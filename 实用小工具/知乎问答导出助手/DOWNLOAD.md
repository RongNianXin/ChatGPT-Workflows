# 知乎问答导出助手：下载与启动

[English](DOWNLOAD.en.md)

在浏览器中将知乎问题、回答及正常返回的评论保存为本机JSON。

[完整使用说明与限制](README.md)

独立分发版本：0.6.7 / r1

## 下载

[下载本工具ZIP](https://github.com/RongNianXin/ChatGPT-Workflows/releases/download/tool-zhihu-export-v0.6.7-r1/zhihu-export-0.6.7-r1.zip)
 · [SHA256SUMS.txt](https://github.com/RongNianXin/ChatGPT-Workflows/releases/download/tool-zhihu-export-v0.6.7-r1/SHA256SUMS.txt)
 · [版本说明](https://github.com/RongNianXin/ChatGPT-Workflows/releases/tag/tool-zhihu-export-v0.6.7-r1)

开发预览版。
ZIP SHA-256: `ec7a91a144a0f3aaf457f41f19c225db347297d8818b610925cedb0008018b7c`

取得ZIP后完整解压到稳定目录，先看包根的START-HERE.md。
无需克隆整个仓库或安装其他工具。保留包内目录结构；GitHub的Source code附件是整个仓库源码。

## 运行环境

- 桌面Chrome或Edge；通过开发者模式手动加载扩展。
- 采集需要使用者自己已有的知乎访问权限及网络；不需要Node或Python。

## 启动

1. 在扩展管理页开启开发者模式，加载 实用小工具/知乎问答导出助手/extension。选择直接包含manifest.json的文件夹。
2. 刷新目标知乎标签，再点击扩展；结果只保存到本机，不能保证全量。

## 更新与求助

回到本工具的下载页核对版本和发布说明，更新需手动取得新版文件。
具体升级和数据保留方法见[知乎问答导出助手使用说明](README.md)。
报错时提供工具/包版本、系统、运行环境或浏览器，以及脱敏错误文字；不要发送凭据或私有任务数据。

## 仅供维护者

`python -B "实用小工具/manage_tools.py" build zhihu-export`

在源码仓库根运行可生成本地包，不会发布。普通使用者无需执行此命令。
