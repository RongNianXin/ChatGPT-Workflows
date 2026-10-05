## 2026-10-05：交接控制面扫描的最小边界修复

- 交接脚本在进入目录前跳过两个明确受保护的目录组件；保留其他位置的递归、重复活动索引检测及历史登记验证。不按Git忽略状态或近似目录名扩大排除，不跟随目录别名。
- 新增隔离回归核对禁区未列未读、深层忽略/未跟踪及近似名称目录仍检出、联接不进入禁区；正式交接仍须独立执行1C预检。
- English: Fixed protected-directory boundaries in the handoff control-plane scan. Legal directories remain in scope, including ignored and untracked paths. Isolated tests check protected subtrees, duplicate detection, and directory aliases.
- 验证：28项交接隔离回归、全仓质量、严格manifest及diff检查通过，独立实例两轮只读审查完成，未发现扫描遗漏或新增阻断；实际合法范围扫描无重复活动索引。未生成正式交接材料、Commit或执行远端操作，正式交接仍需1C预检。

## 2026-10-05：Goal到限后继续的操作入口

- 01 Gen1.3补充正常恢复、到限后有界续跑与再次到限的三步流程及准备提示词，通常不用重写整份Goal。05明确当前生效周期与原模板旧预算的关系，保留历史与专项累计限制，平台状态和硬限额单独核验。
- English: Added a bounded continuation procedure after a Goal work cycle reaches its limit. Each new cycle requires approval and a saved budget; historical usage and cumulative limits remain intact. Platform resume controls are checked separately.
- 验证：全仓质量检查通过；独立只读审查发现并修正“恢复沿用原预算”的旧措辞，最终定点契约与指纹复核通过。静态检查不能证明真实客户端恢复或模型持续遵守。未启动来源业务、Commit或执行远端操作。

## 2026-10-05：同应用回复预授权与操作者反馈

- 09新增操作者直接授予的同应用回复预授权：明确要求直接回执，未说明自主判断，明示无需回复及纯确认不互答；不逐消息重复询问。根AGENTS、02入口、01接入/恢复模板与10恢复记录同步。
- 始终向操作者反馈实际处理、来源回复状态与下一步；实际发送、来源确认和业务完成分开。来源须由可信宿主事件定位，预授权不覆盖新增业务、远端、敏感载荷或第三方联系；通信缺口局部处理。
- English: Added reusable user authorization for replies to incoming tasks within the same app. Explicit requests receive a reply; unspecified requests are assessed for value. Every event still produces an operator-facing report. Business permissions, sensitive data, and external communication remain separately controlled.
- 验证：两轮独立只读审查定位并修正逐消息许可、失效及纯确认互答冲突；全仓质量检查通过，末次场景五修正再核相关契约与指纹。静态检查不能证明模型持续遵守；未向其他窗口广播、Commit或执行远端操作，真实跨窗恢复尚未测试。

## 2026-10-05：Goal高资源授权说明与范围内复用

- 01明确常规本地授权不包含高资源运行；Gen1.2由AI提前准备必要的有界授权候选，并给出模板版本、项目填充与实质改动说明。待确认草稿不冒充有效授权，验收附录按需提供。
- 09维护已有有效授权的复用与差额确认，05同步引用；阶段、批次编号或脚本名称变化本身不重新索权。实际范围、资源风险、剩余专项限额及项目逐次确认要求仍核验，不将单次授权扩大为整个Goal许可。
- English: Clarified that routine local permission excludes resource-intensive runs. Review prepares bounded permission candidates and identifies substantive template changes. Valid permissions are reused within scope; project-specific confirmations and resource limits remain in force.
- 验证：两轮独立只读审查关闭候选问题，最新全仓质量、72项规则契约、23项严格manifest及24项LF检查通过。文本契约不能证明真实运行不再提问；未运行来源业务或测量长任务中断率，未Commit或执行远端操作。

## 2026-10-05：复杂指令提前澄清与自主选择

- 02新增启动前必要只读预检，集中当前可预见的必问事项；已有事实/权限及低风险可回滚选择由AI解决，没有必问项不再索取开始确认。01 Goal正文与审查提示同步，09规定有依据的选项标“（推荐）”并说明取舍。
- 项目精确授权、远端最终载荷、费用和专业验收等门禁保留；运行中新问题只处理差额，未答复不阻断无关已授权工作。推荐、沉默与跳过不产生授权，不承诺未来无中断。
- English: Added scoped preflight checks and grouped known questions before long-task execution. AI resolves authorized low-risk choices and labels supported recommendations; later discoveries and final approval gates remain separate.
- 验证：两轮独立只读审查无剩余问题，新增3项文档契约及最新全仓检查通过；真实长任务中断频率尚未验证。

## 2026-10-05：Agency 普通对话持续适配

- 工具唯一README增加普通对话项目周期入口及英文对应说明；项目适配约定独立于业务绑定，按任务与风险选择少量当前角色，恢复依赖真实入口和实际正文读取，不依赖Goal或永久聊天记忆。
- 内部指南、激活卡和跨项目引用同步配置、切换、撤销、恢复与验收；共同规范仅补两层生命周期边界。关键歧义有限追问，新增角色或权限只处理差额，自换角色不代替独立审查/人工验收，质量用原主任务证据评价。
- 本批未安装角色、改全局配置或调用产品；真实跨阶段切换、跨窗恢复和质量收益未执行，不以文档检查代签。
- 验证：独立实例两轮审查及暂停边界定点复核无剩余阻断；全仓质量、双语、工具入口契约与受管指纹检查通过。
- English: Added optional project-wide role adaptation for ordinary chats. Project policy survives individual tasks, while task bindings retain separate permissions, budgets, and recovery evidence. No permanent-memory or accuracy guarantee is claimed.

## 2026-10-05：精简 Goal 子场景

- 删除独立的启动子场景及启动核验提示词，将必要提交说明并入Gen1.2末尾；原Gen1.4暂停恢复与交接收口改为Gen1.3。同步编号总表、前向指针及检查，手动进入Goal后粘贴正文的操作保持明确。
- English: Removed the separate launch scenario and extra verification prompt. Launch instructions now follow the review step; pause and recovery are renumbered as Gen1.3.

## 2026-10-05：Goal 启动命令与正文分离

- 根据操作者当前桌面版反馈，移除可复制Goal模板的 `/goal` 首行；启动说明改为手动输入命令、确认进入目标模式、再粘贴完整正文。审查提示也要求只返回正文，避免修改后重新加回命令。
- 截图支持命令仍在普通正文中，手动输入有效由操作者报告；未独立复现客户端触发机制，不推广为所有版本的行为。失败时不提交正文，先核对客户端入口。
- English: Keep the Goal activation command separate from the copied prompt body. Enter Goal mode first, then paste the reviewed text; client behavior may vary by version.

## 2026-10-05：Goal 准备与正式启动分步

- Gen1按填写模板、普通聊天审查与角色准备、确认并启动、暂停恢复与收口拆为四个二级子场景，嵌入审查、启动核验和收口提示词。“角色配置”兼容旧“身份赋予”，外部工具安装与调用细节仍由工具唯一入口维护。
- 准备不使用草稿授权执行业务，不安装或启动Goal；核验当前必要角色，区分候选、安装、绑定与实际加载。平台启动/暂停/恢复以实际能力及状态回读为准，不承诺恢复命令跨版本可用；旧预算和其他门禁保持有效。
- English: Split Goal preparation, review, launch, and pause/recovery into explicit steps. Optional role configuration is verified before use; draft permissions do not authorize execution during review.
- 验证：两轮独立只读审查未发现阻断，最新全仓检查通过；最后栏目名称统一后定点回读。真实客户端启动、恢复与角色续接未在本轮执行。

## 2026-10-05：交接身份与导航一致性

- 统一五份必读控制面来源，身份只登记在状态索引CURRENT，其他来源保存导航；实时封条验证新增身份结果，未核身份不再返回可交接。旧链和封条原件保留，不补造历史；缺外部根仍为输入缺口。正式准备及带新导航的直接追加均验证身份，防止摘要通过被误当整体完成。
- 新增18项身份与导航回归，包括旧入口、启用残留、重复未知状态、历史身份、封条不一致、未知平台映射及半切换；既有封条55项、正式准备25项及全仓检查通过。独立审查意见已定点关闭；静态检查不代表来源项目已修复或已核实编号映射。
- English: Added live identity and navigation checks for handoff readiness. Legacy seals remain readable, but byte integrity alone no longer establishes readiness. No historical takeover events are fabricated.

## 2026-10-05：公开反馈的证据与语言检查

- 根AGENTS的现有公开反馈规则加入发布前必做的证据、适用范围、语法、标点、文风、隐私和授权核对；无需操作者另行提醒，不新增审批层。审查不能把操作者报告冒充独立复现，也不能为润色改变技术含义。
- 验证：新增条款人工回读及差异空白检查；公开反馈另按实际发布回读核验。未验证未来任务是否始终遵守，不改变平台权限或Goal工具能力。
- English: Required evidence, scope, language, style, privacy, and authorization checks before public feedback. Operator reports must remain distinct from independently reproduced results.

## 2026-10-05：无法读取额度时的明确豁免

- Gen1增补操作者许可：无法查看额度时可跳过依赖额度读数的停止项，记录未知及无法监控；旧任务未获该许可仍按原约定。05同步真实耗尽/硬预算、时间、轮次、费用与高资源门禁，以及读数恢复时的累计未知处理。不根据登录方式假定能力或授权，不伪造额度。
- 规则版本 `2026-10-05.7`；全仓质量、65项规则契约、18项刷新回归、23项严格manifest及24项LF检查通过。静态验证不代表真实API计费或额度读取测试，本批不执行远端或付费操作。
- English: Added explicit permission to skip stop conditions that require unavailable quota readings. Unknown usage is recorded, while actual exhaustion, hard budgets, time, iterations, and spending permissions remain enforceable. Authentication mode alone does not authorize the exception; recovered readings cannot erase unknown earlier usage.

## 2026-10-05：提示词指代、语法与文档质量检查

- 完整审查01的55个复制块及其他公开提示词，修正0A省略对象、续接窗口指代、协作约定与载体迁移混用、重复词及内部契约的压缩表达；外部工具英文入口同步。权限、停止条件和验证义务保持。
- 将句子主体/动作/对象/条件、操作者角度回读及语言与规则语义复核并入06现有修改审查清单，不新建审批层。脚本只核已知文本/结构问题，不证明语法正确或模型永久遵守。
- 规则版本 `2026-10-05.6`；两轮独立语言/语义复核通过，全仓质量、64项规则契约、18项刷新回归、8份入口、23项严格manifest及24项LF检查通过。已知旧语句断言按新等义表述同步，未降低角色与权限检查。本批不启动来源业务或执行远端写入，不宣称脚本验证了全部自然语言。
- English: Reviewed public copyable prompts and clarified recipients, handoff roles, collaboration updates, and compressed internal wording. Added language and semantic checks to the existing document review checklist without adding an approval layer. Script checks do not attest natural-language correctness or future model behavior.

## 2026-10-05：Goal授权入口与工作周期预算

- Gen1以明确的常规本地授权句替换待选菜单，特殊权限仍按项目门禁；停止条件直接说明局部暂停及全停例外。旧菜单未选择不视为全选，删除授权栏目只沿用已有授权。
- 05统一周期计数：默认累计实际执行时间，暂停不清零；恢复/换窗不重置，明确批准新周期目标与预算才重算周期时间和总迭代。失败证据与同问题、重型运行、独立审查累计限制保留，平台预算/状态独立核验。04/09/10短引用与既有记录同步，不新增账本。
- 规则版本 `2026-10-05.5`；两轮独立只读审查通过，无阻断或必修问题；全仓质量、63项规则契约（含新增四类）、18项刷新回归、23项严格manifest及24项LF检查通过。真实Goal运行与计时可靠性未验证。本批不启动业务或远端写入。
- English: Replaced the permission menu with explicit scoped authorization for routine local work while preserving special gates. Clarified partial pauses and hard stops. New cycle budgets require explicit approval; recovery does not reset counters, and failed-method, heavy-run, and review limits remain cumulative. Timing, handoff records, and platform state remain distinct.

## 2026-10-05：EXT-001标准准备与节点调用

- 区分常规使用和首次试验准备，用户沿用原 Goal 业务模板；AI 保存唯一绑定并生成必要短引用，不再要求拼接长追加提示词。未启动 Goal 可准备，真实目标待启动后核验；准备不创建或恢复 Goal。
- 明确专项自身写者、中央指针、获准传递及执行者实际加载证据。准备不消费正式尝试，成本及预检角色读取仍记录；到约定节点先持久消费并回读再执行，原预算、停止与续接门保持。
- 规则版本 `2026-10-05.4`；与实际使用方两轮讨论及独立静态审查通过，无功能阻断。按审查建议将双语复制入口改为独立文本框；全仓质量、59项规则契约、18项刷新回归、8份入口、23项严格manifest及24项LF检查通过。真实首次试验、压缩后自动发现及效果收益仍待验证；本批不启动来源业务、不安装角色、不执行远端写入。
- English: Added routine-use and first-trial preparation entries. AI maintains one canonical binding and a short reference while preserving the original business Goal template. Preparation before Goal starts does not create or resume it or consume a formal attempt; costs and prior role exposure remain recorded. Specialist write ownership, authorized delivery, recipient loading evidence, and consumption at the agreed stage are explicit. Live recovery and effectiveness remain unverified.

## 2026-10-05：0A直接更新、0B项目转达与对话身份消歧

- 0A只作用于直接接收指令的AI，无论总指挥、普通任务或专项身份；已接入就更新，未接入就核对最小条件，不盘点、联系或替其他对话更新。0B仅由已核验的本项目现任总指挥向本项目全部或指定子任务转达，指定范围可只有一个专项；名称由AI核对唯一编号，不让操作者填技术表。
- 01启动/交接/续接入口区分接收对话、中央登记的现任总指挥与原/旧对话；10维护唯一定位规则，04短引用，06保存脱敏复盘。平台实际ID、逻辑写者、世代、标题分列；平台字段不可见保留UNKNOWN及原因，不用逻辑ID冒充，也不单独否定中央证据确认的身份。指代确认不自动换任、扩权或继承授权，身份缺口不否决普通规则刷新。
- 版本 `2026-10-05.3`。文档样例覆盖旧对话准备、新候选读取和接收对话消歧；PowerShell7全仓质量、59项规则契约、18项普通刷新回归、8文档入口、23项严格manifest与24项LF检查通过。独立审查发现旧0C复制块缺少新门禁，已原位修正并增加直接检查复制块的回归，定点复核关闭。未修改来源项目、未回传来源、未执行远端写入；真实接收窗口行为仍待复测。
- English: Scenario 0A updates only the conversation directly receiving the instruction, regardless of role. Scenario 0B is restricted to the verified current commander and forwards to all or selected tasks within the same project. Updated startup, handoff, and continuation prompts to distinguish the receiver, registered commander, and source conversation. Platform IDs, logical writers, generations, and titles remain separate; unavailable platform IDs are recorded as unknown without invalidating independently verified control evidence. Reference clarification neither transfers authority nor blocks an otherwise successful ordinary refresh. Three documented cases cover old, new, and receiving conversations. Repository checks, 59 contract checks, 18 local-refresh regressions, eight entry documents, 23 strict manifest entries, and 24 LF checks passed. Independent review identified a missing gate in the legacy 0C copy block; it was fixed, directly checked, and closed by focused re-review. No source-project changes, reply, or remote writes occurred. Live receiver behavior remains unverified.

## 2026-10-05：发布准备中的简单问题由AI自主处理

- 场景4K的自然语言同步请求由AI连续完成可发布成果盘点、有限修复、验证、精确暂存及分组Commit。目标、归属和权限明确、处理可逆且能验证的小问题自行决定；文档链接/换行、版本/清单同步、普通新增文件和限定检查修复不再直接升级为操作者裁决。
- 同步01/02/09与文档契约检查；保留最终远端确认，不取消测试或降低验收，不覆盖未知成果。实质产品含义、权限、隐私、不可逆或无法安全合并的问题仅暂停受影响对象；已授权写入网络报错先回读，结果未知不重复副作用。重复迁移指针按明确规则保留本地并排除，不拖住独立成果。
- 发布前发现受管文件工作区CRLF与Git检出LF不一致；按23项清单精确统一LF，并为受管脚本、外部规范及schema补齐精确换行属性，防止提交/克隆后原始字节指纹失配，不改变正文语义。
- 版本 `2026-10-05.2`；换行修正后54项规则契约、18项刷新回归、8文档入口及全仓质量复验通过，23项暂存区/工作区字节与manifest匹配、24项LF属性与实际字节检查通过。独立实例两轮定点审查通过，无实质返工项；38项可发布成果准备完成，私有资料和重复迁移指针留本地。此次整理同时包含前轮EXT-001、普通规则刷新、0A/0B、模型建议及双语入口成果；真实专项恢复/效果仍未验证，远端发布尚未执行。
- English: Scenario 4K now resolves well-scoped, reversible, verifiable preparation issues autonomously, including documentation, version/manifest synchronization, reviewed new files, and bounded test repairs. Updated 01/02/09 and the contract regression. Final remote approval, privacy, acceptance, and destructive-action gates remain in force. Unknown write outcomes are read back before any retry. Clearly excluded local items are preserved without blocking independent deliverables. Publication checks identified CRLF worktree bytes that Git would check out as LF; normalized the 23 manifest entries and pinned line endings for managed scripts, external contracts, and the schema without changing semantics. After normalization, 54 contract cases, 18 refresh cases, eight entry documents, and repository checks passed. All 23 staged entries matched worktree bytes and the manifest; all 24 managed files passed LF checks. Two rounds of independent targeted review passed with no substantive rework. The 38-file candidate excludes private materials and a duplicate migration pointer. Live role recovery and effectiveness remain unverified, and remote publication has not occurred.

## 2026-10-05：EXT-001职责覆盖、任务绑定与专项阶段调用

- 按场景5A由维护者执行、另一项目总指挥只读独立审查，原身份与写权不变；先覆盖目标、交付物、阶段及平台职责，再分开安装集合与本阶段调用。默认轻量遗漏检查，关键未知最多追问1～3项，复杂或关键风险才评估独立分析者，不把首次少量试用缩成完整需求。
- 统一任务职责、阶段加载与单次结果；确认任务职责随同一业务任务保留，明确一次试用仍受其边界约束。开始前持久消费并回读，中断/失败占一次，同次恢复不清零、不重跑。自足专项卡在授权有序计划内自主继续，暂停/撤销/人工验收及独立互审终点门优先；03/04/07/10和轻量交接入口显式续接锚点，继任者独立读正文核权。
- 补登记六个已有共享角色，保留原工作流架构师，共7个；真实文件名和来源/实物/指令摘要保留，用户根使用可移植占位符，不重新安装或改全局配置。规划、已授权实现及检查用途同步中英文入口、AI契约和通用模板；01仍只索引唯一工具README。主复盘位于角色经验文件。
- 规则版本 `2026-10-05.1`；入口8份文档及角色契约、刷新契约53项、全部23项manifest精确核验、7份TOML/文件/指令与六份来源摘要、PowerShell7全仓质量及diff检查通过。第二轮独立审查完整取得必要正文，独立重核入口、冻结manifest/snapshot及7份角色TOML摘要，R1–R4在静态契约层关闭，A–H静态情形通过，无实质返工项；双方一致收口。真实专项首次调用、模糊需求覆盖、压缩/换窗/换任恢复、阶段自主执行及原生发现尚未验证。未启动来源专项/Goal，未改来源产品，未Commit或远端写入。
- English: Separated full responsibility mapping from installation and current invocation. Persisted task responsibilities, stage loading, and individual results independently; consumed attempts are saved before execution and retained across interruptions. Specialist tasks may continue through an authorized ordered plan while honoring pause, revocation, acceptance, and review-closeout gates. Added explicit recovery pointers to task and handoff entries. Registered six existing shared roles without reinstalling them, bringing the registry to seven. Bilingual entries, internal contracts, and templates are aligned. Entry and role contracts, 53 refresh cases, all 23 pinned manifest entries, seven TOML/file/instruction checks, six source hashes, repository quality, and diff checks passed. The independent reviewer read the necessary actual documents, rechecked entries, the frozen snapshot, and seven role files, and closed R1–R4 at the static-contract level. Eight static scenarios passed with no substantive rework; both parties agreed to close the batch. Live recovery, specialist execution, and native discovery remain unverified. No source-product changes, trial start, commit, or remote writes.

