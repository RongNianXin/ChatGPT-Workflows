"""Validate utility declarations and build independent, offline ZIP packages."""
import argparse
import hashlib
import json
import os
import re
import stat
import sys
import zipfile
from pathlib import Path, PurePosixPath
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent.parent
TOOLS = "实用小工具"
REPOSITORY = "https://github.com/RongNianXin/ChatGPT-Workflows"
SCHEMA = 1
ID = re.compile(r"[a-z][a-z0-9]*(?:-[a-z0-9]+)*\Z")
VERSION = re.compile(r"\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?\Z")
PRIVATE = {".git", ".local", ".planning", ".codex-manual-cache", "node_modules",
           "dist", "build", "__pycache__", "其他资料", "全局提示词（严禁AI自动修改）"}
PRIVATE_FOLDED = {p.casefold() for p in PRIVATE}
DENIED_SUFFIXES = {
    ".doc", ".docx", ".docm", ".dot", ".dotx", ".dotm",
    ".xls", ".xlsx", ".xlsm", ".xlsb", ".xlt", ".xltx", ".xltm", ".xlam",
    ".ppt", ".pptx", ".pptm", ".pot", ".potx", ".potm", ".pps", ".ppsx", ".ppsm",
    ".wps", ".wpt", ".et", ".ett", ".dps", ".dpt", ".odt", ".ods", ".odp",
    ".lnk", ".pem", ".key", ".p12", ".pfx", ".log",
}
COMMON_FIELDS = {"schemaVersion", "id", "name", "nameEn", "summary", "summaryEn", "kind"}
PACKAGE_FIELDS = {"version", "packageRevision", "files", "sharedFiles", "entrypoints",
                  "requirements", "requirementsEn", "instructions", "instructionsEn"}


