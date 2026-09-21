# 变更日志

本文件记录 ChatGPT Workflows 的重要变更。

## 未发布：Git 仓库状态罗盘产品方案

- 已执行：记录面向 Git 新手的本地优先、只读桌面工具产品方案，明确区分工作区、本地提交、远端跟踪引用和 GitHub PR。
- 已执行：定义 v0 技术验证门禁、v1 功能边界、隐私与只读契约、测试夹具及已接受风险；该方案不包含代码实现、创建远端仓库或任何远端写操作。
- 已审查：方案结论为 `PASS_WITH_ACCEPTED_RISKS`；Wails/WebView2 兼容性、构建体积、安装与签名仍须在后续样机中验证。
- English: Added the Git State Compass product proposal for a local-first, read-only desktop assistant for Git beginners. It defines v0/v1 gates, safety boundaries, fixtures, and accepted risks; no implementation or remote operation was performed.

## 未发布：一键交接工具的批量选择与重复保护

- 已执行：一键交接工具可对列表中的单个已确认密文故障任务交接；只有人工输入 `Y` 才会批量处理该列表。批量项彼此独立，活动任务和同项目同名接续任务会跳过。
- 已执行：接续标题按字符数截断并保留后缀；离线自测补充密文故障识别、标题长度和恢复状态解析检查。
- 已验证：`--self-test` 与 JavaScript 语法检查通过。未执行扫描真实任务、批量交接、创建接续任务或集成测试；`--help` 尚未实现。
- English: The handoff tool supports one selected confirmed encrypted-content case, or an explicit `Y` batch choice. It skips active tasks and duplicate continuation titles in the same project. Offline self-tests passed; real scans, handoffs, and integration tests were not run, and `--help` is not implemented yet.

## 未发布：Markdown 阅读器拖拽位置提示

- 已执行：文档条目拖到目标上半区时插入前方，下半区时插入后方；对应边缘显示实线，避免原先只能猜测插入位置。
- 已验证：Windows 无头浏览器回归通过，覆盖前插、后插、桌面和移动视图、深色模式、链接与外部请求边界。
- English: Markdown Reader drag-and-drop now inserts before or after the target based on pointer position and shows the matching edge. The Windows headless-browser regression passed.

## 未发布：故障资料入口改名与暂停工具标识

- 已执行：故障库一级分类和案例资料夹改为按用户实际看到的现象命名，保留 `TRB-xxx`、`HTTP-xxx`、`SYS-` 等稳定索引；根目录症状表、跨模块引用、双语 README 和质量脚本同步更新。
- 已执行：`TRB-005` 的旧迁移研究、当前不可用的修复工具和会新建接续任务的交接工具均改为明确状态名；删除两个已暂停的真实操作入口，并保留纯虚构自测与安全边界。
- 已验证：Markdown 链接、双语 README、路径可移植性、隐私边界和故障库 10 个案例的仓库检查通过；交接工具离线 `--self-test`、旧迁移研究的安全与分页谱系测试通过。未执行真实迁移、真实回滚或创建接续任务。
- English: The troubleshooting library now names categories and cases by visible symptoms while retaining stable `TRB`, `HTTP`, and `SYS` identifiers. TRB-005 clearly separates legacy research, an unavailable repair tool, and a handoff tool that creates a continuation task. Repository checks, synthetic tests, and the offline handoff self-test passed; no real migration, rollback, or continuation-task creation was run.

## 未发布：交接封条 v3 与正式附件原子门禁

- 已执行：封条新写入升级为 schema v3，拒绝跨序号时间倒退、`sealed_at < fact_cutoff`、事件 ID 复用、轮换准备时间越界和无变化 `CURRENT_ATTESTATION`；旧 v1/v2 链只读保留并明确标为 `LEGACY_UNVERIFIED`。
- 已执行：新增正式附件生成器，依次核对受跟踪工具、规则 manifest、真实来源根、唯一 CURRENT/HISTORY 结构、Unicode 路径、封条和二次漂移，再通过临时文件与不可覆盖链接原子生成 `final-*`；失败不留下正式附件，交付回执明确为 `GENERATED_NOT_DELIVERED`。
- 已执行：正式交接状态收敛为 `READY / READY_WITH_RESTRICTIONS / BLOCKED / COMPLETED`，未注册颜色码或近似拼写不得进入封条、交接结论和完成回执。
- 已验证：封条定向测试通过 49 项，正式附件测试通过 7 项，覆盖原事故的时间回退、事件复用、无变化重复证明、CURRENT/HISTORY 越界、中文/空格/组合字符及长路径、NFC/NFD 冲突、`core.quotePath` 两种设置、私有封条目录和仓库外交付边界。真实项目下一次交接仍需生成实例封条并回读，工具无法阻止绕过它的宿主写入。
- English: New handoff writes use schema v3 and reject timestamp rollback, invalid transition timing, reused event IDs, and no-change attestations. Legacy v1/v2 chains remain readable as `LEGACY_UNVERIFIED`. A new atomic artifact builder verifies the tracked tool, rule manifest, live sources, CURRENT/HISTORY structure, and Unicode paths before creating a non-overwriting `final-*` file; unregistered status aliases are not accepted.

## 未发布：正式交接材料提交顺序

- 已执行：正式候选附件改为先收敛唯一 CURRENT、登记封条元数据、保存来源并实时验证 `MATERIAL_PREPARED` 封条，再生成和回读 `final-*`；阻断期间只允许 `draft-*` 诊断材料，不得送候选评分。
- 已执行：明确封条工具路径与项目实例 `source-root` 分开定位，附件 SHA-256 保存在封条来源之外，避免回写中央来源造成自引用；CURRENT 只保留唯一当前视图，历史迁入 HISTORY 并保留回查指针。
- 待验证：规则和静态检查通过后仍需由真实项目在下一次交接中验证该顺序；规则不能阻止绕过工具的宿主级写入。
- English: Formal handoff attachments are now created only after the single CURRENT view is converged and a live `MATERIAL_PREPARED` seal passes. Blocked diagnostics use `draft-*` and cannot be submitted for candidate scoring. Tool lookup, project source-root resolution, attachment hashing, and CURRENT/HISTORY ownership are now explicit to prevent source drift and self-reference.

## 未发布：非空答复提前结束故障防护

- 已执行：新增 `TRB-010`，将“任务未闭环即进入非空最终答复”与 TRB-006 的跨任务空回合分开记录；同一事故中的目标载体未消歧作为独立故障面，不伪造共同根因。
- 已执行：多部分请求和本轮执行承诺在最终出口按“请求项—实际动作—证据—状态”核账；跨任务发送先确认目标是 Codex 任务、用户还是群聊。质量脚本同步增加 TRB-010 结构检查和关键规则短语。
- 未验证：仓库没有宿主 pre-final 拦截入口，也尚未实现会话级事后告警；本批静态验证不能证明真实回合不会再次提前结束。
- 遗留风险：故障知识库结构检查仍未覆盖既有 TRB-008/009；本批没有借新增案例改写这两个旧记录。
- English: Added TRB-010 for non-empty responses that end before the task is closed, distinct from TRB-006 cross-task empty turns. Multi-part requests and in-turn action commitments now require a request/action/evidence/status check before completion, while outbound messaging must resolve the target channel and entity type first. No host-level pre-final interceptor or session-level detector has been implemented yet.

## 未发布：事故证据优先回归验证

- 已执行：自动化验证现在先将操作者上一轮提供且相关的故障证据整理为最小回归清单，在可获得且获准的等价条件下逐项复现和验收，再运行常规回归。
- 已执行：结果单列“已复现且已修复、已复现但仍失败、未能复现、证据或环境缺失、常规验证、未覆盖或待确认”。常规测试通过不能替代对原事故的验收；敏感来源、受控环境、前台控制和远端动作仍须另获授权。
- English: Automation now prioritizes relevant incident evidence supplied in the prior operator round. It recreates and verifies each incident under available, authorized equivalent conditions before routine regression. Routine passing tests cannot substitute for incident acceptance, and missing evidence or environments remain explicitly uncovered.

## 未发布：2E 人工验收数据来源

- 已执行：场景 2E 的人工反馈模板新增“测试的数据来源（可选）”，可填无、附件、路径或链接；反馈匹配范围扩展到数据来源，状态索引的人工验收记录同步保留该字段。
- 已验证：仓库质量检查与 Markdown 差异检查通过；数据来源只是证据定位信息，不自动证明测试覆盖、数据有效或验收通过。
- English: Scenario 2E now includes an optional test-data-source field. It can point to none, an attachment, a path, or a link; the field supports evidence traceability but does not itself prove coverage, data validity, or acceptance.

## 未发布：本地检查点与 Tag 策略

- 已执行：将“以可独立核验阶段建立本地 Commit、远端同步按实际协作或发布需要另行决定”写入总览、操作手册和核心规则。普通 Commit 默认不打 Tag；仅在已验证发布、明确回滚锚点或操作者指定稳定里程碑时建立中文本地 Tag，且不会自动推送。
- 已验证：本批工作流规则与封条校验通过现有仓库质量检查；本次为规则迭代检查点，不建立 Tag，也不执行远端写入。
- English: Local commits are now the default durable checkpoints for independently verifiable stages, while remote synchronization remains separately authorized and need-based. Tags are Chinese local markers only for verified releases, explicit rollback anchors, or operator-designated milestones; ordinary commits are not tagged or pushed automatically.

## 未发布：跨项目规则刷新接纳协议

- 已执行：操作者可用自然语言指定规则刷新目标与排除对象；发送方生成唯一 `RULE_REFRESH_ID`，把已发送、`RECEIVED`、实际重新加载、项目内耐久登记和合格 `COMPLETED` 分层核账。版本号与 SHA-256 只证明内容身份，不能代替语义接纳。
- 已执行：目标总指挥按影响范围读取受影响标题，范围无法可靠限定时才全文回退；完成回执必须列出实际读取范围、项目化行为变化、冲突/缺口、受限动作、本地记录回读和失效条件。一次完成回执不产生业务恢复、远端授权、运行验收或未来必然遵从的保证。
- 已验证：规则版本统一为 `2026-09-19.3`；仓库质量检查、40 项封条测试、Markdown/路径/隐私契约和 `git diff --check` 通过。本批未重新广播、未修改其他项目、未 Commit、未 Push。
- English: Cross-project rule refreshes now separate delivery, receipt, actual reload, durable project-local recording, and accepted completion under one `RULE_REFRESH_ID`. Hashes prove content identity only. A valid completion must report what was read, project-specific behavioral impact, conflicts, restrictions, record readback, and invalidation conditions; it does not restore business work, grant remote authority, or guarantee future compliance.

## 未发布：四阶段总指挥换任与封条轮换

- 已执行：把正常换任固定为“旧总指挥准备并冻结材料 → 新候选只读核验 → 操作者停止或归档旧总指挥 → 第二段确认后正式登记”。候选阶段旧任务仍存在及 `active → idle` 不再单独造成置信度降级。
- 已执行：封条 schema 升级为 v2，区分候选核验、`MATERIAL_PREPARED` 和 `TAKEOVER_COMPLETED`；正式跨世代写入必须消费在旧来源仍可回算时生成的不可变轮换意图。
- 已执行：链校验区分历史结构链与最新实时来源，拒绝缺失、篡改、重复、错误前序及过期未消费的轮换意图；`--history-only` 明示最新来源未检查，不能作为 READY/COMPLETED 凭证。旧格式首次迁移用 `CURRENT_MIGRATION` 建立当前序号 1；同一写者更新 current 后用 `CURRENT_ATTESTATION` 追加证明，不伪装换任。
- 已验证：封条合成测试通过 40 个案例，覆盖四阶段换任、pending intent、首次迁移、同世代重新证明、历史来源分层、CAS 与来源漂移。真实平台换任与跨任务确认在本轮广播后另按实际回执报告；未执行 Commit、Push 或远端写入。
- English: Formal commander rotation now follows four stages: the old commander freezes and seals the handoff, the candidate performs read-only verification, the operator stops or archives the old commander, and the candidate completes registration only after the second confirmation. Schema v2 requires a pre-update immutable transition intent for generation changes and uses `CURRENT_ATTESTATION` when the same writer re-attests updated current sources. The 40-case synthetic suite passed; no commit, push, or remote write was performed.

## 未发布：项目配置引用未注册模型提供商故障记录

- 已执行：新增 `TRB-009` 中英文脱敏记录，说明任务保存的 provider ID 与用户配置注册键不一致时，桌面端可能无法加载任务并反复显示 `Model provider 'OpenAI' not found`。
- 已验证：保留原 provider 配置并增加匹配别名后，目标任务由 `notLoaded` 恢复为 `idle`；公开记录未保留真实任务名称、配置原文、凭据或本机路径。
- 未验证：尚未发送新消息做业务回归，未取得网络请求日志或桌面端精确版本；本案例不能证明闪烁期间存在高频远端请求，也不能自动推广到其他任务。
- English: Added a sanitized bilingual `TRB-009` record for a task whose saved provider ID did not match the registered user-configuration key. Preserving the existing provider and adding a matching alias restored the task from `notLoaded` to `idle`. A fresh-message regression, network-request evidence, and the exact desktop version remain unverified; the record excludes the real task name, raw configuration, credentials, and machine-specific paths.