## 2026-10-04：普通规则刷新采用已保存本地正文

- 实际刷新在工具目录已保存、旧清单尚未同步时失败。已将普通0A/0B与精确版本验收分开：默认完整读取并采用稳定的已保存正文，清单旧预期指纹只作维护提示；指定版本、同内容广播、正式交接/封条及发布仍严格核验，不能自动降级。
- 新增只读检查入口 `Inspect-RuleRefresh.mjs`：正文与实际摘要来自同一字节，逐文件输出可绑定同一基线，终点重核实际来源；拒绝坏清单、缺文件、重复路径、链接/越界和漂移。它不写规则/清单，不替模型声明已读，也不观察编辑器未保存缓冲。漂移最多由AI重读一次，仍变化则保留原规则。
- 普通广播不再冻结到所有回执，逐目标登记实际读取截点，不能将不同内容汇总为同一版本通过。操作者不填写指纹、状态字段或未保存证明；成功说明采用情况，待同步时不冒称旧编号正式版本通过。
- 同步00/01/02/09/10、刷新包与回执、外部工具对接/接入模板及检查契约，规则更新为 `2026-10-04.18`。复盘主记录在06。验证：刷新回归18项、刷新契约53项、入口8文档、manifest23项、本地普通/精确模式与同基线正文输出、PowerShell7全仓质量检查及diff检查通过；独立复核两项建议已修正并回读。真实接收窗口复测未执行，不代签多窗口行为。未广播、未修改来源产品、未Commit或远端写入。
- English: Ordinary refresh now adopts stable saved local text, treating stale manifest expectations as maintenance diagnostics. Exact-version verification, identical-content broadcasts, handoffs, seals, and release checks stay strict. Added a read-only byte-bound capture and verification helper with path and completeness guards. Receivers record individual snapshots without holding ordinary broadcasts frozen until all acknowledgments arrive. Editor buffers and model comprehension are not attested; live receiver retesting remains pending.

## 2026-10-04：单角色共享安装与任务绑定续接

- 经操作者限定授权，只共享安装 Workflow Architect；保留上游正文，以 TOML 解析和安装/正文指纹回读验证。一个独立实例实际加载角色并完成一轮只读审查，未安装其他角色、未改产品代码或全局配置、未执行远端操作。
- 根据审查补齐首次名称或专业审查意图触发、授权安装后的连续调用、03/10 的私有绑定指针及启动/恢复步骤。角色职责叠加原身份，绑定与本轮结果分开；完成后待命，恢复不重跑、不清零预算。
- 同步工具中英文入口、内部指南和通用接入模板；规则版本升至 `2026-10-04.17`。共享登记只维护角色实物，业务绑定留在项目私有记录，下一项目自行核验、加载和绑定。
- 验证结果：共享TOML三字段解析及安装/正文指纹匹配；manifest全部22项、入口8份文档、刷新契约53项、PowerShell7仓库质量检查与diff检查通过。限定角色审查已完成；原生自动注册、跨项目首次调用、压缩后自动恢复及实际体验收益未验证，不以文档通过代替运行证据。未 Commit、未广播、未 Push。
- English: Installed only Workflow Architect under explicit authorization and verified its TOML and instruction hashes. An independent instance actually loaded it for one bounded read-only review. Added continuous invocation after authorized installation, private task bindings, and recovery pointers in 03/10; binding lifetime and review results are separate, completed reviews are not rerun, and used budgets persist. Updated bilingual entries and rule version to `2026-10-04.17`. Native discovery, cross-project cold starts, recovered execution, and user benefits remain unverified. No product code or global configuration changes, other role installations, commit, broadcast, or remote writes.

## 2026-10-04：外部工具跨项目自动对接修复

- 针对已通知规则后仍找不到 EXT-001 的实际调用，补齐“已核验规则根 → 正式工具目录 → 唯一 README → 来源、共享状态与内部指南”的名称路由；不要求操作者重复提供已登记地址或配置。
- 刷新 manifest 纳入工具目录和共同对接规范，版本更新为 `2026-10-04.16`；广播、0A、检查及交接生成器统一按声明的仓库根前缀解析。交接生成器现在核验 manifest 全部条目，防止新依赖未被检查。
- 明确正文必须实际呈现给模型，字节统计不能冒充理解；任一必需失配不允许部分采用后报告刷新完成。默认共享安装、项目独立激活，安装许可与中央登记写权分开。
- 详细复盘保存于 `引用的外部工具/角色经验与反馈记录.md`；接入模板加入跨项目验收矩阵，后续 EXT-002/003 使用同一门禁。英文入口同步更新。
- 验证结果：交接生成器 25 项、规则刷新契约 53 项通过；新增实际 manifest 解析、失配、缺失和越界回归，以及入口文档检查。PowerShell 7 仓库质量检查（含新增规范）通过；Windows PowerShell 5.1 因 UTF-8 解码产生解析失败，不用于本次有效验收。真实来源窗口复测尚未执行，不声明模型自动调用效果已验证。本轮未安装角色、未联系来源窗口、未修改来源产品、未提交或远端写入。
- English: Added registry-first discovery from the verified workflow root, included the registry and common discovery contract in refresh scope, and made handoff verification cover every manifest entry. Separated file-byte reads from model-visible reading and prohibited successful refresh claims after required failures. Standardized shared installation with per-project activation, added reusable cross-project acceptance cases, and recorded the incident without source-project details. Live-agent retesting remains pending; no installation, source-project change, cross-thread send, commit, or remote write was performed.

## 2026-10-04：外部工具新手入口与工作区跟踪安全门禁

- 已统一外部工具入口：每个工具提供自然语言入口或固定复制模板，AI 自动判断适用性、选择角色、核对安装状态并组合正式提示词，操作者不需要知道内部编号、安装命令或手工拼接提示词。
- 已完善 Agency Agents：增加跨项目共享状态、版本/哈希复用、项目激活卡、自然语言反馈和安装状态边界；当前仍为 `DOCUMENTED_ONLY / NOT_INSTALLED`。
- 已新增工作区跟踪扫描器：默认只读分类 `SAFE_CANDIDATE`、`REVIEW`、`PROTECTED`；暂存必须逐项提供已复核路径，拒绝路径越界、符号链接和混合失败，不能替代内容审查或提交授权。
- 已修订交接工具：远端基线支持公开 GitHub 只读 API 备用查询；正式交接附件和回执统一使用实时封条验证命令。
- 已验证：工作区扫描器、外部工具入口、规则刷新契约和仓库全量检查通过；本次未安装 Agency Agents，未执行远端写入。

- English: Standardized beginner-friendly external-tool entry points with natural-language routing or copyable templates; AI now selects roles, checks installation state, and composes formal prompts internally. Added shared Agency Agents state, activation cards, feedback routing, and explicit `DOCUMENTED_ONLY / NOT_INSTALLED` boundaries. Added a read-only workspace tracker with explicit reviewed-path staging and symlink/path-traversal rejection. Handoff tooling now uses a read-only public GitHub API fallback and one live seal verification command. Full repository checks passed; no Agency Agents installation or remote write was performed.
# 变更日志
## 2026-10-04

- 重新定义 EXT-001 的入口层级：01 操作者手册只保留功能简介、边界和相对路径索引；每个外部工具子目录的 `README.md` 作为该工具唯一的操作者入口，集中维护标准入口模板和工具说明。
- 将“ 小白固定入口（推荐直接复制）”改为“标准入口模板”，并统一外部工具目录中的相关标题，避免口语化表达。
- 明确新增外部工具的扩展规则：主手册负责索引，工具 README 负责操作，AI 内部文件负责安装、激活、维护和反馈，减少多入口漂移。

## 2026-10-04

- 更新模型推荐到 GPT-6.1 Sol、GPT-6 Luna、GPT-6 Astra 的性价比优先分层：低风险重复任务优先 Luna，常规工程和复杂审查优先 6.1 Sol，高影响难例只有在代表性验收证明能力不足时才评估 Astra；保留 GPT-6 Sol 作为 6.1 不可用时的兼容回退。
- 将 01 手册的模型建议统一为“适配范围 + 升级条件 + 实际可用性待确认”，避免把型号写成永久硬编码。
- 修正场景 0B 操作者模板的中英混杂，复制提示词现在使用“全部子任务 / 指定子任务”等纯中文表达；英文枚举仅保留在内部机器规则中。
- 完成阶段性双语审查，为高可见工具、外部工具入口、经验库和故障经验库补充或优化 `README.en.md`；后续故障案例子目录仍按优先级逐步补齐。

## 2026-10-04：工作区未跟踪成果自动分流

- 已新增：`Inspect-WorkspaceTracking.mjs` 自动检查未跟踪文件，将普通成果、待确认对象和受保护对象分别标记为 `SAFE_CANDIDATE`、`REVIEW`、`PROTECTED`。
- 已明确：在整理本地成果、准备交接或准备提交时，AI 可以只对安全候选使用精确路径暂存；敏感、临时、来源不明和受保护内容必须保留并说明原因。默认扫描只读，不自动提交、推送、删除或覆盖。
- 已补充：操作者手册加入新手最短路径和工作区跟踪说明；新增回归检查。本轮未执行远端写入。

## 2026-10-04：交接验证命令与实时封条来源统一

- 已修订：交接生成器现在从实际封条目录、来源根和外部控制面根实时生成唯一验证命令，并把同一命令写入正式附件和回执；旧模板中的候选编号或旧目录会在生成时被替换，缺少验证入口则直接失败。
- 已补充：新增旧验证命令漂移回归用例，覆盖正式附件与回执命令一致性；更新规则刷新 manifest 指纹。本轮未修改来源项目、未执行远端写入。
- English: Handoff generation now derives one live verification command from the actual seal directory, source root, and optional external control-plane root, and writes it to both the formal artifact and receipt. Stale candidate or seal-directory commands are normalized, while a missing verification entry fails preparation. Added regression coverage and refreshed the rule manifest; no source-project or remote writes were performed.

## 2026-10-04：跨任务事件增加操作者六段汇报出口

- 已修订：跨任务来信处理结束、阻断或等待回调时，统一向操作者说明来源与要求、实际读取与分析、执行决定、来源回执、必要的操作者步骤、事件状态与原主线恢复。
- 已明确：来源回执与操作者汇报是两件事；发送工具成功只能写“已发送待确认”；缺少通信授权只能写“尚未向来源回执”；阻断或待回调不得写“处理完毕”。
- 已补充：`01` 入口指针、根 `AGENTS.md` 引用和工作流契约回归检查；规则版本更新为 `2026-10-04.12`。本轮未修改来源项目、未新增跨任务发送、未执行远端写入。
- English: Added a six-part operator-facing report for cross-task events, covering source/request, reading and analysis, execution decision, source receipt, required operator action, and event closure/mainline recovery. Clarified that source receipts and operator reports are separate, and that blocked or callback-waiting events must not be reported as complete. Updated rule version to `2026-10-04.12`; no source-project changes, new cross-task messages, or remote writes were performed.

## 2026-10-04：交接身份门禁、连续入口与专项自动化范围修补

- 已修订：1B 改为可选的轻量预处理；1C 保留自带预检，并在任何收口、封条或中央写入前增加总指挥身份硬门禁。普通/专项任务误收到 1C 时必须停下，不升级身份、不生成 `final-*`，改用 1E/1F。
- 已修订：1C 明确记录准备锁；规则、manifest、中央世代、单写者或工作区发生影响性漂移时，候选标记 `SUPERSEDED` 后按新基线重来。1B 的“继续”只有在明确可进入 1C 且基线未漂移时才进入正式交接。
- 已修订：1E/1F 只核对与当前任务或项目有绑定证据的自动化；无绑定证据时写“无；未扫描账户级任务”，避免把其他项目的定时任务误列为专项事项。
- 已记录：示例前哨项目 7/8、示例图像项目 35/36、示例游戏项目专项 2/3 的只读复盘。规则版本更新为 `2026-10-04.11`，刷新 manifest 指纹；本轮未修改来源项目、未发送跨任务消息、未执行远端写入。
- English: Added a commander identity gate before any 1C closeout or control-plane write, kept 1B optional with explicit continuation semantics, froze handoff preparation baselines, and scoped 1E/1F automation checks to task/project-bound evidence. Recorded read-only findings from three handoff sample pairs. Updated the rule version to `2026-10-04.11` and refreshed manifest digests; no source-project changes, cross-task messages, or remote writes were performed.

## 2026-10-04：统一 EXT-001 操作者入口并增加路径变更检查

- 已修订：01 手册目录、场景总览和正文统一使用 `EXT-001：Agency Agents`；正文改为面向操作者的人话简介、适用时机、最小例子和边界说明，并保留可点击的文件相对链接。
- 已补充：操作者可见的仓库根相对路径显示，统一采用 `ChatGPT-Workflows/...`；新增 01 手册场景编写规范，明确自然语言新增、修改、迁移和改名时要同步核对的对象。
- 已新增：`Test-OperatorManualExternalEntries.mjs`，在手册或外部工具入口变化、路径改名/移动/删除以及 Commit 前，检查入口文件、标题、EXT 编号、根路径展示和受影响链接；不扫描无关未跟踪文件。
- 已验证：规则刷新契约、操作者手册与外部工具入口检查、仓库质量检查和 `git diff --check`；规则版本更新为 `2026-10-04.10`。本轮未安装 Agency Agents，未修改其他项目，未执行远端写入。
- English: Unified the visible `EXT-001: Agency Agents` naming, rewrote the operator entry in plain language with a minimal example and boundaries, and kept clickable file-relative links. Added repository-root path display conventions, a natural-language manual-update contract, and a scoped external-entry/path consistency check. Updated the rule version to `2026-10-04.10`; no Agency Agents installation, other-project change, or remote write was performed.

## 2026-10-04：补齐外部工具场景的 EXT-001 子场景入口

- 已修订：操作手册原本只在段落内提到 `EXT-001`，没有独立子场景标题，导致阅读器中不易发现。现已在目录和正文中增加 `EXT-001：Agency Agents` 子场景标题及详细正文入口。
- 已保持：操作手册仍只保存外部工具索引，不复制 Agency Agents 的完整提示词、安装命令或角色正文；具体说明继续放在 `引用的外部工具/agency agents/`。
- 已验证：新增子场景回归断言、规则刷新契约、仓库质量检查和 Markdown 差异检查；规则版本更新为 `2026-10-04.9` 并同步 manifest 指纹。
- English: Added a visible `EXT-001: Agency Agents` child entry to the operator manual and table of contents. The manual remains an index only; detailed prompts, installation notes, and role content stay in the tool directory. Added a regression assertion, updated the rule version to `2026-10-04.9`, refreshed manifest digests, and passed repository checks.

## 2026-10-03：自动化能力分层与适配器故障误判修补

- 已确认：一次 `not a function` 包装器错误被错误扩大为“平台无法进行原生窗口自动化”，随后正确读取 Computer Use Skill 并初始化备用入口后成功发现目标窗口；这是可复现的流程缺口，不是授权缺失或平台整体不可用。
- 已修订：`09-自动化授权与风险分级.md` 新增命令行、浏览器、原生窗口、项目专用四层能力核验，以及 `ADAPTER_FAILURE`、`CAPABILITY_UNAVAILABLE`、`TEST_ASSET_MISSING`、`HUMAN_JUDGMENT_REQUIRED` 分类；声称整体不可用前必须读取适用 Skill、核验工具清单、正确初始化并尝试首选与明确备用路径。
- 已补充：`02-总指挥核心规则.md` 增加适配器错误的按需加载指针；`06-复盘与优化规则.md` 记录根因、永久措施和边界；Goal 只因全部授权路径被证据阻断才可 `BLOCKED`，单个适配器错误或测试资产缺失只影响受影响步骤。
- 已验证：工作流刷新契约回归检查新增能力分层断言；规则版本更新为 `2026-10-03.8` 并同步 manifest 指纹。未接管来源项目、未执行微信窗口操作、未执行远端写入。
- English: Added layered automation capability checks and adapter-failure classification. A wrapper `not a function` error can no longer be promoted to platform-wide unavailability. The workflow now distinguishes CLI, browser, native-window, and project-specific paths; requires skill/tool/initialization and preferred-plus-fallback checks before `CAPABILITY_UNAVAILABLE`; separates `ADAPTER_FAILURE`, `TEST_ASSET_MISSING`, and human judgment. The rule version is `2026-10-03.8`, with manifest digests updated and regression assertions added. No source-project operation or remote write was performed.

## 2026-10-03：外部工具调用场景与 EXT-001 注册模板

- 已新增：`可选功能场景：外部工具调用`，在 `01-操作者操作手册.md` 中只保留外部工具目录、EXT-001 工具索引和正文指针；Agency Agents 的详细提示词与维护记录仍独立保存在工具子目录。
- 已新增：`引用的外部工具/README.md`、`外部工具目录.md` 和 `外部工具接入模板.md`，统一使用不可复用的 `EXT-xxx` 编号；当前 Agency Agents 登记为 `EXT-001`，不采用容易与 export/experiment/version 混淆的 `exp01`。
- 已补充：外部工具登记、安装、激活和项目实际使用是四个独立状态；模板覆盖来源版本、安装范围、Goal 状态、权限、回滚、基线、证据和停止条件。
- 已验证：中英文 README 互链及源哈希已更新，新增手册链接使用仓库内相对路径；本轮仅修改工作流文档，未安装 Agency Agents，未修改其他项目，未执行跨任务通信或远端写入。
- English: Added the optional “External tool invocation” scenario. The operator manual now keeps only EXT-00 routing, the EXT-001 index, and pointers; Agency Agents prompts and maintenance records remain in its tool directory. Added a registry, a reusable registration template, and the stable `EXT-xxx` naming scheme. Registration, installation, activation, and project use remain separate states. README links and source hashes were updated; no Agency Agents installation, other-project change, cross-task message, or remote write was performed.

## 2026-10-03：Agency Agents 傻瓜式接入文档与维护记录

- 已新增：`引用的外部工具/agency agents/` 文档区，包含中文入口、调用指南、跨项目引用提示词、角色激活卡、个性化配置建议和安装维护记录；项目总指挥可按入口逐步接入，归档后仍能从仓库恢复操作方法。
- 已补充：相关文档定位索引增加外部角色工具入口。明确 Agency Agents 当前仅登记为 `DOCUMENTED_ONLY / NOT_INSTALLED`，不自动安装、不加载全部角色，不增加产品、跨任务或远端权限；个性化配置只提供候选短路由文本，未修改全局配置。
- 已验证：新目录文件清单、中文 README 与英文 README 互链、英文源文档 SHA-256 同步、`git diff --check` 均通过；本轮未安装 Agency Agents，未修改其他项目，未执行远端写入。
- English: Added `引用的外部工具/agency agents/` with a Chinese entry point, usage guide, cross-project prompt, role activation card, personalization guidance, and an installation/maintenance ledger. Added the external-tool entry to the document locator. The current state remains `DOCUMENTED_ONLY / NOT_INSTALLED`; no automatic installation, all-role loading, product, cross-task, or remote permission is granted. The personalization text is only a candidate short router and global settings were not changed. Verified the file list, reciprocal README links, synchronized English source SHA-256, and `git diff --check`; no Agency Agents installation, external-project change, or remote write was performed.

## 2026-10-03：独立审查完成门禁、故障复发性与提交回读修补

