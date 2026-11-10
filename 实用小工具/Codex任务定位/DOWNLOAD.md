# Codex任务定位：下载与启动

[English](DOWNLOAD.en.md)

按明确项目路径及名称只读查本机会话候选，再由平台核身份。

[完整使用说明与限制](README.md)

独立分发版本：0.1.0 / r1

## 下载

[下载本工具ZIP](https://github.com/RongNianXin/ChatGPT-Workflows/releases/download/tool-codex-task-locator-v0.1.0-r1/codex-task-locator-0.1.0-r1.zip)
 · [SHA256SUMS.txt](https://github.com/RongNianXin/ChatGPT-Workflows/releases/download/tool-codex-task-locator-v0.1.0-r1/SHA256SUMS.txt)
 · [版本说明](https://github.com/RongNianXin/ChatGPT-Workflows/releases/tag/tool-codex-task-locator-v0.1.0-r1)

开发预览版。
ZIP SHA-256: `e485e5d0dc5d5c2e98e158563d16b4aff936143feab2cb15f9f67b6b6eda249f`

取得ZIP后完整解压到稳定目录，先看包根的START-HERE.md。
无需克隆整个仓库或安装其他工具。保留包内目录结构；GitHub的Source code附件是整个仓库源码。

## 运行环境

- Node.js、Python 3及已获准访问的本地Codex元数据库。
- 查询只返回检查点候选，不能代替平台核验。

## 启动

1. 在本包根目录按README执行 node .github/scripts/Find-CodexThread.mjs，并填写已授权项目根与名称。
2. 0.1.0是初始独立分发版本，不代表修改了定位功能。

## 更新与求助

回到本工具的下载页核对版本和发布说明，更新需手动取得新版文件。
具体升级和数据保留方法见[Codex任务定位使用说明](README.md)。
报错时提供工具/包版本、系统、运行环境或浏览器，以及脱敏错误文字；不要发送凭据或私有任务数据。

## 仅供维护者

`python -B "实用小工具/manage_tools.py" build codex-task-locator`

在源码仓库根运行可生成本地包，不会发布。普通使用者无需执行此命令。
