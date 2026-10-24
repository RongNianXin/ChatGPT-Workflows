# Codex 任务续执行守卫

[English](README.en.md)

给单次新启动的 CLI 任务增加程序验收：任务准备结束时，独立检查器核对结果；未通过且预算有效，Codex 自动继续。AI 说“已完成”或 CLI 退出码为零，都不能单独算完成。

这是按任务启用的本地入口，不会给桌面现有对话安装钩子，不会恢复旧任务、发送跨窗口消息、修改全局配置、退出或重启 Codex。会话交接评估工具保持独立。本工具不启动常驻服务或定时任务。

## 使用方式

由负责该任务的 AI 根据操作者已授权目标，准备任务契约、原任务提示词和只读检查器。AI 负责填写路径、指纹和验收，不要求操作者提供测试样本或编写脚本。需要另授权的任务、资源或远端动作仍遵守原门禁，启动守卫不增加这些权限。

在已有 PowerShell 中运行：

```powershell
& './Start-GuardedTask.ps1' -Contract '<TASK_CONTRACT.json>' -Prompt '<TASK_PROMPT.txt>'
```

目的：仅启动这一份新的 CLI 工作。成功时末尾输出 `verified: true`，并给出本地运行目录；其他状态均未验收。异常时保留该目录中的 `state.json`、`cli.jsonl` 和 `cli.stderr.log`，交给 AI 诊断，不重新启动同一业务碰运气。默认使用现有 npm 安装的 CLI 和既有认证，不调用登录、注销或客户端重启命令；其他安装形式可用 `-CodexJs` 指定已安装的入口，不自动安装。

```powershell
node './guard.mjs' status '<RUN_DIRECTORY>'
node './guard.mjs' stop '<RUN_DIRECTORY>'
```

`status` 读取本次状态；只有 `finalized: true` 且 `verified: true` 才表示退出核账已经通过，运行途中的一次检查成功不能代签最终结果。`stop` 请求取消本次启动器拥有的 CLI 及其子进程，不操作其他 Codex 进程。已提交的业务副作用不能撤销。取消、截止时间或异常中止后，先核对原产物和在途副作用，不自动重放。

## 契约与检查器

契约为版本 1 JSON：`workItem` 是稳定工作项键；`cwd` 相对于契约文件；`maxMinutes` 是包含等待与检查的累计时限；`maxContinuations` 是自动续作上限；`maxNoProgress` 是相同产物/失败集合无进展的上限。它们是上限，不要求耗满，也不代替原高资源次数预算。

`checker` 固定 `executable` 可执行程序、`entry` 检查入口、`args` 字符串参数数组、`timeoutSeconds`（1–30 秒），以及程序和依赖文件的 SHA-256 指纹。使用解释器时，第一个参数必须是检查脚本入口；程序和入口都必须列入 `pins`。检查器必须经过审查，声明 `readOnly: true`、`network: "none"`、`idempotent: true`、`spawnsChildren: false`。启动器不把声明当作操作系统隔离：同账号、同文件写权下，不能抵御恶意修改；指纹主要防止误改验收标准。所有会改变检查结论的依赖都应固定；不得把业务运行、启动服务、联网或高资源测试藏进收口检查。

守卫源码、运行目录、唯一登记、检查器及其固定依赖必须位于被守卫工作树 `cwd` 之外。这可以减少正常业务误改验收和控制记录；不能用本仓库里的守卫直接守护整个本仓库根目录。其他业务项目可使用本工具，前提是已取得该项目的执行权限；本仓库内部测试则使用隔离子目录。需要守护本仓库整体时，应另行准备获准的外部控制位置，当前入口不会自动复制或修改仓库外文件。

契约结构示例（占位符由 AI 按实际任务填写，不能直接启动）：

```json
{
  "version": 1,
  "workItem": "authorized-work-batch-1",
  "cwd": "<AUTHORIZED_TASK_WORKTREE>",
  "maxMinutes": 60,
  "maxContinuations": 3,
  "maxNoProgress": 2,
  "checker": {
    "executable": "<EXISTING_NODE_EXECUTABLE>",
    "entry": "<REVIEWED_CHECK_SCRIPT>",
    "args": ["<REVIEWED_CHECK_SCRIPT>"],
    "timeoutSeconds": 10,
    "readOnly": true,
    "network": "none",
    "idempotent": true,
    "spawnsChildren": false,
    "pins": [
      { "path": "<EXISTING_NODE_EXECUTABLE>", "sha256": "<ACTUAL_SHA256>" },
      { "path": "<REVIEWED_CHECK_SCRIPT>", "sha256": "<ACTUAL_SHA256>" }
    ]
  }
}
```