- 已修订：独立审查必须实际读取共同契约点名的必要正文，并回报读取清单、证据指针、未读项和状态；只确认文件存在、只看目录或中途停止时登记 `UNKNOWN/INCOMPLETE_REVIEW`，不得写成审查通过。
- 已修订：阻断、故障、验证失败和流程偏差收口前必须判断一次性环境因素、可复现操作失误或系统性流程缺口；后两类必须留下永久措施和回归验证。
- 已修订：复杂任务在当前操作者已授权的范围内可由总指挥自主安排只读分析者或独立审查者；该授权不扩展到跨任务通信、产品写入或远端写入。
- 已修订：本地 Commit 使用真实换行的提交说明文件或多个独立 `-m` 参数，提交后必须回读提交正文并检查字面量 `\\n`、截断和验证信息。
- English: Independent review now requires reading the necessary source bodies named by the shared contract and returning a read list, evidence pointers, unread items, and status. File-existence checks, directory-only inspection, or an interrupted read must be recorded as `UNKNOWN/INCOMPLETE_REVIEW`, never as approval. Failures must be triaged as one-off environmental factors, reproducible operational errors, or systemic workflow gaps; the latter two require a permanent control and regression evidence. Complex tasks may autonomously use read-only analyzers or independent reviewers within the operator’s existing authorization, without extending communication, product-write, or remote-write permissions. Local commits must use real-newline message files or separate `-m` arguments, then read back the commit body and check for literal `\\n`, truncation, and verification notes.

## 2026-10-03：自然语言场景路由与旧任务兼容过渡

- 已优化：在不引入 API 服务或复杂运行环境的前提下，增加“自然语言入口 → 场景提示词按需加载”的路由契约；明确确定命中、有限候选和无法判断三种分流，减少无关规则读取。新增 `workflow_version`、`state_schema_version`、`scenario_id`、`loaded_sections`、`route_confidence` 和 `migration_status` 的导航语义。
- 已补充：新版采用“双读、单写”兼容过渡，能够读取旧任务快照并生成新版当前视图；`LEGACY_READABLE`、`MIGRATION_REQUIRED`、`MIGRATED` 和 `MIGRATION_BLOCKED` 不得被解释为完成、授权或真实平台验收。脚本仍只承担确定性核验，语义判断和高风险门禁保持在 AI/操作者侧。
- 已验证：刷新契约从 39 项增加到 41 项；`Test-Repository.ps1` 全部通过。独立 AI 审查因未完成正文读取，状态保留为 `UNKNOWN/部分审查`，未把它写成通过。
- English: Added a natural-language routing contract that loads only the matching scenario prompt pack without introducing an API service or complex runtime. The route distinguishes a clear match, a bounded candidate set, and an unknown route, and records workflow/schema versions, scenario, loaded sections, confidence, and migration status. Added a dual-read/single-write compatibility path for legacy tasks; migration states do not grant authorization or prove completion. Deterministic checks remain scriptable while semantic and high-risk decisions stay with the AI/operator. Contract checks increased from 39 to 41 and the repository quality suite passed. The independent review is recorded as `UNKNOWN/partial` because the reviewer stopped before reading the required source sections.

## 2026-10-03：ExampleImageProject 交接反馈的预检与候选唯一性修补

- 已执行：将真实交接反馈区分为网络偶发因素与流程性缺口；补充交接前第一道 `preflight_only` 门、固定事实截点与规则基线、远端失败分类和有限重试、唯一 active candidate 登记、附件与封条两阶段边界，以及旧链只读兼容要求。未修改来源项目，未执行远端写入。
- English: Classified the real handoff feedback into an intermittent network factor and workflow gaps. Added a first `preflight_only` gate, frozen fact cutoff and rule baseline, remote failure categories with bounded retries, a unique active-candidate registry, a two-phase artifact/seal boundary, and read-only compatibility for legacy chains. No source-project or remote changes were performed.

## 2026-10-03：跨窗口材料完整读取与只读互联网核验

- 已修订：收到跨窗口消息后，默认完整取得并阅读当前消息提供的可访问材料；必要时可在只读范围内检索互联网、公开文档和公开代码仓库。读取、核验和总结与来源项目执行授权分离，不再因为未获执行授权而拒绝阅读或总结。本轮回读了 ExampleImageProject 反馈消息及其可见引用内容，未修改来源项目或发送外部消息。
- English: Updated cross-window handling so the receiver must fully obtain and read all accessible materials provided with the message, and may perform read-only searches of the web, public documentation, and public repositories when needed. Reading, verification, and summarization are separate from authorization to act on the source project; lack of execution permission no longer justifies refusing to read or summarize. This batch reread the visible ExampleImageProject feedback and references, with no source-project or external-message changes.

## 2026-10-03：公开故障反馈先查重与透明引用

- 已修订：公开发帖前必须在目标网站检索相似故障，记录查询范围、命中链接和“跟进原帖 / 新发 / 不发布”的决定；相同主题优先跟进原帖。公开载荷必须脱敏，仓库链接只能作为复现记录或参考实现，不得伪装广告或官方背书。本轮只完成规则更新和只读检索，未向外部平台发帖。
- English: Added a pre-publication duplicate-search gate for public bug reports. Before posting, search the target site for similar symptoms, model/version, interface, client, and error terms; record the scope, hits, and the decision to follow an existing thread, create a new post, or not publish. Use a redacted payload and link the repository only as a reproducibility record or reference implementation, never as disguised advertising or implied official endorsement. This batch updated the rules and performed read-only searches; no external post was submitted.

## 2026-10-03：Goal 模板用法与内容触发回执门限

- 已修订：保留现有 Gen1 字段和顺序，在 Goal 入口说明整段代码块才是可编辑区输入，解释文字不重复粘贴；Agency Agents 仍是基线之后的可选只读附录，不是 Goal 启动前置条件。跨任务消息新增内容触发回执信号：场景五/5A–5D、对抗式反馈、征求建议、希望帮忙分析、请审查或评估并给意见。同步定义“入站事件”，并明确“需要回执”与“允许发送回执”分开核验。
- 已记录：用户转述或附件没有当前可定位的来源、目标和本轮通信授权时，只能登记 `尚未向来源回执 / INPUT_REQUIRED`，不得凭猜测补发。未修改来源项目、产品代码或远端状态。
- English: Clarified that the existing Gen1 field order stays intact and the full code block is the editable Goal input; explanatory text is not pasted again. Agency Agents remains an optional read-only appendix after the baseline, not a Goal startup prerequisite. Added content signals that imply a receipt is expected: Scene Five/5A–5D, adversarial feedback, requests for advice or analysis, and review/evaluation requests. Defined an inbound event and separated “a receipt is required” from “sending permission exists”. If a forwarded text lacks a locatable source, target, and current communication authorization, record `NOT YET ACKED / INPUT_REQUIRED` instead of guessing a recipient. No source-project, product, or remote changes were made.
## 2026-09-30：Goal 验收可达性、跨项目反馈路由与复盘积压收口

- 已修订：跨项目来信先核验项目归属；其他项目或归属未知时默认只做 `WORKFLOW_FEEDBACK`，不接管来源业务。Goal 新增逐验收项证据类型、模糊目标的可观察判据、缺证自主恢复与风险相称复核规则；平台未定义原始状态保留为 `UNKNOWN`，不把业务缺口、Pause 和部署门禁互相推导。状态索引新增 `WORKFLOW_FEEDBACK` 最小字段；06 建立阶段状态表，已落地项转观察、外部候选冻结、无触发项不再作为当前待办。未安装外部 Agent、未启动 Hindsight、未执行产品或远端动作。
- English: Updated cross-project routing to verify project affiliation first. Messages from another or unknown project default to `WORKFLOW_FEEDBACK` and do not take over source business work. Goal now records evidence type per acceptance item, converts vague goals into observable criteria, attempts bounded recovery before local waiting, and performs risk-proportional review after decisions; undefined platform states retain their raw value and normalize to `UNKNOWN` instead of conflating business gaps, Pause, and deployment gates. Added minimal `WORKFLOW_FEEDBACK` fields to the state index and a phase status table in the retrospective. External Agents remain uninstalled, Hindsight was not started, and no product or remote action was performed.

## 2026-09-30：场景 0A 固定提示词补齐 manifest 双根路径规则

- 已修复：场景 0A 的长期人工兜底提示词现在直接携带 manifest 的路径解析规则：`.github/` 条目从规则根向上两级的仓库根读取，其他条目从规则根读取。操作者不再需要在失败后手工补发这段规则；同时加入刷新契约检查并更新规则版本。
- English: Fixed the Scene 0A long-term manual fallback prompt so it carries the manifest path-resolution rule directly: `.github/` entries are read from the repository root two levels above the rule root, while other entries are read from the rule root. Operators no longer need to append this rule after a failed refresh. Added a refresh-contract check and updated the rule version.

## 2026-09-30：修正候选交接评分映射

- 已修复：候选材料控制面证据完整且无真实控制面阻断时，交接评分必须为 `HIGH`。`READY_WITH_RESTRICTIONS`、候选阶段旧写者仍为 `IDLE/UNKNOWN`、编辑器缓冲不可观察，以及运行/专业状态 `UNKNOWN/NOT_RUN/FAIL` 只影响各自依赖动作，不再把控制面评分降为 `MEDIUM/LOW`。新增组合回归测试，规则版本更新为 `2026-09-30.6`。
- English: Fixed candidate handoff scoring. When control-plane evidence is complete and no real control-plane blocker exists, the confidence must be `HIGH`. `READY_WITH_RESTRICTIONS`, a candidate-stage old writer still being `IDLE/UNKNOWN`, an unobservable editor buffer, and runtime/professional `UNKNOWN/NOT_RUN/FAIL` states only restrict their dependent actions; they no longer lower control confidence to `MEDIUM/LOW`. Added a combination regression test and updated the rule version to `2026-09-30.6`.

## 2026-09-30：Goal 交接平台暂停闸门

- 已修订：针对 Goal 交接后仍继续执行的实战记录，增加 `Goal 平台状态` 与 `Goal 交接权限` 两个控制字段。交接请求后进入 `PAUSE_REQUIRED / CLOSEOUT_ONLY`；平台确认暂停后才能安全收口；交接材料生成并回读成功后，旧 Goal 的交接权限改为 `NONE`，不得继续测试、修改、分析或启动新批次。`MATERIAL_PREPARED` 和 `GENERATED_NOT_DELIVERED` 不再被视为平台已暂停或旧 Goal 可继续的依据。
- 已补充：模型容量错误在 Goal 中先保存断点、登记 `PAUSE_REQUIRED`，不重复重试同一模型；更新了手册、状态规范、交接模板、阶段矩阵、模型策略、复盘记录和质量契约。版本与规则 manifest 已同步更新。
- English: Added a platform-pause gate after a real Goal handoff incident where the old Goal continued running. Handoff records now carry `Goal platform state` and `Goal continuation authority`: a handoff request enters `PAUSE_REQUIRED / CLOSEOUT_ONLY`, closeout is allowed only after the platform reports paused, and a rereadable handoff changes the old Goal authority to `NONE`. `MATERIAL_PREPARED` and `GENERATED_NOT_DELIVERED` no longer imply that the platform is paused or that the old Goal may continue.
- English: Model-capacity errors now checkpoint the Goal and record `PAUSE_REQUIRED` before any fallback decision; the same unavailable model is not retried. The manual, state rules, handoff template, phase matrix, model strategy, retrospective, and contract checks were updated, and the rule version and manifest were refreshed.

## 未发布：独立 Gen1 Goal 模式与周额度保护

- 已修复：Goal 交接不再只生成文档后继续推进。Gen1 现在把“交接材料生成并回读成功后停止后续业务执行”设为硬停止，并在操作手册中补充 `/goal pause`、`/goal resume`、`/goal clear` 的使用顺序；垃圾桶删除聊天，不作为 Goal 暂停方式。由于工作流文字不能直接证明能够调用客户端暂停 API，平台持久状态仍需操作者用命令或 Goal 进度条 Pause 控制。
- English: Fixed the Goal handoff gap where the task could keep running after producing a handoff document. Gen1 now treats “generate and reread the handoff material, then stop all further business execution” as a hard stop. The operator manual now documents `/goal pause`, `/goal resume`, and `/goal clear`; the trash action deletes the chat and is not a Goal pause mechanism. Because workflow text alone cannot prove that it can call the client pause API, the operator must still control the persistent Goal state with the command or the Goal progress-row Pause control.

- 已修正操作顺序：对于仍在运行的 Goal，必须先由操作者用 `/goal pause` 或 Pause 暂停平台状态，再让 AI 做收口和上下文交接；交接材料回读成功后，如不再继续，再用 `/goal clear`。提示词不能代替客户端暂停正在运行的 Goal。
- English: Corrected the operator order: for an active Goal, the operator must first pause the platform state with `/goal pause` or the Pause control, then ask the AI to close out and prepare handoff material. After the material is reread, use `/goal clear` only if the Goal will not resume. Prompt text cannot replace pausing an active Goal in the client.

- 已调整：Gen1 的“允许操作”方括号现在提供可直接选择的常见权限类别，包括项目材料读取、本地代码/配置/文档修改、普通与高资源验证、本地测试服务和后台任务、无头自动化、Computer Use、已有费用范围内的模型调整、本地依赖更新，以及不 Push 的本地检查点 Commit/分支/worktree。明确保留账号、凭据、远端写入、发布/部署、不可恢复删除、额外费用和专业最终验收的单独授权门禁。最长执行时间默认值改为 8 小时，并同步更新中央默认规则。
- English: Expanded the Gen1 “allowed operations” bracket with selectable common permission categories: project-material reads, local code/config/document edits, ordinary and high-resource validation, local test services and background jobs, headless automation, Computer Use, model adjustments within the existing plan and cost scope, local dependency updates, and local checkpoint commits/branches/worktrees without Push. Account access, credentials, remote writes, publishing/deployment, irreversible deletion, extra costs, and professional final acceptance remain separately gated. The default maximum execution time is now 8 hours, with the central default updated accordingly.

- 已调整：普通或专项任务交接快照现在可以附带自动化任务的完整非秘密重建条件，包括类型、名称、原始提示词、模型、推理设置、周期、时区、绑定对象、通知、状态、最后可靠运行、关联 Goal/任务、授权范围以及暂停/恢复/失效条件。新窗口先只读核验是否仍存在和是否重复；确认缺失且取得本次创建授权后才重建，并在创建后回读配置。任务 ID、凭据、Cookie、API Key 和其他秘密值不随交接继承。
- English: Updated ordinary and specialist handoff snapshots to carry complete non-secret rebuild conditions for active automations: type, name, original prompt, model, reasoning settings, cadence, timezone, binding, notifications, status, last reliable run, Goal/task binding, authorization scope, and pause/resume/expiry conditions. The new window first checks existence and duplicates; it rebuilds only after confirming absence and receiving current creation authorization, then rereads the created configuration. Task IDs, credentials, cookies, API keys, and other secrets are never inherited.

- 已澄清：本轮最终模板把“额度保护”标为可选；未明确启用时不读取或监控额度。并补充了细节描述、素材提供、身份赋予和允许操作字段的留空提示，分别说明由 AI 补齐、在授权范围内查找、按目标选择身份，以及留空时沿用当前项目已有授权但不追加授权。该说明只给操作者看，发送给 AI 前应删除或替换方括号内容。
- English: Clarified that the final template treats quota protection as optional; without explicit enablement, quota is neither read nor monitored. Added operator-only blank-field guidance for details, materials, assigned identity, and allowed operations: AI may fill or search within scope, choose the role, or reuse existing project authorization without adding permissions. These bracketed notes should be removed or replaced before sending the prompt to an AI.

- 已修订：按操作者原模板重新审阅 Gen1，只保留必要修改，不再自动恢复操作者主动删除的“模型容量故障处理”章节。模板的目录层级、字段顺序、编号、分段换行和额度保护的人话表达以操作者版本为基线；补充了方括号填写说明与中央默认值规则，确保删除“③ 最长执行时间”说明文字后仍使用默认 2 小时。
- 已新增规则：模板审阅必须说明每一处改动及原因；操作者删除的章节不得静默加回；每次提示词修改后都要检查关联手册、主规则、额度/授权规则、脚本、manifest、双语说明和质量测试是否受影响。
- English: Re-reviewed Gen1 against the operator’s original template and kept only necessary changes. The operator’s directory level, field order, numbering, line breaks, and plain-language quota wording are the baseline; the intentionally removed model-capacity section was not restored. Bracketed fill-in notes and centralized defaults were added so deleting the “maximum 2 hours” helper text still leaves the 2-hour default in force.
- English: Added a rule that every template edit must explain each change and its reason; intentionally deleted sections must not be silently restored; and every prompt edit must check linked manuals, core rules, quota/authorization rules, scripts, the manifest, bilingual notes, and quality tests.

- 已修订：Gen1 不再作为场景七外的独立目录，而是归入场景七并与 Gen2 同级；模板改为“最终目标—细节描述—素材提供—身份赋予—允许操作—默认规则约束—能力剖面—自动化验证—停止条件—额度保护—模型容量故障—执行要求”。移除“测试规则/测试变量”等容易让操作者误解的字段，并删除示例图像项目专用措辞和场景 2E 的样本分类要求。
- English: Revised: Gen1 is no longer a standalone directory outside Scene Seven. It now sits under Scene Seven beside Gen2. The template uses “final goal, detail description, supplied materials, assigned role, allowed operations, default constraints, capability profile, automated validation, stop conditions, quota protection, model-capacity handling, and execution requirements.” Confusing test-rule/test-variable fields and project-specific ExampleImageProject or Scene 2E wording were removed.

