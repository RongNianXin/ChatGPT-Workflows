# 可独立使用的实用小工具

[English](README.en.md)

只下载需要的工具即可，不需要其他工具或总指挥工作流作为运行依赖。
下表严格区分已发布下载与目前仅在维护者本地生成的独立包。

| 工具 | 版本或类型 | 下载状态 |
| --- | --- | --- |
| [Codex会话交接评估](Codex%E4%BC%9A%E8%AF%9D%E4%BA%A4%E6%8E%A5%E8%AF%84%E4%BC%B0/README.md) | 0.2.0-dev.10 / r1 | 可在本地打包，尚未发布此独立包 · [本工具下载页](https://github.com/RongNianXin/ChatGPT-Workflows/blob/main/%E5%AE%9E%E7%94%A8%E5%B0%8F%E5%B7%A5%E5%85%B7/Codex%E4%BC%9A%E8%AF%9D%E4%BA%A4%E6%8E%A5%E8%AF%84%E4%BC%B0/DOWNLOAD.md) |
| [Codex任务续执行守卫](Codex%E4%BB%BB%E5%8A%A1%E7%BB%AD%E6%89%A7%E8%A1%8C%E5%AE%88%E5%8D%AB/README.md) | 0.1.0 / r1 | 可在本地打包，尚未发布此独立包 · [本工具下载页](https://github.com/RongNianXin/ChatGPT-Workflows/blob/main/%E5%AE%9E%E7%94%A8%E5%B0%8F%E5%B7%A5%E5%85%B7/Codex%E4%BB%BB%E5%8A%A1%E7%BB%AD%E6%89%A7%E8%A1%8C%E5%AE%88%E5%8D%AB/DOWNLOAD.md) |
| [Codex任务定位](Codex%E4%BB%BB%E5%8A%A1%E5%AE%9A%E4%BD%8D/README.md) | 0.1.0 / r1 | 可在本地打包，尚未发布此独立包 · [本工具下载页](https://github.com/RongNianXin/ChatGPT-Workflows/blob/main/%E5%AE%9E%E7%94%A8%E5%B0%8F%E5%B7%A5%E5%85%B7/Codex%E4%BB%BB%E5%8A%A1%E5%AE%9A%E4%BD%8D/DOWNLOAD.md) |
| [Git仓库状态罗盘](Git%E4%BB%93%E5%BA%93%E7%8A%B6%E6%80%81%E7%BD%97%E7%9B%98/README.md) | 独立仓库 | [前往独立仓库](https://github.com/RongNianXin/Git-State-Compass) |
| [Markdown阅读器](Markdown%E9%98%85%E8%AF%BB%E5%99%A8/README.md) | 1.0.0 / r1 | 可在本地打包，尚未发布此独立包 · [本工具下载页](https://github.com/RongNianXin/ChatGPT-Workflows/blob/main/%E5%AE%9E%E7%94%A8%E5%B0%8F%E5%B7%A5%E5%85%B7/Markdown%E9%98%85%E8%AF%BB%E5%99%A8/DOWNLOAD.md) |
| [知乎问答导出助手](%E7%9F%A5%E4%B9%8E%E9%97%AE%E7%AD%94%E5%AF%BC%E5%87%BA%E5%8A%A9%E6%89%8B/README.md) | 0.6.7 / r1 | 可在本地打包，尚未发布此独立包 · [本工具下载页](https://github.com/RongNianXin/ChatGPT-Workflows/blob/main/%E5%AE%9E%E7%94%A8%E5%B0%8F%E5%B7%A5%E5%85%B7/%E7%9F%A5%E4%B9%8E%E9%97%AE%E7%AD%94%E5%AF%BC%E5%87%BA%E5%8A%A9%E6%89%8B/DOWNLOAD.md) |

每个ZIP都带齐自身所需文件、许可证、启动说明和逐文件校验清单。
独立不等于不需要运行环境：浏览器、PowerShell、Node、Python或已安装Codex等要求，按工具分别说明。
源码ZIP不等于商店安装或签名安装器；新的统一包系列不覆盖既有Release。

维护者见[独立分发架构](DISTRIBUTION.md)。
在本目录运行 `python -B manage_tools.py list`、`python -B manage_tools.py check`，或 `python -B manage_tools.py build zhihu-export`。
这些命令不发布Release、不安装依赖、不退出应用，也不启动工具本身。