检查器只读核对本次对象，标准输出仅一个 JSON，包含：

| 字段 | 要求 |
| --- | --- |
| `status` | `PASS`、`ACTIONABLE_FAIL`、`WAIT` 或 `BLOCKED` |
| `reason` | 简短原因，不含凭据 |
| `progressKey` | 固定产物指纹或失败项集合；不要使用当前时间或模型措辞伪造进展 |
| `pendingOperations` | 尚未取得最终结果的原操作标识数组，无则 `[]` |

对应退出码依次为 `0`、`10`、`20`、`21`。程序同时核对状态和退出码。空输出、乱码、崩溃、超时、指纹变化或带在途操作的 `PASS` 都不能通过。模型的完成声明不参与判断。需要人工判断的专业质量、产品满意度等应返回 `WAIT`，不能用文件存在冒充已验收。任务范围或授权变更时先停旧守卫，更新任务契约和已有责任记录，不能让自动续作替操作者作决定。

## 实际续作和停止

启动器只在本次 CLI 命令行注入 `Stop`、工具前后和中断钩子，不写用户级或项目级 `hooks.json/config.toml`。程序已审查这些固定钩子后，仅本次调用使用官方一次性钩子信任选项；不跳过业务审批或沙箱，CLI 使用 `workspace-write` 和不交互索权设置，权限不足时保持未完成。

- `Stop` 检查通过才记 `VERIFIED`；失败会返回官方 `decision: block`，让宿主将原因加入原回合继续执行。
- 已观察到的在途工具未结束时，不跑可能读到半成品的验收，只要求等待原调用结果；返回后台会话标识仍视为在途，回读原会话终态后才清除。命令结果未知也保留在途；明确权限拒绝会停止续作。守卫从不重放业务命令。专用工具未走生命周期钩子时，仍依赖检查器提供 `pendingOperations`，不能保证覆盖所有后台活动。文本终态识别不是操作系统级进程证明，任务检查器仍应核对本次真实产物和未完操作。
- 等待人工、阻断、取消、累计时限、续作次数和无进展上限都会停止自动续作，保留未验收状态。相同续作后结束事件无法区分重投与无进展时保守停止，可能提早转人工；不会以此无限循环。
- 规范化工作目录与稳定工作项键共用唯一登记；更换运行目录不能清零预算。重复启动拒绝进入业务。进程重启后可回读旧状态，不自动重启或接管旧 CLI；确认原副作用及新预算后由负责人准备新工作批次，不能只换键掩盖原预算。
- CLI 退出后另行核账。没有 Stop、没有验收终态、钩子报错或 CLI 异常退出，一律不报成功。稍后取消或钩子异常优先于较早的 `VERIFIED`；通过后又发生工具活动或新的结束事件，须重新验收。网络故障、宿主崩溃和人工中断不触发自动重放。

钩子不是语义万能判官，也不保证最终文字尚未显示给用户。这里只证明本机已测试的 CLI 路径；现有桌面对话尚未接入，不能宣称已获得相同防复发效果。官方说明：[Hooks](https://developers.openai.com/codex/hooks)、[非交互模式](https://developers.openai.com/codex/noninteractive)。

## 自动验证

```powershell
& './Start-GuardedTask.ps1' -SelfTest
```

测试自行构造输入，使用独立 `CODEX_HOME` 和本机模拟模型端点，不读取既有认证、不调用真实模型通道，不附着现有会话。红色基线证明“CLI 退出零但答案错误”；接入守卫后，真实 CLI 在同回合消费续作提示，正确结果通过独立算术检查，且业务命令执行零次。另测后台会话、未知和拒绝、重复启动、脚本变化、无进展、取消、异常退出及已有钩子兼容。模拟模型验证宿主控制链，不证明真实模型、业务算法、性能收益或桌面线程已通过验收。

此前的隔离工具执行试验被本机策略拒绝；未放宽权限或绕过策略，不能宣称业务写入链路已验证。现有工具前后状态、在途与不重放逻辑另有隔离事件测试。测试证据只保存在仓库已忽略的 `.planning/continuation-guard-tests/`；运行状态与唯一登记保存在 `.codex-manual-cache/task-continuation-guard/`。公开分发不得包含这些私有记录。
