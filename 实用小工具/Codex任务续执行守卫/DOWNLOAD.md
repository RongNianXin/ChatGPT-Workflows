# Codex任务续执行守卫：下载与启动

[English](DOWNLOAD.en.md)

按任务启用验收与有限续作，不接管已有桌面对话。

[完整使用说明与限制](README.md)

独立分发版本：0.1.0 / r1

## 下载

[下载本工具ZIP](https://github.com/RongNianXin/ChatGPT-Workflows/releases/download/tool-codex-task-guard-v0.1.0-r1/codex-task-guard-0.1.0-r1.zip)
 · [SHA256SUMS.txt](https://github.com/RongNianXin/ChatGPT-Workflows/releases/download/tool-codex-task-guard-v0.1.0-r1/SHA256SUMS.txt)
 · [版本说明](https://github.com/RongNianXin/ChatGPT-Workflows/releases/tag/tool-codex-task-guard-v0.1.0-r1)

开发预览版。
ZIP SHA-256: `53ec4e5914ab23ea520df30c39c03444470037219634a78b8a8a53e95beef378`

取得ZIP后完整解压到稳定目录，先看包根的START-HERE.md。
无需克隆整个仓库或安装其他工具。保留包内目录结构；GitHub的Source code附件是整个仓库源码。

## 运行环境

- Windows、PowerShell、Node.js及已有可用认证的Codex CLI。
- 正式运行需明确授权的任务契约和经审查的只读验收器；不自动安装。

## 启动

1. 先读 实用小工具/Codex任务续执行守卫/README.md，由AI在已授权任务内准备契约与验收器。
2. 在该目录调用 Start-GuardedTask.ps1 并给出契约/提示词；被守护项目须与本包分离。
3. 0.1.0是初始独立分发版本，不代表新增后台自动化。

## 更新与求助

回到本工具的下载页核对版本和发布说明，更新需手动取得新版文件。
具体升级和数据保留方法见[Codex任务续执行守卫使用说明](README.md)。
报错时提供工具/包版本、系统、运行环境或浏览器，以及脱敏错误文字；不要发送凭据或私有任务数据。

## 仅供维护者

`python -B "实用小工具/manage_tools.py" build codex-task-guard`

在源码仓库根运行可生成本地包，不会发布。普通使用者无需执行此命令。
