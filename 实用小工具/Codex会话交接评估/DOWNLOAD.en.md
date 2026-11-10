# Codex Session Handoff Assessment: download and start

[中文](DOWNLOAD.md)

A local Windows desk for read-only snapshots of existing Codex sessions.

[Full usage and limitations](README.en.md)

Distribution version: 0.2.0-dev.10 / r1

## Download

[Download this tool ZIP](https://github.com/RongNianXin/ChatGPT-Workflows/releases/download/tool-codex-session-desk-v0.2.0-dev.10-r1/codex-session-desk-0.2.0-dev.10-r1.zip)
 · [SHA256SUMS.txt](https://github.com/RongNianXin/ChatGPT-Workflows/releases/download/tool-codex-session-desk-v0.2.0-dev.10-r1/SHA256SUMS.txt)
 · [Release notes](https://github.com/RongNianXin/ChatGPT-Workflows/releases/tag/tool-codex-session-desk-v0.2.0-dev.10-r1)

Development preview.
ZIP SHA-256: `a5200fa9355b3a0bcca4c58d5f7a01543b76aa79945875bee40389e32065a3bf`

Once a download is available, extract the entire ZIP to a permanent folder and read START-HERE.en.md.
No repository clone or other tool is required. Keep the package layout intact; GitHub's Source code archive is the whole repository.

## Requirements

- Windows, existing PowerShell and local Codex session files; other systems are not validated.
- Starting the desk runs a local-only service and opens a browser; state stays under windows-local/.local in this package.

## Start

1. Run 实用小工具/Codex会话交接评估/Start-SessionDesk.cmd; read the adjacent README first.
2. This is distribution revision r1 of the current sources, distinct from older preview ZIPs with the same app version. Follow the desk shutdown instructions.

## Updates and help

Return to this tool's download page to check its version and release notes. Updates are manual.
Follow the [Codex Session Handoff Assessment guide](README.en.md) for tool-specific update and data-preservation steps.
For failures, report the tool and package version, OS, runtime/browser and redacted error text. Do not send credentials or private task data.

## For maintainers

`python -B "实用小工具/manage_tools.py" build codex-session-desk`

Run from a source checkout to create a local package; this does not publish it. Ordinary users do not need this command.

<!-- README-SOURCE-SHA256: 8d1d1f57471a6df4c26d2eb27be6103668b40afa06645ba14ea8c64e6a7bfb32 -->
