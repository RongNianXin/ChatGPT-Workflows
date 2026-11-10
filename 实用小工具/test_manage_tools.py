"""Offline distribution tests; temporary fixtures never use personal tool data."""
import importlib.util
import io
import json
import os
import subprocess
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
module_spec = importlib.util.spec_from_file_location("manage_tools", HERE / "manage_tools.py")
m = importlib.util.module_from_spec(module_spec)
module_spec.loader.exec_module(m)


class DistributionTests(unittest.TestCase):
    def setUp(self):
        parent = HERE.parent / ".planning" / "distribution-tests"
        parent.mkdir(parents=True, exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(prefix="case-", dir=parent)
        self.root = Path(self.temp.name).resolve()
        self.assertTrue(self.root.is_relative_to(parent.resolve()))
        self.directory = self.root / m.TOOLS / "Example"
        self.directory.mkdir(parents=True)
        (self.root / "LICENSE").write_text("Example license\n", encoding="utf-8")
        self.spec = {
            "schemaVersion": 1, "id": "example", "name": "Example",
            "nameEn": "Example", "summary": "Example", "summaryEn": "Example",
            "kind": "package", "version": "1.0.0", "packageRevision": 1,
            "files": [m.TOOLS + "/Example/start.txt"],
            "entrypoints": [m.TOOLS + "/Example/start.txt"],
            "requirements": ["No runtime"], "requirementsEn": ["No runtime"],
            "instructions": ["Read start.txt"], "instructionsEn": ["Read start.txt"],
        }
        (self.directory / "start.txt").write_text("Independent example\n", encoding="utf-8")
        self.receipts = {"schemaVersion": 1, "releases": []}
        self.save()

    def tearDown(self):
        self.temp.cleanup()

    def save(self):
        external = {"schemaVersion": 1, "tools": []}
        declaration = self.directory / "tool.json"
        if self.spec["kind"] == "external":
            external["tools"] = [{**self.spec, "directory": m.TOOLS + "/Example"}]
            if declaration.exists():
                declaration.unlink()
            (self.directory / "README.md").write_text("External pointer\n", encoding="utf-8")
        else:
            declaration.write_bytes(m.encoded(self.spec))
        (self.root / m.TOOLS / "external-tools.json").write_bytes(m.encoded(external))
        (self.root / m.TOOLS / "release-index.json").write_bytes(m.encoded(self.receipts))

    def loaded(self):
        self.save()
        return m.load_tools(self.root)[0]

    def receipt(self, fingerprint, sha="0" * 64):
        return dict(id="example", version="1.0.0", packageRevision=1,
                    tag="tool-example-v1.0.0-r1", asset="example-1.0.0-r1.zip",
                    sha256=sha, sourceFingerprint=fingerprint,
                    sourceCommit="1" * 40, prerelease=False)

    def test_real_inventory_and_complete_member_manifests(self):
        tools = m.load_tools()
        self.assertEqual(len(tools), 6)
        self.assertEqual(sum(s["kind"] == "package" for s in tools), 5)
        m.check_generated(m.ROOT, tools)
        for spec in tools:
            if spec["kind"] == "external":
                with self.assertRaises(ValueError):
                    m.package_members(m.ROOT, spec)
                continue
            members, fingerprint = m.package_members(m.ROOT, spec)
            manifest = json.loads(members["PACKAGE.json"])
            self.assertEqual(manifest["sourceFingerprint"], fingerprint)
            self.assertEqual(set(members) - {"PACKAGE.json"},
                             {row["path"] for row in manifest["files"]})
            for row in manifest["files"]:
                self.assertEqual(row["sha256"], m.digest(members[row["path"]]))
                self.assertEqual(row["bytes"], len(members[row["path"]]))
            self.assertTrue(set(spec["entrypoints"]).issubset(members))
            self.assertFalse(any(p.startswith("总指挥工作流/") for p in members))
            self.assertFalse(any("node_modules" in p for p in members))

    def test_archive_integrity_reproducibility_and_no_overwrite(self):
        spec = self.loaded()
        a = m.build(self.root, spec, self.root / "dist" / "a")
        b = m.build(self.root, spec, self.root / "dist" / "b")
        self.assertEqual(a["sha256"], b["sha256"])
        archive = Path(a["directory"]) / a["asset"]
        with zipfile.ZipFile(archive) as z:
            self.assertIsNone(z.testzip())
            self.assertTrue(all(p.startswith("example/") for p in z.namelist()))
            manifest = json.loads(z.read("example/PACKAGE.json"))
            for row in manifest["files"]:
                self.assertEqual(m.digest(z.read("example/" + row["path"])), row["sha256"])
        original = archive.read_bytes()
        with self.assertRaises(ValueError):
            m.build(self.root, spec, self.root / "dist" / "a")
        self.assertEqual(archive.read_bytes(), original)

    def test_catalog_staleness_and_download_status(self):
        spec = self.loaded()
        for english in (False, True):
            name = "README.en.md" if english else "README.md"
            (self.directory / name).write_text("[Download](" + m.download_page_url(spec, english) + ")", encoding="utf-8")
        for p, data in m.generated(self.root, [spec]).items():
            p.write_bytes(data)
        m.check_generated(self.root, [spec])
        self.assertNotIn("download", m.catalog([spec])["tools"][0])
        (self.root / m.TOOLS / "catalog.json").write_text("{}", encoding="utf-8")
        with self.assertRaises(ValueError):
            m.check_generated(self.root, [spec])

    def test_tool_download_page_receipt_does_not_change_package(self):
        for english in (False, True):
            name = "README.en.md" if english else "README.md"
            url = m.download_page_url({"directory": m.TOOLS + "/Example"}, english)
            (self.directory / name).write_text("[Download](" + url + ")", encoding="utf-8")
            self.spec["files"].append(m.TOOLS + "/Example/" + name)
        spec = self.loaded()
        before_members, fingerprint = m.package_members(self.root, spec)
        unpublished = m.generated(self.root, [spec])
        page = self.directory / "DOWNLOAD.md"
        self.assertTrue(page in unpublished)
        self.assertNotIn(b"/releases/download/", unpublished[page])
        self.receipts["releases"] = [self.receipt(fingerprint)]
        published = self.loaded()
        pages = m.generated(self.root, [published])
        self.assertIn(b"/releases/download/tool-example-v1.0.0-r1/example-1.0.0-r1.zip", pages[page])
        self.assertIn(b"SHA256SUMS.txt", pages[page])
        self.assertNotEqual(unpublished[page], pages[page])
        for p, data in pages.items():
            p.write_bytes(data)
        self.assertEqual(m.package_members(self.root, published), (before_members, fingerprint))

    def test_tool_page_link_required_in_both_readmes(self):
        spec = self.loaded()
        for english in (False, True):
            name = "README.en.md" if english else "README.md"
            (self.directory / name).write_text("[Download](" + m.download_page_url(spec, english) + ")", encoding="utf-8")
        for p, data in m.generated(self.root, [spec]).items():
            p.write_bytes(data)
        m.check_generated(self.root, [spec])
        page = self.directory / "DOWNLOAD.md"
        original = page.read_bytes()
        page.write_text("Incorrect release status\n", encoding="utf-8")
        with self.assertRaises(ValueError):
            m.check_generated(self.root, [spec])
        page.write_bytes(original)
        (self.directory / "README.en.md").write_text("Wrong general catalog link\n", encoding="utf-8")
        with self.assertRaises(ValueError):
            m.check_generated(self.root, [spec])

    def test_dynamic_download_pages_cannot_be_package_inputs(self):
        (self.directory / "DOWNLOAD.md").write_text("Changing release status\n", encoding="utf-8")
        self.spec["files"].append(m.TOOLS + "/Example/DOWNLOAD.md")
        with self.assertRaises(ValueError):
            self.loaded()

    def test_missing_declaration_input_and_entrypoint(self):
        (self.root / m.TOOLS / "Undeclared").mkdir()
        with self.assertRaises(OSError):
            self.loaded()
        (self.root / m.TOOLS / "Undeclared").rmdir()
        self.spec["files"].append(m.TOOLS + "/Example/missing.txt")
        with self.assertRaises(OSError):
            self.loaded()
        self.spec["files"].pop()
        self.spec["entrypoints"] = [m.TOOLS + "/Example/missing.txt"]
        with self.assertRaises(ValueError):
            self.loaded()

    def test_duplicate_id_path_unknown_field_and_json_key(self):
        second = self.root / m.TOOLS / "Second"
        second.mkdir()
        (second / "tool.json").write_bytes(m.encoded(self.spec))
        with self.assertRaises(ValueError):
            self.loaded()
        (second / "tool.json").unlink()
        second.rmdir()
        self.spec["files"] *= 2
        with self.assertRaises(ValueError):
            self.loaded()
        self.spec["files"].pop()
        self.spec["published"] = {}
        with self.assertRaises(ValueError):
            self.loaded()
        self.spec.pop("published")
        self.save()
        (self.directory / "tool.json").write_text('{"id":"a","id":"b"}', encoding="utf-8")
        with self.assertRaises(ValueError):
            m.load_tools(self.root)

    def test_path_aliases_private_inputs_and_cross_tool_sources(self):
        for value in ("../secret", "/secret", "C:/secret", "a\\b", "a//b",
                      "a/./b", "a/../b", ".GIT/config", ".ENV.prod", "a/file.docx",
                      "a/secret.key", "a/NUL.txt", "a/file.", "a/file ", "a/x?"):
            with self.subTest(path=value), self.assertRaises(ValueError):
                m.relative(value)
        self.spec["files"] = [m.TOOLS + "/Other/start.txt"]
        with self.assertRaises(ValueError):
            self.loaded()
        self.spec["files"] = [m.TOOLS + "/Example/start.txt"]
        self.spec["sharedFiles"] = ["AGENTS.md"]
        with self.assertRaises(ValueError):
            self.loaded()

    def test_output_boundary_and_input_byte_preservation(self):
        spec = self.loaded()
        before = {p: p.read_bytes() for p in self.directory.iterdir()}
        for path in (self.root, self.root / m.TOOLS / "output", self.root.parent / "escape"):
            with self.subTest(path=path), self.assertRaises(ValueError):
                m.build(self.root, spec, path)
        m.build(self.root, spec, self.root / ".planning" / "packages")
        self.assertEqual(before, {p: p.read_bytes() for p in self.directory.iterdir()})

    def test_file_size_limit(self):
        oversized = self.directory / "large.bin"
        with oversized.open("wb") as f:
            f.truncate(64 * 1024 * 1024 + 1)
        with self.assertRaises(ValueError):
            m.read_source(self.root, m.TOOLS + "/Example/large.bin")

    def test_receipt_binding_and_no_circular_hash(self):
        spec = self.loaded()
        members, fingerprint = m.package_members(self.root, spec)
        buffer = io.BytesIO()
        m.write_archive(buffer, spec, members)
        sha = m.digest(buffer.getvalue())
        self.receipts["releases"] = [self.receipt(fingerprint, sha)]
        published = self.loaded()
        self.assertEqual(m.package_members(self.root, published), (members, fingerprint))
        self.assertIn("/releases/download/tool-example-v1.0.0-r1/",
                      m.catalog([published])["tools"][0]["download"])
        result = m.build(self.root, published, self.root / "dist")
        self.assertEqual(result["sha256"], sha)
        (self.directory / "start.txt").write_text("Changed\n", encoding="utf-8")
        with self.assertRaises(ValueError):
            m.build(self.root, self.loaded(), self.root / "dist" / "changed")

    def test_invalid_receipts_and_false_archive_checksum(self):
        _, fingerprint = m.package_members(self.root, self.loaded())
        self.receipts["releases"] = [self.receipt(fingerprint)]
        with self.assertRaises(ValueError):
            m.build(self.root, self.loaded(), self.root / "dist")
        self.receipts["releases"][0]["id"] = "missing-tool"
        with self.assertRaises(ValueError):
            self.loaded()
        self.receipts["releases"] = [self.receipt(fingerprint)] * 2
        with self.assertRaises(ValueError):
            self.loaded()

    def test_external_pointer_does_not_create_a_package(self):
        self.spec = {k: v for k, v in self.spec.items() if k in m.COMMON_FIELDS}
        self.spec.update(kind="external", repository="https://github.com/example/tool")
        (self.directory / "start.txt").unlink()
        spec = self.loaded()
        with self.assertRaises(ValueError):
            m.build(self.root, spec, self.root / "dist")
        self.assertFalse((self.root / "dist").exists())

    def test_office_formats_rejected_and_public_sources_allowed(self):
        for suffix in (".xlsx", ".pptx", ".xlsm", ".wps", ".docm", ".dotx",
                       ".xltm", ".pptm", ".ppsm", ".dps", ".et", ".odt"):
            with self.subTest(suffix=suffix), self.assertRaises(ValueError):
                m.relative(m.TOOLS + "/Example/input" + suffix)
        for suffix in (".mjs", ".py", ".ps1", ".cmd", ".html", ".css", ".json", ".png"):
            self.assertEqual(m.relative(m.TOOLS + "/Example/public" + suffix).suffix, suffix)

    def test_migration_keeps_historical_receipts_and_pointer_isolation(self):
        _, fingerprint = m.package_members(self.root, self.loaded())
        self.receipts["releases"] = [self.receipt(fingerprint)]
        self.spec = {k: v for k, v in self.spec.items() if k in m.COMMON_FIELDS}
        self.spec.update(kind="external", repository="https://github.com/example/tool")
        with self.assertRaises(ValueError):
            self.loaded()
        self.assertEqual({p.name for p in self.directory.iterdir()}, {"README.md", "start.txt"})
        # A migrated pointer may not keep local product files.
        (self.directory / "start.txt").unlink()
        spec = self.loaded()
        self.assertEqual(spec["kind"], "external")
        self.assertNotIn("published", spec)
        self.assertNotIn("download", m.catalog([spec])["tools"][0])
        (self.directory / "stray.py").write_text("pass\n", encoding="utf-8")
        with self.assertRaises(ValueError):
            m.load_tools(self.root)

    def test_generated_cache_is_not_mistaken_for_a_new_tool(self):
        (self.root / m.TOOLS / "__pycache__").mkdir()
        self.assertEqual(self.loaded()["id"], "example")

    def test_changed_file_while_collecting_sources(self):
        spec = self.loaded()
        read = m.read_source
        changed = False

        def concurrent_edit(root, value):
            nonlocal changed
            data = read(root, value)
            if value == "LICENSE" and not changed:
                (self.directory / "start.txt").write_text("Concurrent edit\n", encoding="utf-8")
                changed = True
            return data

        with patch.object(m, "read_source", side_effect=concurrent_edit):
            with self.assertRaises(ValueError):
                m.package_members(self.root, spec)

    def test_real_link_or_windows_junction_rejected(self):
        spec = self.loaded()
        target = self.root / ".planning" / "target"
        target.mkdir(parents=True)
        link = self.root / m.TOOLS / "Linked"

        def create_link(path):
            if os.name == "nt":
                env = dict(os.environ, DISTRIBUTION_TEST_LINK=str(path),
                           DISTRIBUTION_TEST_TARGET=str(target))
                run = subprocess.run(
                    ["powershell", "-NoProfile", "-NonInteractive", "-Command",
                     "$ErrorActionPreference='Stop'; New-Item -ItemType Junction "
                     "-Path $env:DISTRIBUTION_TEST_LINK -Target $env:DISTRIBUTION_TEST_TARGET | Out-Null"],
                    env=env, capture_output=True, timeout=20)
                self.assertEqual(run.returncode, 0, run.stderr.decode(errors="replace"))
            else:
                path.symlink_to(target, target_is_directory=True)

        create_link(link)
        try:
            with self.assertRaises(ValueError):
                self.loaded()
        finally:
            if os.name == "nt":
                os.rmdir(link)
            else:
                link.unlink()
        (self.root / "dist").mkdir()
        link = self.root / "dist" / "Linked"
        create_link(link)
        try:
            with self.assertRaises(ValueError):
                m.build(self.root, spec, link)
            self.assertEqual(list(target.iterdir()), [])
        finally:
            if os.name == "nt":
                os.rmdir(link)
            else:
                link.unlink()


if __name__ == "__main__":
    unittest.main(verbosity=2)