## 未发布：跨任务成果运输、授权请求与写入租约分流

- 已执行：把跨任务写入协作分为 `WRITE_HANDOFF`、`AUTH_REQUEST`、`LEASE_TRANSFER`；没有项目目录写入租约不再被表述为缺少用户业务授权。
- 已执行：非写者通过结构化成果交接把已核验内容、目标落点、证据、禁止项和回执要求交给现任写者；正常路径压缩为一次入口核对、一次交接、一次写入回执。
- 已执行：租约只保存在现有权威入口，中央索引仅保存指针和聚合字段；恢复时区分 `active/inProgress`、`idle`、`archived/notFound`，确认旧写者停止且无在途或结果未知写入后才转移租约。
- 边界：三类事件不产生彼此的权限；租约不扩大读取、Git、远端、发布、费用或自动化授权。规则版本和指纹变化会使旧交接快照按既有条件失效。
- English: Cross-task write coordination now separates `WRITE_HANDOFF`, `AUTH_REQUEST`, and `LEASE_TRANSFER`. Missing a directory lease is no longer reported as missing user authorization. Verified results move to the current writer through one structured handoff; lease state remains in the existing authoritative entry, while the central index stores only a pointer and aggregate fields. Lease recovery distinguishes active, idle, archived, and unavailable task states and requires the old writer to be stopped with no in-flight or unknown writes. None of the three event types grants the permissions represented by another type.

## 未发布：Markdown 阅读器远端相对链接回退

- 已执行：普通文件重新载入保留远端地址；不再凭安全新窗口的返回值误报弹窗被阻止。此批仅本地收口，远端发布待确认；真实远端页面与操作者体验未代签验收。
- English: Reloading a session file retains its remote URL. Secure window opening no longer misreports popup blocking based on its return value. This batch is finalized locally; remote publication awaits approval, and live remote content and user acceptance remain unverified.

- 已执行：为本地 Markdown 阅读器增加当前文档远端页面地址设置；已载入目标仍优先在阅读器内跳转，未载入的相对链接可按 `URL` 规则解析后在新标签页打开。
- 已执行：远端地址按文档保存，不硬编码仓库、账号或分支；只在用户点击后打开，不自动下载远端内容；未配置时保留原有离线行为。
- 已验证：阅读器语法与资源检查通过；Windows 无头浏览器回归通过，覆盖远端相对路径、中文路径/锚点编码、本地候选与远端候选共存、页面异常和外部请求检查。
- 边界：浏览器是否允许新标签页、远端仓库权限、远端页面当前内容和 GitHub 锚点实际显示效果仍由浏览器/远端服务决定；本批未执行 Commit 或远端写入。
- English: Added a per-document remote page URL for the local Markdown reader. Loaded targets still navigate locally; unloaded relative links resolve with standard URL rules and open in a new tab. The URL is stored per document, never hardcodes a repository or branch, and is used only after an explicit click; unset configuration preserves offline behavior. Syntax/resource checks and the Windows headless browser regression passed, including remote relative paths, encoded Chinese paths/fragments, local/remote candidate coexistence, page errors, and external-request checks. Browser popup policy, repository permissions, remote content, and GitHub anchor rendering remain environment-dependent; no commit or remote write was performed.

## 未发布：总指挥交接控制面封条与分层验收

- 已执行：把交接结果拆为 `control_handoff_confidence`、`switch_status`、`runtime_acceptance_status` 和 `professional_acceptance_status`；运行或专业验收未知时，只限制依赖它们的动作，不把未知代签为通过。
- 已执行：新增版本化 `HANDOFF_STATE.schema.json`、私有不可变封条链工具和交接合成测试。封条绑定世代、写者、单调序号、前序摘要、事件 ID、同截点来源摘要、`source_digest_status`、工作区/Git/远端基线和失效条件；写入使用独占锁、临时文件、flush/fsync、改名与 expected-previous CAS。
- 已执行：校验拒绝未知字段、危险路径、序号/摘要链断裂（包括首条序号不从 1 开始）、文件名与正文不一致、同世代换写者、同写者伪造新世代、残留锁或临时文件、不一致事实截点、远端失败、未回算来源、来源未验证或旧写者未停止；旧格式没有新封条时只能作为 `CONTROL_UNKNOWN` 迁移候选。
- 已验证：`node .github/scripts/Test-HandoffSeal.mjs` 通过 25 个合成案例，包含独立来源根目录的真实 SHA-256 回算、两个 Node 进程的锁/CAS 竞争、来源变更阻断、损坏 JSON、残留 `.tmp` 与残留锁；`node .github/scripts/Test-HandoffIdentity.mjs` 通过 16 个案例；仓库质量检查、Markdown 链接检查、双语 README、PowerShell 语法和 `git diff --check` 均通过。Markdown 检查同时修复了 Windows PowerShell 对无 BOM UTF-8 中文链接的误读。
- 未验证：同步盘/网络文件系统的真实占用时序、冲突副本策略、断电或崩溃恢复、宿主级写入拦截、真实任务切换或运行/专业验收；这些结果不能由本地合成测试代签。
- 验证边界：Windows PowerShell 5.1 已通过路径、Markdown 和双语 README 阶段，但随后在既有 `Repair-CodexThreadArchive.ps1` 的现代 PowerShell/JavaScript 语法处失败；因此没有把 5.1 全量仓库检查标为通过。PowerShell 7 等价检查已通过。
- 边界：本批仅修改本地工作流规则、模板、校验脚本和履历，未 Commit、Push、创建或修改远端对象，也未修改产品代码。
- English: Handoff results are now separated into control confidence, switch status, runtime acceptance, and professional acceptance. A versioned schema and private immutable seal chain bind generation, writer, sequence, predecessor digest, event, same-cutoff source digests, workspace/Git/remote baselines, and invalidation conditions. Deterministic tests cover 25 seal cases, including rejection of a chain that starts after sequence 1, SHA-256 recomputation from a separate source root, a two-process lock/CAS race, source drift, malformed JSON, leftover temporary artifacts, and stale locks. Real synced/network-storage contention and crash recovery, host-level fencing, real task switching, and runtime/professional acceptance remain unverified. This batch changed only local workflow rules, templates, validators, and the changelog; no commit or remote write was performed.

## 未发布：高资源验证分型

- 已执行：高资源、浏览器或模型验证在任务卡中先声明“流程／生成效果／两者”。流程只覆盖入口、交互和运行状态；生成效果必须单列素材清单、原图哈希、模型/资产身份与参考或人工判据。
- 已执行：缺少生成效果所需素材、样本或判定标准时，自动降级为流程、运行身份或接口验证，不能把 Playwright、截图、CI 全绿或页面点击成功写成算法效果验收。
- 已验证：测试手册将代码/资源到位、运行恢复、实际生成效果和人工验收分层报告；仓库检查锁定上述关键表述。
- English: High-resource validation now declares whether it covers workflow behavior, generated output quality, or both. Missing material, sample, or acceptance evidence restricts conclusions to workflow, runtime identity, or interface checks; browser automation and green CI cannot stand in for output-quality acceptance.

## 未发布：可复用故障的外部资料与本地收口

- 已执行：涉及外部产品/版本、证据不足、连续失败或可复用规则时，才触发一次有边界的公开资料检索；来源、版本、日期、支持事实和未证实部分分开记录，网友猜测不直接升级为结论。
- 已执行：达到故障库收口门槛后优先增量更新已有案例；只有新且可复用的问题才按命名规则新建记录，一次性小问题留在任务记录或变更日志。
- 边界：检索前脱敏；发帖、评论、Issue、上传和其他远端写入仍需单独授权。本地故障库收口不产生远端发布授权。
- English: Public research is triggered only for reusable, externally dependent, under-evidenced, or repeatedly failing problems. Existing incident records are updated before creating new cases; unverified discussions remain references, and any public posting still requires separate authorization.

## 未发布：发布候选的存储环境基线

- 已执行：自动化测试最小契约新增操作系统、运行时或 shell、普通本地/同步/网络文件系统、实际路径长度和已知平台限制；未知环境只限制依赖它的结论，不自动判定产品失败。
- 已执行：发布候选验证绑定精确包 SHA-256 与文件清单，先从全新短路径非同步目录建立基准；源码目录、旧解压副本和同名旧包不能代签。声明支持同步目录或网络文件系统时，再用同一候选做单变量兼容性对照。
- 已执行：同一测试装置错误连续两次后转既有链路诊断标准，区分路径限制、文件系统竞争、测试装置和产品行为，找到第一处可靠偏差后再修；不得把未经同包、同输入对照的换目录后通过、延长超时或重复全量测试当作故障已解决。
- English: The testing contract now records the operating system, runtime or shell, storage type and effective path length. Release validation binds the exact package hash and manifest, establishes a baseline from a fresh short non-synced extraction, and uses the same package for any claimed sync or network-storage compatibility check. Two repeated harness failures must enter the existing causal diagnosis flow before further fixes.

## 未发布：Windows SessionDesk dev.10 同步盘兼容修复

- 已确认：旧清单迁移后的页面超时来自同步盘短暂占用 `tasks.json`，接口返回共享冲突并留下 `tasks.json.pending`；服务快速重启时，`server.lock` 也可能被同步程序短暂占用。过深解压路径触发的 Windows PowerShell 5.1 路径限制是另一项独立环境问题。
- 已修复：原子写入把临时文件写入和正式替换分成有限 `IOException` 重试；服务锁获取也采用有限重试。持续失败仍抛出错误，快照保存失败仍对页面可见，`FileShare.None` 单写者约束保持不变。
- 已验证：同步盘最小迁移流程修复后连续 10 次返回 HTTP 200；精确的 10 文件 clean ZIP 在非同步短路径完整通过 47 项自动化模拟测试，`errors=[]`、`external=0`，未包含 `.local`、任务清单或连接文件。候选 SHA-256 为 `8C4D2E1C68A68C7B37A0F3977431704D99BA86A7A65AF5A018117D8EFC8BE0CC`。
- 边界：完整回归仍是合成数据，不能代表所有电脑、同步软件和真实会话。同步盘内的完整测试还可能因测试脚本直接写入夹具时被占用而失败，因此发布验收使用从精确 ZIP 解压出的非同步短路径副本。
- English: Added bounded retries for transient sync-folder sharing violations during atomic state writes and single-writer lock acquisition. Persistent failures remain visible. The exact ten-file clean ZIP passed all 47 synthetic checks from a non-synced short path with no page errors or external requests; its SHA-256 is `8C4D2E1C68A68C7B37A0F3977431704D99BA86A7A65AF5A018117D8EFC8BE0CC`. Coverage does not extend to every machine, sync client, or real session.

## 未发布：工作流规则统一写入门禁

- 已执行：规则、模板、检查脚本和根 `AGENTS.md` 的写入、暂存与 Commit 收归当前唯一总指挥；其他任务窗口只能回传带问题、事实、精确建议位置、影响、验证、风险和证据指针的建议包。
- 已执行：只有操作者完成正式总指挥换任，新的登记总指挥才能取得该写入权；同账号、专项委派、独立审查、通信回执和一般维护授权均不能例外。
- 已验证：仓库质量检查将核对这条职责边界的关键文字。该检查证明规则未被删改，不保证宿主平台强制阻止其他窗口写文件。
- English: Centralized writes, staging, and commits for workflow rules, templates, checks, and the root `AGENTS.md` under the currently registered sole commander. Other task windows may only return an evidence-backed proposal. The authority transfers only through a formal commander handoff; the repository check detects missing contract text but cannot enforce host-level file permissions.

## 未发布：事件触发的规则刷新回执

- 已执行：把“重新温习规则”实现为事件触发的 `RULE-REFRESH` 短回执。新任务/角色、上下文压缩或恢复、契约/场景/范围/风险/授权变化、长任务批次切换、高影响动作和最终汇报前，重新核对短状态、规则路径、指纹及当前动作的关键标题。
- 已执行：刷新结果记录触发原因、实际回读范围、`PASS / WARN / FAIL`、冲突缺口、受影响动作和下一失效条件。未实际回读、输出截断、路径不可访问或写入失败不能登记通过。
- 边界：采用稳定事件节点，不按固定分钟、消息数或工具调用后台轮询。该机制能留下重新加载证据并发现旧规则，不能直接控制模型注意力，也不能证明后续动作必然遵从。
- English: Added an event-triggered `RULE-REFRESH` receipt for task/role start, context recovery, scope or authorization changes, long-task batch transitions, high-impact actions, and final reporting. It records fingerprints, actual reread scope, outcome, gaps and expiry conditions; it is auditable evidence of reloading, not a guarantee of model attention or compliance.

## 未发布：Windows SessionDesk dev.10 发布前证据清单

