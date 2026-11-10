# Codex会话交接评估：下载与启动

[English](DOWNLOAD.en.md)

Windows本地工作台，按需只读查看已有Codex会话状态。

[完整使用说明与限制](README.md)

独立分发版本：0.2.0-dev.10 / r1

## 下载

这一版本的独立包尚未发布，当前没有可用的ZIP下载入口。
可以先阅读使用说明；说明中如有旧版下载，它属于另一条历史发布。

取得ZIP后完整解压到稳定目录，先看包根的START-HERE.md。
无需克隆整个仓库或安装其他工具。保留包内目录结构；GitHub的Source code附件是整个仓库源码。

## 运行环境

- Windows、已有PowerShell及Codex本地会话文件；其他系统未验收。
- 启动后运行仅本机服务并打开浏览器；数据保存在本包windows-local/.local下。

## 启动

1. 双击 实用小工具/Codex会话交接评估/Start-SessionDesk.cmd；首次使用先读同目录README。
2. 本包是当前源码的独立分发修订r1，不等于历史同名预览ZIP；关闭按工作台说明操作。

## 更新与求助

回到本工具的下载页核对版本和发布说明，更新需手动取得新版文件。
具体升级和数据保留方法见[Codex会话交接评估使用说明](README.md)。
报错时提供工具/包版本、系统、运行环境或浏览器，以及脱敏错误文字；不要发送凭据或私有任务数据。

## 仅供维护者

`python -B "实用小工具/manage_tools.py" build codex-session-desk`

在源码仓库根运行可生成本地包，不会发布。普通使用者无需执行此命令。