- 已核验：操作者提供的桌面端和网页版截图指向同一个每周共享限额，界面显示剩余百分比；当前 Codex 环境的只读用量接口与截图的剩余方向一致。具体动态数值不写入公开记录。
- 已调整：Goal 额度保护只保留两个操作者可理解的停止条件：剩余额度低于保留下限，或本轮观测到的额度差值达到任务上限。默认保留下限从 2 个百分点调整为 5 个百分点，可选 3 / 5 / 10 / 自定义；默认任务上限为 `min(20%, R0-保留下限)`。触发任一条件后先保存断点、任务记录和下一步再停止；不再要求操作者理解软停止/硬停止或填写复杂采样表。
- 已记录：`Selected model is at capacity. Please try a different model.` 单独归类为模型容量不可用；只有预先授权模型故障切换时才允许切换候选模型，并重新核对配置和小型验收，不把容量错误写成额度耗尽，也不反复重试同一模型。
- 历史草稿（已由本轮后续修订覆盖）：曾把 Gen1 从场景七中独立为“场景 Gen1：长任务 Goal 模式”，并按当时的模板加入无头验证、样本级结果分类、额度采样降级和模型容量处理；当前生效版本已按操作者最新模板回归场景七，并不包含已删除的模型容量字段。尚未在多个客户端/账号上验证接口与页面的长期一致性，也未执行任何产品、外部项目或远端操作。
- English: The operator’s desktop and web screenshots identify the same weekly shared limit and show a remaining percentage; the current Codex read-only usage endpoint matched the UI’s remaining direction. Exact dynamic values are not written to public records.
- English: Simplified Goal quota protection to two operator-facing stop conditions: remaining allowance falls to or below a reserve floor, or the observed shared-allowance difference reaches the task cap. The default reserve changed from 2 to 5 percentage points, with 3 / 5 / 10 / custom choices; the default cap is `min(20%, R0-reserve)`. When either condition triggers, save the checkpoint, task record, and next step before stopping. Operators no longer need to understand soft/hard stops or fill a detailed sampling table.
- English: The error `Selected model is at capacity. Please try a different model.` is classified separately as model capacity unavailability. A fallback model may be selected only when pre-authorized, followed by configuration checks and a small acceptance run; do not treat capacity errors as quota exhaustion or repeatedly retry the same unavailable model.
- English: Historical draft (superseded by the later revision in this batch): Gen1 was temporarily made an independent “Gen1: Long-running Goal Mode” scene with headless validation, sample-level result classes, quota-observation fallback, and model-capacity handling. The currently effective version follows the operator’s latest template, returns Gen1 under Scene Seven, and does not include the deleted model-capacity field. Long-term equivalence across clients/accounts remains unverified; no product, external-project, or remote action was performed.
- 已记录：对 `msitarzewski/agency-agents` 完成只读候选评估。它是面向工程、游戏开发、测试、学术、设计、产品和项目管理的专业 Agent 提示词库，支持转换到 Codex 自定义 Agent；当前只保留原始 GitHub URL、核验日期和证据边界，状态为 `CANDIDATE / NOT_INSTALLED`，未安装、未运行转换脚本、未接入真实项目。
- English: Completed a read-only candidate assessment of `msitarzewski/agency-agents`. It is a library of specialist Agent prompts for engineering, game development, testing, academic, design, product, and project-management work, with conversion support for Codex custom agents. Only the original GitHub URL, review date, and evidence boundaries are recorded; status is `CANDIDATE / NOT_INSTALLED`, with no installation, conversion run, or real-project integration.
- 已登记：为 Agency Agents 建立两个项目类型的只读试用：图像/算法工程角色和通用游戏设计角色。试用不写入用户级 Agent 目录、不改真实项目、不运行远端或发布动作；先比较事实核对、专业增益、输出证据、输入成本、权限边界和失败恢复，再决定是否做项目级精选安装。
- English: Registered two read-only Agency Agents pilots: an image/algorithm engineering role and a general game-design role. The pilot does not write to the user-level Agent directory, modify real projects, or perform remote or publishing actions. It will compare factual grounding, specialist gain, evidence quality, input cost, permission boundaries, and failure recovery before any project-level selective installation.
- 已完成：第一轮只读对照审查发现，两个候选角色与项目既有规则和测试材料有较大重复；AI 工程角色的通用生产指标不能套用，暂不安装。游戏设计角色仅保留一次定向运行候选，需证明能发现现有材料未覆盖的可验证问题。本轮未启动独立 Agent 实例，状态为 `DESK_REVIEW_COMPLETE / NOT_INSTALLED`；未修改两个真实项目、未广播、未执行远端动作。
- English: The first read-only comparison found substantial overlap between both candidate roles and existing project rules and test materials. The AI Engineer role's generic production metrics cannot be transferred, so installation is not recommended. The Game Designer role remains a candidate for one targeted run and must identify a verifiable gap absent from the current materials. No independent Agent instance was run; status is `DESK_REVIEW_COMPLETE / NOT_INSTALLED`. Neither real project was modified, no broadcast was sent, and no remote action was performed.
- 已调整：接受“角色赋予”与“全局安装”分开验证。当前轮次收口后，先保留总指挥原输出作为基线，再对同一材料临时叠加 AI Engineer 或 Game Designer 角色做 A/B 对照；比较新增发现、证据、重复度、成本和越权倾向。状态改为 `ROLE_OVERLAY_AB_TEST_PENDING / NO_GLOBAL_INSTALL`，仍不修改真实项目、不广播、不执行远端动作。
- English: The evaluation now separates temporary role assignment from global installation. After the current round closes, the commander's original output will be kept as a baseline, then the same materials will be reviewed with a temporary AI Engineer or Game Designer overlay. The comparison will cover new findings, evidence, overlap, cost, and scope expansion. Status: `ROLE_OVERLAY_AB_TEST_PENDING / NO_GLOBAL_INSTALL`; real projects, broadcasts, and remote state remain unchanged.
- 已确认：Agency Agents 的 Codex 集成说明把 TOML 安装到用户级 `~/.codex/agents/`，不能据此声称只给某个项目或专项任务安装。当前不做全局安装；示例游戏项目先在总指挥窗口使用一条临时 Game Designer 角色叠加提示词，示例图像项目等 Goal 长任务等形成断点后再试。已补充傻瓜式调用入口和冲突边界，未广播、未改真实项目、未执行远端动作。
- English: The Agency Agents Codex integration installs TOML files in the user-level `~/.codex/agents/`; this does not provide project- or task-only installation. No global install is performed. The ExampleGameProject project will first use a temporary Game Designer overlay in its commander window; long-running Goal work such as ExampleImageProject will wait for a checkpoint. A plain-language invocation and conflict boundary were added; no broadcast, real-project change, or remote action was performed.
- 已验证：首次实际角色叠加已在示例游戏项目总指挥窗口完成。未安装 Agent，而是发送了精简的 Game Designer 工作约束；总指挥确认当前真正缺口是真人无口头提示试玩，不是设计建议，因此没有转交开发专项、修改代码或远端操作。结果为“角色入口可用，但本轮没有新增价值”，尚不能证明安装版有额外收益。
- English: The first real role overlay was completed in the ExampleGameProject commander window. No Agent was installed; a concise Game Designer constraint set was supplied instead. The commander confirmed that the actual gap is an unprompted human playtest, not another design recommendation, so no developer handoff, code change, or remote action occurred. Result: the role entry works, but this round added no value; installed-agent gains remain unproven.

## 2026-09-28：建立外部材料原始证据定位规则

- 已执行：规定外部网页、仓库、附件和第三方报告参与复盘或优化结论时，必须记录原始来源、取得日期、精确范围、支持/不支持的事实、保存状态和失效条件，并把来源与 AI 推断、本项目实测分开。
- 已确认：该规则要求可回源，不要求复制完整网页；无法回源或内容漂移时，受影响结论必须回到“待确认”，不得把旧摘要当作当前事实。
- English: External webpages, repositories, attachments, and third-party reports used in retrospectives or optimization decisions must record the original source, access date, exact scope, supported and unsupported facts, preservation state, and invalidation conditions, while separating source evidence from AI inference and project measurements.
- English: The rule requires a reproducible source pointer, not a full webpage copy. If the source cannot be revisited or has drifted, affected conclusions return to pending confirmation instead of treating an old summary as current fact.

## 2026-09-28：补充外部记忆候选的原始证据定位

- 已执行：在 Hindsight 评估候选中记录原始 GitHub 地址、具体章节锚点、各自支持的事实和证据边界，区分“可回源指针”与“离线快照”。
- 已确认：本轮未保存外部网页全文、视频、截图或仓库副本，未安装或运行 Hindsight；后续总指挥应先回源核对，再把上游声明与本项目实测分开。
- English: The Hindsight evaluation now records the original GitHub URL, section anchors, supported facts, and evidence boundaries, distinguishing a source pointer from an offline snapshot.
- English: No external webpage, video, screenshot, or repository copy was saved, and Hindsight was not installed or run; future commanders must recheck the source and keep upstream claims separate from project evidence.

## 2026-09-28：登记 Hindsight 外部记忆系统评估候选

- 已讨论：把 Hindsight 作为可替换的外部 Agent 记忆层候选，评估长期记忆、证据化观察、项目隔离、隐私防护和 MCP/编码 Agent 接入；不把它视为总指挥控制面替代品。
- 已记录：新增分阶段计划、对抗式风险审查、比较契约、安全验收、停止条件、回滚边界和替换决策门；当前状态为 `CANDIDATE / NOT_DEPLOYED`，未安装、未启动、未接入真实数据。
- 已确认：计划来源为 Hindsight 公开 README（核验日期 2026-09-28）；上游能力和基准不直接构成本项目效果证据。
- English: Hindsight is recorded as a replaceable external Agent-memory candidate for evaluating long-term memory, evidence-backed observations, project isolation, privacy defense, and MCP/coding-agent integration; it is not treated as a replacement for the commander control plane.
- English: The new staged plan includes a comparison contract, adversarial risks, safety acceptance, stop conditions, rollback boundaries, and replacement gates. Status: `CANDIDATE / NOT_DEPLOYED`; no dependency, server, or real data was used.
- English: The plan cites Hindsight's public README checked on 2026-09-28; upstream capabilities and benchmarks are not project-level evidence.

## 2026-09-28：修正交接来源根路径校验

- 已执行：封条验证和交接预处理现在按各来源自身声明的根目录核对控制面 registry，并使用路径关系判断避免符号链接或相邻前缀绕过边界。
- 已验证：HandoffSeal 54/54、Prepare-Handoff 20/20、WorkflowRefreshContract 30/30 通过；本批修复已与 manifest 指纹同步。
- English: Handoff seal verification and preparation now validate the control-plane registry against its declared source root and use path relationships that resist symlink or adjacent-prefix boundary bypasses.
- English: HandoffSeal 54/54, Prepare-Handoff 20/20, and WorkflowRefreshContract 30/30 passed; the manifest fingerprints were refreshed for these fixes.

## 2026-09-28：明确 Windows 工作台版本与远端下载核对

- 已执行：在 Windows 工作台中说明 `0.2.0-dev.10` 已有 GitHub 下载但仍是开发预览，并补充本地包、远端 Release、SHA-256 和预发布状态的核对方法。
- 已执行：中英文 README 同步增加 `Get-FileHash` 示例，避免把同名 ZIP 或本地可运行误解为远端已同步。
- 已验证：本次只修改公开说明和 CHANGELOG，未修改 Homepage、封面图、Topics、Release 状态或其他远端对象。
- English: The Windows desk README now states that `0.2.0-dev.10` is downloadable from GitHub but remains a development preview, and documents how to compare the local package, remote release, SHA-256, and prerelease state.
- English: Both README pages include a `Get-FileHash` example so a same-named ZIP or a locally working build is not mistaken for proof of remote synchronization.
- English: This batch changed public documentation and the changelog only; it did not change the Homepage, cover image, Topics, release status, or any other remote object.

## 2026-09-28：交接与远端同步流程收口

- 已执行：补齐交接预处理、正式候选附件、封条来源回算、工作区内容指纹和远端基线核验；缺少外部控制面根时明确返回 `INPUT_REQUIRED`，不把缺少参数误判为来源损坏。
- 已执行：候选交接回复统一先给四句人话摘要，再按需展开机器字段；远端同步自然语言入口继续经过本地成果盘点、验证和授权门禁。
- 已执行：同步更新根 README 中英文入口，说明当前交接规则、证据边界和远端同步流程。
- 已验证：本地规则指纹、封条链、工作区聚合指纹和远端 `origin/main` 基线已回读；仓库质量、工作流刷新契约、Prepare-Handoff、HandoffSeal 与 `git diff --check` 均通过。
- English: Handoff closeout now covers preflight, formal candidate attachments, live seal-source verification, worktree content fingerprints, and the remote baseline. Missing external control-plane roots are reported as `INPUT_REQUIRED` instead of being treated as source corruption.
- English: Candidate handoff replies start with four plain-language lines and expand machine fields only when needed. Natural-language remote-sync requests still pass through local inventory, verification, and authorization gates.
- English: The root Chinese and English README pages now describe the current handoff evidence boundaries and remote-sync flow together.
- English: Local rule fingerprints, the seal chain, the worktree aggregate, and the `origin/main` baseline were reread. Repository quality, the workflow refresh contract, Prepare-Handoff, HandoffSeal, and `git diff --check` all pass.

## 未发布：交接候选回复改为人话优先

- 已执行：修正交接规则之间的出口冲突。候选回复现在必须先用四行普通中文说明评分、是否建议交接、真正阻断和操作者下一步；机器字段、计数、指纹和内部状态码只在用户要求或真实异常需要定位时补充。`NOT_RUN`、`GENERATED_NOT_DELIVERED`、不可观察状态和旧总指挥未归档，不再被自动写成阻断。
- 已验证：新增人话出口契约检查；规则版本升至 `2026-09-28.12`。本批验证结果以当前回合实际运行结果为准，未执行远端写入。
- English: Handoff candidate replies now start with four plain-language lines: confidence, whether handoff is recommended, the real blocker, and the operator’s next action. Machine fields, counts, hashes, and internal statuses are shown only when requested or needed to locate a real exception. `NOT_RUN`, `GENERATED_NOT_DELIVERED`, unobservable state, and an unarchived old commander are no longer treated as blockers by default. Rule version `2026-09-28.12`; no remote write was performed.

## 未发布：交接预处理、收口与远端差异分级

- 已执行：场景 1B 改为交接预处理与收口判断；它先给出评分、是否建议交接、真实阻断和可执行收口项。不存在场景 EC；历史误写“EC”均按场景 1C 理解。需要先收口时使用 1B，只有收口后达到稳定条件才进入 1C 并生成 `final-*`；仍不适合交接时不生成快照。
- 已执行：本地未 Push 或本地与远端尚未同步的成果不再单独阻断交接，改登记为交接后的待办；只有当前断点依赖远端且远端无法核验或存在未解释冲突时，才阻断受影响动作。规则版本升至 `2026-09-28.11`。
- 已验证：Prepare-Handoff 20/20、HandoffSeal 54/54、WorkflowRefreshContract 29/29、Test-Repository 和 `git diff --check` 均通过；未执行远端写入。
- English: Scenario 1B now performs handoff preflight and closeout triage. There is no Scenario EC; historical “EC” mentions are treated as typos for Scenario 1C. When closeout is needed first, Scenario 1B precedes 1C, and a `final-*` artifact is generated only after closeout reaches a stable handoff condition. Local work that has not been pushed is tracked as a post-handoff item rather than a blocker unless the current breakpoint depends on an unverifiable or conflicting remote fact. Prepare-Handoff 20/20, HandoffSeal 54/54, WorkflowRefreshContract 29/29, repository quality, and diff checks pass locally; no remote write was performed. Rule version `2026-09-28.11`.

## 未发布：交接实时远端核验与无回执候选流程

- 已执行：Prepare-Handoff 在生成正式附件前重新查询已绑定远端 ref，并将通过核验的远端 Head 与事实截点绑定到封条；增加实时远端漂移回归用例。修订正常交接语义：主附件生成后即可由操作者发送，`GENERATED_NOT_DELIVERED` 是内部中间状态，候选以当前消息收到主附件为送达事实，不再要求独立 `DELIVERED` 回执。
- 已执行：交接以磁盘最后一次保存内容为边界；编辑器未保存缓冲只登记为不可观察信息，不降低控制面评分。候选汇报先给评分、是否建议交接、真实阻断和操作者下一步，再附技术字段。规则版本升至 `2026-09-28.9`。
- 已执行：规则 manifest 纳入 HandoffSeal、Prepare-Handoff 和历史交付工具的实际文件指纹；交接工具改动会使候选规则基线失效并要求重生成。
- 已验证：Prepare-Handoff 20/20、HandoffSeal 54/54、工作流刷新契约 28/28、仓库质量检查和差异检查均通过；未执行远端写入。真实空白窗口交接行为仍需后续观察。
- English: Prepare-Handoff now re-queries the bound remote ref before creating a formal attachment and binds the observed remote head to the seal cutoff; a regression probe covers remote drift. Normal handoff now treats `GENERATED_NOT_DELIVERED` as an internal post-generation state: the operator sends the single Markdown attachment, and the candidate uses receipt of that attachment in the current message as delivery evidence without a separate `DELIVERED` callback. Handoff uses the last saved disk state; unobservable editor buffers are informational and do not lower control confidence. Prepare-Handoff 20/20, HandoffSeal 54/54, workflow refresh 28/28, repository quality, and diff checks passed locally; no remote write was performed. Rule version is `2026-09-28.9`.
- English: The rule manifest now includes file digests for HandoffSeal, Prepare-Handoff, and the historical delivery utility, so tool changes invalidate the candidate rule baseline and require regeneration.

## 未发布：交接主附件出口明确化

- 已执行：明确交接生成后的唯一人工转发对象是项目化命名的 `final-*.md` 主附件；操作者按场景 1D 第一步发送该附件和提示词，机器 JSON、封条、manifest 与回执只供 AI 核验。为兼容历史称呼，场景 ED 解释为现行场景 1D。
- 已验证：同步更新 01/04/07 的交接出口说明；规则版本升至 `2026-09-28.8`，manifest 按实际文件重算；本地远端同步仍需另行授权。
- English: Handoff output now has one explicit human-forwardable artifact: the project-named `final-*.md` attachment. The operator sends that file with Scenario 1D Step 1; machine JSON, seals, manifests, and receipts remain verification-only. The historical label “Scenario ED” maps to current Scenario 1D. Rule version `2026-09-28.8` and the manifest were refreshed; remote sync remains separately authorized.

本文件记录 ChatGPT Workflows 的重要变更。

## 未发布：将“当前轮指令优先”提升为全局规则

- 已执行：把“当前提示词决定本轮行动、历史时序约定只作背景、冲突时按当前消息重建任务契约，同时保留系统/团队/安全/权限/验证门禁”写入总览与核心规则；场景 1C 仅保留交接专属动作，不再独占这条原则。
- 已验证：规则版本升至 `2026-09-28.7`，manifest 已按实际文件重新计算；待本批本地检查完成后再决定是否同步远端。
- English: The “current-turn instruction takes precedence” rule is now global: historical timing plans are background only, conflicts rebuild the current task contract, and system, team, safety, permission, and verification gates remain in force. Scenario 1C now contains only handoff-specific actions. Rule version `2026-09-28.7` and the manifest have been refreshed; remote synchronization remains separate.

## 未发布：修复规则 manifest 的跨平台换行指纹

- 已发现：本地四份规则文件仍含 CRLF/混合换行，manifest 绑定了本地字节；GitHub 按 `.gitattributes` 检出 LF 后，远端 `Repository quality` 在提交 `256e2ec` 发现 `00-第二代工作流总览.md` 指纹不一致。
- 已修复：将 `00/02/09/10` 规范化为 LF，并按规范化后的实际文件重新计算 manifest；未改变规则语义。该修复只处理跨平台字节一致性，不放宽规则内容校验。
- English: Four rule files still contained CRLF or mixed line endings while the manifest recorded local bytes. GitHub checked out LF per `.gitattributes`, and the `Repository quality` run for commit `256e2ec` reported a digest mismatch beginning with `00-第二代工作流总览.md`. The files are now normalized to LF and the manifest is recalculated from those canonical bytes; rule semantics are unchanged.

## 未发布：远端同步自然语言入口统一路由到 4K

- 已执行：将“更新一下远端仓库”“把本地的最新成果同步到远端”及同义表达明确路由到场景 4K 的本地成果盘点与候选准备阶段；这些表达不直接授予 Push，也不跳过归属、隐私、验证、团队协作和远端最终确认门禁。
- 已验证：规则总览、操作者手册和总指挥核心规则的路由说明保持一致；`Test-WorkflowRefreshContract.mjs`（28 项）、`Test-Repository.ps1`、`Test-HandoffSeal.mjs`（54 项）、`Test-Prepare-Handoff.mjs`（19 项）和 `git diff --check` 均通过。
- English: The natural-language requests “update the remote repository” and “sync the latest local work to the remote repository,” including equivalent wording, now route to Scenario 4K for local-result inventory and candidate preparation. They do not directly authorize Push or bypass ownership, privacy, verification, team-collaboration, or final remote-confirmation gates. `Test-WorkflowRefreshContract.mjs` (28 cases), `Test-Repository.ps1`, `Test-HandoffSeal.mjs` (54 cases), `Test-Prepare-Handoff.mjs` (19 cases), and `git diff --check` all pass.

## 未发布：交接读取链减负与规范快照收敛

- 已执行：对抗式复核总指挥交接的必要步骤，保留安全收口、独立候选核验、操作者停止确认、原子登记唯一写者和中央回读；将旧总指挥与新候选的提示词改为“一份规范机器记录 + 短摘要”，候选默认只读取聚合状态和必要未提交成果。
- 已执行：规则指纹一致时不全文读取 02/04/07/09/10；中央工作项先读计数、优先级摘要和当前活跃项；远端、运行和专业验收按当前项目及下一步依赖条件展开。规则或工作区漂移时废弃候选并递增重生成，保留独立 `DELIVERED` 回执和规则冻结。
- 已验证：本批只修改工作流文档和规则版本，未执行真实跨窗口交接、产品修改、远端写入或部署；本轮质量脚本、封条、交接准备、契约检查和 `git diff --check` 已复跑并通过。
- English: Adversarial review retained the safety gates for closeout, independent candidate verification, operator stop confirmation, atomic single-writer registration, and central readback. Scenario 1C/1D now use one canonical machine record plus a short summary; candidates read aggregates and necessary uncommitted artifacts by default. Rule drift or workspace drift supersedes the candidate and requires a new generation. Real cross-window handoff and remote operations remain unverified.

## 未发布：交接流程减负与验证器根因修复

