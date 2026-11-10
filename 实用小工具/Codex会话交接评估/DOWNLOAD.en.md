# Codex Session Handoff Assessment: download and start

[中文](DOWNLOAD.md)

A local Windows desk for read-only snapshots of existing Codex sessions.

[Full usage and limitations](README.en.md)

Distribution version: 0.2.0-dev.10 / r1

## Download

This version of the standalone package has not been published; no ZIP download is available here yet.
You can read the usage guide now. Any older download listed there is a separate release.

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

<!-- README-SOURCE-SHA256: 7a7c1557e8001fbcc4a0202ed20c067a7400707c3ff3c5f48c381264713cb822 -->
