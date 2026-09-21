# Codex historical-task migration research material

[简体中文](README.md) | **English**

<!-- README-SOURCE-SHA256: bf0d701b0177f74162832801fbbccfc6eccdaaaeab26b0ff33278f97cdb441b3 -->
## Current status

- **Installation and rollback against real data are suspended.** `--apply` and `--rollback-latest` fail before reading a manifest, scanning, backing up, or modifying any real task.
- The previous version validated each file independently. It did not prove that a child's `history_base.end_byte_offset` still identifies the same byte prefix after its parent is rewritten.
- The public package currently retains transformation source, synthetic tests, and the historical rollback implementation for review and repair. Retaining source does not make the real entry point safe to use.
- Locally generated scan reports may contain absolute paths and real task IDs. They are excluded by `.gitignore` and are not runtime dependencies of the installer.
- The self-test and lineage tests use only synthetic values or temporary directories. They do not enumerate real session contents.

## Purpose

The package scans only Codex tasks that are currently unarchived. It removes hidden reasoning and compaction ciphertext that is bound to the original provider and cannot be verified after an account or API-provider change. User messages, visible AI responses, tool calls, and other non-encrypted structures are preserved. Archived tasks under `archived_sessions` are not scanned, backed up, or modified.

This addresses compatibility when continuing the same visible task. It does not and cannot convert the original provider's hidden reasoning ciphertext for another provider.

## Public validation result

Local tests confirmed that fail-closed protection is active, expected encrypted fields are removed, non-encrypted structure digests remain unchanged, and manually created backups are not treated as live tasks. These results do not replace validation against the current Codex release and your own backup.

## Installation status

The suspended migration launcher has been removed because it served no operational purpose. This directory retains one legacy copy of the source, tests, and documentation. It is neither the everyday repair entry point nor a runtime dependency of the current tool.

The old exact-task command is also suspended and cannot bypass the gate:

```powershell
node install_bulk_codex_migration.mjs --apply --task "00000000-0000-0000-0000-000000000000"
```

Re-enabling installation requires proof that every referenced parent exists; every offset is a non-negative safe integer within bounds; each parent candidate is byte-identical to its source before every referenced cutoff; and archived or out-of-set parents are explicitly included. No real-data validation has been performed, so the gate remains closed.

Available checks:

```powershell
node safety_tests.mjs
node lineage_tests.mjs
node install_bulk_codex_migration.mjs --self-test
```

The first verifies visible-content preservation and fail-closed handling of unknown ciphertext. The second creates wholly synthetic fixtures in a temporary directory for no-lineage, parent-child, multi-level, multiple-child, out-of-set, out-of-range, repeated-check, and restored-original cases. The third checks synthetic process names, the task selector, and temporary-file metadata without reading real sessions.

## Rollback status

The suspended rollback launcher has been removed; real session backups remain untouched. Independent review found that the historical implementation trusts absolute paths from the newest `manifest.json` without first proving its schema, allowed roots, or path-traversal boundaries. The rollback command in the source still fails before reading a manifest or real file.

Rollback can be restored only after synthetic tests cover malicious and damaged manifests, out-of-root absolute paths, `..` traversal, repeated runs, and partial restoration failures, and after every source and backup path is proven to remain under an allowed root.

## Backup location

`<USER_HOME>\Documents\Codex\CodexSessionBackups\bulk-<TIMESTAMP>`

A historical installation directory may contain `manifest.json`, copies of original task files, and Codex/CC Switch configuration or database backups. Do not run the rollback script or restore only `config.toml`. Preserve the evidence and manifest hash until rollback boundaries have been validated.

## Known limitations

The previous migration handled only ciphertext in currently unarchived tasks and ignored cross-file pagination lineage. Even after lineage validation is repaired, a provider may write new hidden ciphertext and a later switch to an incompatible provider may reproduce the failure. Long-term compatibility still requires upstream support for cross-provider state conversion. Setting only `model_provider = "custom"` does not change ciphertext ownership.

This tool is not derived from or packaged from `codex-session-cleaner` or `codex-rescue`, and it does not copy their source code. See the [related-tool and license notes](<../相关工具和许可证说明.md>) for details.
