# Independent utility distribution

[中文](DISTRIBUTION.md)

## For users

Choose one entry in the [utility catalog](README.en.md), download its ZIP, extract the entire archive and follow `START-HERE.en.md` at the package root. No repository clone or other utility is required. A missing download link means that this package series has not been published. GitHub's automatically generated repository source ZIP is not a single-tool package.

Packages retain a small original relative layout, such as `实用小工具/Markdown阅读器/index.html`. Other utilities and the commander workflow are not included. Keep the extracted directory intact instead of moving individual launch scripts.

Independence does not remove runtime requirements. The Zhihu helper and reader need a browser; the session desk needs Windows and existing Codex data; the locator needs Node and Python; the guard needs an existing Codex CLI and an authorized task. See each package's start guide. Nothing is installed or authenticated automatically.

Use a system SHA-256 tool to compare the ZIP with `SHA256SUMS.txt` on the same release page. A checksum detects file changes; it is not an identity signature. `PACKAGE.json` lists every other member's path, size and checksum. It excludes its own checksum.

## Maintenance interface and ownership

Sources remain in their existing utility directories, with independent runtime behavior. Local packages use their own `tool.json`. Migrated tools are registered in `external-tools.json` here, while their pointer directories retain only a README. The shared [manage_tools.py](manage_tools.py) validates declarations, generates the catalog and creates archives. It does not run utilities, access session data, use the network, stop services or publish releases.

| File | Responsibility |
| --- | --- |
| `<utility>/tool.json` | Stable ID, distribution version, package revision, explicit file allowlist, entrypoints, requirements and steps |
| `external-tools.json` | Stable IDs, pointer directories and repositories for external tools; no product files in pointer directories |
| `release-index.json` | Maintainer-verified publication receipts, separate from package declarations to avoid circular checksums |
| `catalog.json` and the bilingual README files here | Generated current catalog; do not edit manually or use the repository-wide latest release as every tool's version |
| `<utility>/DOWNLOAD.md` and `DOWNLOAD.en.md` | Generated tool-specific download, requirements and start pages; live status stays outside packages and fixed delivery manifests |
| `dist/tools/<id>/<version>-r<revision>/` | Generated ZIP, SHA256SUMS and build-report; excluded from Git |

From the repository root, or with the script's actual path from another directory:

```powershell
python -B "实用小工具/manage_tools.py" list
python -B "实用小工具/manage_tools.py" catalog
python -B "实用小工具/manage_tools.py" check
python -B "实用小工具/test_manage_tools.py"
python -B "实用小工具/manage_tools.py" build zhihu-export
```

Packaging needs only the Python 3 standard library. `check` validates local declarations, generated files and registered fingerprints. It does not verify live GitHub releases, application behavior or security. `build` creates a new directory for one tool and refuses to overwrite it. Use another output parent to test an unpublished candidate after edits. Published packages require a new version or revision.

## Standalone tool pages

This contract applies only to utilities. A public answer can link directly to a tool directory or its README, without requiring readers to visit the repository homepage or understand the commander workflow. Each guide covers purpose and use cases, limitations, runtime requirements, its own download entry, installation and first successful result, updates and redacted error reporting. Explain personal-data handling and service shutdown where applicable.

Each README links near the top to its own DOWNLOAD page. Readers can understand the tool in its guide and get the ZIP from that tool's download page, without searching the aggregate catalog. Show the exact current version and asset after publication, or an honest unpublished status. Migrated tools retain a clear pointer to their independent project, which owns its documentation and distribution; do not copy the product back here.

Download pages are generated from the existing tool declarations and publication receipts, without a separate release script for each tool. They are excluded from ZIPs. The bundled full guide links to the stable upstream download page; offline startup still uses START-HERE and the bundled README. Adding a receipt updates only pages outside the package and leaves published ZIP fingerprints unchanged. `check` validates generated pages and each bilingual README's tool-specific download link, and rejects dynamic download pages in package allowlists. Zhihu's fixed-delivery verifier exempts only these two root-level generated pages; other unexpected files still fail.

## Adding, updating and retiring tools

