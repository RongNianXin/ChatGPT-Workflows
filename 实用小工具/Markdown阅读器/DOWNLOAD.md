# Markdown阅读器：下载与启动

[English](DOWNLOAD.en.md)

离线阅读主动选择的Markdown文件，不修改原文件。

[完整使用说明与限制](README.md)

独立分发版本：1.0.0 / r1

## 下载

[下载本工具ZIP](https://github.com/RongNianXin/ChatGPT-Workflows/releases/download/tool-markdown-reader-v1.0.0-r1/markdown-reader-1.0.0-r1.zip)
 · [SHA256SUMS.txt](https://github.com/RongNianXin/ChatGPT-Workflows/releases/download/tool-markdown-reader-v1.0.0-r1/SHA256SUMS.txt)
 · [版本说明](https://github.com/RongNianXin/ChatGPT-Workflows/releases/tag/tool-markdown-reader-v1.0.0-r1)

开发预览版。
ZIP SHA-256: `216ab8f71cf6921f15c9ecde9cd9248ada763101d899560ef301996636f9603a`

取得ZIP后完整解压到稳定目录，先看包根的START-HERE.md。
无需克隆整个仓库或安装其他工具。保留包内目录结构；GitHub的Source code附件是整个仓库源码。

## 运行环境

- 现代桌面浏览器；无需Node、安装或服务。
- 原文件自动记忆依赖浏览器接口与授权；不支持时使用普通文件选择。

## 启动

1. 双击 实用小工具/Markdown阅读器/index.html。
2. 点击“打开文档”，选择自己的Markdown；包中不附带工作流文档。

## 更新与求助

回到本工具的下载页核对版本和发布说明，更新需手动取得新版文件。
具体升级和数据保留方法见[Markdown阅读器使用说明](README.md)。
报错时提供工具/包版本、系统、运行环境或浏览器，以及脱敏错误文字；不要发送凭据或私有任务数据。

## 仅供维护者

`python -B "实用小工具/manage_tools.py" build markdown-reader`

在源码仓库根运行可生成本地包，不会发布。普通使用者无需执行此命令。
