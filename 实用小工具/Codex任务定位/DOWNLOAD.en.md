# Codex Task Locator: download and start

[中文](DOWNLOAD.md)

Find local session candidates by explicit project and name; verify identity through the host.

[Full usage and limitations](README.en.md)

Distribution version: 0.1.0 / r1

## Download

This version of the standalone package has not been published; no ZIP download is available here yet.
You can read the usage guide now. Any older download listed there is a separate release.

Once a download is available, extract the entire ZIP to a permanent folder and read START-HERE.en.md.
No repository clone or other tool is required. Keep the package layout intact; GitHub's Source code archive is the whole repository.

## Requirements

- Node.js, Python 3 and an authorized local Codex metadata database.
- Lookup returns checkpoint candidates only; host verification is still required.

## Start

1. From this package root, follow the README to run node .github/scripts/Find-CodexThread.mjs with the authorized project root and name.
2. 0.1.0 is the initial distribution version, not a change to lookup behavior.

## Updates and help

Return to this tool's download page to check its version and release notes. Updates are manual.
Follow the [Codex Task Locator guide](README.en.md) for tool-specific update and data-preservation steps.
For failures, report the tool and package version, OS, runtime/browser and redacted error text. Do not send credentials or private task data.

## For maintainers

`python -B "实用小工具/manage_tools.py" build codex-task-locator`

Run from a source checkout to create a local package; this does not publish it. Ordinary users do not need this command.

<!-- README-SOURCE-SHA256: b80b0c50c496a4460b449676743b2919ed93da57fb71deb6fec42103610920c2 -->