1. Verify that the tool runs independently. Document entrypoints, dependencies, state locations and licenses. Add `tool.json` in its direct directory with an explicit public file list. Do not recursively copy personal data, Office originals, secrets, dependency caches or runtime records.
2. `files` stays inside that tool. List necessary public scripts individually in `sharedFiles`; they are copied into the same ZIP, so runtime never fetches them from the repository. Include third-party licenses. Register migrated tools in `external-tools.json` using `kind: external`, `directory` and their repository URL, instead of an empty ZIP. Their directories may contain only README.md.
3. Update application versions under the tool's own policy. Increment `packageRevision` when only package layout, documentation or dependencies change. A tool without an application version may use a separate distribution version, clearly labeled as such.
4. Run `catalog`, `check` and distribution tests. Extract the ZIP away from the source checkout and verify entrypoints and affected behavior using authorized data only. Record synthetic checks separately from live acceptance.
5. Before publication, freeze sources, record the source commit, run repository validation and privacy checks, and obtain remote approval for the target, versions and assets. Publication is never a packaging side effect.
6. On retirement, retain the stable ID, last available version and replacement pointer. Apply the existing preservation rules to historical assets. A retired tool does not block others. Do not reuse published IDs or overwrite old assets.

A direct utility directory without a local declaration or registered external pointer fails validation. Known private state and generated directories are not read as new tools. The machine-readable catalog is keyed by stable IDs and display pages are generated. Growing to hundreds of tools does not require hundreds of publication scripts or CI workflows.

## Release names and readback

Each tool uses its own identifiers:

```text
Tag: tool-<id>-v<version>-r<packageRevision>
ZIP: <id>-<version>-r<packageRevision>.zip
```

Release only changed tools, without coupling versions. Each release contains that tool's ZIP and `SHA256SUMS.txt`, with runtime requirements, changes, validation limits and maintenance policy. Mark preview versions as prereleases. Link to exact tags from the catalog rather than relying on the repository-wide Latest label. Keep historical releases unchanged.

Only after publishing and reading back the tag, source commit, asset name and downloaded bytes may a receipt be added to `release-index.json`. Fields are `id`, `version`, `packageRevision`, `tag`, `asset`, `sha256`, `sourceFingerprint`, `sourceCommit` and `prerelease`. Receipts are outside packages, so recording a release does not alter its ZIP. Retain historical receipts; the catalog displays only the receipt matching the current declaration.

Build official releases from a clean, isolated checkout of the fixed commit, with that checkout's `core.autocrlf` set to `false` and the repository's existing exact-byte attributes respected. Verify inputs against the commit, rebuild, extract and validate, then upload those new artifacts. A normal working-tree build is a candidate and cannot attest a clean source commit. The script preserves source bytes and line endings. LF/CRLF differences are not functional changes, but still require correct byte binding and never justify overwriting assets. When a registered ID migrates to external, its historical receipts remain valid metadata without participating in current local-package binding. Unknown IDs are still rejected.

A receipt records maintainer verification. The local script cannot prove that a remote release still exists or has not been replaced. Publication must verify download availability; writing a URL is insufficient. This change provides local distribution tooling, without background publication, store installation, automatic updates or a hosted service.

## Safety and validation limits

Input paths reject traversal, links, Windows reparse points, private state directories, common secret formats and Office originals. Limits are 64 MiB per input and 512 MiB in total. Output is restricted to this checkout's `dist/` or `.planning/`, and existing package directories cannot be overwritten. Reads detect observable changes and recheck collected bytes. Stop concurrent candidate edits during packaging. This is not OS isolation against a malicious process with the same account.

Sorted members, fixed timestamps and permissions make identical inputs reproducible in the same packaging environment. Different Python or compression-library versions can change ZIP bytes. Publication receipts bind actual released bytes; matching application versions alone do not prove matching packages. Checksums prove content consistency, not freedom from vulnerabilities.

CI validates declarations, catalogs, packaging counterexamples and existing tool checks. It does not create tags, releases or deployments, or download personal data. Any future publication automation must reuse this interface and separately establish permission, approval, immutable versions and readback. None is enabled now.
