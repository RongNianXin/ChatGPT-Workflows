# Markdown Reader: download and start

[中文](DOWNLOAD.md)

Read selected Markdown files offline without modifying the originals.

[Full usage and limitations](README.en.md)

Distribution version: 1.0.0 / r1

## Download

This version of the standalone package has not been published; no ZIP download is available here yet.
You can read the usage guide now. Any older download listed there is a separate release.

Once a download is available, extract the entire ZIP to a permanent folder and read START-HERE.en.md.
No repository clone or other tool is required. Keep the package layout intact; GitHub's Source code archive is the whole repository.

## Requirements

- A modern desktop browser; no Node, installation or server is needed.
- Remembering original files depends on browser APIs and permission; ordinary selection is the fallback.

## Start

1. Open 实用小工具/Markdown阅读器/index.html.
2. Click Open document and select your Markdown files. Workflow documents are not bundled.

## Updates and help

Return to this tool's download page to check its version and release notes. Updates are manual.
Follow the [Markdown Reader guide](README.en.md) for tool-specific update and data-preservation steps.
For failures, report the tool and package version, OS, runtime/browser and redacted error text. Do not send credentials or private task data.

## For maintainers

`python -B "实用小工具/manage_tools.py" build markdown-reader`

Run from a source checkout to create a local package; this does not publish it. Ordinary users do not need this command.

<!-- README-SOURCE-SHA256: 1366b249395ff26a54f9992088afd4b9cd8d09a721e633b3a22388269db80c9b -->
