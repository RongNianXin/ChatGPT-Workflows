# Independent local utilities

[中文](README.md)

Download one utility; the other utilities and commander workflow are not runtime dependencies.
The table distinguishes published downloads from packages currently available only to local maintainers.

| Utility | Version / kind | Download status |
| --- | --- | --- |
| [Codex Session Handoff Assessment](Codex%E4%BC%9A%E8%AF%9D%E4%BA%A4%E6%8E%A5%E8%AF%84%E4%BC%B0/README.en.md) | 0.2.0-dev.10 / r1 | [Download ZIP](https://github.com/RongNianXin/ChatGPT-Workflows/releases/download/tool-codex-session-desk-v0.2.0-dev.10-r1/codex-session-desk-0.2.0-dev.10-r1.zip) · [Tool download page](https://github.com/RongNianXin/ChatGPT-Workflows/blob/main/%E5%AE%9E%E7%94%A8%E5%B0%8F%E5%B7%A5%E5%85%B7/Codex%E4%BC%9A%E8%AF%9D%E4%BA%A4%E6%8E%A5%E8%AF%84%E4%BC%B0/DOWNLOAD.en.md) |
| [Codex Task Continuation Guard](Codex%E4%BB%BB%E5%8A%A1%E7%BB%AD%E6%89%A7%E8%A1%8C%E5%AE%88%E5%8D%AB/README.en.md) | 0.1.0 / r1 | [Download ZIP](https://github.com/RongNianXin/ChatGPT-Workflows/releases/download/tool-codex-task-guard-v0.1.0-r1/codex-task-guard-0.1.0-r1.zip) · [Tool download page](https://github.com/RongNianXin/ChatGPT-Workflows/blob/main/%E5%AE%9E%E7%94%A8%E5%B0%8F%E5%B7%A5%E5%85%B7/Codex%E4%BB%BB%E5%8A%A1%E7%BB%AD%E6%89%A7%E8%A1%8C%E5%AE%88%E5%8D%AB/DOWNLOAD.en.md) |
| [Codex Task Locator](Codex%E4%BB%BB%E5%8A%A1%E5%AE%9A%E4%BD%8D/README.en.md) | 0.1.0 / r1 | [Download ZIP](https://github.com/RongNianXin/ChatGPT-Workflows/releases/download/tool-codex-task-locator-v0.1.0-r1/codex-task-locator-0.1.0-r1.zip) · [Tool download page](https://github.com/RongNianXin/ChatGPT-Workflows/blob/main/%E5%AE%9E%E7%94%A8%E5%B0%8F%E5%B7%A5%E5%85%B7/Codex%E4%BB%BB%E5%8A%A1%E5%AE%9A%E4%BD%8D/DOWNLOAD.en.md) |
| [Git State Compass](Git%E4%BB%93%E5%BA%93%E7%8A%B6%E6%80%81%E7%BD%97%E7%9B%98/README.md) | External repository | [Open repository](https://github.com/RongNianXin/Git-State-Compass) |
| [Markdown Reader](Markdown%E9%98%85%E8%AF%BB%E5%99%A8/README.en.md) | 1.0.0 / r1 | [Download ZIP](https://github.com/RongNianXin/ChatGPT-Workflows/releases/download/tool-markdown-reader-v1.0.0-r1/markdown-reader-1.0.0-r1.zip) · [Tool download page](https://github.com/RongNianXin/ChatGPT-Workflows/blob/main/%E5%AE%9E%E7%94%A8%E5%B0%8F%E5%B7%A5%E5%85%B7/Markdown%E9%98%85%E8%AF%BB%E5%99%A8/DOWNLOAD.en.md) |
| [Zhihu Q&A Export Helper](%E7%9F%A5%E4%B9%8E%E9%97%AE%E7%AD%94%E5%AF%BC%E5%87%BA%E5%8A%A9%E6%89%8B/README.en.md) | 0.6.7 / r1 | [Download ZIP](https://github.com/RongNianXin/ChatGPT-Workflows/releases/download/tool-zhihu-export-v0.6.7-r1/zhihu-export-0.6.7-r1.zip) · [Tool download page](https://github.com/RongNianXin/ChatGPT-Workflows/blob/main/%E5%AE%9E%E7%94%A8%E5%B0%8F%E5%B7%A5%E5%85%B7/%E7%9F%A5%E4%B9%8E%E9%97%AE%E7%AD%94%E5%AF%BC%E5%87%BA%E5%8A%A9%E6%89%8B/DOWNLOAD.en.md) |

Each ZIP includes its own required files, license, start guide and per-file checksums.
A runtime such as a browser, PowerShell, Node.js, Python or an existing Codex installation may still be required; see the tool's requirements.
A source ZIP is not an app-store installation or a signed installer. The new package series does not replace existing releases.

Maintainers: see [distribution architecture](DISTRIBUTION.en.md).
Run `python -B manage_tools.py list`, `python -B manage_tools.py check`, or `python -B manage_tools.py build zhihu-export` from this directory.
These commands do not publish releases, install dependencies, stop applications or start the tools.

<!-- README-SOURCE-SHA256: f8148ce4d11a08d61bcd4a932ead75fd9d23e6c10ceefa35f8056ddadad95722 -->