- 已执行：根据两份真实交接复盘，拆开“不可变交接证明”“持续变化的中央状态”和“候选规则基线”。候选生成到正式切换期间冻结规则版本与 manifest；普通中央进度更新不再强制追加 `CURRENT_ATTESTATION`，已完成接管不因普通进度变化自动失效。版本更新为 `2026-09-28.4`。
- 已修复：封条验证缺少 external control-plane root 时改报 `INPUT_REQUIRED` 并把 `latest_source_status` 标为 `NOT_CHECKED`；回执加入可直接执行的完整验证命令和预期结果；封条、来源和远端允许记录真实的更早观察时间，只拒绝晚于事实截点的时间。
- 已修复：正式交接准备现在回读 live Git 的 HEAD、tree、分支和工作区计数，不能靠中央状态正文残留的旧 HEAD 通过；封条新增 `rule_baseline`，把规则版本和 manifest 摘要纳入封条摘要，新增 `worktree_fingerprint`，绑定 tracked diff 与未跟踪内容摘要，同计数替换也会被阻断。
- 已验证：封条链、正式附件、时间边界、缺参分类、实时 Git 漂移和工作流契约回归通过；真实跨窗口交接仍需下一次自然任务验证。未执行产品修改、远端写入、部署或正式总指挥切换。
- English: Based on two real handoff postmortems, the workflow now separates immutable handoff evidence, live central state, and the candidate rule baseline. The rule version and manifest are frozen from candidate preparation through takeover; ordinary central progress updates do not require a new `CURRENT_ATTESTATION`, and a completed takeover is not invalidated by ordinary progress. Version `2026-09-28.4`.
- English: The seal verifier now reports `INPUT_REQUIRED` and `latest_source_status=NOT_CHECKED` when the external control-plane root is missing. The seal now binds the rule baseline and a worktree content fingerprint, so same-count replacements are detected. Receipts include a copyable verification command and expected results. Real earlier observation times are accepted, while observations after the fact cutoff are rejected. Formal preparation now compares live Git HEAD, tree, branch, and workspace counts with the draft. Contract tests pass; a real cross-window handoff remains to be observed.

## 未发布：交接快照内容一致性门禁

- 已修复：交接工具此前能验证封条和来源哈希，却不会自动发现快照正文残留旧世代、旧断点、旧工作区计数或过期交付状态。1C/04 现在要求在封存前把快照正文逐项与中央 CURRENT、状态索引、Git/远端和独立交付回执核对；无法核对的字段必须标记待确认。
- 已验证：新增工作流契约检查；该门禁仍不替代候选对实际代码、配置和测试的回读。
- English: Handoff tooling previously verified seals and source hashes without detecting stale generation, breakpoint, workspace counts, or delivery status in the snapshot body. Scenario 1C and rule 04 now require a content reconciliation against CURRENT state, the status index, Git/remote facts, and the independent delivery receipt before sealing; unverifiable fields must remain pending.

## 未发布：交接触发与当前轮指令优先修正

- 已执行：明确每轮以当前操作者消息决定目标、时序和授权；上一轮“下一轮再交接”等内容只作背景，不能自动生成快照或继承权限。自然语言“准备交接/收口后交接”仅路由到场景 1C，必须完整执行预检、结束覆盖核账、成果回读、封条和交付门禁；不存在场景 EC；历史误写“EC”按场景 1C 处理。
- 已执行：定义“收口”为安全停止原子步骤并登记状态、责任、断点、下一行动和恢复/失效条件；普通未完成项可进入快照非终态队列，结果未知的高风险动作或缺少稳定断点时才阻断。新增契约断言并升级规则版本到 `2026-09-28.1`。
- English: Each turn now derives its action, timing, and authorization from the current operator message. Earlier “handoff next turn” wording is background only and cannot generate a snapshot or inherit permissions. Natural-language handoff requests route to scenario 1C but do not bypass its preflight, closeout coverage, readback, seal, and delivery gates. There is no Scenario EC; historical “EC” mentions are typos for Scenario 1C. Closeout means safely stopping at an atomic boundary and recording status, owner, checkpoint, next action, and recovery/expiry conditions; ordinary pending work may remain in the snapshot queue, while unknown high-risk work or missing checkpoints blocks readiness.

## 未发布：跨任务工作流审查与来源业务分流修正

- 已修正：明确请求审查公共工作流的 AI 来信按 `WORKFLOW_FEEDBACK` 处理，按 FIFO 在取得时隙后完成最小只读核对；来源项目的产品、算法、测试、部署、远端动作和业务交接仍需专项授权。混合消息拆分处理，避免把隔离边界扩大成跳过工作流审查。
- 已验证：新增契约检查覆盖公共工作流审查、来源业务阻断和混合消息分流；静态检查不能证明未来宿主一定自动正确路由。
- English: AI messages that explicitly request review of the public workflow now route to `WORKFLOW_FEEDBACK` and receive minimal read-only handling after FIFO scheduling. Source-project product, algorithm, test, deployment, remote, and business-handoff actions still require scoped authorization. Mixed messages are split so isolation cannot suppress workflow review. A regression contract covers the three routes; static checks cannot prove future host behavior.

## 已发布：Windows SessionDesk 0.2.0-dev.10

- 已执行：按当前源码重新制作独立的 10 文件 ZIP，保留旧包；当前候选 SHA-256 为 `3161D998B2F6032ED5F74CA2B6B8BD13E26B3F49273D6665CBE6F114269FE91A`。更新测试清单以绑定这份精确候选。
- 已验证：全新解压后 47/47 项合成回归通过，页面错误为空、外部请求为 0；隔离空 `CODEX_HOME` 的非合成启动返回 `0.2.0-dev.10 / local-readonly`，并受控退出。Tag、Release、ZIP 与校验文件已在 GitHub 回读一致；真实用户会话、其他设备及专业表现未验收。
- 已修复：根目录中英文 README 的推荐入口与模块页统一指向已发布的 `windows-sessiondesk-v0.2.0-dev.10`，不再显示 dev.9。
- English: Rebuilt and published the 10-file Windows SessionDesk 0.2.0-dev.10 candidate. All 47 synthetic checks passed after fresh extraction, with no page errors or external requests. An isolated non-synthetic startup reported the expected version and mode, then exited cleanly. The tag, release, ZIP, and checksum were verified on GitHub; real user sessions, other devices, and professional acceptance remain unverified. Root bilingual README links now match dev.10 instead of dev.9.

## 未发布：跨任务回执硬门禁事故修复

- 已确认：来源 AI 明确要求回执且通信工具可用，但本窗口只输出了说明，没有实际发送回执；原因是旧规则要求回执却没有把“先调用发送工具并读取结果”设为下一动作和最终出口硬门禁。
- 已执行：`02`、`09`、根 `AGENTS.md` 增加回执先行、工具结果核对和缺证据不得收口规则；契约检查新增事故回归；`06` 留存事实、影响和验证边界。静态检查不能替代未来真实宿主行为验证。
- English: An AI explicitly requested a receipt while communication was available, but this window only explained the situation and did not send one. The workflow now makes the actual send call, result readback, and final evidence check a hard gate in `02`, `09`, and root `AGENTS.md`, with a regression contract and an incident record. Static checks cannot prove future host behavior.

## 未发布：场景 2G 有界自动测试入口

- 已执行：把独立自动化负反馈闭环测试提示词的当前用法迁入场景 2G，操作者只填停止条件、质量标准、真实数据与可选真值；2E 保留人工反馈，2C 保留原因不明时的逐节点诊断。旧版“2G 代码精简”按内容和规则版本映射现行 2B，独立提示词原件保留。
- 待验证：真实产品入口、算法效果、硬时限执行和专业验收均未运行；本批仅涉及工作流规则与静态检查，不含产品修改或广播。Commit 与远端状态以 Git 记录为准。
- English: Added scenario 2G for bounded testing with real data, authorized local repair, and retesting. Existing 2E feedback and 2C diagnosis keep their roles; the legacy 2G refactoring alias maps to 2B. The standalone source prompt remains. Live product behavior is unverified, and this change is local only.

## 未发布：自动化负反馈测试入口定位

- 已核验：限轮次或时长的自动测试、局部修复与复测提示词仍在 `其他 Codex 技巧性提示词/`，属于独立提示词；Git 历史显示其新增晚于一次操作手册精简，未发现被该次重排删除。当前编号场景中没有对应的显眼入口；本批只记录定位结论，未改测试流程或执行测试。
- 后续处理：相关手册现已增加场景 2G 入口；真实自动测试与算法效果未验证。Commit 与远端状态以 Git 记录为准。
- English: Confirmed the bounded automated feedback test prompt still exists as a standalone prompt and was added after the operator manual was condensed. This records a possible navigation gap; no test behavior changed or test run was performed.

## 未发布：GitHub 与算法工作流定点修正

- 已执行：`02` 的输出异常入口先读诊断标准 2.1，只有按证据进入完整 2C 才全文加载和逐节点盘查；双边有效成果的当前路由及关联引用改为 `4I`，保留旧编号兼容。规则版本更新为 `2026-09-27.8`，契约检查增加加载、盘查范围和错号路由的反例门禁。
- 已审查：另一 Agent 定点复核确认两处冲突及修法；直接 Push 全文加载 PR 标准、`4J` 干净快进固定确认属于待评估成本，本批保留现有保护。
- 待验证：真实 AI 路由、算法根因定位与修复效果、GitHub 协作耗时和 Token 收益。Commit 与远端状态以 Git 记录为准。
- English: Fixed the 2E/2C loading conflict and routed bilateral Git integration to 4I while retaining the legacy alias. Added regression checks; direct-push reading cost and 4J confirmation remain under evaluation. Local change only; live Agent and algorithm outcomes remain unverified.

## 未发布：2E 反馈到 2C 查因与修复的默认路径

- 已执行：2E 失败反馈先由 AI 做最小定点核对；原因与边界清楚时局部修复，仍不明、证据冲突或涉及跨层链路时才进入完整 2C。2C 内部保留完整节点拆解、逐层观测和因果验证，默认先报告根因证据、具体修复计划、授权内修复及回归。流程图和逐节点讲解改为按需展示，不再作为修复前置交付。
- 已执行：修复缺授权时先完成独立诊断，再一次列出拟改范围、影响和验证请求差额；仅分析、转贴材料、专业效果及远端门禁不变。同步修正诊断标准的分流章节锚点，规则版本更新为 `2026-09-27.6`。
- 已验证：规则来源指纹、全仓质量检查及合成分流案例通过；真实项目中的根因定位质量、修复效果和对话轮次尚无证据。本批未处理来源项目；Commit 与远端状态以 Git 记录为准。
- English: Scenario 2E first triages failed feedback with a focused check. Clear causes get a local fix; unresolved or cross-stage faults enter full 2C diagnosis. Full node-level evidence and causal checks remain, while the default report leads with findings, a fix plan, authorized changes, and regression results. Diagrams remain available when needed. Missing repair permission still requires one scoped request; real-world behavior remains unverified.

## 未发布：4A/4K 的范围与项目规则分流

- 已执行：4A 明确由 AI 根据团队和项目准则、改动依赖、审查责任与验证证据提出 PR 范围，操作者无需预划验收边界；多个功能不自动合成一个 PR。
- 已执行：4K 明确个人项目可在允许直推时建议直接 Push，团队项目遵守团队贡献、保护、Review 和 CI 规则；多功能成果先分组，隐私、验证和远端最终确认仍适用。
- 已验证：规则 manifest 15 项指纹、仓库质量检查和 4A/4K 防回退检查通过；真实任务中的路由表现仍待观察。本批仅本地修改，未 Push、创建 PR、Release 或部署。
- English: Scenario 4A now asks AI to propose a coherent PR scope from project rules, dependencies, ownership, and evidence. Scenario 4K separates optional direct pushes in personal projects from team contribution requirements and groups unrelated features before publication. Local change only; live routing remains unverified.

## 未发布：场景 4K 本地成果同步入口

- 已执行：新增与 4J 方向相反的 4K，操作者不知道文件清单时由 AI 盘点、筛选并准备本地可发布成果；4A 保留为明确需要 PR 的路径。第一代停用目录按精确路径排除，避免被“全部同步”误纳入。
- 已确认：Windows SessionDesk 的 `dev.10` 源码候选已在仓库，Release 列表仍以 `dev.9` 为最新；源码 Push 与 Tag、Release、下载包发布是独立动作。
- 已验证：全仓质量检查、规则 manifest 15 项指纹和第一代目录忽略规则通过；本批 13 个路径已推送到 `origin/main`，GitHub Repository quality 对该批首次提交通过。静态检查不证明未来 AI 行为；`dev.10` 发布候选的完整复测和人工发布决定仍独立处理。
- English: Added scenario 4K for inventorying and preparing publishable local changes without requiring the operator to know file names or choose a PR. Scenario 4A remains the explicit PR route, and historical first-generation files stay local. The dev.10 source candidate is present, but no dev.10 Release has been published; validation and release remain separate.

## 未发布：反馈自动分流与连续算法效果诊断

- 已执行：2E 明确为人工反馈入口，2C 为系统诊断方法；操作手册补入选择示例，由 AI 按证据分流，取消同一授权目标内的重复阶段启动确认。内部步骤保留，总资源上限、关键人工输入及受控操作仍是局部停止边界。
- 已执行：诊断标准补入期望可观察化、错误分组、算法适用假设、节点替换/消融和有依据的行为关系测试；允许结论为方法能力限制或多因素作用，不强迫每次找出单个代码缺陷。第三方方法仅作研究输入，未安装新依赖或调用产品算法。
- 已执行：联动 01、02、06、版本入口及 manifest，版本 `2026-09-27.3`；现有文档回归门禁补入旧阶段审批措辞的防回退检查。旧章节锚点兼容保留。
- 已验证：全仓质量检查、独立审查定点复核与六类分流/停点静态走读通过；复核指出的一处旧阶段边界措辞已统一并回读。静态规则不能证明真实模型遵循率、算法效果或 Token 收益。本批仅本地修改，未 Commit、广播或远端写入。
- English: Clarified 2E as the feedback entry and 2C as the diagnosis method. AI routes by evidence and continues within the same authorized objective without repeated phase approvals, while retaining resource and permission limits. Added task-specific error grouping, algorithm-assumption checks, controlled ablations, and behavioral relations without promising a unique root cause. Version `2026-09-27.3`; repository checks, independent review and six routing/stop-condition walkthroughs passed. One remaining phase-boundary phrase was corrected and reread. Local changes only; no live behavior or product-effect validation and no remote publication.

## 未发布：跨平台规则指纹一致性

- 已确认：`2026-09-27.1` 在本地检查通过、推送成功，但 GitHub Windows 检出将部分规则文件转为 CRLF，导致原始字节 SHA-256 与规则 manifest 不一致，远端 `Repository quality` 失败。
- 已执行：为第二代规则根目录的 Markdown 与规则 manifest 固定 LF 检出换行，并重新生成逐文件指纹；规则版本更新为 `2026-09-27.2`。只约束规则来源文件，不改变其他目录的换行策略。
- 待验证：修订后的本地全仓检查和远端 GitHub Actions；此前远端失败不能写成已通过。
- English: The `2026-09-27.1` push passed locally but failed the Windows CI rule-manifest hash check because checkout changed line endings. The rule source files and manifest now use LF checkout bytes; version `2026-09-27.2` will be validated locally and in GitHub Actions.

## 未发布：GPT-6 Sol/Luna 的场景起步建议

- 已执行（2026-09-27）：逐条审查 01 的 45 条场景模型建议，把每次出现的型号写为 GPT-6 Sol、GPT-6 Luna 或 GPT-6 Astra，避免只看单个场景时将 Sol 误解为 5.6；契约检查新增逐条版本标注门禁。规则版本升至 `2026-09-27.1`。
- 已执行：按 2026-09-26 官方模型与 Codex 定价资料，更新 05 的起步候选和 01 的场景示例；复杂工程优先比较 GPT-6 Sol，边界清楚且可直接验收的重复工作可比较 GPT-6 Luna。现有稳定配置仍可继续，不自动切换当前任务或其他窗口。
- 已执行：06 补入“先独立判断、再核对外部 AI 报告”的交叉审查条件；外部材料只作为候选证据。未把第三方榜单数字或 API 缓存机制写成当前桌面端已实测效果。
- 独立审查后修订：Luna 不固定使用高推理档；场景 5C 的纯反馈归类与实际返工分开，返工按原任务风险和验收选择配置。
- 已验证：规则刷新契约 14 项、manifest 15 项来源指纹和仓库质量检查通过；独立审查复核本批差异。静态检查与文档审查不证明未来模型行为。
- 待验证：当前账号和客户端的实际型号/推理强度可用性、同等验收下每项成功任务的 Token、耗时、返工与信用点消耗。无产品修改、模型切换、广播、Commit 或远端写入。
- English: Updated model starting examples for GPT-6 Sol and Luna using official model and Codex pricing as of 2026-09-26. On 2026-09-27, spelled out GPT-6 in all 45 scenario recommendations and added a contract check against ambiguous model names. Existing working configurations remain valid; model availability and task-level savings need real usage evidence. Added conditional independent-first review of external AI reports. No product, broadcast, commit, or remote changes.

## 未发布：自然语言确认绑定最近唯一方案

- 已执行：操作者对最近唯一、范围明确的执行方案回复“同意、确认、授权你去做、开始执行”等肯定语时，直接视为该方案明示范围内的执行授权，不要求固定口令或逐项重复确认。
- 已执行：多个方案、只同意判断、引用/假设/否定、方案后实质变化和方案外新增动作继续按最小缺口澄清；局部门禁不再暂停其他独立且已授权事项。
- 已执行：一次最终确认型门禁在方案已经列清精确对象、动作和影响时可由该肯定回复满足；分次/双重确认和最终载荷另行确认仍按原门禁执行。
- 已验证：刷新契约 14 项、manifest 15 项逐文件指纹和全仓质量检查通过；真实跨窗口模型行为仍待后续实际任务观察，本轮未执行广播、Commit 或远端写入。

## 未发布：按条件选用 Skill，保留基础流程

- 已执行：操作手册明确操作者只需描述目标；AI 按实际可用性、任务和权限选用 Skill，缺失时继续基础流程，不自动安装。
- 已执行：核心规则为代码诊断、测试先行、接口边界和 AI 规则文档维护设置按需触发条件；场景 2E 不因反馈故障自动升级为实现任务。
- 已执行：重大规则调整增加有限合成案例验证及证据边界，不把静态检查等同于真实模型行为或质量收益。
- 待验证：真实项目中的选用准确率、质量和 Token 净收益；本轮无远端写入或广播。

## 未发布：明确场景 1B 是可选换窗分流入口

- 已执行：将场景 1B 改名为“不确定如何换窗或归档时的通用分流”，并同步目录和场景总表；明确正式更换总指挥时直接使用 1C，无需先执行 1B。
- 已执行：补充误用后的判断规则；若 1B 已自动完成 1C、生成核验通过的正式附件和 1D 第一步提示词，则直接进入 1D，不重复执行 1C。
- 已执行：保留 1B 对普通/专项任务换窗、归档和窗口角色不确定情况的分流职责，没有改变 1C/1D 正式交接协议。
- 已验证：规则版本递增为 `2026-09-26.10`，目录锚点与正文标题一致，15 个 manifest 条目逐文件 SHA-256 回读一致；未执行远端写入。

## 未发布：新增 WORKFLOW_FEEDBACK 事件分流

- 已执行：发现现有跨任务事件类型没有覆盖“经验同步/规则建议/新问题”消息，补充 `WORKFLOW_FEEDBACK` 类型及独立事件契约。
- 已执行：要求主题变化或人工转交的新反馈先保存旧任务断点、实际回读新内容并可见报告状态，避免新问题被上一轮回答吞掉。
- 已执行：明确该类型不授予接收方处理来源项目产品、算法或远端事项的权限；无专项授权时只处理本项目工作流缺陷。
- 已验证：规则版本递增为 `2026-09-26.9`，15 个 manifest 条目逐文件 SHA-256 回读一致；当前项目 `AGENTS.md` 已补入同一事件边界；未执行远端写入。

## 未发布：操作者质疑后的案例回读门

- 已执行：新增纠偏门；操作者质疑未回答原问题时，必须先定位并实际回读被点名的任务、消息或附件，区分已处理、仅抽象分析和未处理部分，不能用相邻案例或上一轮回答替代。
- 已执行：将画像维护结果列为交接输出硬性收口项；画像机制已启用或待核验时，必须报告合并门结果、候选数量和缺口，没有候选也要明确 `NO_UPDATE`。
- 已验证：规则版本递增为 `2026-09-26.8`，15 个 manifest 条目逐文件 SHA-256 回读一致；未执行远端写入。