- 已执行：新增唯一的 47 项命名自动化模拟测试清单，明确排序、刷新和角色分组属于该清单内的覆盖内容，不再与其他统计口径重复相加。
- 已验证：对 SHA-256 为 `8C4D2E1C68A68C7B37A0F3977431704D99BA86A7A65AF5A018117D8EFC8BE0CC` 的 10 文件候选 ZIP，在全新短路径非同步目录运行候选基线的测试脚本，结果为 47/47、`errors=[]`、`external=0`；非合成启动返回 `0.2.0-dev.10` 和 `local-readonly`，受控退出成功。现有公开截图的版本、布局和主要控件与该副本一致，但截图本身不证明构建哈希。
- 边界：运行时、ZIP、测试脚本或存储位置变化都会使这份结果失效；自动化模拟不代表所有设备、同步客户端或真实会话。
- English: Added a single manifest of 47 named automated simulation checks, with sorting, refresh, and role grouping counted only within that set. The exact ten-file ZIP with SHA-256 `8C4D2E1C68A68C7B37A0F3977431704D99BA86A7A65AF5A018117D8EFC8BE0CC` passed 47/47 checks from a fresh short non-synced extraction, with `errors=[]` and `external=0`. A non-synthetic startup reported `0.2.0-dev.10` and `local-readonly`, then stopped cleanly. The public screenshot matches its version, layout, and primary controls, but does not prove the build hash.

## 未发布：Windows SessionDesk dev.10 本地发布候选

- 已执行：将工具中英文 README 的测试数量从 45 项改为实际记录的 47 项自动化模拟测试，并明确这些测试不代表覆盖所有电脑、系统环境或真实会话。
- 已执行：旧 dev.10 ZIP 以原 SHA-256 保留为历史测试产物；从当前源码重新生成 10 文件候选包。新包 SHA-256 为 `D3F8C0A3B82EB8E13902FA08A2A336059A1C91D0ABFDCE678CD24042E2357B55`，不含 `.local`、任务清单、连接文件或已检出的机器专属路径。
- 已验证：新 ZIP 在短路径解压后通过服务启动、版本显示、任务保存、虚构查询、详细报告、零页面错误/外部请求和界面退出等 8 项冒烟检查。现有公开截图与当前 dev.10 的版本、控件和布局一致，但截图不含构建哈希，不能证明来自这个精确 ZIP。
- 未验证：本轮完整 47 项重跑在“旧版任务迁移后等待页面”处发生不稳定超时，没有形成新的全通过凭证；此前的 47 项通过记录继续作为历史证据，不能替代本轮结果。过深解压路径还会触发 Windows PowerShell 5.1 路径长度限制，继续要求解压到较短路径。
- English: Updated both tool READMEs from 45 to 47 automated simulation checks and stated their coverage limits. Rebuilt the ten-file dev.10 ZIP from current source, preserved the old candidate by its original hash, and passed an eight-step smoke test after extracting to a short path. A fresh full 47-check run remains unverified because the harness timed out after legacy-task migration; the screenshot matches the current dev.10 interface but cannot prove exact ZIP provenance.

## 未发布：下一步建议改为可直接执行的交棒

- 已执行：日常汇报出口现在必须区分三种情况：AI 在授权内直接继续、操作者按明确步骤手动操作、操作者复制完整提示词发给 AI。只列项目待办不再算合格的下一步建议。
- 已执行：手动操作必须说明位置、步骤或命令、目的、成功表现和异常反馈；需要另发消息时，必须提供标题为“可直接发送”的独立文本块，并预填对象、范围、禁止项和验收标准。
- 已验证：`git diff --check` 与仓库质量脚本通过。本批只修改本地工作流规则、耐久检查和履历，不涉及远端写入。
- English: The daily reporting exit must now distinguish work the AI should continue within existing authorization, explicit manual steps for the operator, and a complete prompt the operator can send to an AI. A bare project to-do list is no longer an acceptable next action.

## 未发布：压缩恢复后的重复创建防护

- 已执行：登记一次总指挥在上下文压缩后恢复已完成教学目标、再次调用 `create_thread` 并生成第二个独立任务的现场；两个任务各执行一次，不是原教学窗口自行重跑。
- 已执行：每次创建前按来源请求、规范化目标和交付类型核对近期相关任务；复用初始化中/进行中任务，回读未交付的既有结果，已交付任务只有在操作者本轮明确要求重跑时才能重建。
- 已执行：发生上下文压缩或恢复后，旧创建计划失效；必须重新核对最新有效请求、完成回执和任务映射。第二次实际运行使用 Sol，现有证据不支持把 Terra 作为根因。
- 已验证：`git diff --check` 与仓库质量脚本通过；本批没有重放真实创建流程，也没有修改 Codex 宿主调度器，行为级防护的真实运行效果仍待验证。
- English: After context compaction, the coordinator restored a completed teaching request and called `create_thread` again, producing a second independent task. Task creation now checks the source request, normalized objective, delivery type, existing task state, and completion receipt; any pre-compaction creation plan must be revalidated before execution.

## 未发布：授权说明、连续执行与本地等价 CI 验证

- 已执行：授权确认在精确字段前先用人话说明拟做动作、原因、预期改变、风险/资源/耗时、成功结果与异常停止或所需反馈；该概览不替代精确授权卡，也不把进度更新伪装成授权请求。
- 已执行：明确普通进度告知不要求操作者逐阶段回复或暂停。只有新授权、人工决策、明确停止条件或无法限定影响的异常才等待反馈。
- 已执行：项目提供可本地复现的受影响 CI Job 时，优先执行等价 Job；无法等价时，说明浏览器、服务、权限或环境差异的限制。规则不要求全量 CI 或特定项目参数。
- 已验证：同步更新模板、授权规则、测试手册和静态耐久契约；来源项目的 PR、提交、浏览器、DOM、测试文件与 CI 结论均未写入本仓库。
- English: Authorization requests now start with a plain-language summary of the action, rationale, expected change, risk/resources/time, successful result, and stop or feedback path. Routine progress updates do not pause authorized work. When a project provides a reproducible local command for an affected CI job, run that equivalent job first or disclose the environment gap.

## 未发布：场景 2C 的可选诊断证据

- 已执行：场景 2C 增加可选诊断证据字段和“行车记录仪”说明，明确日志、trace、请求标识、阶段产物或后台观测不是入场券；AI 能自行取得时不要求操作者重复提供。
- 已执行：有限记录先冻结版本、输入和现象，再做少量受控尝试；刷新、换输入、改参数或切模式前按覆盖边界及时导出。日志缺失只暂停依赖它的归因，日志存在也不能代替原始输入、运行身份、人工观察、可信真值或可证伪根因验证。
- 已执行：补充页面内存记录的刷新提示：普通刷新、关闭或离开页面前先保存；硬刷新只用于怀疑前端资源缓存或 AI 明确要求取新资源，不作为日常复现或日志保存步骤。
- 已验证：规则只补充 2C 操作者入口与既有链路诊断手册，没有复制 09 连续执行或 10 规则复用；差异检查与仓库质量检查通过。来源项目的端口、路径、容量和产品字段未进入通用规则。
- English: Scene 2C now treats logs, traces, request identifiers, stage artifacts, and backend observations as optional evidence rather than an entry requirement. The AI acquires accessible evidence first, requests minimal operator steps only when necessary, preserves bounded records before state changes, and never treats a log as ground truth or causal proof.

## 未发布：功能删减的影响面与测试契约门禁

- 已执行：自动化测试手册要求在删除、隐藏、改名或迁移功能前，沿实际引用核对共享组件、公共接口、运行时契约和测试消费者，不把单一页面通过当作影响面完整。
- 已执行：CI 失败区分真实产品回归、合法需求变化后的过期测试契约、测试装置或环境错误及有证据的时序波动；修正测试不得只为变绿削弱断言。受影响测试文件或等价测试单元须完整运行，但不机械扩大为整库或高资源测试。
- 已执行：删除类需求使用“目标不存在或不可达 + 保留的关键业务行为仍正确”的组合证据；项目组件名、DOM 和具体测试写法不进入通用规则。
- 已验证：差异检查与仓库质量检查通过；本次只更新工作流文档和静态耐久契约，未在来源项目重跑产品测试。
- English: The testing guide now requires dependency-aware impact checks before removing or hiding behavior, classifies CI failures before changing assertions, runs the affected test file or equivalent unit without forcing a full-suite run, and pairs absence checks with evidence that retained behavior still works.

## 未发布：PR 最终事实与本地 amend 的披露边界

- 已执行：PR 标准明确区分从未对外可见的本地 amend、已 Push/进入 PR、CI、审阅、其他远端引用或被协作者取得的旧 Head，以及未外发但涉及安全、隐私、数据处置的旧 Head。前者的 PR 正文只描述最终 Head；已对外可见者必须如实说明相对上次可见 Head 的实质增量并重新核验；未外发的敏感处置事实保留在本地受控审计记录，PR 只写最终 Head 必需的脱敏影响、修复和剩余风险。
- 已执行：不要求逐次记录纯本地排版或措辞试错；既有本地任务状态或受控审计记录保留最终 Head、验证证据，以及会影响安全、隐私、数据、范围或验证有效性的事实，避免把本地日志当作远端协作记录的替代品。
- 已验证：本次仅合并进现有“精确 Head”条款，没有新增平行流程或规则文件；仓库质量检查与差异检查通过。
- English: The PR standard now distinguishes a purely local, never-visible amend; a prior head that was pushed, entered PR/CI/review or another remote reference, or reached collaborators; and a never-visible head involving security, privacy, or data handling. Only the final head belongs in the first PR narrative. A previously visible head requires a truthful incremental update and renewed checks; a never-visible sensitive case stays in controlled local audit records, while the PR contains only the necessary redacted impact, fix, and residual risk.

## 未发布：跨任务回执按回合排队并隔离契约

- 已执行：把不可抢占边界从整个长期任务缩小到正在运行的当前回合。回合执行中收到的跨任务消息进入 FIFO 队列；本回合完整输出后优先处理队列，再恢复原任务断点。窗口已处于回合间空闲点时，即使原任务仍有后续步骤，也不能阻塞回执。
- 已执行：每条跨任务消息使用独立事件契约，不得与接收窗口原任务合并目标、范围、授权、事实或验证结论。规则与故障记录已补充截图所示的“长期任务阻塞回执”和“外部审查混入本地画像任务”两类现场现象。
- 待验证：本批只修正文档行为契约与静态质量检查，未修改 Codex 宿主调度器，也未进行真实跨窗口消息试验；空回合等底层故障仍保持未解决。
- English: Cross-task messages now queue only behind the currently running turn, not behind an unfinished multi-turn task. Each message uses an isolated event contract, is handled before the previous long-running task resumes, and cannot inherit or merge that task's scope, authorization, facts, or conclusions. Runtime behavior remains unverified because this change does not modify the Codex host scheduler.

## 未发布：操作者画像跨项目接管与三个场景入口

- 已执行：将原 Pe1 拆分为 Pe1-(a) 开启或接管、Pe1-(b) 持久关闭、Pe1-(c) 从粘贴文本/精确路径/直接链接生成候选；新项目定位同一规则根后继承已核验的画像选择和修订号。场景 1A 现支持无文件、Git 或远端的本地空白项目，不会为启动总指挥擅自初始化 Git 或创建远端。
- 已执行：所有已启用窗口在指定断点检查新证据，由当前总指挥默认统一写入；姓名、年龄、职业等身份资料经逐字段确认后只能进入独立本地档案，不进入跨项目画像、索引、交接或自动接管。硬禁止载荷继续拒绝写入。
- 已验证：仓库质量脚本、Markdown 差异检查和本地画像 Git 隐私边界通过。本批只本地维护，未 Commit 或发布；未在另一个真实空白项目中启动新总指挥做跨窗口现场演练。
- English: Split operator profiles into enable/takeover, disable, and external-source entry points. A new project can inherit a verified rule-root-level choice, while one profile writer merges checkpoint candidates. Identity details such as name, age, and occupation require field-level confirmation and remain in a separate local-only record; they do not enter the cross-project profile, index, handoff, or automatic takeover flow.

## 未发布：统一计划、进度与存档入口

- 已执行：把“写进计划、记录成果、保存进度、存档、留档”等自然语言纳入通用语义路由；详细材料按用途保存，同时把仍影响执行、验收、阻断、暂缓或恢复的事项同步到项目中央工作项清单。
- 已执行：明确中央清单、当前进度视图、会议/专项证据、CHANGELOG 与工程 TODO/Issue 的职责，并要求交接快照投影全部非终态事项、优先级、断点、恢复/失效条件和证据指针。
- 已验证：规则入口版本统一为 `2026-09-16.1`；规则契约、Markdown 链接、双语 README、PowerShell 语法、差异检查和仓库质量检查通过。本批仅本地维护，未 Commit 或发布。
- English: Added a shared semantic route for plan, progress, result, and archive requests. Projects keep one central work-item register for resumable state, a concise current-progress view, detailed evidence in its original records, and portable handoff snapshots that remain projections rather than new sources of truth.

