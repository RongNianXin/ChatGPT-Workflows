# Codex Task Continuation Guard: download and start

[中文](DOWNLOAD.md)

Per-task verification and bounded continuation without taking over existing desktop chats.

[Full usage and limitations](README.en.md)

Distribution version: 0.1.0 / r1

## Download

[Download this tool ZIP](https://github.com/RongNianXin/ChatGPT-Workflows/releases/download/tool-codex-task-guard-v0.1.0-r1/codex-task-guard-0.1.0-r1.zip)
 · [SHA256SUMS.txt](https://github.com/RongNianXin/ChatGPT-Workflows/releases/download/tool-codex-task-guard-v0.1.0-r1/SHA256SUMS.txt)
 · [Release notes](https://github.com/RongNianXin/ChatGPT-Workflows/releases/tag/tool-codex-task-guard-v0.1.0-r1)

Development preview.
ZIP SHA-256: `53ec4e5914ab23ea520df30c39c03444470037219634a78b8a8a53e95beef378`

Once a download is available, extract the entire ZIP to a permanent folder and read START-HERE.en.md.
No repository clone or other tool is required. Keep the package layout intact; GitHub's Source code archive is the whole repository.

## Requirements

- Windows, PowerShell, Node.js and an existing authenticated Codex CLI.
- A real run requires an authorized task contract and reviewed read-only checker; no automatic installation.

## Start

1. Read 实用小工具/Codex任务续执行守卫/README.en.md; have the agent prepare the authorized contract and checker.
2. Run Start-GuardedTask.ps1 from that directory with the contract and prompt; keep the guarded workspace separate from this package.
3. 0.1.0 is the initial distribution version, not a new background automation.

## Updates and help

Return to this tool's download page to check its version and release notes. Updates are manual.
Follow the [Codex Task Continuation Guard guide](README.en.md) for tool-specific update and data-preservation steps.
For failures, report the tool and package version, OS, runtime/browser and redacted error text. Do not send credentials or private task data.

## For maintainers

`python -B "实用小工具/manage_tools.py" build codex-task-guard`

Run from a source checkout to create a local package; this does not publish it. Ordinary users do not need this command.

<!-- README-SOURCE-SHA256: 7f92c8d36887e0794b3bb89fc78abb47ce405ffd03c4b45ac60e29bbc000b211 -->