## 未发布：交接期间的操作者画像单写者合并门

- 已执行：保留“当前唯一总指挥是画像唯一写者”，为普通/专项窗口增加 `PROFILE_CANDIDATE` 脱敏候选与证据指针回传路径，避免因不能直接写共享画像而丢失观察结果。
- 已执行：要求旧总指挥在交接材料登记待合并候选，新总指挥取得唯一调度权后先执行画像合并门，输出 `UPDATED / NO_UPDATE / PENDING_REVIEW / BLOCKED`，再恢复主任务。
- 已执行：交接模板增加合并门状态、候选来源、证据截点、实际写入和缺口字段；画像未启用、暂停、关闭或不可用时不因候选自动改变状态。
- 已验证：规则版本递增为 `2026-09-26.7`，15 个 manifest 条目逐文件 SHA-256 回读一致；未执行远端写入。

## 未发布：GitStateCompass 目录收敛为单文件迁移指针

- 已执行（2026-09-27）：单文件指针迁至 `实用小工具/Git仓库状态罗盘/README.md`；质量脚本的例外同步到新路径，并检查该目录只有这一份 README。暂存后重跑全仓检查，以覆盖实际提交内容。
- English: Moved the single-file repository pointer to `实用小工具/Git仓库状态罗盘/README.md` and updated the quality-check exception to require that directory to contain only this README. The full repository check is rerun against the staged content.
- 已执行：将 `实用小工具/GitStateCompass/` 收敛为唯一的 `README.md`，README 直接指向独立的 Git 仓库状态罗盘仓库。
- 已执行：移除旧 `.project-root` 和 `README.en.md` 指针文件；本仓库不再承载 GitStateCompass 的源码、测试、夹具、网页原型或项目记录。
- 已执行：为单文件跨仓库指针目录增加质量检查例外，要求 README 包含明确目标仓库链接，避免被通用双语 README 门禁误判为项目内容缺失。
- 已执行：统一 5 个规则入口的正文版本为 `2026-09-26.6`，重新计算 15 个 manifest 指纹；同时让路径可移植性检查识别带 `<...>` 的示例占位符，并补齐长期人工规则刷新兜底契约文本。
- 已验证：独立仓库本身未修改；本轮未执行 Push、PR 或其他远端写入。

## 未发布：移除跨项目 Git remote 牵连

- 已执行：删除本仓库中指向独立 GitStateCompass 项目的本地 `origin` 配置，并将 ChatGPT Workflows 原 `legacy-origin` 改名为本仓库唯一的 `origin`。
- 已执行：同步更新项目启用声明；独立项目的 remote、源码、测试和发布不再属于本仓库的 Git 操作范围。
- 已验证：本轮只修改当前仓库本地 Git 配置和边界文档，未执行 Fetch、Push、PR 或其他远端写入。

## 未发布：操作手册改用稳定相对规则路径

- 已执行：将 `01-操作者操作手册.md` 中 5 处“第二代规则目录”输入改为固定相对路径 `总指挥工作流/第二代总指挥的工作模式`，要求从当前项目根目录解析，不再要求操作者填写机器绝对路径。
- 已执行：避免 `A_Rong` 等本机目录名在 Markdown/跨任务传输中被错误转义，同时保持复制整段提示词即可使用。
- 已验证：5 处入口已回读；本轮未修改项目代码、远端或其他项目文件。

## 未发布：绝对规则路径的示例占位符边界

- 已修正：考虑到其他项目无法从自身项目根定位中央规则根，操作手册 5 处入口改为“操作者本机绝对路径占位符 + 克隆者必须替换示例”的写法。
- 未写入：没有把本机用户名、盘符或真实目录写进 Git 跟踪文件；本机路径只能由操作者在发送前替换，避免把单机路径固化为仓库依赖。

## 未发布：跨任务回执的操作者可见标记

- 已执行：在 `09-自动化授权与风险分级.md` 的双通道回执规则中补充：向来源任务发送回执后，接收窗口必须在面向操作者的文本中明确回报来源任务和实际状态；未回执要说明原因，已发送但未获对方确认要标记“已发送待确认”。
- 已执行：该规则只增加可观察性，不增加通信授权，不把工具发送成功或平台完成标记当作对方已收到。
- 待验证：规则刷新 manifest 将在本批最后一步更新并逐文件回读；本轮不执行项目或远端操作。

## 未发布：规则修改与 manifest 的自动收口门禁

- 已执行：明确规则维护者每次修改受管规则文件后都必须检查 manifest；总指挥主动修改工作流时，递增版本、更新全部指纹并逐文件回读是该修改批次的最后写入步骤。
- 已执行：明确广播第一步必须复核 manifest 与当前规则根一致；不一致时先收敛规则版本和指纹，不能广播旧封条或要求接收方在变化中的规则根上刷新。
- 已验证：本轮规则文件修改后将重新计算全部 manifest 条目，并执行逐文件 SHA-256 回读；本轮不涉及产品代码、项目配置或远端写入。

## 未发布：worktree 收口字段补充（场景 5A 复审）

- 已执行：采纳 31 号独立审查的最小建议，在 02 的临时 worktree 收口规则和 10 的现有 `WORKTREE` 记录中补充远端写入后的来源、主工作区、集成状态、下一行动方与恢复条件字段。
- 已执行：明确只读审查、CI 临时修复和未 Push 实验 worktree 可标记 `integration_status=NOT_REQUIRED`，不强制整合；仍须确认删除前没有未保存成果和唯一证据。
- 未执行：未修改示例图像项目项目，未执行 Git 合并、Commit、Push 或远端对象操作。

## 当前暂停记录：2026-09-26

- **任务一：worktree 总指挥工作流优化**：状态 `PAUSED`。已完成最小规则补充，明确隔离 worktree 完成远端写入后必须回读日常主工作区；未完成本轮提交、广播或远端发布。恢复条件：回读本规则、当前 manifest 和工作区状态后继续审查。
- **任务二：远端与本地冲突处理**：状态 `PAUSED`。已确认本地 `main` 落后远端 3 个提交，且本地存在未提交/未跟踪成果；未执行合并、重置、覆盖、提交或清理。恢复条件：逐文件锁定远端来源、本地目标、重叠路径和保护点后再制卡。
- **当前优先事项**：处理规则刷新 manifest 与当前规则文件指纹不一致，完成指纹回读后再评估 31 号规则刷新回执；不处理示例图像项目项目代码、配置、中央状态或远端状态。
- **31号刷新事件**：已将规则版本更新为 `2026-09-26.1`，15 个 manifest 条目逐文件回读无差异；已向 31 号发起一次仅限规则刷新与回执的重试。平台显示回合完成，但当前接口仍未返回可见正文，因此采用 `DELIVERY/UNKNOWN`，不宣称其已采用规则。
- **31号正式刷新回执**：31 号已返回 `COMPLETED + PASS`，确认 15 个 manifest 条目全部匹配，并已采用 `2026-09-26.3` 及新增 worktree 收口字段；它确认本轮未执行示例图像项目项目、产品、部署或远端操作，未提出规则冲突或疑问。

## 未发布：隔离 worktree 远端写入后的主工作区收口

- 已执行：在 `02-总指挥核心规则.md` 的场景 4J 增加最小收口门禁：隔离 worktree 完成 Commit/Push 后，远端写入不再被视为日常主工作区已同步；删除临时载体前必须回读主工作区的分支、HEAD、未提交/未跟踪修改与远端来源。
- 已执行：主工作区干净且目标明确时才可按执行卡完成快进或等价集成；存在未提交或来源不明修改时不得覆盖、强制对齐或把删除 worktree 当成同步完成，必须记录“远端已更新、主工作区未对齐”的状态、恢复条件和下一行动方。
- 已验证：本条由本次远端 3 个提交已推送、主工作区仍落后且保留未提交修改的实际案例触发；未执行本地主工作区合并、提交、推送或清理。
- 未解决：当前主工作区仍需另行完成逐文件安全对齐；31 号审查任务已收到请求但未返回可见正文，未将其隐性运行状态当作审查证据。

## 未发布：修复 GitStateCompass 英文 README 配对门禁

- 已执行：为已迁移的 `实用小工具/GitStateCompass/README.md` 增加对应的 `README.en.md`，保留项目位置指针语义并加入中英文互链，修复远端仓库质量检查对公开目录 README 成对存在的要求。
- 已验证：修复只涉及该目录的英文说明和本变更记录；未修改 GitStateCompass 独立仓库、产品代码或远端对象。待本地提交并推送后由 GitHub Actions 重新运行远端检查。
- English: Added the required paired `README.en.md` for the migrated `实用小工具/GitStateCompass/README.md`, preserving its project-location-pointer meaning and adding a language link. This addresses the repository quality check for paired public-directory READMEs. No independent GitState Compass repository, product code, or remote object was changed; GitHub Actions can rerun after the local change is committed and pushed.

## 未发布：正式接管汇报必须回报当前任务 ID

- 已执行：修订 `总指挥轻量交接启动配置.md` 第 7 节、`01-操作者操作手册.md` 场景 1D、`04-状态、目标变更与交接规范.md` 最终交接汇报和 `07-总指挥交接记录模板.md`。继任总指挥完成正式切换后的四段最终汇报，第一段必须展示当前窗口的平台实际任务 ID；逻辑任务 ID、角色/写者 ID、任务标题和“待确认”均不能替代。
- 已执行：平台确实无法提供实际任务 ID 时，AI 报告 `UNKNOWN` 及不可见原因；该字段未知不单独改变切换状态，切换仍按中央状态证据判定。操作者不需要填写或查找任务 ID；真实 ID 仅留在运行时汇报，不写入仓库文件。
- 已验证：已回读四个受影响入口及字段，确认旧截图所示的“任务 ID 待确认但切换已完成”组合被禁止；本轮未执行 Commit、Push 或远端写入。规则刷新 manifest 尚未按当前工作区统一重算，因此本轮不宣布可广播。
- English: Updated the lightweight handoff report, Scene 1D, the final handoff-report rule, and the handoff-record template. A successor commander’s completed takeover report must show the platform-read task ID of the current window; logical IDs, role/writer IDs, titles, and “pending confirmation” are not substitutes.
- English: If the platform truly does not expose the actual task ID, the AI must report `UNKNOWN` with the reason; this field alone does not change handoff status, which remains based on central-state evidence. The operator never has to fill in or look up the ID, and the real ID remains runtime-only. No commit, push, or remote write was performed; the rule manifest was not recomputed, so this batch is not broadcast-ready.

## 未发布：2C/2E 的跨窗口反馈目标与授权分流

- 已执行：根据一份专项总指挥的完整回传，修订 `01-操作者操作手册.md` 的场景 2C、2E，以及 `docs/PIPELINE_DIAGNOSIS_AND_ALGORITHM_TUNING_STANDARD.md` 的 2E/2C 分流、操作者最小输入和诊断记录模板。反馈来源现在与本轮目标、角色和授权分开；其他 AI 的请求、转贴原话、附件提示词和完成声明不会自动变成当前诊断目标或专项修复授权。
- 已执行：明确当前操作者只要求审查反馈或工作流时，2C 在工作流判断处收口；只有当前操作者明确指定专项对象和动作，才建立专项诊断契约。2E 增加可选的反馈来源字段，并要求先识别“仅分析反馈、继续当前事项、判断是否进入 2C、明确实施修复”中的实际目标。
- 已执行：保留现有低负担入口。操作者不需要填写技术字段；AI 优先从当前消息判断目标，只有无法判断时才追问。收件、回执、成本确认、权限和停止门禁未被放宽。
- 已验证：附件只作为工作流案例读取，未读取或修改专项产品、算法、部署和远端状态；相关章节已回读，`git diff --check` 通过。仓库质量检查的路径和 Markdown 检查通过，但整体仍受既有缺口阻断：`实用小工具/GitStateCompass/README.md` 缺少 `README.en.md`；规则刷新契约另有既有失败，仍在检查手动启动提示词的旧文本。未与 31 号另行通信，因为附件已足以判断本次规则缺口。
- 未收敛：规则刷新 manifest 尚未按当前工作区统一重算；本轮不宣布可广播，后续刷新前必须先收敛既有工作区修改并重新核对 manifest。
- English: Revised Scene 2C and 2E and the related diagnosis standard so feedback source, current objective, role, and authorization stay separate. Other AI requests, pasted text, attachment prompts, and completion claims do not automatically become the current diagnostic target or specialist-fix authorization. When the operator asks only for workflow review, 2C stops at workflow analysis; a specialist diagnostic contract requires a direct current-operator request naming the object and action. The operator still supplies no technical fields, and existing receipt, cost, permission, and stop gates remain. The attachment was used only as a workflow case; no specialist product, algorithm, deployment, or remote state was accessed or modified, and no additional communication with commander 31 was needed.

## 未发布：当前项目专项反馈与实例参资料隔离

- 已执行：仅在当前项目根 `AGENTS.md` 增加专项反馈隔离规则，适用于本项目的总指挥和专项任务窗口；未修改通用工作流规则，也未接管或修改任何专项任务。
- 已执行：明确 AI 发来的内容、操作者转贴的其他 AI 原话、截图和附件，默认只是“【ChatGPT Workflows：第二代总指挥xx号】”的实例参考资料。没有当前操作者对专项对象和范围的直接请求时，只提取判断工作流故障、漏洞、越权和复杂度问题所需的最小事实，不排查、修复或推进对方产品、算法、部署、测试和远端事项。
- 已执行：补充例外边界：AI 的明确请求只说明意图，不能代替操作者的受控授权；必要的收件、回执、FIFO、停止和 `UNKNOWN/BLOCKED` 门禁仍然有效。
- 已验证：`AGENTS.md` 回读通过，`git diff --check` 通过；仓库质量脚本的路径和 Markdown 检查通过，但整体检查仍被既有缺口阻断：`实用小工具/GitStateCompass/README.md` 缺少配对的 `README.en.md`。本轮未执行产品、算法、部署、专项任务或远端操作。
- English: Added a project-local isolation rule to the root `AGENTS.md` for commander and specialist windows. AI messages, pasted transcripts, screenshots, and attachments are reference material by default; without a direct current-operator request naming the specialist scope, the window only analyzes workflow defects and does not solve the other task. AI requests do not grant controlled authorization. Existing receipt, FIFO, stop, and `UNKNOWN/BLOCKED` gates remain in force. `git diff --check` passed; the repository suite remains blocked by the pre-existing missing `实用小工具/GitStateCompass/README.en.md`. No product, algorithm, deployment, specialist-task, or remote action was performed.

## 未发布：操作者手册新手入口与目录修订

- 已执行：只修改本项目自己的 `总指挥工作流/第二代总指挥的工作模式/01-操作者操作手册.md`，将原先散落在快速上手中的规则刷新、专项接入、旧窗口接入、首次项目接入和单窗口确认提示词重组为场景 0A–0E；顶部目录和场景总览同步更新，原有场景一至七编号和业务含义保持不变，不把入口误加到其他项目的操作手册。
- 已执行：为场景零总入口及 0A–0E 补充与 `05-模型选择与资源策略.md` 一致的起步建议和升级条件；简单只读接入默认低成本，只有多窗口、状态/权限冲突或控制面缺口才建议升档，不能用模型档位替代证据或授权。
- 已执行：补充身份、实际读取范围、后续收件处理、阻断四项合格结果，以及“已发送/已收到”不等于接收或执行完成的错误提示；明确接入确认不开始业务、交接、写入或远端操作。
- 待验证：新手是否能在不进入场景正文的情况下正确选择入口，需后续实际使用观察。本轮未执行 Commit、Push 或远端写入。
- English: Updated only this project's `01-操作者操作手册.md` by grouping reusable rule refresh, specialist onboarding, existing-window onboarding, first project enrollment, and single-window confirmation prompts into Scene 0A–0E. The table of contents and scene registry were updated while existing business scene numbering remains unchanged; the change was not applied to another project's manual.
- English: Added the four required onboarding result fields and clarified that “sent” or “received” does not prove acceptance or execution. New-user behavior remains to be observed; no commit, push, or remote write was performed.
## 未发布：修复 GitStateCompass 英文 README 配对门禁

- 已执行：为已迁移的 `实用小工具/GitStateCompass/README.md` 增加对应的 `README.en.md`，保留项目位置指针语义并加入中英文互链，修复远端仓库质量检查对公开目录 README 成对存在的要求。
- 已执行：同步修正规则刷新 manifest 中全部 14 个规则入口的实际 SHA-256；这是 README 门禁修复后继续暴露的远端基线漂移，否则 GitHub Actions 仍会在后续规则刷新检查失败。
- 已执行：修复 Windows runner 上交接附件测试对 Git 根目录路径大小写/分隔符的脆弱字符串比较；仍要求 Git 返回根目录与声明的 `source_root` 指向同一真实目录，只规范化平台表示差异。
- 已验证：修复只涉及该目录的英文说明和本变更记录；未修改 GitStateCompass 独立仓库、产品代码或远端对象。待本地提交并推送后由 GitHub Actions 重新运行远端检查。
- English: Added the required paired `README.en.md` for the migrated `实用小工具/GitStateCompass/README.md`, preserving its project-location-pointer meaning and adding a language link. Also synchronized all 14 rule-entry digests in the rule-refresh manifest, which was the next remote baseline drift exposed after the README gate. No independent Git State Compass repository, product code, or remote object was changed; GitHub Actions can rerun after the local change is committed and pushed.
- English: Fixed the Windows-runner handoff test’s brittle string comparison between Git’s repository-root output and Node’s real path. The check still requires both values to identify the same real directory; only platform-specific separators and case are normalized.
## 未发布：长期人工规则刷新兜底

- 已执行：操作手册登记一段固定的手动刷新提示词。只要规则路径保持不变且可访问，它可以跨后续工作流版本、总指挥世代以及已接入项目的窗口复用，不要求操作者填写版本、manifest 或接收者身份。
- 已执行：明确该提示词只加载规则，不做项目体检、配置迁移或交接，也不授予总指挥身份和业务写权；自动广播异常时可直接使用，路径改变或未来更高优先级规则明确废止时才需更新。
- 已验证：规则刷新契约 12/12、仓库质量检查和差异格式检查通过；`2026-09-24.5` 最终规则 manifest SHA-256 为 `E4996885A0FCDEDB2ABB73E657EE35C26A0E36F805D7A8AE398DAB553262B9D7`。
- English: Added a stable manual rule-refresh fallback. While the rule path remains unchanged and accessible, the same prompt can be reused across later workflow versions, commander generations, and enrolled project windows without operator-supplied versions, manifest hashes, or recipient identity. It loads rules only and grants no project role or write authority.
- English: Workflow refresh checks passed 12/12, together with the repository quality and diff-format checks. The final `2026-09-24.5` rule-manifest SHA-256 is `E4996885A0FCDEDB2ABB73E657EE35C26A0E36F805D7A8AE398DAB553262B9D7`.

## 未发布：算法成果身份的存档、部署与 PR 绑定