## 未发布：补充社区交流说明

- 已执行：在中英文 README 的许可证章节前补充 LINUX DO 社区链接和交流说明；英文采用中性表述，避免暗示官方背书、合作关系或发布资格。
- 已验证：同步刷新英文 README 的中文源 SHA-256 标记，并完成仓库质量检查与差异检查。本次文档修改已提交并推送到远端默认分支。
- English: Added a LINUX DO community link and a neutral community statement before the license sections in both README files. Refreshed the English page's Chinese-source SHA-256 marker. The documentation update has been committed and pushed to the remote default branch.

## 未发布：历史分支审计与安全清理

- 已执行：场景 4E 扩展为 Issue、PR 与历史分支的统一只读收口入口。分支审计必须区分祖先关系、补丁/树等价、PR 最终 Head、PR 后追加提交、未结责任和恢复用途，并单独盘点 stash；本地分支、远端分支、stash、worktree 分别制卡和授权。
- 已验证：仓库质量脚本覆盖上述耐久契约。该规则不预设单人或团队协作方式，也不把“已合并 PR”直接等同于“当前分支可删除”。真实分支删除效果未在本批验证；删除仍需针对精确对象另行确认。
- English: Scene 4E now audits stale issues, pull requests, and branches through one read-only convergence entry. Branch cleanup distinguishes ancestry, patch/tree equivalence, the PR's final head, later commits, unresolved responsibilities, and recovery use. Local branches, remote branches, and worktrees require separate action cards and authorization; no branch deletion was performed in this batch.

## 未发布：唯一日常主工作区与隔离载体可见性

- 已执行：为单人维护项目增加唯一日常主工作区规则；自然语言“修改本地项目/工作流”默认指已登记入口的当前权威默认分支，不能静默创建、切换或把后续工作转移到其他分支/worktree。
- 创建或切换隔离载体前须说明路径、起点、必要性、用途、禁止项、回归主线方式和保留条件，并取得本次明确确认；任务结束须报告实际修改位置、成果层级、遗留载体和日常入口对齐状态。该默认不外推到其他项目或多人团队。
- English: Added a single daily workspace policy for explicitly registered solo-maintained projects. Natural-language requests to modify the local project target that workspace's authoritative default branch. Moving work to another branch or worktree requires an explicit, informed confirmation and an end-of-task location and convergence report; this policy does not apply automatically to other repositories or team workflows.

## 未发布：发布前本地资源与推送引用核验

- 已执行：4A 和 PR 标准补充沿运行/验收依赖定点发现相关忽略或受限资源、原位保留、实际待上传历史核账和接收方复现限制；09 明确单分支授权不包含附带标签或其他引用。
- 不新增按文件类型划分的子场景；沿用其他发布入口对 PR 标准的引用。未验证：真实外部项目的资源状态和远端推送效果。本批仅本地文档维护。
- 已验证：`git diff --check` 和 `.github/scripts/Test-Repository.ps1` 通过；检查对象为当前混合工作区，不代表其他未提交任务已完成审阅。补充区分 LFS、推送钩子、Release 附件和制品上传的载荷与授权。
- Verification: Diff whitespace and repository quality checks passed against the mixed working tree, not a review of unrelated pending work. LFS, push hooks, release attachments and artifact uploads require separate payload and authorization checks.
- English: Publishing guidance now checks relevant ignored or restricted resources through runtime and acceptance dependencies, preserves local resources, audits the actual push history and references, and records recipient reproducibility limits. Branch authorization does not include extra tags or refs. No file-type-specific scenarios were added; external project state and live push behavior remain unverified. This is a local documentation update.

## 未发布：按风险分层的对抗式审查

- 所有指令执行前均做一次相称检查：简单任务静默快速检查，复杂或高影响任务才展开结构化对抗式审查；审查问题必须有事实或明确推理依据。
- 第二次对抗式复审改为条件触发，只针对实际产物、新证据、范围变化和受影响回归，不机械重复第一次审查。验证和汇报前事实核对继续保留，但不各自计为审查轮次。
- 操作者主动要求审查时，与当前阶段原定审查合并，不额外叠加；只有新证据、范围变化或产物形成后的独立风险才触发定向复审。本批只更新本地文档，尚未 Commit 或发布。

### English summary

- Require one risk-proportionate preflight check for every instruction: simple work gets a silent quick check, while complex or high-impact work receives structured adversarial review supported by evidence or explicit reasoning.
- Make a second adversarial review conditional and targeted to actual artifacts, new evidence, scope changes, and affected regressions. Verification and pre-report fact checks remain mandatory but do not each count as review rounds.
- An operator-requested review is merged with the review already required for that stage rather than added mechanically. A targeted follow-up occurs only for new evidence, scope changes, or artifact-specific risk. This batch updates local documentation only and has not been committed or published.

## 未发布：Worktree 人话别名与可追溯登记

- 新增项目内唯一且不复用的 worktree 稳定别名；别名用于交流定位，规范路径、分支和 HEAD 仍作为 Git 事实回读，不能把别名误当 Git tag。
- `WORKTREE` 记录补充用途、特色、禁止及受限操作、责任方、状态、替代映射和清理/保留条件；限制必须独立登记，不能只写在名称里。
- 登记缺失、别名重复或映射冲突时，只允许必要的只读归属核验；修复前不得自动开发、汇合、迁移、发布或清理该 worktree。本批只更新本地文档，尚未 Commit 或发布。

### English summary

- Add a project-unique, non-reusable human-readable alias for each worktree. The alias is a conversational locator, while canonical path, branch, and HEAD remain the Git facts; it is not a Git tag.
- Extend `WORKTREE` records with purpose, distinguishing traits, prohibited or restricted actions, ownership, lifecycle state, alias replacement mapping, and retention/removal conditions. Restrictions must be stored separately rather than only encoded in a name.
- Missing, duplicate, or conflicting mappings permit only the minimum read-only attribution checks until repaired. This batch changes local documentation only and has not been committed or published.

## 未发布：更新 Markdown 阅读器真实运行截图

- 已执行：用操作者提供的最新 1920×919 PNG 运行截图替换 `实用小工具/Markdown阅读器/assets/workflow-reader-preview.png`；已回读目标文件并确认与附件 SHA-256 一致。该截图仅作可选展示材料，不作为运行依赖。

### English summary

- Executed: replaced `实用小工具/Markdown阅读器/assets/workflow-reader-preview.png` with the operator-provided latest 1920×919 PNG runtime screenshot and verified the target SHA-256 matches the attachment. The screenshot remains optional showcase material, not a runtime dependency.

## 未发布：交接失败的分层诊断与一致性交付

- 已执行：补充 04 的通信、材料与身份分层核验；要求先验证候选收到的附件版本，再判断旧副本、漏更新或后续漂移；交付前逐字段回读 current 与实际成果。
- 已执行：区分更早前任与当前移交方，明确草稿身份冲突和认证切换仅作待核验线索；这些文档约定不是宿主自动拦截。未验证：第三方认证切换故障根因与正式接管。本批尚未提交或发布。
- English: Added layered handoff diagnosis, received-attachment version checks, field-by-field current-state verification, and distinct predecessor/transferor roles. Provider-switch causality and formal takeover remain unverified; these are workflow rules, not host-enforced controls. Not committed or published.

## 未发布：交接失败回退场景与证据修复

- 新增场景 1I“交接失败时如何处理”，明确提示词发送给移交方 AI，并要求填写当前恢复置信度（中/低）及依据来源（复制对话窗口原文、口述总结或其他）。
- 固化交接失败的回退链：候选正文不可读、断点缺失、事实冲突或完成声明无法回溯时，先由移交方修订证据和快照，再由候选重新执行场景 1D 的独立只读核验；不以新建空白对话、重复发送或平台“已完成”标记替代核验。
- 交接快照继续区分已提交树、当前工作树、中央状态和逐对象证据；场景 1I 不授予中央调度权、远端写入权，也不覆盖未提交成果。

### English summary

- Add Scene 1I, “What to do when handoff fails,” with a prompt addressed to the transferring AI. It requires the current recovery confidence (medium/low) and evidence source (copied conversation text, verbal summary, or other).
- Fix the fallback chain: when the candidate cannot read the response, the checkpoint is missing, facts conflict, or completion claims cannot be traced, the transferring AI must repair the evidence and snapshot before the candidate repeats Scene 1D read-only verification. A blank chat, repeated submission, or a platform “completed” flag is not a substitute for verification.
- Handoff snapshots continue to separate the committed tree, working tree, central state, and per-object evidence. Scene 1I grants neither central dispatch authority nor remote-write permission and never overwrites uncommitted work.

## 未发布：跨任务经验吸收与交接回执边界强化

- 修正交接快照的基线表述：明确区分“已提交树与远端目标一致”和“当前工作树含未提交差异”，并把中央状态冲突列为交接阻断；补充快照生成后的失效复核要求。
- 为专项任务增加开始/结束 `git status` 回报和默认不自行 Commit/Push/合并的边界；为 PR 合并、远端更新和本地 `main` 切换增加按需只读 Fetch 与差异核对前置。
- 统一 Markdown 阅读器 README 哈希校验的换行规范，并增加目录层级的浏览器断言。
- 将跨任务交流中可复用的经验纳入研发侧工作流：回执先区分可复用规则、项目特定约定和未证实建议，只有完成适用性、冲突和隐私核验后，才能写入规范源或质量契约。
- 强化自动化交接快照：存在已登记、待恢复、暂停或替代中的自动化时，逐项记录用途、逻辑任务、世代、频率/时区、配置或提示词指纹、通知设置、授权范围、最后可靠成功截点、平台核验、来源、核验时间和失效条件；不复制完整提示词、凭据或私有目标。
- 明确平台任务 ID 只是运行时定位线索；回执、成果、授权和平台完成标记分开登记，“已发送”不等于“已确认”，接口不可见不等于目标未收到。
- 本批同时记录了对操作者操作手册整体重排、场景迁移和提示词格式统一的维护背景；上述手册及联动规则已完成本地提交，远端分支与 PR 状态以发布后的实际回读为准。

### English summary

- Incorporate reusable cross-task experience into the development workflow: classify incoming findings as reusable rules, project-specific conventions, or unverified suggestions, and update canonical rules or quality contracts only after applicability, conflict, and privacy checks.
- Strengthen automation handoff snapshots. When an automation is registered, pending recovery, paused, or replaced, record its purpose, logical task, generation, cadence/time zone, configuration or prompt fingerprint, notification settings, authorization scope, last reliable success checkpoint, platform verification, source, verification time, and invalidation conditions—without copying full prompts, credentials, or private targets.
- Treat platform task IDs as runtime locators only. Track acknowledgements, artifacts, authorization, and platform completion separately: “sent” is not “confirmed,” and an invisible read result is not proof of non-delivery.
- This batch also records the maintenance context of the broader operator-manual reorganization, scene migration, and prompt-format normalization. It also corrects handoff snapshot baseline wording, adds central-state conflict blockers and post-snapshot invalidation checks, adds scoped-task `git status` reporting and Fetch prerequisites, and aligns Markdown Reader README hash verification on normalized line endings.

## 未发布：重排操作者手册场景编号与入口

- 重新建立“场景一至六”和可选场景的注册表，补充普通任务交接、无上下文故障接管、项目初步分析、队友工作接手、独立模块规划、PR/Issue 操作及资料查询的初版提示词。
- 删除旧的“本地连续开发”独立编号：本地开发、验收和交付准备归入普通场景 2；旧 2D 的安全汇合改为场景 4I，并明确不等于开发、人工验收或 GitHub Merge。
- 将执行—独立审查协作从旧 2F 简化为场景五四个子场景；画像改为“可选场景一：个性化定制”的可开关子场景。
- 旧编号保留兼容映射，不产生新授权；本条记录的本地文档改动已随本地提交保存，远端状态以发布后的实际回读为准。

### English summary

- Rebuilt the operator-manual registry for Scenes 1–6 and optional scenes, adding initial prompts for ordinary task handoff, context-free recovery, project analysis, teammate takeover, independent module planning, PR/Issue work, and reference research.
- Removed the standalone local-development number: local development, acceptance, and delivery preparation now belong to Scene 2; the former 2D safe-convergence flow is Scene 4I and does not imply development, human acceptance, or GitHub Merge.
- Simplified execution plus independent review from legacy 2F into four sub-scenes under Scene 5; moved the profile feature under optional “Personalization.”
- Legacy numbers remain compatibility aliases and grant no authorization; this entry records the local documentation changes and is included in the current local follow-up commit.

## 未发布：移除任务卡片上的单轮上下文交接提示

- 删除任务卡片中仅由单轮上下文占比触发的 85%/95% 交接提示，避免把不参与累计评分的指标误读为交接等级。
- 终端和报告继续保留上下文占比，用于诊断自动压缩原因；评分仍只使用文件体积和自动压缩次数。

