# Zhihu Q&A Export Helper: download and start

[中文](DOWNLOAD.md)

Export normally returned Zhihu questions, answers and comments to local JSON.

[Full usage and limitations](README.en.md)

Distribution version: 0.6.7 / r1

## Download

This version of the standalone package has not been published; no ZIP download is available here yet.
You can read the usage guide now. Any older download listed there is a separate release.

Once a download is available, extract the entire ZIP to a permanent folder and read START-HERE.en.md.
No repository clone or other tool is required. Keep the package layout intact; GitHub's Source code archive is the whole repository.

## Requirements

- Desktop Chrome or Edge; load the unpacked extension in developer mode.
- Collection uses your existing Zhihu access and network; Node and Python are not required.

## Start

1. Enable developer mode on the extensions page and load 实用小工具/知乎问答导出助手/extension, the folder containing manifest.json.
2. Refresh the target Zhihu tab, then click the extension. Results remain local; full coverage is not guaranteed.

## Updates and help

Return to this tool's download page to check its version and release notes. Updates are manual.
Follow the [Zhihu Q&A Export Helper guide](README.en.md) for tool-specific update and data-preservation steps.
For failures, report the tool and package version, OS, runtime/browser and redacted error text. Do not send credentials or private task data.

## For maintainers

`python -B "实用小工具/manage_tools.py" build zhihu-export`

Run from a source checkout to create a local package; this does not publish it. Ordinary users do not need this command.

<!-- README-SOURCE-SHA256: 63ecb02d021049b713029eb1444c5f4208ebe7da92fbe96cb22912f579219533 -->