def encoded(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def digest(value):
    return hashlib.sha256(value).hexdigest()


def relative(value):
    if not isinstance(value, str) or not value or "\\" in value or ":" in value:
        raise ValueError("Use an explicit repository-relative POSIX file path")
    p = PurePosixPath(value)
    if p.is_absolute() or any(x in {"", ".", ".."} for x in value.split("/")):
        raise ValueError("Absolute, empty and traversal paths are forbidden")
    if any(x.casefold() in PRIVATE_FOLDED or x.casefold().startswith(".env") or
           x.startswith("~$") or x.endswith((" ", ".")) or
           re.search(r'[<>"|?*\x00-\x1f]', x) or
           re.fullmatch(r"(?i)(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\..*)?", x)
           for x in p.parts):
        raise ValueError("Private or generated paths cannot be distributed")
    if p.suffix.lower() in DENIED_SUFFIXES:
        raise ValueError("Office sources, shortcuts, secrets and logs are not package inputs")
    return p


def ordinary(root, value):
    p = root.joinpath(*relative(value).parts)
    root_info = root.lstat()
    if stat.S_ISLNK(root_info.st_mode) or getattr(root_info, "st_file_attributes", 0) & 0x400:
        raise ValueError("Linked repository root")
    current = root
    for part in p.relative_to(root).parts:
        current = current / part
        info = current.lstat()
        if stat.S_ISLNK(info.st_mode) or getattr(info, "st_file_attributes", 0) & 0x400:
            raise ValueError("Links and reparse points are forbidden: " + value)
    if not stat.S_ISREG(info.st_mode):
        raise ValueError("Only explicit regular files may be packaged: " + value)
    if info.st_size > 64 * 1024 * 1024:
        raise ValueError("Package member exceeds the 64 MiB safety limit")
    return p


def read_source(root, value):
    p = ordinary(root, value)
    before = p.stat()
    with p.open("rb") as stream:
        opened = os.fstat(stream.fileno())
        if (before.st_dev, before.st_ino) != (opened.st_dev, opened.st_ino):
            raise ValueError("Source changed while opening: " + value)
        data = stream.read(64 * 1024 * 1024 + 1)
        if len(data) > 64 * 1024 * 1024:
            raise ValueError("Package member grew beyond the 64 MiB safety limit")
        after_open = os.fstat(stream.fileno())
    after = ordinary(root, value).stat()
    signature = lambda s: (s.st_dev, s.st_ino, s.st_size, s.st_mtime_ns)
    if signature(before) != signature(after_open) or signature(before) != signature(after):
        raise ValueError("Source changed during the read: " + value)
    return data


def read_json(root, source):
    def unique_pairs(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError("Duplicate JSON key: " + key)
            result[key] = value
        return result
    result = json.loads(read_source(root, source), object_pairs_hook=unique_pairs)
    if not isinstance(result, dict):
        raise ValueError("JSON object required: " + source)
    return result


def load_tools(root=ROOT):
    directory = root / TOOLS
    if directory.is_symlink() or getattr(directory.lstat(), "st_file_attributes", 0) & 0x400:
        raise ValueError("Linked utilities root")
    declarations = []
    seen = set()
    external = read_json(root, f"{TOOLS}/external-tools.json")
    if set(external) != {"schemaVersion", "tools"} or type(external.get("schemaVersion")) is not int or external["schemaVersion"] != SCHEMA or not isinstance(external["tools"], list):
        raise ValueError("Invalid external utility index")
    pointers = {}
    for row in external["tools"]:
        if not isinstance(row, dict) or row.get("kind") != "external":
            raise ValueError("External index entries must be external pointers")
        directory_ref = row.get("directory")
        p = relative(directory_ref)
        if len(p.parts) != 2 or p.parts[0] != TOOLS or directory_ref in pointers:
            raise ValueError("Invalid or duplicate external pointer directory")
        pointers[directory_ref] = {k: v for k, v in row.items() if k != "directory"}
    consumed = set()
    for child in sorted(directory.iterdir(), key=lambda p: p.name):
        if child.name.casefold() in PRIVATE_FOLDED:
            continue
        if not child.is_dir():
            continue
        if child.is_symlink() or getattr(child.lstat(), "st_file_attributes", 0) & 0x400:
            raise ValueError("Linked utility directory")
        directory_ref = f"{TOOLS}/{child.name}"
        if directory_ref in pointers:
            if {p.name for p in child.iterdir()} != {"README.md"}:
                raise ValueError("External pointer directories may contain only README.md")
            ordinary(root, directory_ref + "/README.md")
            spec = dict(pointers[directory_ref])
            source = f"{TOOLS}/external-tools.json"
            consumed.add(directory_ref)
        else:
            source = directory_ref + "/tool.json"
            spec = read_json(root, source)
            if spec.get("kind") == "external":
                raise ValueError("Keep external declarations in external-tools.json")
        if type(spec.get("schemaVersion")) is not int or spec["schemaVersion"] != SCHEMA or not isinstance(spec.get("id"), str) or not ID.fullmatch(spec["id"]):
            raise ValueError("Invalid utility schema or ID: " + source)
        if spec["id"] in seen:
            raise ValueError("Duplicate utility ID: " + spec["id"])
        seen.add(spec["id"])
        for key in ("name", "nameEn", "summary", "summaryEn"):
            if not isinstance(spec.get(key), str) or not spec[key].strip():
                raise ValueError("Missing display text: " + key)
        kind = spec.get("kind")
        allowed = COMMON_FIELDS | (PACKAGE_FIELDS if kind == "package" else {"repository"})
        if set(spec) - allowed:
            raise ValueError("Unknown declaration fields: " + source)
        spec["directory"] = directory_ref
        spec["declaration"] = source
        if kind == "external":
            if not isinstance(spec.get("repository"), str) or not re.fullmatch(r"https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", spec["repository"]):
                raise ValueError("External utilities require an explicit GitHub repository")
            if any(k in spec for k in ("files", "sharedFiles", "version", "entrypoints")):
                raise ValueError("External pointers must not pretend to be local packages")
        elif kind == "package":
            if not isinstance(spec.get("version"), str) or not VERSION.fullmatch(spec["version"]):
                raise ValueError("Invalid distribution version")
            if type(spec.get("packageRevision")) is not int or spec["packageRevision"] < 1:
                raise ValueError("Invalid package revision")
            for key in ("files", "entrypoints", "requirements", "requirementsEn", "instructions", "instructionsEn"):
                if not isinstance(spec.get(key), list) or not spec[key] or any(not isinstance(x, str) or not x for x in spec[key]):
                    raise ValueError("Missing nonempty string list: " + key)
            shared = spec.get("sharedFiles", [])
            if not isinstance(shared, list) or any(not isinstance(x, str) for x in shared):
                raise ValueError("Invalid shared files")
            files = spec["files"] + shared + [source]
            if len({x.casefold() for x in files}) != len(files):
                raise ValueError("Duplicate or case-colliding source paths")
            for value in spec["files"]:
                relative(value)
                if not value.startswith(spec["directory"] + "/"):
                    raise ValueError("A utility cannot take another utility's files")
                if PurePosixPath(value).name in {"DOWNLOAD.md", "DOWNLOAD.en.md"}:
                    raise ValueError("Generated download status must remain outside packages")
            for value in shared:
                p = relative(value)
                if not value.startswith(".github/scripts/") or p.suffix not in {".mjs", ".py", ".ps1", ".cjs", ".js"}:
                    raise ValueError("Shared inputs must be explicit public script files")
            for value in files:
                ordinary(root, value)
            if any(p not in files for p in spec["entrypoints"]):
                raise ValueError("Entrypoint missing from package inputs")
        else:
            raise ValueError("Unknown utility kind")
        declarations.append(spec)
    if consumed != set(pointers):
        raise ValueError("External pointer directory is missing")
    receipts = read_json(root, f"{TOOLS}/release-index.json")
    if set(receipts) != {"schemaVersion", "releases"} or type(receipts.get("schemaVersion")) is not int or receipts["schemaVersion"] != SCHEMA or not isinstance(receipts.get("releases"), list):
        raise ValueError("Invalid release index")
    releases_seen = set()
    registered_ids = {s["id"] for s in declarations}
    for row in receipts["releases"]:
        if not isinstance(row, dict) or set(row) != {"id", "version", "packageRevision", "tag", "asset", "sha256",
                        "sourceFingerprint", "sourceCommit", "prerelease"}:
            raise ValueError("Incomplete immutable publication receipt")
        if not isinstance(row["id"], str) or row["id"] not in registered_ids or not isinstance(row["version"], str) or not VERSION.fullmatch(row["version"]):
            raise ValueError("Invalid release identity")
        if type(row["packageRevision"]) is not int or row["packageRevision"] < 1:
            raise ValueError("Invalid published package revision")
        if row["tag"] != tag(row) or row["asset"] != asset(row) or row["tag"] in releases_seen:
            raise ValueError("Mismatched or duplicate release tag")
        if any(not isinstance(row[k], str) or not re.fullmatch(r"[a-f0-9]{64}", row[k]) for k in ("sha256", "sourceFingerprint")):
            raise ValueError("Invalid release checksum")
        if not isinstance(row["sourceCommit"], str) or not re.fullmatch(r"[a-f0-9]{40}", row["sourceCommit"]) or type(row["prerelease"]) is not bool:
            raise ValueError("Release source commit and maturity must be explicit")
        releases_seen.add(row["tag"])
    for spec in declarations:
        if spec["kind"] == "package":
            spec["published"] = next((r for r in receipts["releases"]
                                      if r["tag"] == tag(spec)), None)
    return sorted(declarations, key=lambda x: x["id"])


def tag(spec):
    return f"tool-{spec['id']}-v{spec['version']}-r{spec['packageRevision']}"


def asset(spec):
    return f"{spec['id']}-{spec['version']}-r{spec['packageRevision']}.zip"


def download_page_url(spec, english=False):
    name = "DOWNLOAD.en.md" if english else "DOWNLOAD.md"
    return f"{REPOSITORY}/blob/main/{quote(spec['directory'], safe='/')}/{name}"


def catalog(tools):
    rows = []
    for spec in tools:
        row = {k: spec[k] for k in ("id", "name", "nameEn", "summary", "summaryEn", "kind", "directory")}
        if spec["kind"] == "external":
            row["repository"] = spec["repository"]
        else:
            row.update(version=spec["version"], packageRevision=spec["packageRevision"],
                       asset=asset(spec), tag=tag(spec), requirements=spec["requirements"],
                       requirementsEn=spec["requirementsEn"], published=spec.get("published"),
                       downloadPage=download_page_url(spec),
                       downloadPageEn=download_page_url(spec, True))
            if row["published"]:
                row["download"] = f"{REPOSITORY}/releases/download/{quote(tag(spec), safe='')}/{asset(spec)}"
        rows.append(row)
    return {"schemaVersion": SCHEMA, "tools": rows}


def render_download(spec, english=False):
    name = spec["nameEn"] if english else spec["name"]
    readme = "README.en.md" if english else "README.md"
    lines = [f"# {name}" + (": download and start" if english else "：下载与启动"), "",
             "[中文](DOWNLOAD.md)" if english else "[English](DOWNLOAD.en.md)", "",
             spec["summaryEn" if english else "summary"], "",
             f"[{'Full usage and limitations' if english else '完整使用说明与限制'}]({readme})", "",
             f"{'Distribution version: ' if english else '独立分发版本：'}{spec['version']} / r{spec['packageRevision']}", "",
             "## Download" if english else "## 下载"]
    receipt = spec.get("published")
    if receipt:
        base = f"{REPOSITORY}/releases/download/{quote(tag(spec), safe='')}/"
        release = f"{REPOSITORY}/releases/tag/{quote(tag(spec), safe='')}"
        lines += ["", f"[{'Download this tool ZIP' if english else '下载本工具ZIP'}]({base}{asset(spec)})",
                  f" · [SHA256SUMS.txt]({base}SHA256SUMS.txt)",
                  f" · [{'Release notes' if english else '版本说明'}]({release})", "",
                  ("Development preview." if receipt["prerelease"] else "Published package.")
                  if english else ("开发预览版。" if receipt["prerelease"] else "已发布包。"),
                  f"ZIP SHA-256: `{receipt['sha256']}`"]
    else:
        lines += ["", ("This version of the standalone package has not been published; no ZIP download is available here yet."
                       if english else "这一版本的独立包尚未发布，当前没有可用的ZIP下载入口。"),
                  ("You can read the usage guide now. Any older download listed there is a separate release."
                   if english else "可以先阅读使用说明；说明中如有旧版下载，它属于另一条历史发布。")]
    lines += ["", ("Once a download is available, extract the entire ZIP to a permanent folder and read START-HERE.en.md."
                   if english else "取得ZIP后完整解压到稳定目录，先看包根的START-HERE.md。"),
              ("No repository clone or other tool is required. Keep the package layout intact; GitHub's Source code archive is the whole repository."
               if english else "无需克隆整个仓库或安装其他工具。保留包内目录结构；GitHub的Source code附件是整个仓库源码。"),
              "", "## Requirements" if english else "## 运行环境", ""]
    lines.extend("- " + text for text in spec["requirementsEn" if english else "requirements"])
    lines += ["", "## Start" if english else "## 启动", ""]
    lines.extend(f"{i}. {text}" for i, text in enumerate(spec["instructionsEn" if english else "instructions"], 1))
    lines += ["", "## Updates and help" if english else "## 更新与求助",
              "", ("Return to this tool's download page to check its version and release notes. Updates are manual."
                   if english else "回到本工具的下载页核对版本和发布说明，更新需手动取得新版文件。"),
              (f"Follow the [{name} guide]({readme}) for tool-specific update and data-preservation steps."
               if english else f"具体升级和数据保留方法见[{name}使用说明]({readme})。"),
              ("For failures, report the tool and package version, OS, runtime/browser and redacted error text. Do not send credentials or private task data."
               if english else "报错时提供工具/包版本、系统、运行环境或浏览器，以及脱敏错误文字；不要发送凭据或私有任务数据。"),
              "", "## For maintainers" if english else "## 仅供维护者",
              "", f'`python -B "实用小工具/manage_tools.py" build {spec["id"]}`',
              "", ("Run from a source checkout to create a local package; this does not publish it. Ordinary users do not need this command."
                   if english else "在源码仓库根运行可生成本地包，不会发布。普通使用者无需执行此命令。"), ""]
    return "\n".join(lines).encode("utf-8")


def render_readme(tools, english=False):
    lines = (["# Independent local utilities", "", "[中文](README.md)", "",
              "Download one utility; the other utilities and commander workflow are not runtime dependencies.",
              "The table distinguishes published downloads from packages currently available only to local maintainers.", "",
              "| Utility | Version / kind | Download status |", "| --- | --- | --- |"]
             if english else
             ["# 可独立使用的实用小工具", "", "[English](README.en.md)", "",
              "只下载需要的工具即可，不需要其他工具或总指挥工作流作为运行依赖。",
              "下表严格区分已发布下载与目前仅在维护者本地生成的独立包。", "",
              "| 工具 | 版本或类型 | 下载状态 |", "| --- | --- | --- |"])
    for spec in catalog(tools)["tools"]:
        name = spec["nameEn"] if english else spec["name"]
        link = quote(spec["directory"].split("/", 1)[1], safe="") + "/README" + (".en" if english and spec["kind"] != "external" else "") + ".md"
        if spec["kind"] == "external":
            version = "External repository" if english else "独立仓库"
            state = f"[{'Open repository' if english else '前往独立仓库'}]({spec['repository']})"
        else:
            version = f"{spec['version']} / r{spec['packageRevision']}"
            state = (f"[{'Download ZIP' if english else '下载ZIP'}]({spec['download']})"
                     if spec.get("download") else ("Local package ready; not published" if english else "可在本地打包，尚未发布此独立包"))
            state += f" · [{'Tool download page' if english else '本工具下载页'}]({spec['downloadPageEn' if english else 'downloadPage']})"
        lines.append(f"| [{name}]({link}) | {version} | {state} |")
    lines += (["", "Each ZIP includes its own required files, license, start guide and per-file checksums.",
               "A runtime such as a browser, PowerShell, Node.js, Python or an existing Codex installation may still be required; see the tool's requirements.",
               "A source ZIP is not an app-store installation or a signed installer. The new package series does not replace existing releases.",
               "", "Maintainers: see [distribution architecture](DISTRIBUTION.en.md).",
               "Run `python -B manage_tools.py list`, `python -B manage_tools.py check`, or `python -B manage_tools.py build zhihu-export` from this directory.",
               "These commands do not publish releases, install dependencies, stop applications or start the tools.", ""]
              if english else
              ["", "每个ZIP都带齐自身所需文件、许可证、启动说明和逐文件校验清单。",
               "独立不等于不需要运行环境：浏览器、PowerShell、Node、Python或已安装Codex等要求，按工具分别说明。",
               "源码ZIP不等于商店安装或签名安装器；新的统一包系列不覆盖既有Release。",
               "", "维护者见[独立分发架构](DISTRIBUTION.md)。",
               "在本目录运行 `python -B manage_tools.py list`、`python -B manage_tools.py check`，或 `python -B manage_tools.py build zhihu-export`。",
               "这些命令不发布Release、不安装依赖、不退出应用，也不启动工具本身。", ""])
    return "\n".join(lines).encode("utf-8")


def generated(root, tools):
    chinese = render_readme(tools)
    english = render_readme(tools, True) + f"\n<!-- README-SOURCE-SHA256: {digest(chinese)} -->\n".encode("ascii")
    result = {root / TOOLS / "catalog.json": encoded(catalog(tools)),
              root / TOOLS / "README.md": chinese,
              root / TOOLS / "README.en.md": english}
    for spec in tools:
        if spec["kind"] == "package":
            chinese = render_download(spec)
            english = render_download(spec, True) + f"\n<!-- README-SOURCE-SHA256: {digest(chinese)} -->\n".encode("ascii")
            result[root / spec["directory"] / "DOWNLOAD.md"] = chinese
            result[root / spec["directory"] / "DOWNLOAD.en.md"] = english
    return result


def check_generated(root, tools):
    for file, expected in generated(root, tools).items():
        value = file.relative_to(root).as_posix()
        if read_source(root, value).replace(b"\r\n", b"\n") != expected:
            raise ValueError("Generated page is stale: " + value + "; run catalog")
    for spec in tools:
        if spec["kind"] == "package":
            for english in (False, True):
                name = "README.en.md" if english else "README.md"
                text = read_source(root, spec["directory"] + "/" + name).decode("utf-8")
                if "](" + download_page_url(spec, english) + ")" not in text:
                    raise ValueError("Tool README needs its own download-page link: " + spec["directory"] + "/" + name)


def package_members(root, spec):
    if spec["kind"] != "package":
        raise ValueError("External pointers cannot be packaged; use their own repository")
    declared = read_json(root, spec["declaration"])
    expected = {k: v for k, v in spec.items() if k in COMMON_FIELDS | PACKAGE_FIELDS}
    if declared != expected:
        raise ValueError("Declaration changed after loading; reload before packaging")
    members = {}
    total = 0
    for p in spec["files"] + spec.get("sharedFiles", []) + [spec["declaration"]]:
        data = read_source(root, p)
        total += len(data)
        if total > 512 * 1024 * 1024:
            raise ValueError("Package exceeds the 512 MiB safety limit")
        members[p] = data
    members["LICENSE"] = read_source(root, "LICENSE")
    # Catch an input modified after its own read while other members were read.
    for name, data in members.items():
        if read_source(root, name) != data:
            raise ValueError("Package sources changed; retry after edits stop: " + name)
    for english, name in ((False, "START-HERE.md"), (True, "START-HERE.en.md")):
        text = [f"# {spec['nameEn'] if english else spec['name']}", "",
                f"Package: {spec['version']} / revision {spec['packageRevision']}", "",
                ("Extract the entire ZIP to a permanent folder. No clone of ChatGPT Workflows is required."
                 if english else "完整解压到稳定目录，不需要克隆ChatGPT Workflows，也不需要安装其他工具。"),
                ("The small original directory layout is retained so relative script paths and private state stay inside this package."
                 if english else "包内保留最小原相对目录，确保脚本引用和私有状态仍位于本包内。"),
                "", "## Requirements" if english else "## 运行环境"]
        text.extend("- " + x for x in spec["requirementsEn" if english else "requirements"])
        text += ["", "## Start" if english else "## 启动"]
        text.extend(f"{i}. {x}" for i, x in enumerate(spec["instructionsEn" if english else "instructions"], 1))
        text += ["", ("All commands are examples; packaging does not execute them."
                      if english else "命令是使用示例，打包时不会执行。"),
                 ("Maintenance links in source documentation may refer to the full upstream repository."
                  if english else "源码说明中的维护链接可能指向完整上游仓库，不是本工具的运行依赖。"),
                 f"Source: {REPOSITORY}/tree/main/{quote(spec['directory'], safe='/')}", ""]
        members[name] = "\n".join(text).encode("utf-8")
    if sum(len(v) for v in members.values()) > 512 * 1024 * 1024:
        raise ValueError("Package exceeds the 512 MiB safety limit")
    rows = [{"path": p, "bytes": len(b), "sha256": digest(b)} for p, b in sorted(members.items())]
    fingerprint = digest(encoded({"id": spec["id"], "version": spec["version"],
                                 "packageRevision": spec["packageRevision"],
                                 "entrypoints": spec["entrypoints"], "files": rows}))
    members["PACKAGE.json"] = encoded({"schemaVersion": SCHEMA, "id": spec["id"],
                                      "version": spec["version"], "packageRevision": spec["packageRevision"],
                                      "sourceKind": "working-tree-byte-snapshot", "sourceFingerprint": fingerprint,
                                      "entrypoints": spec["entrypoints"], "files": rows,
                                      "note": "This manifest excludes itself. Published status is not implied."})
    return members, fingerprint


def output_directory(root, output, spec):
    base = Path(os.path.abspath(output))
    rel = base.relative_to(root)
    if not rel.parts or rel.parts[0] not in {"dist", ".planning"}:
        raise ValueError("Output must be under this checkout's dist/ or .planning/")
    destination = base / spec["id"] / f"{spec['version']}-r{spec['packageRevision']}"
    current = root
    for part in destination.relative_to(root).parts:
        current /= part
        if current.exists() or current.is_symlink():
            info = current.lstat()
            if not stat.S_ISDIR(info.st_mode) or stat.S_ISLNK(info.st_mode) or getattr(info, "st_file_attributes", 0) & 0x400:
                raise ValueError("Linked or non-directory output component")
    if destination.exists() or destination.is_symlink():
        raise ValueError("Package revision already exists; no overwrite is allowed")
    destination.mkdir(parents=True, exist_ok=False)
    # Verify all newly created components before creating any archive.
    current = root
    for part in destination.relative_to(root).parts:
        current /= part
        info = current.lstat()
        if stat.S_ISLNK(info.st_mode) or getattr(info, "st_file_attributes", 0) & 0x400:
            raise ValueError("Output path changed to a link")
    return destination


def write_archive(stream, spec, members):
    with zipfile.ZipFile(stream, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for name, data in sorted(members.items()):
            info = zipfile.ZipInfo(spec["id"] + "/" + name, date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            z.writestr(info, data)


def build(root, spec, output):
    members, fingerprint = package_members(root, spec)
    if spec.get("published") and spec["published"]["sourceFingerprint"] != fingerprint:
        raise ValueError("Published sources changed; use a new version or package revision")
    folder = output_directory(root, output, spec)
    archive = folder / asset(spec)
    with archive.open("xb") as stream:
        write_archive(stream, spec, members)
    archive_sha = digest(archive.read_bytes())
    if spec.get("published") and spec["published"]["sha256"] != archive_sha:
        raise ValueError("Published archive checksum differs; retained local build is not a verified release")
    (folder / "SHA256SUMS.txt").write_text(f"{archive_sha}  {archive.name}\n", encoding="ascii")
    report = {"id": spec["id"], "version": spec["version"], "packageRevision": spec["packageRevision"],
              "asset": archive.name, "sha256": archive_sha, "sourceFingerprint": fingerprint,
              "members": len(members), "tag": tag(spec), "published": False}
    (folder / "build-report.json").write_bytes(encoded(report))
    return {**report, "directory": str(folder)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("list", "check", "catalog", "build"))
    parser.add_argument("tool", nargs="?")
    parser.add_argument("--output", type=Path, default=ROOT / "dist" / "tools")
    args = parser.parse_args()
    tools = load_tools()
    if args.command == "catalog":
        pages = generated(ROOT, tools)
        for file, contents in pages.items():
            if file.is_symlink() or (file.exists() and getattr(file.lstat(), "st_file_attributes", 0) & 0x400):
                raise ValueError("Linked generated catalog")
            file.write_bytes(contents)
        result = {"result": "PASS", "generated": len(pages)}
    elif args.command == "build":
        spec = next((t for t in tools if t["id"] == args.tool), None)
        if not spec:
            raise ValueError("Choose one registered tool ID")
        check_generated(ROOT, tools)
        result = build(ROOT, spec, args.output)
    elif args.command == "check":
        check_generated(ROOT, tools)
        for spec in tools:
            if spec["kind"] == "package":
                _, fingerprint = package_members(ROOT, spec)
                if spec.get("published") and spec["published"]["sourceFingerprint"] != fingerprint:
                    raise ValueError("Published package source changed; increment its version or package revision")
        result = {"result": "PASS", "tools": len(tools),
                  "packages": sum(t["kind"] == "package" for t in tools), "network": "NONE"}
    else:
        result = catalog(tools)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, KeyError, json.JSONDecodeError) as error:
        print("ERROR: " + str(error), file=sys.stderr)
        sys.exit(1)