- 已执行：把“最新算法”收敛为当前目标下最后一个身份完整、状态明确的可靠候选；区分本地验收、共享候选测试和正式默认/发布/生产部署，候选部署不再冒充效果已验收。
- 已执行：自然语言保存算法复用现有成果包契约，增加意图消歧、范围恢复、同内容幂等、稳定采集、原子确定、恢复回读和隐私排除；操作者只保留 AI 无法代签的评价、编辑器保存、产品取舍和授权事实。
- 已执行：PR/CI 必须从实际 checkout 或合并候选重算源码/资产身份并核对默认选择，不能只信登记文件中的自报摘要；本地恢复包不入 Git 时，CI 仍须能独立证明干净环境可复现。
- 已执行：算法族/组件版本、界面版本、联合恢复包身份分开维护；项目范围配置决定复制、仅留指纹或排除的实体。跨责任共享文件的归属或影响无法确认时，只阻断受影响的共享部署、PR Ready、合并和正式发布，不全局停工。
- 已验证：规则刷新契约 12/12、仓库质量检查和差异格式检查通过；`2026-09-24.4` 最终规则 manifest SHA-256 为 `EADA8F58B00D41C22B9C100501041501620FC06620FE5BF0645DB8522D1AB706`。本批只验证通用工作流契约，没有在来源产品项目复算组件摘要、执行部署或验证算法效果。
- English: Bound algorithm archives, deployments, and PR/CI checks to a reproducible candidate identity. “Latest” now means the latest reliable candidate for the active goal, not the last edit. Candidate deployments remain possible when clearly marked unaccepted; formal-default claims require evaluation and saved-buffer confirmation bound to the same digests. Natural-language archives are scoped, idempotent, stable, privacy-checked, and recoverable. PR/CI recomputes identity from the actual checkout or merge candidate instead of trusting self-reported registry values.
- English: Algorithm-family or component versions, UI versions, and joint recovery-package identities are maintained separately. Project scope configuration decides whether an entity is copied, fingerprinted only, or excluded. Unresolved ownership or impact of cross-responsibility shared files blocks only the affected shared deployment, Ready transition, merge, or formal release.
- English: Workflow refresh checks passed 12/12, together with the repository quality and diff-format checks. The final `2026-09-24.4` rule-manifest SHA-256 is `EADA8F58B00D41C22B9C100501041501620FC06620FE5BF0645DB8522D1AB706`. This batch validates the generic workflow contract only; it does not recompute product-component digests, deploy a product, or validate algorithm output quality.

## 未发布：工作流复杂度预算

- 已执行：工作流制定与修补默认不得增加复杂度；新增机制前先删除、替换或合并旧机制，只有安全/权限硬边界或可验证净收益才能例外增加。
- 已执行：同类问题连续两次采用相近补丁仍未改善时，停止继续叠加，回到复现条件、根因和最小流程；本规则不新增操作者步骤、表单或状态。
- 已验证：规则版本已统一为 `2026-09-24.3`；刷新契约 12/12 和全仓质量检查通过，最终 manifest 摘要为 `18F6A18701FEE5BFFCFA8F2F7D85E3A8B75CC3E7E0BD8F51C8E58FC6F9462850`。
- English: Workflow design and repair now use a non-increasing complexity budget. Replace, remove, or merge existing mechanisms before adding new ones; additional complexity requires a hard safety/permission need or verified net benefit. Two ineffective similar patches trigger a return to reproduction evidence, root cause, and the minimum process rather than another layer of rules.

## 未发布：首次规则刷新手动启动路径

- 为尚未了解新广播协议的总指挥增加一次性手动启动提示词。
- 明确该启动只要求读取、角色核对、项目配置盘点和结构化回执，不自动授予写入或启用权限。

## 未发布：工作流结论本轮持久化与相关文档定位

- 已执行：建立“相关文档定位索引”，把规则、复盘、变更履历、计划、故障、项目状态和交接材料分别绑定到唯一主记录入口；操作者只需用自然语言说明“相关文档”，总指挥负责按语义定位并回读实际路径。
- 已执行：新增全局持久化门禁：涉及工作流但本轮不立即实施工作流修改时，必须在本轮结束前记录结论、待确认项、阻断、行动方、证据入口和失效条件；本轮立即实施修改时仍需按既有规则记录任务契约、改动和验证。
- 已验证：已同步 AGENTS、00、06、10 和 CHANGELOG 的入口与引用；本轮未执行远端写入、Commit 或项目外状态修改。
- English: Added a stable related-document locator and a global persistence gate. Workflow-related conclusions must be written to a single semantic primary record before the turn ends when no workflow change is implemented immediately; implemented changes still require the existing contract, change, and verification records. AGENTS, the overview, review rules, state index, and changelog now point to the same locator. No remote write or commit was performed.

## 未发布：交接中央规则绑定与交付闭环修补

- 已执行：正式交接准备器现在强制核对中央状态索引 CURRENT 区的 `规则清单摘要`，必须与本轮实际规则 manifest 的 SHA-256 完全一致；中央索引过期时在生成附件前阻断，避免出现“附件看似 READY、登记表仍是旧规则”的假收敛。
- 已执行：新增 `.github/scripts/Mark-Handoff-Delivered.mjs`，把 `GENERATED_NOT_DELIVERED` 与实际交付后的独立 `DELIVERED` 回执分开，并回读附件文件、校验哈希、绑定接收对象和交付事件；新增 3 项交付闭环测试及仓库质量脚本入口。
- 已验证：HandoffSeal 52/52、Prepare-Handoff 16/16、交付闭环 3/3；仓库质量脚本整体 PASS。未执行真实示例图像项目项目交接、Commit 或远端写入。
- English: Formal handoff preparation now requires the canonical status index CURRENT block to carry a `规则清单摘要` SHA-256 matching the current rule manifest; stale indexes are blocked before an apparently READY artifact can be produced. Added `.github/scripts/Mark-Handoff-Delivered.mjs` to separate `GENERATED_NOT_DELIVERED` from an independently verified `DELIVERED` receipt, including artifact hash, recipient and delivery event binding. HandoffSeal passed 52/52, Prepare-Handoff 16/16, delivery closure 3/3, and the repository quality suite passed. No real product-project handoff, commit, or remote write was performed.

## 未发布：规则接入提示词简化与交接审计分流

- 已执行：根据一次真实接入回执，将操作者可复制的规则接入提示词压缩为短版；明确这类消息只核对项目启用、当前角色和接收方门禁，不自动进入 HandoffSeal、外部控制面、产品代码或远端审计。
- 已执行：保留安全阻断语义。项目启用声明、角色、规则入口或状态无法确认时仍必须报告 `UNKNOWN/BLOCKED`，但不得把无关的交接审计缺口混入普通接入确认。
- 已验证：新短提示词已写入操作手册并回读；规则版本同步至 `2026-09-23.7`，未执行远端写入。
- English: Simplified the reusable rule-onboarding prompt after a real receiver report. The short prompt limits onboarding to project enablement, current role, and the receiver-processing gate; it does not automatically enter HandoffSeal, external control-plane, product-code, or remote audits. Safety blocking remains for unverifiable project enablement, role, rule entry, or state, while unrelated handoff-audit gaps must not be mixed into ordinary onboarding. The prompt was written to the operator manual, workflow version synchronized to `2026-09-23.7`, and no remote write was performed.

## 未发布：可复用操作写入操作手册

- 已执行：确认项目接入的两段操作已写入 `01-操作者操作手册.md`，并新增“可复用操作留存原则”：已验证且可能重复使用的接入、广播、刷新、回执、交接和恢复动作不得只留在聊天口头说明中。
- 已执行：将同一原则写入 `06-复盘与优化规则.md`，要求优先并入现有入口，保留适用条件、复制边界、预期结果、异常处理和权限限制，避免生成互相冲突的多个提示词。规则版本同步至 `2026-09-23.6`。
- 已验证：操作手册中的两种项目接入路径和新增留存原则已回读；未执行远端写入。
- English: Confirmed that the two project-onboarding procedures are already present in `01-操作者操作手册.md` and added a retention rule: verified reusable onboarding, broadcast, refresh, receipt, handoff, and recovery actions must not exist only as conversational explanations. The same rule is recorded in `06-复盘与优化规则.md`, requiring reuse of existing entries and preservation of scope, copy boundaries, expected results, failure handling, and permission limits. Workflow version synchronized to `2026-09-23.6`; no remote write was performed.

## 未发布：操作者项目接入简化

- 已执行：在操作者手册增加傻瓜式项目接入入口，将空白项目和已运行项目分别压缩为“先用 1A 建立总指挥”和“要求总指挥自动盘点并刷新现有窗口”两条路径；新专项任务只需在第一条消息使用一段最短接入句。
- 已执行：明确接入结果只由实际读取、角色确认、处理和回执证明；总指挥建立不等于旧窗口自动同步，平台未注入规则时仍需新窗口执行最短接入句。同步版本至 `2026-09-23.5`。
- 已验证：已回读新增操作说明与接收方门禁，确认不新增场景编号、不扩大权限、不要求操作者逐个维护任务清单；完整仓库质量检查待本轮完成后记录。
- English: Added a simplified operator entry for project onboarding. A blank project now follows “establish the commander with 1A first”; an existing project uses one request for the commander to inventory and refresh visible windows; new specialist tasks use one short onboarding sentence. Actual reading, role confirmation, processing, and receipts remain the only evidence of onboarding. Commander creation does not retroactively synchronize old windows, and a short onboarding sentence is still required when the host does not inject project rules automatically. Version synchronized to `2026-09-23.5`.

## 未发布：接收方强制处理门禁

- 已执行：将“收到广播或定向消息后必须实际处理”提升为所有工作流事件的统一接收方门禁。接收方必须识别事件、核对自身角色、完整读取消息及必要引用、执行范围内处理，或返回带具体缺口和恢复条件的 `BLOCKED`；`RECEIVED`、解释性答复、平台完成标记和空输出均不能代替处理完成。
- 已执行：明确已启用工作流的项目中，总指挥、普通任务和专项任务都继承收件、读取、处理、FIFO、回执和停止规则；专项任务不继承总指挥身份、中央调度权、中央写权或额外业务授权。同步更新总览、核心规则、自动化授权与风险分级、状态索引和轻量交接版本至 `2026-09-23.4`。
- 已验证：已回读统一门禁与规则刷新协议，确认角色继承和权限继承分离；尚未进行真实跨窗口广播实测，宿主是否执行空闲回合仍需单独观察。
- English: Added a universal receiver-side processing gate for workflow events. Receivers must identify the event, verify their role, fully read the message and required references, process the in-scope request, or return `BLOCKED` with a concrete gap and recovery condition. `RECEIVED`, explanatory text, platform completion markers, and empty output are not completion evidence. Enabled projects apply receipt, reading, processing, FIFO, receipt, and stop rules to commanders, ordinary tasks, and specialist tasks; specialists do not inherit commander identity, central dispatch/write authority, or extra business authorization. Updated the overview, core rules, automation/risk rules, state index, and lightweight handoff to `2026-09-23.4`. Static consistency was verified; real cross-window behavior remains untested.

## 未发布：规则刷新广播自动续处理

- 已执行：针对目标窗口把 `RECEIVED` 当作广播终点的问题，明确 `RECEIVED` 只是中间态；发送方必须在目标未返回合格 `COMPLETED` 时，自动发送一次绑定同一 `RULE_REFRESH_ID` 的续处理控制消息。
- 已执行：续处理只引用原刷新事件，不重复业务正文、不创建任务、不扩大授权；发送后必须等待并回读目标状态；仍无合格结果时登记 `WARN / FAIL / 不可达` 并停止该通信路线。同步更新总览、操作者入口、核心规则、自动化授权与风险分级、状态索引和轻量交接版本至 `2026-09-23.3`。
- 已验证：已回读六份规则文件，确认 `RECEIVED`、续处理、`COMPLETED` 和停止条件语义一致；未执行真实跨窗口自动续处理，宿主是否能自动触发下一回合仍需在下一次广播中实测。
- English: Clarified that `RECEIVED` is only an intermediate state for cross-project rule refreshes. If a target does not return a valid `COMPLETED`, the sender must automatically issue one continuation control message bound to the same `RULE_REFRESH_ID`; the continuation cannot duplicate business payloads, create tasks, or expand authorization. After one unsuccessful continuation, record `WARN / FAIL / unreachable` and stop that route. Synchronized the overview, operator entry, core rules, automation/risk rules, state index, and lightweight handoff version to `2026-09-23.3`. Static consistency was verified; real cross-window automatic continuation remains untested.

## 未发布：交接可行性预检与外部控制面边界修复

- 已执行：为场景 1C 增加正式交接可行性预检，区分可带限制继续与必须阻断；未提交成果保护摘要不再等同于正式封条来源或 Git 全量盘点。
- 已执行：允许中央控制面位于代码 `source_root` 外，以 `root_ref=external_control_plane` 和受控外部根目录绑定；仍要求路径边界、项目绑定、指纹和事实截点一致，且不授权修改外部项目源码。
- 已执行：`Prepare-Handoff.mjs` 支持 `preflight_only` 只读模式，并同步更新 `HandoffSeal.mjs`、schema、模板和操作手册；旧 v1/v2 只读标记 `LEGACY_UNVERIFIED`，迁移候选绑定旧链最后摘要，不补造历史。
- 已验证：封条 52 项、准备器 15 项、身份 16 项定向测试通过；未执行真实项目交接、Commit 或远端写入。全仓质量脚本是否仍受既有 PowerShell 解析故障影响，需在本轮综合验证中记录。
- English: Added a Scenario 1C handoff feasibility preflight and separated uncommitted-workspace protection summaries from formal seal sources and Git inventory. External control planes may now be bound outside the code `source_root` through `root_ref=external_control_plane` and a controlled root, while path, project, digest, and fact-cutoff checks remain mandatory and external source code remains out of scope. `Prepare-Handoff.mjs` supports read-only `preflight_only`; `HandoffSeal.mjs`, the schema, templates, and operator guidance are aligned. v1/v2 history stays `LEGACY_UNVERIFIED`, with migration candidates bound to the last legacy summary and no fabricated history. Targeted tests pass; no real project handoff, commit, or remote write was performed.

## 未发布：实战反馈触发工作流案例双轨反思

- 已执行：将“外部 AI、专项任务或场景五配对反馈触发公共工作流案例反思”确立为总指挥工作流的全局规则，不把它做成 2E/2C 的业务入口或额外填写项。
- 已执行：新增案例双轨要求，分别记录触发事实、提示词/分流/观测/授权/回执缺口、保留/删除/增加/改写建议、通用性证据、阻断和下一行动方；案例反馈不自动取得规则、代码、任务或远端写入授权。
- 已执行：将该门禁写入 2E 操作者入口、02 核心规则、2C 链路诊断标准和 09 跨任务回执规则。当前改动仅为本地规则与履历更新，尚未 Commit 或远端发布。
- English: Added a dual-track review requirement for Scenario 2E/2C feedback from specialist tasks, external AIs, or Scenario 5 pairings: close the current project issue and assess whether the real-world case exposes a reusable workflow defect. The case track records evidence, prompt/routing/observation/authorization/receipt gaps, keep/delete/add/rewrite proposals, generality evidence, blockers and owners. Case feedback grants no rule, code, task or remote-write authority. Local documentation only; not committed or published.

## 未发布：GitStateCompass 迁移后的项目边界

- 已执行：确认 GitStateCompass 已迁移到本仓库之外的独立项目；本仓库旧路径仅保留 README 和远端仓库指针，不再承载其代码、测试、夹具、网页原型或项目记录。
- 已执行：更新总指挥工作流边界规则：ChatGPT Workflows 继续只使用 `legacy-origin`；允许提交明确属于本仓库的两个迁移指针文件，`origin` 及独立项目源码、测试和输出不得进入本项目的暂存、Commit、Push、PR 或合并。独立项目的发布另行核对授权。
- English: Recorded that GitStateCompass has moved to an independent project outside this repository. The old path now keeps only a README and remote-repository pointer; it no longer carries product code, tests, fixtures, web prototypes, or project records.
- English: ChatGPT Workflows continues to use only `legacy-origin`. The two migration pointer files that belong to this repository may be committed here; `origin` and the independent project's source, tests, and outputs must not enter this repository's staging, commits, pushes, pull requests, or merges.

## 未发布：红队复核与任务化交接命名

- 已执行：明确红队复核是对抗式审查的一种反例驱动方法，不新增场景编号；公共规则、核心代码、权限、交接和不可逆动作优先使用执行者之外的独立 AI 复核，低风险任务不强制增加回合。
- 已执行：正式交接快照统一要求稳定项目/任务 slug、日期、材料形态和递增编号；禁止使用孤立的 `handoff.md`、`snapshot.md`、`final.md` 等无法区分归属的默认名称，同时保留机器可验证封条的固定命名合同。
- English: Clarified that red-team review is a counterexample-driven method within adversarial review, not a new scenario. Public rules, core code, permissions, handoff, and irreversible actions should prefer an independent AI reviewer outside the executor; low-risk tasks do not gain a mandatory extra round.
- English: Formal handoff snapshots now require a stable project/task slug, date, material type, and incrementing number. Generic names such as `handoff.md`, `snapshot.md`, and `final.md` are forbidden, while machine-verifiable seal filenames keep their fixed contract.

## 未发布：人工反馈分流与链路诊断成本确认

- 已执行：2E 由 AI 核对根因证据，完整 2C 启动前确认范围、成本与阶段停止点；明确未知反馈、累计尝试、额度中断和恢复边界，并纠正运行展示入口的旧编号。
- 已执行：补充偶发故障证据和按风险选择回归覆盖；文档改动不证明实际算法已修复，也不保证平台额度可观测或精确截断。本批为本地未提交修改，验证与独立审查结果见本轮交付。
- English: Added evidence-based routing from manual feedback to pipeline diagnosis, with scope, cost and stage confirmation before full diagnosis. Clarified unknown feedback, cumulative attempts, interruption recovery, intermittent failures and risk-based regression coverage, and corrected the run-preview scene reference. These local, uncommitted documentation changes do not establish algorithm correctness or guarantee quota visibility or exact enforcement; validation and independent review results are reported with this delivery.

## 未发布：公共 worktree 规则边界补充

- 已执行：明确 worktree 数量只能触发盘点，不能单独触发删除、归档、迁移或合并；活跃 worktree 数量仅作为可调整软目标。
- 已执行：明确默认复用已登记主工作区或短期分支，创建新 worktree 必须有并行、隔离、未提交成果保护、并排运行/比较、长时间运行或操作者指定理由。
- 已执行：将 Git 对象库垃圾对象、缺失索引/包文件警告与 worktree 生命周期分为独立事项，要求分别取证、制卡和授权。
- English: Clarified that worktree counts trigger inventory only; they do not by themselves authorize deletion, archival, migration, or merging. Any active-worktree target is a tunable soft goal.
- English: The default is to reuse the registered main workspace or a short-lived branch. A new worktree needs an explicit reason such as parallel work, isolation, protecting uncommitted results, side-by-side comparison, long-running execution, or user instruction.
- English: Git object-database issues such as garbage objects or missing index/pack files are separate from worktree lifecycle and require separate evidence, work items, and authorization.

## 未发布：场景五审阅回执闭环

- 已执行：明确标注“场景五”“场景 5A”或等价执行者—独立审查者请求时，接收窗口必须按场景五逐项审阅并发送正式回执；后续确认、质疑和补充证据继续归入同一事件轮次，直到明确收口或记录真实阻断，不能把工具完成标记或一次初始回执当作闭环。
- 已执行：补充唯一事件标识、状态回执、未决项、禁止动作和下一行动方要求；未指明场景的普通自检或只读解释仍不会自动触发场景五。
- English: Explicit “Scenario 5”, “Scenario 5A”, or equivalent executor–independent-reviewer requests now require the receiving window to perform the requested review and send a formal receipt. Follow-up confirmations, objections, and evidence remain in the same event until closure or a recorded real block; a tool completion marker or one initial receipt is not closure.
- English: Added requirements for a unique event identifier, status receipt, open items, prohibitions, and next action owner. Ordinary self-checks or read-only explanations without an explicit Scenario 5 signal do not enter this workflow.

## 未发布：场景模型建议的目录显示优化

- 已执行：将操作手册各场景标题后的模型建议改为标题下方的加粗正文，避免右侧目录重复显示推荐模型，同时保留场景内的可见提示。
- English: Moved each scenario's model recommendation from the heading into a bold line below it, keeping the navigation outline clean while preserving visibility in the scenario body.

## 未发布：操作手册场景模型起步建议

