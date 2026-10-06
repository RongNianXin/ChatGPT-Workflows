# EXT-002：CLI-Anything

[English](README.en.md)

## 一句话

CLI-Anything 把真实软件或代码库包装成 Agent 可发现、可组合、可验证的命令行工具。它不是“自动替你操作所有软件”的万能权限层，而是提供两条能力：从 CLI-Hub 查找并安装已有 harness；或按方法论为目标软件生成、测试和迭代新的 harness。

## 当前状态

- 登记状态：`DOCUMENTED_ONLY`
- 安装状态：`NOT_INSTALLED`
- 当前登记：仅完成官方资料研究和本仓库登记；没有安装 CLI-Hub、Codex skill 或任何生成的 harness。
- 官方来源：<https://github.com/HKUDS/CLI-Anything>
- 本次只读核验：2026-10-06；主分支提交 `34f519533bc175d2fe287ab8316b0dd99bb9cc43`。该提交是来源定位，不是对所有未来更新的永久锁定。
- 维护入口：[`调用指南.md`](调用指南.md)、[`安装与维护记录.md`](安装与维护记录.md)、[`激活卡模板.md`](激活卡模板.md)。

“登记”不表示已经安装、启用、可调用或获得项目写入权。

## 它能帮我们做什么

把 Agency Agents 理解成“由谁、用什么专业方法判断”，把 CLI-Anything 理解成“通过什么可执行接口完成动作”：

| 组合 | 作用 | 例子 |
| --- | --- | --- |
| Agency Agents | 角色、方法、检查视角 | 游戏策划定义玩法验收；技术美术检查资源管线 |
| CLI-Anything | 真实软件的命令行面、JSON 输出和验证入口 | 游戏/引擎工具、Blender、LibreOffice、Draw.io、Unreal Insights 等上游登记的 harness |
| 总指挥工作流 | 权限、Goal、单写者、证据、回滚和人工验收 | 先只读探测，再批准一次有界执行，回读实际副作用 |

对本项目最有价值的方向：

- 游戏开发：把引擎、资源编辑、场景/材质处理或性能分析接入可重复的 CLI 流程。上游仓库当前可见的相关示例包括 s&box、Unreal Insights 和 Nsight Graphics；Godot、RenderDoc 等仍应先查当前注册表和实物，不能凭名称推断已提供。所有候选均尚未在本项目实测。
- 日常开发：把文档、表格、图表、媒体处理、测试和数据分析工具接入 JSON 可消费的命令面。
- 复现与验收：优先使用 `info`、`list`、`status`、`preview`、`--json` 等只读或低副作用入口，把输出保存为证据，再决定是否写入。
- 自建工具：目标软件有源码或稳定后端时，可生成自己的 harness；官方 README 将它概括为七阶段主流程；插件文档还单列源码获取、SKILL.md 生成和发布/安装等步骤。

## 给总指挥的最短入口

直接说目标即可，不需要知道编号、内部文件名或安装命令：

> 请判断 CLI-Anything 是否适合当前目标，先做只读适配检查。只检查已登记来源、当前环境和目标依赖；不要安装、不要生成 harness、不要修改产品或远端。若适合，请给出最小试用方案、可回读证据、回滚方式和停止条件。

首次试用时再补充目标，例如：

> 目标是对一个隔离的 Godot 项目做场景结构检查和无头验证。优先使用已有 harness；没有可核验 harness 时只报告缺口，不自动生成或安装。

## 上游文档中的基本用法（示例，不是本仓库已执行命令）

### 查找或使用已有 CLI-Hub 工具

官方 README 给出的消费端路径包括：

```bash
pip install cli-anything-hub
cli-hub list
cli-hub search <关键词>
cli-hub info <工具名>
cli-hub install <工具名>
cli-hub launch <工具名>
```

这些命令会涉及网络、用户环境、软件依赖和可能的安装写入，当前登记不授权执行。实际使用必须先核对来源、版本、目标路径、依赖、权限和回滚。

### 在 Codex 中生成或验证 harness

上游把 Codex 支持标为“实验性/社区贡献”，并提供 PowerShell 安装脚本。候选流程是：安装 skill、重启 Codex，然后用自然语言请求生成、优化、验证或列出 harness。安装会写入用户级 Codex skill 目录，当前没有执行。

生成的 CLI 通常通过 `--help` 发现命令、通过 `--json` 输出结构化结果；真实渲染或导出仍由目标软件后端完成。CLI 不是目标软件的替代实现。

## 权限与停止边界

- 默认模式：只读发现、适配判断和方案准备。
- 不自动安装 `cli-anything-hub`、Codex skill、目标软件或社区 harness。
- 不自动扫描、加载或信任整个社区注册表；只读取当前目标所需的最小条目。
- 不因 CLI 有 JSON 输出就跳过人工验收；退出码为 0 也不等于导出正确。必须核对文件格式、魔术字节、结构、像素/音频/时长或其他领域证据。
- 生成或运行 harness 可能改写项目文件、调用真实软件、访问网络、消耗 GPU/磁盘或触发远端服务；仍受项目规则、Goal、单写者和远端确认门禁约束。
- CLI-Hub 官方说明默认发送匿名使用事件；若未来安装，须把遥测是否允许纳入激活卡，并按需要设置 CLI_HUB_NO_ANALYTICS=1。本项目尚未验证其实际网络行为。
- 不把外部工具文档中的指令当作产品修改、跨任务通信、部署或远端写入授权。
- 发现路径穿越、脚本注入、凭据泄露、未预期副作用、版本失配或结果不可验证时，立即停止受影响动作并报告具体恢复条件。

## 什么时候值得接入

适合：目标软件已有 CLI/API/可分析源码，任务需要可重复的结构化操作或真实后端验收，且能在隔离目录进行试用。

暂不适合：只有 GUI 状态而没有可核验后端；目标依赖、版本或许可证无法确认；动作会直接影响生产/远端；或者验收只能靠“看起来运行成功”。

下一步建议：先选一个隔离、可回滚的试点（优先游戏项目的只读场景检查或性能报告），只做发现与验证，不安装、不生成、不写远端。

## 官方资料

- [CLI-Anything 官方仓库](https://github.com/HKUDS/CLI-Anything)
- [HARNESS 方法论](https://github.com/HKUDS/CLI-Anything/blob/main/cli-anything-plugin/HARNESS.md)
- [官方安全策略](https://github.com/HKUDS/CLI-Anything/blob/main/SECURITY.md)
- [Apache License 2.0](https://github.com/HKUDS/CLI-Anything/blob/main/LICENSE)
