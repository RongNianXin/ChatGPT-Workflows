<!-- README-SOURCE-SHA256: 579cad263664d4c6d3ede16aed40786f54a13e19cd94892e3537a5a3259a7ea6 -->

# RTK: Terminal Output Summaries

[中文](README.md)

ID: `EXT-005`. RTK condenses command output before an AI reads it. It is useful for browsing repetitive logs, not a smarter model or a guarantee of equivalent task-speed or cost savings. Start from the [directory](../外部工具目录.md); follow the [shared integration rules](../外部工具自动对接规范.md) and the [version and maintenance record](安装与维护记录.md).

## Scope and Invocation

A user can say: "The terminal output is long. Assess whether RTK fits, and retain the necessary evidence." The AI checks the goal, authorization for the underlying command, installed artifact, version and filter compatibility. Users need not assemble commands. Use existing tools for short output; do not force wrapping without evidence of benefit.

For an existing Windows installation, check `Get-Command rtk.exe` and `rtk --version`. The current portable convention resolves `Programs/RTK/1.1.0-oss/rtk.exe` under `$env:LOCALAPPDATA` at runtime. Existence does not prove version or integrity: consult the local installation evidence. New terminals can inherit user PATH; an existing host can use the verified absolute executable path without a restart. If missing or mismatched, continue safely with the original command rather than installing automatically.

Explicit forms tested include `rtk git log -3`, `rtk git status --short` and `rtk run node --version`. Real projects must still check the underlying command's configuration, executable filters and side effects. `run` may just pass output through, with no reduction. Status summaries do not replace complete path inventories. Short log output does not replace full commit identity, precise timestamps, authorization or original commit text. Do not bypass the workflow's existing Git/LFS guards.

In the tested version, `rtk test node --test` does not reliably retain total and passing test counts; using TAP does not fix it. Do not use it for test acceptance. This does not prove other test ecosystems are incompatible. Do not install another test framework or disguise command names just to pass RTK acceptance. Validate untested filters within a limited scope instead of adding a prefix to every command.

## Safety, Evidence and Exit

- Wrapping grants no permission for the underlying action. Do not automatically wrap writes, deletion, publication, network requests or other controlled actions; do not rerun a command automatically to recover output.
- Do not use lossy summaries instead of required complete rules, original requests, identity evidence, structured protocols or verbatim evidence. Read existing raw logs when a summary is insufficient. Preserve raw output on the first critical execution using the existing evidence mechanism, not by repeating potentially consequential commands for RTK.
- When an actual `rtk recall <HASH>` hint appears, use `rtk recall <HASH> --full` for the complete stored output; the default can return only the unseen part. Never invent a hash. Recovery has size and write-access limits and may not store output at all. It is not a permanent backup, and omitted summary text does not prove the original is absent.
- Use explicit calls only. Do not run `rtk init`, inject global AGENTS instructions, install hooks or aliases, or grant approval. The current tool interface differs from the upstream Bash hook input; host mapping is untested. Transparent PowerShell/Codex rewriting is not certified.
- Telemetry is configured off, but v1.1.0 ignores the history-disable setting on some tested paths. It still records commands, working directories, timestamps and estimated usage, then deletes old history at an upstream hard-coded retention period. A new dedicated history database isolates future calls; the default database bytes were unchanged after the isolation test. Its pre-first-call state was not captured, so no claim of zero impact on earlier history is possible. Never use history as an original evidence archive. The separate recovery store has age/count eviction disabled but is still not a permanent raw-output backup. Records may contain private data and must not be published.
- To stop, omit the RTK prefix. Removing only the newly added user PATH segment reverses command discovery without replacing the rest of PATH. Retain installation, configuration and evidence; no business-file deletion or upstream uninstaller is required.

Reports should state the authorized command scope, actual wrapper, exit code, key result, raw evidence location, unobserved content and next actor. Only nonsensitive synthetic validation is retained; routine business adoption is on hold until effective history and preservation controls are verified. A configuration flag alone is not acceptance. Cross-project discovery, new-window adoption, other systems and actual total token/cost benefits remain untested. The current Node/Git subprocess approach does not run locally on iOS; this does not change the availability of historical text-only workflows.
