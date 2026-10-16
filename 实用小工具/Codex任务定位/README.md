# Codex 任务名称定位

[English](README.en.md)

平台近期列表未返回某个项目对话时，AI可在已有只读权限内按明确的项目根与显示名称查询本机元数据。它只产生候选，之后仍须用平台 `read_thread` 核对；不会创建、唤醒、发送消息或修改对话。

入口：[Find-CodexThread.mjs](../../.github/scripts/Find-CodexThread.mjs)。需要 Node 和已有 Python 3 标准库；缺少运行时只暂停这个后备查询，不安装依赖或判定对话不存在。

从仓库根执行，参数由AI填写：

```powershell
node .github/scripts/Find-CodexThread.mjs --project-root "<PROJECT_ROOT>" --name "专项任务A"
```

默认仅访问 `CODEX_HOME`（未设置时为用户标准 `.codex` 目录）中的 `state_5.sqlite`；可用 `--state-db` 指定已明确授权的单个数据库，不遍历目录。查询只使用 `threads` 中的名称、项目路径、归档状态和定位标识，不读取会话正文、初始消息、模型、账号或凭据字段。显示名称优先使用 `name`，不能把 `title` 中的长提示词当名称。

工具通过 [标准库读取器](../../.github/scripts/Find-CodexThread.py) 以 `mode=ro&immutable=1` 只读主库检查点，不读 WAL 增量、不创建或修改数据库锁和伴随文件。检查点可能滞后，名称或归档状态可能已改变，不能作为实时或全量列表。主库读取期间发生可观察变化或读取异常时丢弃候选。

`CANDIDATE` 表示检查点中的唯一未归档候选，`AMBIGUOUS` 表示同名需消歧，`NOT_FOUND` 仅表示本次检查点未匹配。数据库不可达、结构不兼容或状态不明时返回 `INPUT_REQUIRED`；这些结果不证明对话不存在、失效或未接入工作流。每个候选必须通过平台回读核当前名称、项目根和状态，失败时保持未确认。定位标识仅用于获准运行时操作，不写进公开文档或日志。

验证：运行 [Test-Find-CodexThread.mjs](../../.github/scripts/Test-Find-CodexThread.mjs)，覆盖名称字段优先、路径前缀、归档、重名及只读文件保全。合成检查不代签平台列表全量能力或目标身份。