### English summary

- Remove task-card handoff reminders triggered only by single-turn context usage, so a non-scored metric is not mistaken for the cumulative handoff level.
- Keep context usage in terminal and report output for diagnosing automatic compaction; scoring still uses only file size and compaction count.

## 研发历程与后续计划 / Development history and roadmap

本节把分散在历史提交、工具文档和工作记录中的信息汇总为可维护索引；逐条变更的细节仍以本文件后续条目和实际产物为准。

### 已确认的演进 / Confirmed evolution

- **会话交接评估工具**：从本地任务查询与保存，逐步扩展到 Windows 工作台、历史结果与报告、交接评分和分级提醒；评分算法、页面视觉样式及兼容旧数据的显示逻辑均有研发记录。
- **故障解除与恢复能力**：增加归档路径异常修复工具，并持续沉淀跨窗口交接、自动化结果关联、会话过长和客户端异常等排查案例。
- **工作流与展示入口**：补充离线 Markdown 阅读、脱敏展示图、中文规范源与英文入口，逐步把规则、操作手册和公开展示材料分层维护。

以上是根据当前可见的历史提交、变更日志和仓库文件交叉核对出的事实；“未发布”条目仍表示研发记录，不自动表示已合并或已验证通过。

### 当前状态 / Current status

- 已发布的文档与展示入口继续以仓库现状为准；本轮脚本、工具文档和工作流规则修改已形成本地提交，是否进入远端发布以分支和 PR 回读结果为准。
- 仓库质量检查仍存在既有的编码、链接和 Markdown 结构告警；这些问题与本节路线图相关，但尚未在本次变更中解决。

### 候选路线图 / Candidate roadmap

以下是暂存的研发想法，不是承诺、排期或已授权执行项：

1. 修正质量检查器对 UTF-8 路径、Markdown 代码围栏和跨平台路径的误报，并补充可复现测试。
2. 为展示入口增加轻量的中英内容同步检查；页面已有翻译按钮时继续以中文为源，避免维护重复静态译文。
3. 补齐 Windows 以外环境的运行验证和关键界面人工验收，明确哪些能力仍是平台特定实现。
4. 将当前工作区的混合修改按功能拆分、逐项验证后再形成独立提交，避免把未验证实验混入发布。

### 维护规则 / Maintenance rule

- 每次 commit 前，先梳理并更新本文件：记录变更范围、证据、验证结果和未验证限制，并按现有语言规则提供中英说明；纯内部 commit 至少记录其范围或明确标注无用户可见变化。
- “已讨论”“计划执行”“已执行”“已验证”必须分开写；候选想法不得写成完成事实。远端状态、提交和发布状态以实际回读结果为准。

### English overview

This section indexes the evolution reconstructed from visible commits, tool documentation, and repository records. Detailed entries below and the current files remain authoritative. The handoff evaluator grew from local task lookup and saving into a Windows desk with history, reports, scoring, tiered reminders, algorithm changes, visual redesign, and legacy-data compatibility. Recovery work added archive-path repair and troubleshooting records for cross-window handoff, automation-result association, long sessions, and client failures. Offline Markdown reading, redacted showcases, a Chinese source of truth, and an English entry were added to keep rules and public material maintainable.

The roadmap items above are candidates only. Before every commit, update this changelog with scope, evidence, verification, and limits; for internal-only commits, at least record the scope or state that there is no user-visible change. Clearly separate discussed, planned, executed, and verified work.

## 未发布：明确更新介绍的双语输出规则

- 默认要求每次更新介绍、变更摘要或发布说明同时提供中文和英文。
- 已集成翻译按钮或语言切换的页面默认只维护中文源；英文由读者点击翻译查看，除非翻译功能失效或验收明确要求静态英文文本。

### English summary

- Require Chinese and English for every update description, change summary, or release note by default.
- On pages with a working translation or language-switch button, maintain only the Chinese source by default; readers can click to view English, unless the feature is unavailable or static English is explicitly required.

## 未发布：强化“无需回传”消息的双通道反馈门禁

- 将“无需向来源回传”和“必须向操作者可见反馈”拆成收到消息后的强制双通道分流步骤。
- 明确要求立即输出已收到、实际状态和下一步；把空输出、仅工具卡片或平台完成标记列为反馈缺失，避免新任总指挥将“无需回执”误解为“无需任何输出”。

### English summary

- Turn the distinction between “no reply to the source” and “visible feedback to the operator is still required” into a mandatory two-channel routing step.
- Require an immediate received/status/next-step message and classify empty output, tool cards alone, or a platform completion flag as missing feedback, preventing new commanders from interpreting “no ACK” as “no output”.

## 未发布：会话交接评分第二道警戒线与十格滑条

- 将交接参考分扩展为 0～10 分：文件体积与自动压缩次数各贡献 0～5 分，3 分进入“建议交接”，8 分（含 8）进入“必须交接”。
- 任务卡片新增 10 格静态滑条、3/8 细刻度、悬停与键盘聚焦提示，并保留旧快照无评分字段时的兼容显示。
- 上下文占用不混入会倒退的总分，85% 和 95% 改为独立提醒；这些档位是本地经验规则，不是官方限制。

### English summary

- Extend the handoff reference score to 0–10: file size and automatic compaction each contribute 0–5 points, with 3 entering **Handoff recommended** and 8 (inclusive) entering **Handoff required**.
- Add a static 10-segment task-card slider with subtle 3/8 ticks and hover/focus text, while keeping legacy snapshots without score fields compatible.
- Keep sawtooth context usage out of the cumulative score and show separate 85% and 95% reminders. These bands are local heuristics, not official limits.

## 未发布：heartbeat工具结果关联失败400的证据分流

- 在TRB-007补充heartbeat后持续工具结果关联失败的来源样本、匿名错误及快速处置分流，与会话过长400和自动化实例更新失败分别判断。
- 区分来源方日志复核、本窗口报告指纹核验及官方API契约；保留请求转换与实际运行版本缺口，不把新分支可用、社区方案或曝光目标当作修复通过。
- 反馈优先检索已有同类报告，仅在最终授权后补充最小证据；本轮未发布、修改代理、重放业务或重建自动化。

### English summary

- Add a source-reported case of persistent tool-output association errors after a heartbeat to TRB-007, with an anonymized signature and a separate HTTP 400 routing entry.
- Distinguish source-side log inspection, report fingerprint verification, and the public API contract. Runtime versions and request transformations remain unverified; a working branch or community workaround does not establish a fix.
- Prefer relevant existing reports and require final authorization before sharing minimal evidence. No publishing, proxy changes, business replay, or automation recreation was performed.

## 未发布：明确总指挥交接附件与标准模板

- 场景6交付明确默认主附件、补充材料条件、接收窗口及场景6A完整标准模板位置，避免操作者在多个材料入口间猜测。
- 自动创建受阻时提供同一标准流程的人工路径；保留候选只读、停止旧写者、最终确认和必要成果可访问的门禁，不将一个快照当作跨位置源码包。

### English summary

- Identify the primary handoff attachment, when additional materials are required, the recipient, and the full Scene 6A template instead of leaving users to choose among multiple links.
- Provide the same standard manual path when automated task creation is unavailable. Preserve read-only candidate verification, stopping the previous writer, final confirmation, and access to required artifacts; a snapshot is not a source transfer package.

## 未发布：补齐长会话长度400的路线对照边界

- 补充同一旧任务在操作者报告切换官方账号后短回复成功、切回中转后再次长度拒绝的观察；区分平台可见结果、操作者说明和未核验的实际出站路线。
- 不再把新建任务作为唯一恢复方式；保留停止故障路线重复投递、保护未提交成果及有限验收边界，不将短回复成功当作完整业务恢复。

### English summary

- Record a successful short reply in the same existing task after a user-reported switch to direct account sign-in, followed by another length rejection after switching back to a relay. Separate observed outcomes, user reports, and unverified outbound routing.
- Keep recovery options open while stopping repeated submissions on the failing route. Preserve uncommitted work and require scoped validation; a short reply does not establish full workflow recovery.

## 未发布：PR审阅修复与合并后本地接续

- PR标准第8节补充审阅、CI与冲突修复的影响分析和定向复验，核对隔离发布分支与未提交开发成果的包含关系，不因提交号不同就认定内容分叉。
- 第10.1节明确按实际合并结果选择本地接续方式，不默认反向合并或覆盖工作区；补充回归留证、定位、修复与回退边界，并分开报告合并、接续和运行验收状态。
- 沿用既有成果契约和发布/同步路由，不新增场景、提示词或长表，不扩大本地、远端和部署授权。

### English summary

- Add impact analysis and targeted revalidation for review, CI, and conflict fixes, including content mapping between release branches and uncommitted development work.
- Clarify local continuation after the actual merge result, without automatic reverse integration or overwriting working trees. Preserve regression evidence and distinguish code, deployment, and data recovery.
- Reuse existing artifact and synchronization contracts without adding prompt entry points or granting new permissions.

## 未发布：合并操作手册重复提示词

- 2B 与 4A 共用人工反馈模板，允许如实填写未执行或不确定，并保留对象匹配、验收证据和返工权限边界。
- 2F 的补充反馈与收口后返工共用一个入口，由 AI 核对批次及有限返工条件；3A/3B 共用协作队列模板，保留全量、增量及不可靠截点升级规则。旧编号和定位链接继续可用。
- 精简 2B/2D 选择说明、2C 预期结果和 6B 恢复说明；交接准备、候选核验、正式切换及其他不同权限入口仍分开，不以合并模板扩大授权。

### English summary

- Share one manual feedback prompt between 2B and 4A, preserving unperformed and uncertain results, evidence matching, and rework permissions.
- Consolidate ongoing and post-completion feedback in 2F, and share one queue prompt between 3A and 3B. Keep bounded rework, full and incremental scans, checkpoint validation, and legacy navigation.
- Shorten repeated explanations while keeping handoff preparation, candidate verification, formal switching, and distinct permission boundaries separate.

## 未发布：场景 6 默认接续未提交成果

- 合并重复的交接补充提示词，场景 6 单一入口明确覆盖未提交修改、必要新文件与详细证据；场景 6A 要求候选回读实际成果，不以摘要或提交号代替。
- 区分同工作区保留、跨位置恢复和编辑器未保存内容。交接快照不等于代码传输，不新增创建任务、通信、打包、覆盖或远端权限；无法取得的必要内容继续标为缺口。

### English summary

- Consolidate the duplicate handoff prompt. Scene 6 includes uncommitted changes, required new files and evidence by default; Scene 6A requires reading the actual artifacts rather than relying on a summary or commit identifier.
- Distinguish keeping files in the same worktree, restoring them elsewhere and unsaved editor buffers. A handoff snapshot does not transfer code or grant task creation, messaging, packaging, overwrite or remote permissions. Required content that cannot be obtained remains an explicit gap.

## 2026-09-10：离线 Markdown 阅读器与工作流展示

