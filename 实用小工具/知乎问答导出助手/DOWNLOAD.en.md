# Zhihu Q&A Export Helper: download and start

[中文](DOWNLOAD.md)

Export normally returned Zhihu questions, answers and comments to local JSON.

[Full usage and limitations](README.en.md)

Distribution version: 0.6.7 / r1

## Download

[Download this tool ZIP](https://github.com/RongNianXin/ChatGPT-Workflows/releases/download/tool-zhihu-export-v0.6.7-r1/zhihu-export-0.6.7-r1.zip)
 · [SHA256SUMS.txt](https://github.com/RongNianXin/ChatGPT-Workflows/releases/download/tool-zhihu-export-v0.6.7-r1/SHA256SUMS.txt)
 · [Release notes](https://github.com/RongNianXin/ChatGPT-Workflows/releases/tag/tool-zhihu-export-v0.6.7-r1)

Development preview.
ZIP SHA-256: `ec7a91a144a0f3aaf457f41f19c225db347297d8818b610925cedb0008018b7c`

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

<!-- README-SOURCE-SHA256: 1414bfe083d8320885bb045cd26f88da06d8cf7654e4eba1fab8118a681019ef -->
