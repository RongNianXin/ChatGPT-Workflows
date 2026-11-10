# Codex Task Continuation Guard: download and start

[中文](DOWNLOAD.md)

Per-task verification and bounded continuation without taking over existing desktop chats.

[Full usage and limitations](README.en.md)

Distribution version: 0.1.0 / r1

## Download

This version of the standalone package has not been published; no ZIP download is available here yet.
You can read the usage guide now. Any older download listed there is a separate release.

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

<!-- README-SOURCE-SHA256: f0fff5c46108aa5fcadbd84e7d625f8ef5b137993e52fd1f087dadc5252cdb23 -->