- 已执行：为 1A–1J、2–2F、3A–3D、4A–4J、5A–5D、6A–6B、Gen1–Gen2 增加模型与推理强度的起步建议。
- 已执行：采用“固定起步值 + 复杂度升级范围”：稳定的交接和常规场景给 Terra/Sol 的默认档位；链路排查、无上下文恢复、远端汇合和规则修复等变化场景写明升级条件，避免简单任务被强行交给高成本模型，也避免复杂任务被低档位误接。
- 已执行：明确模型建议不是强制路由；实际任务必须记录所用模型、推理强度、升级原因和未验证项。未修改远端、未 Commit、未生成新的正式交接附件。
- 未验证：不同模型在本项目真实交接中的效果仍需后续候选独立核验；本次只完成手册规则和记录更新。
- English: Added model/reasoning starting recommendations to every current operator-manual scenario. Stable handoff and routine scenarios use fixed Terra/Sol starting points; variable diagnosis, recovery, remote convergence, and workflow-repair scenarios specify escalation conditions.
- English: These are starting recommendations rather than mandatory routing. The actual model, reasoning level, escalation reason, and unverified items must be recorded. This update changes local documentation and handoff evidence only; it does not grant remote-write permission.

## 未发布：交接有效期与规则升级复杂度门禁

- 已执行：明确交接材料不按固定小时数自动过期；隔夜等待或不改变项目事实的文字聊天不会单独使材料失效，规则、中央状态、工作区、远端、授权、目标、断点或必要证据变化才会触发刷新。
- 已执行：要求候选以当前实际来源优先于附件摘要，发现附件、封条、状态索引、当前视图或中央工作项冲突时直接 `BLOCKED`。
- 已执行：增加规则升级门禁：只解决已复现问题，说明净收益和删减项，补最小验证，先验证旧流程兼容性再更新指纹，禁止半套新规则与旧封条混用。

## 未发布：交接控制面双入口与封条误判修复

- 已执行：为正式交接增加项目键精确绑定、显式 `handoff_ready` 门禁和历史控制面登记；未登记的第二个 `CURRENT`、登记内容漂移或项目键不匹配仍会阻断，不删除旧证据。
- 已执行：补齐交接候选失效门禁：候选在正式切换前被归档、取消、替换或失联时，旧评分、封条和附件只能保留为历史，不能继续复用；交接状态同时展示 `chain_status`、`control_status` 与 `handoff_ready`，避免把结构链 PASS 误当作可切换。
- 已执行：将 00/02/09/10 与轻量启动配置统一升版至 `2026-09-22.1`，让候选能区分本轮交接规则正文变化与旧指纹。
- English: Added an invalidation gate for pre-takeover candidate archival, cancellation, replacement, or loss of verifiability. Old scores, seals, and attachments remain historical and cannot be reused; handoff reports must show `chain_status`, `control_status`, and `handoff_ready` together.
- 已执行：允许同世代/同写者用 `CURRENT_ATTESTATION` 追加 `BLOCKED` 当前证明，保留低置信度事实截点并避免改写旧封条；`control_status=BLOCKED` 不会因结构链 `status=PASS` 被误判为可切换。
- 已验证：准备器 12 项、封条 51 项定向测试通过；当前链最新来源回算通过，但 `handoff_ready=false`、`switch_status=BLOCKED`，未生成或发送正式候选附件；未 Commit、Push 或切换调度权。
- 未验证：全仓库质量脚本当前退出 1，错误集中在既有故障案例 `Repair-CodexThreadArchive.ps1` 的 PowerShell 解析；本轮未修改该文件，也不把它写成交接控制面已修复。
- English: Added exact project binding, an explicit `handoff_ready` gate, and a hashed registry for historical control planes. Unregistered duplicate `CURRENT` records, registry drift, and project-key mismatches remain blocking. Same-writer `CURRENT_ATTESTATION` may now preserve a blocked fact cutoff without rewriting old seals. Targeted preparation and seal tests pass; the current handoff remains blocked and no remote or authority-changing action was performed.
- 已执行：准备器支持同一事件的失败重试；若封条已追加但外部附件尚未完整落盘，重试会校验并复用原封条，不重复推进序号或生成第二事件。
- 已验证：新增“附件重试复用封条”回归测试通过；准备器 14 项、封条 51 项定向测试通过。

## 未发布：长任务批次化与低打断执行规则

- 已执行：在 `02` 增加 `AUTO_BATCH / CHECKPOINT / HUMAN_GATE` 的最小判定和局部失败策略；同一契约、基线、授权和可机械验证链内连续执行，不因命令或微步骤逐次汇报。
- 已执行：在 `09` 复用该判定，并明确新增授权、事实漂移、远端/不可逆动作和人工语义验收才触发停顿；未改变远端授权或专项任务门禁。
- 已验证：`git diff --check` 与 `.github/scripts/Test-Repository.ps1` 均通过，规则版本和链接一致；未执行远端写入。

## 未发布：明确 ChatGPT Workflows 与 GitStateCompass 的远端边界

- 已执行：登记本项目只使用 `legacy-origin` 作为 ChatGPT Workflows 的远端候选；`origin` 和 GitStateCompass 独立项目内容明确排除在本项目提交和远端发布范围外，本仓库自己的迁移指针文件除外。
- 已验证：边界声明只允许迁移指针，不授权读取、修改或提交 GitStateCompass 独立源码；当时未执行远端写入。

## 未发布：经验库索引闭环与按需加载收敛

- 已执行：把跨项目经验索引加入项目启用声明和新项目初始化清单，明确它是可选共享来源；新项目记录相对路径、版本、修订和 SHA-256，缺失时只标记 `EXPERIENCE_INDEX_UNAVAILABLE`。
- 已执行：在 10 中定义经验索引四态（未加载/无匹配/已加载条目/索引不可用）、单任务单修订复用和写入前乐观校验；经验索引变化默认不触发完整规则刷新。
- 已执行：在轻量交接配置中明确经验库不属于固定全文来源；补充 `候选/` 目录占位文件，避免文档入口与实际目录不一致。
- 已验证：`git diff --check` 与 `.github/scripts/Test-Repository.ps1` 均通过；第二轮场景五交叉审查确认文档逻辑与引用链无阻断问题；未执行远端写入。

## 未发布：跨项目经验库的分层沉淀与并发门禁

- 已执行：新增 `总指挥工作流/跨项目经验库/`，包含经验索引、候选模板和中英双语说明；项目特有经验、脱敏候选和已采纳公共条目分层保存。
- 已执行：更新 00/06/09/10 与轻量交接配置，定义交接、重复失败、规则变更、稳定截点和自然语言明确要求的待审触发；关键词只产生候选事件，不自动公共化。
- 已执行：补充候选多写者追加、公共索引动态单写者、租约/乐观版本校验、冲突停止、按索引按需加载，以及本地 Commit、审核和远端 Push/PR 分层授权。
- 已验证：本批未写入任何真实项目经验、绝对路径、任务 ID或聊天原文；公共索引当前无已采纳条目，未执行远端写入。

## 未发布：修复精确路径被截图/文本误读的问题

- 已确认：本次故障不是文件系统或用户路径错误，而是 AI 把正确的下划线目录名误读成了额外的目录分隔符，并将未经原样核验的猜测写成结论。
- 已执行：在根 `AGENTS.md` 增加精确标识逐字保留、原样只读核验、截图与明确文本优先级及歧义阻断规则；在复盘规则中记录根因、预防动作和最小验收。
- 已验证：将使用带下划线目录名的真实现有路径与人为插入分隔符的错误候选进行只读对照；未修改用户路径、项目代码或远端状态。

## 未发布：空白任务的总指挥工作流自动发现与动态身份门禁

- 已执行：增加项目级 `总指挥工作流/工作流启用声明.md` 与 `新项目初始化清单.md`。总指挥工作流不再因目录存在、任务标题或任务 ID 被推断启用；未启用项目只使用全局省 Token 规则。
- 已执行：更新 `AGENTS.md`、第二代总览、核心规则和状态索引规范。空白专项任务先读取短入口、定位动态状态并完成握手；状态缺失/过期、身份不可定位或通信失败时只返回 `UNKNOWN/BLOCKED`，不猜测身份、不取得写入权。
- 已执行：将项目实例状态入口登记为被 `.gitignore` 排除的本地路径 `.codex-manual-cache/commander/AI状态索引.md`，初始状态明确为 `UNKNOWN/BLOCKED`，不伪造当前总指挥或授权。
- 已验证：完成启用、未启用、状态缺失和握手失败四类最小自动化启动测试；仓库质量检查与差异检查通过。现有未提交的 handoff.mjs 未被修改、暂存或提交。

## 未发布：跨窗口最小充分 Token 控制

- 已执行：在全局 Codex 指令中加入最小充分输出、按需读取、工具结果摘要和质量门禁规则；规则保持短小，不引入常驻压缩器。
- 已执行：在总指挥 Token 控制章节补充成功/失败输出的证据下限、复杂度路由和“减少重复与返工优先于盲目降档”原则。
- 已验证：仅修改规则与履历文件；未安装第三方 Skill 或代理，未宣称已获得实际 Token 节省率。既有未提交工具改动未纳入本次变更。
- 已执行：核对现有会话评估工具已支持本地输入、缓存、输出和推理 Token 快照；尝试通过 Windows `winget` 安装 RTK，但软件源更新失败，未启用 RTK。Headroom 等代理型工具仍按门禁保持未接入。
- English: Added a compact global baseline and commander-specific rules for minimal-sufficient output, scoped reads, summarized tool results, and evidence-preserving verification. No third-party compressor was installed and no measured token saving is claimed.

## 未发布：本地成果先整理到远端可执行状态

- 已执行：发布流程改为先在现有授权范围内连续核对、修复、验证并分组提交本地成果，不再要求操作者先批准 Git 技术方案；来源不明、删除意图不明、损坏、敏感或验证失败的对象只做局部暂停。
- 已执行：只有候选内成果已进入明确 Commit、待上传历史和精确引用已核对、验证与隐私检查有结果、远端基线有效时，才生成一次最终远端执行卡；Push、PR、Merge、Tag 和 Release 仍须按实际动作确认。
- 已验证：发布就绪契约定向检查、Markdown 链接、双语 README、路径可移植性与 PowerShell 语法通过；完整仓库检查被一份既有损坏的核心规则文件阻断，本条不能代签全库通过或远端发布就绪。
- English: Local release preparation now proceeds continuously within existing authorization: inspect, fix clear issues, verify, and create scoped commits without asking the operator to choose Git mechanics. Ambiguous, damaged, sensitive, or failing groups are isolated. A single remote execution card is produced only after the candidate is stable; remote writes still require action-specific approval.

## 未发布：故障库改为按人话现象命名

- 已执行：公开故障分类、案例文件夹和用户需要打开的记录文件改为按可见现象命名，例如 `TRB-005-转移旧对话后报错`、`TRB-006-发消息给AI任务却没回应` 和 `TRB-007-任务太长或网络报错`。
- 已执行：保留 `TRB`、`HTTP`、`SYS` 稳定编号与原有案例层级；同步更新公开链接、双语索引、展示页和故障库质量检查路径。
- 已执行：补齐历史记录和 8 个 HTTP 分流页遗漏的改名后总索引链接，避免读者从具体错误页返回旧文件名。
- 已验证：Markdown 链接和双语 README 检查通过。全库检查被一项独立的未提交总指挥规则改动阻断，不能据此声称全库通过。
- English: Renamed public troubleshooting categories, case folders, and user-facing record files around visible symptoms while retaining stable `TRB`, `HTTP`, and `SYS` identifiers. Links and bilingual README checks passed; an unrelated uncommitted commander-rule change blocks the full repository check.

## 未发布：一键交接工具的完成状态回读

- 已执行：等待接续任务完成时，除监听完成事件外，定时回读任务状态，降低事件未送达导致误判超时的风险。
- 已执行：隔离集成测试的恢复提示只允许读取临时测试文件，不再引用当前工作目录。
- 已执行：桌面项目 ID 与官方外部接口项目 ID 无法唯一对应时失败关闭；项目内任务不再尝试生成可能落到错误位置的接续任务，未归属项目任务仍可按原流程处理。
- 已执行：使用说明明确区分当前可用的扫描/未归属任务交接与暂不可用的项目内自动交接，并提示只有工具明确成功后才进入新任务。
- 已执行：新增 `--export-source` 只读导出入口，复用项目归属、活动状态和重复标题保护后输出可审计的交接导出信息；未创建接续任务或修改原任务。
- 已执行：增加 `--catalog-json` 只读目录输出；正式接管和隔离集成测试统一要求 `HANDOFF_QUALITY` 与 `HANDOFF_RECOVERY_STATUS`，并在离线自测中覆盖质量评级解析。
- 已验证：JavaScript 语法检查、离线 `--self-test`、差异检查和仓库质量检查通过；集成测试需启动 app-server 并创建隔离任务，本批未获得成功回执，不能代签集成通过。
- English: The handoff tool now polls continuation status, offers a read-only `--catalog-json` catalog, and requires both `HANDOFF_QUALITY` and `HANDOFF_RECOVERY_STATUS` for normal and isolated recovery prompts. Syntax, offline self-tests, diff checks, and repository quality checks passed; live integration was not confirmed because it requires an app-server and a temporary task.

## 未发布：Git 仓库状态罗盘产品方案

- 已执行：记录面向 Git 新手的本地优先、只读桌面工具产品方案，明确区分工作区、本地提交、远端跟踪引用和 GitHub PR。
- 已执行：定义 v0 技术验证门禁、v1 功能边界、隐私与只读契约、测试夹具及已接受风险；该方案不包含代码实现、创建远端仓库或任何远端写操作。
- 已审查：方案结论为 `PASS_WITH_ACCEPTED_RISKS`；旧建议必须在本地状态变化、监听丢事件或窗口恢复焦点后失效。Wails/WebView2 兼容性、构建体积、安装与签名仍须在后续样机中验证。
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

## 未发布：首次手动刷新事件封套修正

- 已执行：修正首次手动规则刷新提示词，要求发送前填写真实 `RULE_REFRESH_ID`、规则根、旧/新版本、manifest 摘要、变化范围、读取深度、允许写入范围、排除项和失效条件；仅读取测试可明确使用“允许写入范围：无”。
- 已执行：明确静态广播包不能单独充当刷新事件；占位符未替换或来源无法核验时，接收方只能返回 `WARN/BLOCKED`，不得猜测或伪造登记。
- 已验证：工作流刷新契约测试覆盖手动启动模板，避免说明包与可复制提示词再次脱节；未执行 Commit、Push 或其他远端写入。

## 未发布：规则刷新 manifest 来源与人话回执

- 已执行：新增可回读的 `规则刷新manifest.json`，事件封套同时携带 manifest 摘要和来源路径；接收方找不到 manifest 原文时必须返回 `WARN`，不能只凭哈希宣称一致。
- 已执行：规则刷新回执改为“操作者摘要 + 机器核验详情”两层结构，先说明是否接纳、真实阻断和下一行动方，再保留审计字段。
- 已验证：刷新契约测试 `9/9 PASS`，manifest 逐条规则摘要核验通过；未执行 Commit、Push 或远端写入。

## 未发布：规则刷新状态与结果正交化

- 已执行：明确 `RECEIVED/COMPLETED` 只描述处理进度，`PASS/WARN/FAIL` 描述处理结果；只读处理已结束但无耐久写入授权时必须返回 `COMPLETED + WARN`，不得退回 `RECEIVED`。
- 已执行：机器核验详情默认不超过 12 条，正常文件只报告 manifest 匹配和数量，异常项才展开；操作者摘要同时区分“本次处理”和“耐久接纳”。
- 已验证：刷新契约测试 `10/10 PASS`，新 manifest 逐条摘要核验通过；未执行 Commit、Push 或远端写入。

## 未发布：规则版本与 manifest 同步门禁

- 已执行：将规则版本提升为 `2026-09-24.1`，并在 `规则刷新manifest.json` 中登记同一 `rule_version`；内容变化后不再沿用旧版本号。
- 已执行：版本一致性检查新增 `09`，刷新契约同时核对 00/02/09/10/轻量配置与 manifest 的版本一致性。
- 已验证：规则版本、manifest 十项来源和总摘要一致；仓库质量检查通过。旧刷新事件及旧 manifest 摘要自动失效。

## 未发布：规则广播简化为纯加载

- 已执行：规则广播与项目接入、身份、CURRENT、唯一写者、配置迁移、耐久登记、交接和封条完全拆分。操作者只发送“规则更新指令 + 第二代规则路径”；项目历史问题不得让加载结果变成 `WARN/BLOCKED`。
- 已执行：规则加载只返回 `PASS/FAIL`。规则根自洽即回复“已更新到 <版本>”；只有路径不可访问、必需文件缺失/哈希不一致、读取期间漂移或更高优先级冲突才失败。
- 已执行：增加广播前冻结门禁；维护者完成修改、版本、manifest 和质量检查后才允许广播，广播期间不得继续修改来源。项目迁移清单改为另行授权后使用。
- 已执行：刷新 manifest 与交接 manifest 解耦，覆盖 00—11、轻量配置、广播包和回执模板共 15 项核心工作流文件。
- 已验证：规则刷新契约 `11/11 PASS`，完整刷新 manifest 逐项匹配；未执行 Commit、Push、远端写入或实际广播。
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
## 未发布：交接阶段矩阵与分阶段状态输出

- 新增统一的交接阶段矩阵，区分材料准备、发送、接收核验和正式切换。
- 明确旧总指挥尚未停止不阻断材料准备；候选任务 ID 在空白任务接收成功后才登记。
- 统一要求分别输出候选材料状态、真实阻断、操作者下一步和正式切换状态。
- 未执行 Commit 或远端写入。

## 未发布：广播前对抗式修补

- 独立红队审查发现并修复阶段命名、封条字段、交付状态和候选核验状态混用问题。
- 广播包现在要求事件封套、版本、manifest 摘要、允许写入范围和按角色读取集合；空白项目不会因广播自动启用。
- 接收回执补齐 `result`、规则刷新记录位置和 `RECEIVED` 中间态说明。
- 统一 schema v3 的 `root_ref` 必填契约，并新增工作流刷新静态契约测试。

## 2026-09-27：修复 ChatGPT 网页侧栏拖动

- 已执行：侧栏脚本更新至 2.1，拖动时同步调整侧栏外框与标题区域，手柄跟随实际边界。
- 已验证：JavaScript 语法检查与差异空白检查通过；真实 ChatGPT 页面效果仍待人工验收。
- English: Updated the sidebar userscript to 2.1 so its handle follows the actual edge while resizing the sidebar frame and title area. Syntax and diff checks passed; live-site behavior still needs manual validation.
## 未发布：规则刷新双根路径契约修复

- 中文：修复规则刷新 manifest 将仓库根 `.github/scripts/` 与规则根文件混用时的路径歧义；广播和回归检查现在明确 `.github/` 条目按仓库根、其他条目按规则根解析，并记录了仓库根相对路径。
- English: Clarified the rule-refresh manifest's dual-root path contract: `.github/` entries resolve from the repository root while other entries resolve from the rule root, with the repository-root reference recorded and regression-checked.
- 状态 / Status：本地已修改，待验证；未 Commit，未 Push / Modified locally, verification pending; not committed or pushed.
## 2026-10-05：规则升级与旧项目适配闭环

- 06维护流程区分正文调整与状态/校验契约升级，既有迁移清单补充旧格式识别、授权内最小适配、历史保留和实际预检；01C及04同步入口。
- 缺字段不直接否定可核验身份，不重复索取已有范围内授权；真实冲突仍局部停止。规则加载不自动迁移其他项目，模拟通过不能代替当前项目可交接证明。
- English: Added migration guidance for state and validation changes. Existing authority must be verified before filling missing fields; formal handoff requires a preflight against the actual project, not only synthetic tests.
- 当前项目导航迁移和真实交接预检结果记录在本地交接证据中；不宣称其他项目已迁移。未Commit或执行远端写入。

## 2026-10-05：规则刷新结果与正文分段读取门禁修正

- 修正规则刷新广播包与回执模板中“处理已收口”和“加载成功”的状态混淆，最终结果统一使用 `result：PASS/FAIL`，并把 `RULE_REFRESH`、`PROJECT_ENROLLMENT`、`IDENTITY_CONTROL_PLANE` 分开记录。
- 明确单次工具输出截断只要求继续按稳定字节范围分段读取，不等于规则来源损坏；加载记录需保存 `text_reading`、分段范围和终点复核。
- 增加规则契约断言，防止项目未接入或身份未请求再次阻断普通规则刷新。未执行项目接入、产品修改或远端写入。