- 新增离线阅读入口，支持选择原始文档、多文档切换、目录定位、正文搜索、代码复制、明暗主题和打印；首次无已记住的文件时显示空列表，不内置操作手册快照。
- 已选择的原文件可在切换文档、返回窗口或主动刷新时尝试重读；记忆取决于浏览器接口和权限。普通文件选择需重新选择，没有后台监听或目录扫描。所有条目均可移除，只清除列表和保存的文件引用，不修改或删除原文件。
- 展示页新增阅读器打开总指挥操作手册的真实截图；图片归入阅读器资产目录，仅作可选说明，不成为工具运行依赖。根规则明确小工具对工作流文件默认只读，限定放行不替代其他权限门禁。
- 将 Markdown 解析器锁定为 14.2.0 并同步离线资源，修复依赖公告 [GHSA-38c4-r59v-3vqw](https://github.com/advisories/GHSA-38c4-r59v-3vqw) 和 [GHSA-6v5v-wf23-fmfq](https://github.com/advisories/GHSA-6v5v-wf23-fmfq) 涉及的特制文本解析耗时问题。
- 解析器、图标和许可证随工具分发，不上传正文、不加载外部图片。暂不渲染公式、Mermaid和图片；真实系统剪贴板、文件选择器授权记忆及其他操作系统仍待验证。Windows无头浏览器检查不代替这些人工验收。

### English summary

- Add an offline Markdown reader with user-selected documents, outline navigation, text search, code copying, printing and light/dark themes. Start with an empty list when no files are remembered; no manual snapshot is bundled.
- Selected original files can be reread on selection, return or refresh when browser permissions allow. Session imports require reselection. There is no background watcher or directory scan. Removing any entry only clears its list record and saved reference; source files are never modified or deleted.
- Add an approved screenshot of the reader displaying the commander manual to the showcase, stored with reader assets as an optional visual reference. Root rules make workflow files read-only to tools by default; scoped exceptions do not replace other permission requirements.
- Pin the Markdown parser to 14.2.0 and rebuild offline assets to address crafted-input parsing slowdowns described in GHSA-38c4-r59v-3vqw and GHSA-6v5v-wf23-fmfq.
- Parser, icons and licenses ship locally. Documents are not uploaded and external images are not loaded. Formulas, Mermaid and images are not rendered; native clipboard, picker permission persistence and other operating systems remain unverified.

## 2026-09-09：统一2B发布准备与2D按需汇合

- 保留2B/2D编号与旧锚点：2B承载本地实现、验收和发布准备，2D是可由2B调用、也可独立使用的安全汇合子流程，不按长期未同步自动触发。
- 共用只读路由区分单侧、双侧、已包含、未提交增量及未知归属；远端单侧更新不自动发布，查询不可靠不预设Merge。只读查询、Fetch和工作区变更分别核权限。
- 汇合沿原工作项和执行卡推进，变化后只重验受影响证据并更新同一有效发布卡；旧基线授权不自动沿用。验证采用十类静态场景、旧入口兼容与仓库质量检查，未运行真实同步或验证所有AI的自然语言路由。

### English summary

- Preserve scene numbers and legacy anchors. Scene 2B covers development and release preparation; 2D provides on-demand integration for 2B or a standalone synchronization goal.
- A shared read-only routing guide distinguishes one-sided changes, uncommitted work and uncertain ownership. Fetch and working-tree changes require their applicable permissions; remote-only changes do not imply publication.
- Reuse the work item and execution cards, revalidate affected evidence and renew invalidated authorization. Validation is documentary and does not establish live synchronization or model routing behavior.

## 2026-09-09：按用途筛选发布内容

- PR手册统一核对项目事实、仓库规则、本轮排除和文件用途；个人/团队项目、代码扩展名或AI合成都不自动决定能否提交。展示素材与获准测试数据可为交付物，秘密及明确排除项仍受原门禁约束。
- 区分产品、测试、展示与临时取证依赖，检查源码内嵌数据和诊断工具副作用；检查最终树及全部待上传历史，不靠后续删除或忽略规则掩盖历史内容，不自动削测试、改架构或清理原成果。
- 验证为十类反例静态走读及仓库质量检查；新增脚本约束只检查文档条文存在，不是自动内容审核器，也不证明真实项目发布或跨机复现已通过。

### English summary

- Select release content by its purpose, repository rules and explicit exclusions. Project type, file extension or AI generation does not establish permission; approved presentation assets and test data can be deliverables.
- Distinguish runtime, test, presentation and temporary diagnostic dependencies. Inspect embedded data, tool side effects, the final tree and all history to be uploaded without silently weakening tests or changing project structure.
- Validation covers ten documentary counterexamples and repository checks. Added assertions check policy text, not actual content approval or cross-machine reproducibility.

## 2026-09-09：下一步明确由谁执行

- 现有规则已要求行动方、预填授权和人工操作包；本次将03汇报出口按AI执行、人工操作、交替、等待/停止及剩余任务澄清，避免只给抽象建议。
- 02重型步骤摘要区分缺少授权与已有有效授权；06增加行动方表达核验。保留原授权、资源、跨窗口收口和失败停止门禁，不增加每轮确认或必填表。
- 验证采用七类文档静态场景和仓库质量检查；规则文本不保证所有窗口已加载或今后必然正确执行。

### English summary

- Clarify who performs the next action, what the user must confirm or do, and when to wait. Existing reporting requirements remain the basis.
- Distinguish missing authorization from valid existing authorization for resource-intensive steps. Preserve permission, resource, coordination and failure-stop boundaries without repeated confirmation forms.
- Validation uses seven documentary scenarios and repository checks; it does not establish that every task has loaded or will correctly apply the rules.

## 2026-09-09：分层汇报与正式履职加载

- 澄清阶段汇报：当前任务展开剩余子项，其他关联任务概括状态；跳转不丢暂停主线，父任务完成取决于验收，不按子项实现或取消自动判完成。
- 技术结论先解释对象职责、实际发现和证据边界；不看内部编号和日志也应知道结论及下一动作。
- 轻量候选与正式履职分开：首次实质汇报加载03/06出口，复用既有加载记录；指纹一致不等于全文已读或理解正确，不增加每轮全文阅读。
- 验证范围：三个虚构用户例及17个边界场景静态走读、仓库质量检查；实际跨任务效果和长期收益仍未验证。来源项目、真实服务、产品与远端操作不在本批范围。

### English summary

- Reports expand remaining steps for the current task and summarize other related tasks. Switching topics preserves paused work; parent completion requires acceptance evidence.
- Explain the object's purpose, findings and evidence limits before internal identifiers or logs. First substantive reporting after handoff loads the relevant reporting rules; matching fingerprints do not prove reading or understanding.
- Validation covers documentary scenarios and repository checks, not live cross-task reliability or long-term benefits.

## 2026-09-08：成果连续性、协作收口与故障知识库

- 将交接成果身份拆为 Git、工作区增量、依赖构建、实际运行、输入验收五层；明确同机同 worktree、新 worktree、跨机及 PR 合并后的不同核验路径。保留未提交成果，不承诺远端自动传递；文本规范化与二进制精确校验分开，未知和未验证不记为通过。
- 场景 2F 泛化为跨窗口执行与独立审查；执行与审查角色不改变原有调度身份，面向操作者的下一步由收口方统一。补齐换窗、归档续接与消息状态证据，减少重复执行及互相冲突的操作建议。
- 故障材料整理为 7 个稳定编号案例及中英文导航/模板，区分上游请求失败与本地分页谱系损坏。迁移工具真实安装和回滚均已暂停，保留虚构回归和研究材料；本次不恢复真实迁移能力。
- 验证：仓库质量检查通过，成果身份新增 13 项（7 项虚构 Git/文件实验、6 项文档边界检查）。独立审查核对最终规则及指纹。未进行真实补丁恢复、跨操作系统或真机模型/性能验收。

### English summary

- Handoff identity now separates five layers: Git, working-tree changes, dependencies/builds, actual runtime, and inputs/acceptance. Same-worktree, new-worktree, cross-machine, and post-merge checks have explicit boundaries. Uncommitted results require verified continuity or restoration; remote repositories do not transfer them automatically.
- Scenario 2F supports cross-window execution and independent review without changing existing authority. A coordinating role consolidates user-facing next actions; continuation material and explicit messaging states help prevent duplicate work and conflicting instructions.
- Troubleshooting is organized into seven stable cases with bilingual navigation and templates. Upstream request failures and local paginated-history damage are distinct. Real migration installation and rollback remain suspended; only research materials and synthetic regression tests are retained.
- Repository checks pass, including 13 new identity checks: 7 synthetic Git/file experiments and 6 documentary boundaries. Final rules and fingerprints received independent review. Actual patch restoration, cross-platform operation, and real model/performance acceptance remain untested.

## 2026-09-07：代码精简与可复现交付

本轮重点是让精简和交付有可核对的依据，同时减少操作者查找模板和重复填写参数的步骤。

- **代码精简：**独立入口改为场景 2G，旧 2B-1 保留兼容定位。先建立可删除或合并的证据、原有效果基线和分批恢复方案；同时验证实际收益与不退化条件。统计包含抽取模块和新增依赖，不以行数下降或平均分提高代替验收。
- **PR 表达：**写清问题、修改范围、前后行为、具体输入、操作步骤、预期结果和实际证据。通用测试命令保留基础回归价值，但不能作为本次改动的全部验证；未验证项明确保留。
- **交付与跨机复现：**检查接收者能否取得依赖、配置、模型和样例，核对实际运行入口与合并结果。效果与耗时分开定位，不将同一提交、作者本地成功或硬件不同视为充分结论。
- **日常使用：**2B 管本地开发与验收，2G 管代码精简，2F 管执行与独立审查。自然语言入口按目的、状态、对象和权限选取已有场景；发布意图主动加载交付标准，无需 PR 时不强制创建。可核实参数由 AI 补齐，沿用已确认角色及有效授权。
- **验证边界：**规则经过仓库检查及虚构情境静态走读，不代表任意机器、模型或真实项目都已实测通过。此次介绍更新不修改工具程序，也不创建新的工具安装包。

## [Unreleased]

- 将故障资料重构为按故障层分类、使用稳定 `TRB-xxx` 编号的知识库；首页提供按症状导航，并新增中英文故障记录模板。统一标明解决状态、工具状态、最后核验和证据边界；拆分跨供应商密文错误与迁移后分页谱系损坏，清理空白/重复入口和公开别名。迁移工具的真实安装与真实回滚均改为失败关闭，只保留源码和虚构测试供审查。
- 新增“换窗与归档前连续性门禁”：总指挥换任继续使用正式快照；主线分支和普通任务归档至少生成可直接发送的新窗口续接提示词。材料区分已完成不可重复、执行中、结果未知和未开始事项，保留旧授权不继承与失效条件；直接点击客户端侧栏归档属于 AI 不可观察动作，操作手册明确提示先在对话中整理材料。
- 场景 2F 更名为“跨窗口执行与独立审查协作”，把执行者和独立审查者改为不覆盖原身份的逻辑角色。当前窗口可以执行时只补一个独立审查窗口；总指挥、普通任务和专项任务均可参与，但项目中央调度与单写权保持唯一。自然语言路由会先核对本地画像修订，普通同窗口自检或只讨论场景不会误建配对。
- 跨任务通信新增 `ACK_REQUIRED` 强制状态协议：唯一消息编号、最小回传授权、`RECEIVED / BLOCKED / COMPLETED / FAILED` 状态和重复消息去重。业务权限不足也返回 `BLOCKED`；空字符串、纯空白或只有平台完成标记不算回执。
- 故障记录补充三次“消息正文已进入目标任务，但模型返回空字符串且平台标记完成”的复发现象。诊断时分开核对发送、读取接口可见性、目标页面、本地回复和反向 ACK；不再用 `items: []` 单独证明消息丢失，也不据此断定模型被替换。
- 双向通信实验进一步区分前台任务占用、模型不受线路支持和可用模型空回合。排除前两项干扰后，空闲目标仍出现“平台完成但没有规则读取、状态输出或回传工具调用”；强制回执规则能阻止误报和重复执行，但不能修复底层线路。

- 正式场景新增一次性可见路由回执：命中时说明场景与关键依据，连续反馈不重复；该提示不替代规则加载、授权、验证或完成凭证。专项任务沿用母任务场景，不重新裁定全局路由。
- 可选本地协作画像新增有限的自然语言路由别名与修订失效机制：稳定表达可减少重复填参，候选表达不自动决定场景，高风险动作仍须独立确认；任务间只同步修订号，不传播私有正文或建立后台轮询。
- 多项请求新增“活跃请求清单—确认卡覆盖—执行后回表”闭环：最小下一步只表示当前顺序，不能隐藏或结束其他未完成事项；AI 漏写的事项不得事后归因于操作者未授权。
- 项目规则允许明确任务所需的仓库外文件默认只读，其他 AI 可提供读取指针；仓库外写入仍须操作者明确授权，禁止自动扫描扩围或把材料当执行授权。
- 自然语言入口增加多项请求逐项覆盖、按实际复杂度分流、未完成项留存与下一步提示词核验；沿用既有复杂工作链，不新增场景、审批或后台任务。

- 会话工作台在工具根目录提供 `Start-SessionDesk.cmd`，统一克隆与独立包的启动方式；明确 `windows-local` 为正式内部程序目录。测试副本及个人数据不进入公开仓库。

- 明确跨项目工作流经验默认由来源窗口总结、指定公共维护窗口去重落地；限定直接修改的例外，保留项目内已授权纠错能力。补齐仅回执与执行派发的区别，不将“不新增授权”误解为撤销既有授权，也不把消息投递冒充实际推进。

- 配对协作规范修订为 2026-09-07.3：澄清反馈后须给出处理安排、下一行动方及操作者动作；补充反馈发给审查者时的转交责任，区分建议、投递与接收。沿用原授权和轮次，不新增后台任务或人工表单。

- 开发规则补齐测试版本的数据连续性：核实实际入口、备份并沿用兼容数据；遇到多份冲突不静默覆盖。个人测试数据不进入公开安装包，团队规范继续优先。

### Windows 工作台 dev.9（2026-09-07）

- “查看结果”仅在有成功且非空的缓存输出时启用；无缓存、正在查询和无可用缓存的失败状态均禁用，避免把状态记录误当成查询结果。保留已有历史恢复与双语切换行为。

### dev.9 包含的 dev.8 改进

- 桌面双栏底部对齐，窄屏保持纵向布局；上下箭头移动后选中并显示被移动的任务。
- 一键整理保留项目首次出现顺序；组内总指挥置顶，普通任务保持原序，同主题同编号且无重复的专项审查者与执行者成组排在后面，组内保留原序。未知归属和不明确配对不强行合并。
- 同步中英文排序说明，正式分析器与历史存储策略不变；随 dev.9 一并发布。

### Windows 工作台 dev.7 与工作流更新（2026-09-07）

- 工具退出按钮移至页面顶部，保留中英文悬停说明；退出后显示明显提示，告诉用户可以关闭页面。后台退出、任务与查询历史保存及正式统计策略保持不变；关闭网页本身仍不会停止后台服务。
- 默认克隆入口和独立 ZIP 推荐 dev.7，旧 dev.6 Release 保留供回退。dev.7 源码与打包候选分别通过 37 项隔离虚构回归，操作者反馈人工试用无问题；不宣称 macOS 或所有浏览器已验证。
- 操作者手册精简人类说明，把 AI 执行与模板核验规则集中到核心规则；场景 2E 改为填写具体目标、由 AI 核实运行参数并交付验收入口。
- 委派允许传递已核实、范围明确的用户授权，避免单纯因跨窗口重复索要确认；通知与执行仍分开，授权不能扩大，隐私和直接人工确认门禁保留。规则检查不代表跨窗口实测已通过。
- 团队与仓库规则优先于个人工作流细节；仅在已确认的个人项目中按变更重要程度编写更新说明，不强制每次 Push 新建 Tag、Release 或评论，不产生未来远端授权。

下面同日的协作规范条目也包含在本次累计发布中，具体变化保留在各条目。

### 有界直联与反馈返工（2026-09-07）

- 2F 改为已授权配对优先直联，总指挥负责启动、例外与终点；同步根约定、角色卡和状态接口，不用规则文本代替通信授权。
- 明确批内补充、收口后有限返工及同问题累计失败，默认两轮、最多三轮；重复反馈不清零，不把未解决问题包装为新批次。
- 模板身份统一为“专项执行者”和“专项审查者”，已有窗口名称保留，独立核对要求不变。
- 操作手册使用 2F-1 至 2F-6，逐段标明发给谁、等谁、预期和异常处理；普通反馈不需要重新粘贴角色规则。
- 区分文档就绪与旧窗口加载确认。静态走读覆盖正常、返工、上限、权限不足、重复消息和附件不可达；未宣称实际互审运行或 Token 收益已验证。


### 执行与独立审查协作（2026-09-07）

- 新增按需协作规范与操作者场景 2F，统一专项执行者、独立审查员、总指挥的职责；补齐已有任务换任、新任务创建、人工反馈和两类角色提示词。
- 默认总指挥串行转交，成果版本绑定、默认两轮最多三轮、无问题提前结束；历史直接通信不自动迁移，专项不因意见扩大实施授权。创建、确认联络与业务执行分别登记。
- 澄清画像节点漏查的补做：历史选择、本次安全核验与维护结果分开，未执行不冒充失败或无新证据；补查只按实际时间记录，不阻断主工作流。
- 对照两类既有本地协作记录形成通用试行模板；完成阶段走读、权限与隐私复检、链接及仓库质量检查。通用规范不包含来源项目身份、产物或私有画像内容，不代表各领域效果验收。


### 发布与使用方式更新（2026-09-07）

- Windows 会话工作台 dev.6 成为推荐入口，提供独立 ZIP；支持任务清单、排序、双语、结果历史与明确的退出操作。关闭网页不会退出后台服务，需点击“退出工具”。旧原型和实验报告退出正式目录，Git 保留历史；命令行分析器和有效回归样例继续保留。
- 工作流补齐自然语言统一入口、跨窗口提示词的标准模板核对、每次汇报的具体下一步、换任后的专项联络确认及自动化测试边界。既有角色与权限门禁继续适用，不产生新的远端授权。

### Fixed

- 修复会话评估 PowerShell 分析器按 JSON 字段文本顺序识别事件导致的漏计；改用对象层级并复用解析结果。两种 PowerShell 运行时各完成 23 组虚构对照，保留截断记录策略差异；新增持续回归和未实施的完整性方案，未接入真实会话。


### Added

- 会话评估新增真实字段结构的虚构兼容样例、浏览器验证页和对照报告：20 组中 18 组一致，2 组分别记录原脚本字段顺序漏计与截断记录策略差异；原分析器保持不变，未声明完整兼容或接入真实会话。

- 会话交接评估新增单文件浏览器分析验证页和可行性报告：只接受自定义虚构日志，经用户选择后后台分块解析，并按内容核验内存缓存；列明约 64 MiB 样例实测、异常与取消行为及 macOS 未验证边界，不接入真实分析或自动目录扫描。

- 会话交接评估新增离线单文件任务面板原型：仅以虚构数据演示搜索、收藏、单项/批量刷新、缓存、失败恢复和报告入口，不读取真实会话；中英文模块说明同步列明浏览器存储与平台验证边界。

- 新增统一效果预览页，直接展示场景 2C 和会话交接评估的两张真实截图；中英文首页与对应模块提供醒目入口，核心文档不再依赖深层折叠区发现图片。
- 操作者协作画像规范增加经双重确认、不可逆纯黑遮挡的真实运行效果预览；原始画像与本地来源资料仍不进入公开仓库。
- 新增 `ChatGPT-Web`：收录两份可审阅的篡改猴用户脚本、Chrome 用户脚本权限说明、安装入口和不含账号信息的设置示意图。
- 新增“文字版流程图提示词”，可按已确认拓扑或指定源码生成等宽纯文字流程图，并保留分叉、汇合、循环和不确定性边界。
- 新增仓库级双语 README 契约：公开目录的中英文 README 必须成对互链，英文页绑定中文源哈希；质量脚本会递归阻止漏建页面和未复核的旧译文。
- 新增无外部依赖的 `PIPELINE_STEP_DECK_TEMPLATE.html`：链路较长或需要逐步讲解时，可按同一节点编号生成支持按钮、方向键、步骤计数和总览的本地 HTML；证据区兼容图片、表格、代码、日志、指标与明确缺失状态。
- 新增 `11-操作者协作画像规范.md`：公开文件只定义可选协作适配、证据、过期和隐私门禁；真实画像使用被 Git 精确忽略的本地实例，默认关闭且可随时更正、暂停或删除。
- 新增 `PR_SUBMISSION_AND_REVIEW_STANDARD.md`，把 PR 正文、精确 Head 审查快照、实际验证、未验证项、Review 回复闭环和合并前活状态核对统一为可复现的交接契约。
- 新增 `PIPELINE_DIAGNOSIS_AND_ALGORITHM_TUNING_STANDARD.md`，以实际执行图、阶段契约、第一处可靠偏差、因果实验、最小修复和分层回归处理输出异常，并提供 AI 引导操作者理解排查过程的通用模板。
- 新增场景 3C“过时对象审查与收口”，以远端当前事实和可复现验证识别明确可关闭的 Issue/PR；证据不足一律保持开放，扫描后须由操作者逐项确认，无关闭权限时只生成需另行授权的负责人留言方案。
- 新增“基于真值对照的自动化负反馈闭环测试”提示词，要求逐样本核账、保留最佳方案并禁止通过降低标准制造测试通过。
- 新增 README 的 30 秒开始入口、双语项目摘要和仓库质量状态徽章。
- 新增适配 Markdown、PowerShell 和 Windows 归档修复工具的 GitHub Actions 自动检查。
- 新增“故障检查”和“其他 Codex 技巧性提示词”分类入口。
- 增加 `/其他资料/` 的 Git 忽略规则与 AI 访问边界，避免本地私有资料进入公开交付。
- 新增脱敏的故障排查资料、分类导航和可移植的会话迁移工具。
- 新增相关项目、MIT 许可证边界和独立实现差异说明。
- 新增 Windows `thread-store` 归档故障诊断文档和单任务、可回滚的自助修复脚本。
- 新增带图形界面的 Windows 归档路径修复工具，区分在线只读分析与退出 Codex 后的离线修复。
- 新增 Codex `thread not found` 的低风险恢复案例与操作顺序。

### Changed

- 固化 worktree 生命周期记录：新建 worktree 必须登记任务、时间、目的、基线、变更摘要、责任方和清理条件；来源不明时暂停自动合并、迁移和清理。第二 worktree 的可复用规则已抽取，未提交草稿不整批迁移。

- 第二代总指挥入口升版为 `2026-09-05.5`：需要操作者另发指令时按需附上可直接发送的下一步提示词，复用已确认事实并保留选择权；不机械附加、不推迟已授权工作，也不预置新的权限。

- 第二代总指挥入口升版为 `2026-09-05.4`：统一操作手册、任务卡、授权回执和专项文档的公开措辞，使用清晰、具体的说明替代口语化表达与能力标签；保留既有操作步骤、接口和权限边界。

- 第二代总指挥入口升版为 `2026-09-05.3`：模型策略改为沿用已选且适用配置，取消强制最低档起步；仅在有证据的阶段变化或质量/成本需要时评估调整。API 能力、客户端设置和订阅额度分开核对，不将跨模型档位等价或固定型号写成长期要求。
- 规则复盘先区分执行失误、证据不足和规则缺口；新增按需时效核验与退役，由实际使用、升级信号或相关维护触发，不新建周期扫描或全仓时效台账。更新或退役须核对依赖与替代证据，保留安全门禁和历史凭证。
- 统一接管汇报为身份、交接结论、接续断点、下一步与边界四段；公开文档采用专业表达与低操作负担标准。中英文首页增加对应能力入口，说明效果、跨模型一致性和时效边界。

- 场景 2C 分步 HTML 的上方步骤计数改为复用当前和末尾选项卡的稳定节点编号；从 `00` 或 `01` 起编均可，页面计数不再与底部阶段索引错一位。增强器升版为 `2.0.1`，同时兼容修正旧页面。
- 场景 2C 的分步 HTML 采用通用证据契约：节点六模块、页面与一键复制来自同一数据源；执行身份和产物身份分离，只有完整产物身份完全一致时才折叠视觉卡，长图仍导出全部执行记录；显式 `comparisonKey` 才允许语义配对。增强器加入节点级图例、关键参数标题、结构化复制和原生保存位置选择，专项标准升版为 `2026-09-04.1`。
- 场景 2C、链路排查专项标准和分步 HTML 模板采用 `场景2C·紧凑顶格版（B版）`：桌面端左侧说明与右侧输出独立滚动，成功/失败标题贴顶，阶段索引横向跟随当前节点但不改变页面纵向位置，并压缩标题、右栏说明和底部导航，把更多高度留给真实阶段输出；同排成功/失败卡片会按较高者补齐，避免说明换行差异使后续图片逐行错位，窄屏单列不启用该补高。质量脚本同步锁定 `scene2c-compact-flush-b-v2` 布局合同，专项标准升版为 `2026-09-03.3`。
- 第二代总指挥 `00`、`02`、`10` 与轻量交接启动配置升版为 `2026-09-03.2`：新增克隆可移植性边界，仓库内引用默认使用相对路径，脚本从自身位置或当前仓库根动态解析；运行时绝对路径继续用于仓库外输入、系统目录和破坏性动作的边界校验，但不得固化为作者机器依赖。质量脚本同步阻止机器专属绝对路径和“已忽略但仍被跟踪”的文件进入公开提交。
- 第二代总指挥 `00`、`02`、`10` 与轻量交接启动配置升版为 `2026-09-03.1`：新增“核心设计目标与新功能审查基线”，工作流功能必须证明协作净收益、保持简单入口、按需加载并让依赖失效可见；该检查默认静默完成，不新增表单、后台任务或固定长报告。
- 场景 2C 与链路排查专项标准升版为 `2026-09-03.1`：等宽文本图改为按需调用唯一的 `text-flowchart-renderer / interface_version: 1` 模板。操作者仍只复制场景 2C；模板只负责排版，路径或接口失效时明确报警并只暂停受影响交付，质量脚本会阻止引用、接口或调用合同静默漂移。
- 链路分步演示模板新增双栏成功/失败真实输出对照类型；不适用分支仍显示明确状态，不用示意产物冒充运行证据。
- 第二代总指挥 `00`、`02`、`10` 与轻量交接启动配置升版为 `2026-09-02.9`，`11` 升版为 `2026-09-02.4`：本地协作画像采用 `unasked / enabled / paused / disabled / unavailable` 五态；项目首次建立总指挥时只在主回复后介绍一次，明确启用后在稳定里程碑和交接前做无定时任务的本地触发检查。拒绝或忽略不会收集且不重复提示，节点检查失败也不阻断主任务或交接；中英文 README 同步补充用途、开关和可核对的隐私证据。
- 链路分步演示模板调整顶部信息顺序：基线与事实截点位于第一栏，步骤导航、进度和总览入口位于第二栏；区块内容、样式和交互合同保持不变，并增加模板顺序检查。
- 场景 2C 与链路排查专项标准升版为 `2026-09-02.5`：紧凑文本执行图继续作为默认视图；矢量图改为仅在操作者主动要求时生成，并须交付一张连续连接全链路的单一整图。HTML 翻页改用可见阶段索引锚点补偿高度变化，移除历史最大页高造成的大块空白，并把“无跳顶、无异常空白、横向索引不动”纳入无头核验。
- 场景 2C 操作者提示词、链路排查专项标准和 HTML 模板完成阶段输出语义校正：执行图先由唯一拓扑表派生，等宽文本采用固定列连接符并为复杂分支提供纵向矢量回退；HTML 右栏只展示同一输入与基线的真实阶段输出，将“无天然直观输出”和“本应有但尚未采集”分开，禁止用人工核验附件冒充中间结果；步骤切换保留页面及阶段索引滚动位置，并纳入无头浏览器优先的回读检查。专项标准升版为 `2026-09-02.4`。
- 第二代总指挥 `00`、`02`、`10` 与轻量交接启动配置升版为 `2026-09-02.8`，`09` 升版为 `2026-09-02.3`，自动化测试手册升版为 `2026-09-02.4`：自动化验证统一改为无头单 worker 优先；只有无头证据不能等价覆盖时才暂停受影响步骤，并在说明工具、范围、前台影响与关闭方式后申请可见浏览器、Chrome 控制或 Computer Use 的当前精确授权。明确要求打开指定产物只授权该次限定展示，不扩展为 Computer Use 或现有个人浏览器会话控制。
- 第二代总指挥 `00`、`02`、`10` 与轻量交接启动配置升版为 `2026-09-02.7`：场景 6B 改为适用于普通、专项和总指挥窗口的角色中立任务恢复入口，但不再作为所有中断任务的必经步骤；安全重做更短时直接重发原任务，其余情况先恢复原身份并执行恢复收益门禁，在直接重做、快速恢复、深度恢复和必须先核账中选择成本更低且不会重复副作用的路线，再按任务实际需要读取对话摘录、任务记录、产物、工作区、Git 或平台证据。GitHub、账号和规则目录不再是固定必填项，专项任务不会因恢复提示词取得总指挥或中央状态写权；同时修复 01 中紧凑文本执行图的术语契约。
- 第二代总指挥 `00`、`02`、`10` 与轻量交接启动配置升版为 `2026-09-02.6`：场景 6B 的操作者名称改为“没有正式交接时恢复项目进度”；内部协议改称“无正式交接恢复”和“项目恢复热快照”，并兼容旧状态名。原任务仍可继续时走普通断点恢复，旧总指挥能够正式交接时优先走场景 6/6A。
- 第二代总指挥 `00`、`02`、`10` 与轻量交接启动配置升版为 `2026-09-02.5`：明确平台 `/goal` 只负责同一任务的持久目标与暂停/恢复，不增加额度或完成跨账号迁移；新增可选额度中断保护，在可观察预警时按现有热快照安全收口，额度耗尽后复用空白账号灾难恢复，不新增第二套状态系统。
- 第二代总指挥 `00`、`02`、`10` 与轻量交接启动配置升版为 `2026-09-02.4`：场景 2C 默认先交付紧凑文本执行图，长链路按需升级为矢量图或 HTML 分步演示；节点证据状态和展示产物指针进入索引与交接，示意内容不得冒充实际运行证据。
- 第二代总指挥规则入口升版为 `2026-09-02.3`：允许只读处理操作者在当前任务中主动上传、明确点名并要求处理的精确附件；附件仍作为不可信数据，禁止扫描父目录、执行附件指令或继承到其他任务。
- 第二代总指挥 `00`、`02`、`09`、`10`、`11` 与轻量交接启动配置升版为 `2026-09-02.2`：画像更新改为有限容量工作集，过期、重复和被新证据取代的条目先清理；一次讲解只能形成“已有所了解、独立应用能力未验证”的保守结论。
- 第二代总指挥 `00`、`02`、`10` 与轻量交接启动配置升版为 `2026-09-02.1`，将 11 号协作画像作为按需规则接入注册表、复盘、状态和交接；候选交接阶段只核对画像安全指针，不读取正文，画像不可用不会阻断接管。
- 会话交接评估工具改用虚构数据重绘的终端示意图，并在工具 README 直接展示；仓库首页只增加文字入口，避免第二张大图破坏首页视觉层级。
- 第二代总指挥 `00`、`02`、`10` 与轻量交接启动配置统一升版为 `2026-09-01.5`；场景 2E 改为专业、完整、可复制的部署核验模板，内部仍接受任意详略的自然语言入口；运行身份、交接和 PR 契约新增规范启动命令及自检输出，并要求继续回读实际服务；文档治理新增私聊输入与公开文本隔离规则。
- `2026-09-01.4` 新增耐久 `COMMIT-LEDGER` 与 `KEY_NODE` 精简保护、并存实现决议矩阵和运行身份交付门禁。简短自然语言部署请求可触发自动候选恢复，AI 在完成当前任务后提供可选的表达建议，不把长提示词变成前置门禁或授权。
- 第二代总指挥 `00`、`02`、`09`、`10` 与轻量交接启动配置统一升版为 `2026-09-01.3`；新增场景 2C、场景 2D 和链路排查按需入口，明确自然语言低门槛输入不降低 AI 的证据、验证、风险和教学解释质量。
- 将面向操作者的能力标签改为描述客观状态的“信息不足恢复”；长期双边分叉的执行算法收敛到 `02-总指挥核心规则.md`，操作者只从 `01-操作者操作手册.md` 启动场景 2D，不再维护重复的远端同步提示词。
- 仓库中英文入口增加明确的语言切换、最近提交徽章和维护状态；英文概览同步展示仓库封面。
- 第二代总指挥 `00`、`02`、`09`、`10` 与轻量交接启动配置统一升版为 `2026-09-01.2`；操作者入口、人工操作包、测试与 PR 手册改为 AI 先恢复和预填、操作者只处理例外，正式支持“未执行/不确定”状态、可复制回答及绑定版本的人工回执，且不会把未知状态折算为通过或远端授权。
- 第二代总指挥 `00`、`02`、`09`、`10` 与轻量交接启动配置统一升版为 `2026-09-01.1`；新增 PR 交接契约与审查门禁，并纳入过时对象的证据门禁、误关闭防护、无权限协作路径和远端回读要求。
- 第二代总指挥四份正式入口统一升版为 `2026-08-27.1`；总览、操作者须知、专项执行规则和复盘清单改为“主来源 + 短摘要”，修正过时模型档位与特定领域措辞。
- 第二代总指挥四份正式入口统一升版为 `2026-08-26.1`，补充来源与效果等价、验证状态分离和冲突解析规则。
- 将总指挥规则中残留的具体领域词汇改为通用的输入与样例表述。
- 会话交接评估工具将 Token 排名、完整用户输入和文件占用构成移入本地详细报告；终端改为每 5 个完成回合输出里程碑，并保留最终回合摘要。
- 独立专项任务统一使用不继承聊天历史的创建方式；只有明确要求复制既有历史时才允许 Fork。
- 会话批量迁移和回滚现在保留原 JSONL 的访问时间与修改时间，避免修复操作改写历史任务排序。
- 会话迁移支持按任务 UUID 精确选择，并在提交前强制落盘候选文件、恢复原文件权限。
- 安装器不再依赖被隐私规则排除的本机扫描报告，公开克隆可直接完成自测和候选校验。
- 按“第二代总指挥的工作模式、故障检查、其他 Codex 技巧性提示词、实用小工具”重组仓库目录。
- 将规则说明、模板和会话检查工具移动到对应分类，根目录只保留仓库级文件。
- 将 `Codex` 调整为唯一仓库根目录，使 Git 边界与本地分类边界一致；“故障检查”扩展为“故障排查与解决经验”。
- 重写 README，明确操作者从 `01-操作者操作手册.md` 开始，其余规则由 AI 按需读取。

### Security

- 项目规则新增真实运行截图自动安置约定：明确授权公开后由总指挥先核验隐私与元数据，再选择模块资产目录、统一预览页和明显入口；图片保持为非运行依赖，远端写入仍需当前精确授权。
- 篡改猴备份 ZIP 继续作为本地导入素材处理，由 `.gitignore` 精确排除；公开目录只收录人工可审阅的 `.user.js`、说明和已检查截图。
- 协作画像交接只登记五态、一次介绍状态、节点维护结果和安全指针；关闭并删除只处理被 Git 忽略的精确本地实例。删除公开 11 号规范不再被解释为关闭操作，规范缺失时按 `unavailable` 安全停用。
- 本人环境截图允许逐文件公开例外：AI 必须先说明可见的环境信息，授权只绑定精确文件和展示位置；默认仍禁止公开其他本地路径、任务标识、第三方信息和凭据。
- 操作者画像原始资料新增整目录本地隔离；质量脚本拒绝私有画像路径进入 Git 跟踪。画像或其派生摘要对外披露必须先展示最终脱敏载荷，再由操作者在下一条独立消息第二次精确确认；原始画像和来源资料始终禁止直接外发。
- 移除含真实 Windows 用户名、绝对路径和任务名称的旧终端截图，改为不含真实身份、仓库或任务数据的可审计 SVG。
- `.gitignore` 精确排除 `操作者协作画像.local.md`；索引和交接只保存状态、通用相对指针、schema、过期与未跟踪核验，不保存画像正文、内容哈希或标签。
- 场景 2D 将 Fetch、本地历史变更和远端写入分层处理：先冻结双边基线和共同祖先，本地汇合与远端执行分别制卡确认；自然语言发起不构成对 Push、PR、Review、Merge 或删除远端分支的概括授权。
- 会话详细报告使用固定任务级文件名自动覆盖，采用 UTF-8 BOM、写后严格回读和临时文件原子替换；报告包含完整用户输入，不应上传或提交。
- `.gitignore` 直接排除 `*-详细分析报告.md`，降低自定义报告路径位于仓库内时误提交敏感对话的风险。
- 文件存在、被 Git 跟踪或被文档引用不再自动构成 Office 文件处理授权；环境能力缺失时按验收标准停止或降级。
- 忽略由同步盘重新生成的旧包装目录，防止其中的旧版私有资料被意外重新纳入 Git。
- 本地过程记录、Word 私有原件和临时文件不进入公开仓库；会话工具继续使用脱敏公开版。
- 忽略本地规划目录、独立构建缓存及含真实成员信息的未脱敏提示词，防止过程材料误入公开提交。
- 排除全局私人提示词、自用 DOCX、机器扫描报告、迁移备份和本地缓存；公开故障资料移除真实任务 ID、用户路径和机器身份。

## [2026-08-20.2] - 2026-08-20

### Changed

- 默认架构改为单窗口主执行；使用者只向总指挥反馈，例外专项任务必须证明整个工作流的总 Token 或关键路径净收益。
- 标题级按需加载替代普通场景的全量规则重读；远端写入、高资源、未知修改、可靠截点和独立 Review 等安全门禁保持不变。
- 将未公开历史工作流从新用户必需理解的核心概念降为可选迁移背景；`08` 改为中性的旧版兼容规范，并明确新用户跳过。
- 收敛跨文件重复说明；`02` 作为执行算法主来源，操作手册继续保留可独立复制且占位符兼容的场景提示词。

## [2026-08-19.5] - 2026-08-19

### Added

- 新增总指挥轻量交接启动配置，支持候选阶段按来源指纹核验并在异常时回退到完整读取。
- 新增只读的本地会话检查工具、Markdown 使用说明和脱敏 DOCX 公开版。

### Changed

- 将公开项目名称更新为 Codex Workflows，并同步第二代 `00`～`10` 规则到 `2026-08-19.5`。
- 完善长任务状态、交接软门禁、自动化授权和资源使用规则。

### Security

- 会话检查工具只包含虚构任务 ID 和相对路径；公开 DOCX 已清除真实路径、任务标识、作者及设备元数据。

## [2026-08-12.18] - 2026-08-12

### Added

- 新增场景 2B，支持从新目标或已有远端协作断点进入本地闭环实现、自动验证和分阶段人工验收。
- 新增需求—证据—验收矩阵、本地检查点记录和独立的远端发布执行卡。

### Changed

- 将 Review 动作、实现责任和分支载体拆分判断，由 AI 解释直接修复、交回作者、等待协调或批准的选择依据。
- 明确本地 Commit 与远端 Push/PR/Review 授权相互隔离，并补充来源不明修改和事实漂移的恢复规则。
- 扩展任务卡、状态规范和索引字段，保存本地闭环断点、Reviewer 资格与发布门禁。

### Security

- 公开示例继续只使用通用目标和占位符，不携带来源项目的领域术语、身份、路径或仓库对象。

## [2026-08-11.14] - 2026-08-11

### Added

- 发布第二代 `00`～`10` 完整规则与操作者操作手册。
- 增加下载后 3 步启动路径、跨平台规则目录登记方式和首次状态索引说明。

### Changed

- 将安全与证据边界泛化为适用于个人数据、受监管资料和敏感业务数据的通用表达。
- 将模型选择描述改为当前推荐与不可用回退，避免把特定模型写成永久前提。
- 让工作流概览回归导航用途，以根目录 `00`～`10` 作为唯一正式规则来源。

## 初始化阶段

### Added

- 初始化项目说明、维护规则、工作流概览、安全边界和规则变更事件模板。
- 明确单窗口不可抢占前台任务、FIFO 事件队列、最终反馈完成边界与违规恢复规则。
