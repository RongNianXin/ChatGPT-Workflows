import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const workflow = path.join(root, '总指挥工作流', '第二代总指挥的工作模式');
// Existing prose contracts check visible wording; the dedicated reference check
// separately validates these hidden semantic bindings and history boundaries.
const read = name => fs.readFileSync(path.join(workflow, name), 'utf8')
  .replace(/<!-- SCENARIO_(?:REFS:[^\n]*|HISTORY:(?:BEGIN|END)) -->/g, '');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex').toUpperCase();
const schema = JSON.parse(fs.readFileSync(path.join(workflow, 'templates', 'HANDOFF_STATE.schema.json'), 'utf8'));
const REFRESH_REQUIRED_RULES = [
  '.github/scripts/HandoffWorkspaceScope.mjs',
  '.github/scripts/HandoffSeal.mjs',
  '.github/scripts/Prepare-Handoff.mjs',
  '.github/scripts/Mark-Handoff-Delivered.mjs',
  '.github/scripts/Inspect-RuleRefresh.mjs',
  '.github/scripts/Inspect-QuotaProtection.mjs',
  '.github/scripts/Test-OperatorManualReferences.mjs',
  'templates/OPERATOR_MANUAL_REFERENCES.json',
  ...Array.from({ length: 12 }, (_, index) => `${String(index).padStart(2, '0')}-`),
  '总指挥轻量交接启动配置.md',
  '规则刷新广播包.md',
  '规则刷新接收回执模板.md',
  'docs/EXECUTION_AND_INDEPENDENT_REVIEW.md',
  '引用的外部工具/外部工具目录.md',
  '引用的外部工具/外部工具自动对接规范.md'
];
const checks = [
  ['state upgrades require migration and real project evidence', read('06-复盘与优化规则.md'), ['旧状态识别', '责任与权限', '旧状态兼容验证', '当前项目迁移', '真实使用预检', 'preflight_only', '不能替代', 'SUPERSEDED']],
  ['missing fields do not manufacture authority or weaken migration gates', read('项目配置迁移清单.md'), ['格式缺项不等于身份冲突', '新注释不能反过来自证身份', '冻结或生成新候选之前', '多文件迁移中断不得宣布完成', '不由规则维护者批量回写']],
  ['handoff entry executes scoped migration and actual preflight', read('01-操作者操作手册.md'), ['在冻结候选前自动最小补齐并回读', '不重复询问已获授权', '当前真实项目的完整 `preflight_only` 预检']],
  ['matrix separates logical and machine phases', read('交接阶段矩阵.md'), ['逻辑交接阶段', '封条阶段', '附件交付状态', '候选核验状态']],
  ['broadcast is load-only and self-describing', read('规则刷新广播包.md'), ['规则广播只做一件事', '规则更新指令 + 第二代规则路径', '不需要手工填写 `RULE_REFRESH_ID`', '项目问题另列待办', '规则根向上两级得到的仓库根', '以 `.github/` 开头']],
  ['broadcast limits failure to rule-root faults', read('规则刷新广播包.md'), ['路径不可访问', '必需文件缺失', '哈希不一致', '更高优先级规则冲突', '不得触发 `WARN/BLOCKED`']],
  ['ordinary refresh reads saved local text while pinned verification stays strict', read('规则刷新广播包.md'), ['普通本地刷新（默认）', '旧预期指纹或版本标签待同步', '不单独否决普通刷新', '精确版本核验', '不自动降为本地正文模式', '立即取消本批']],
  ['refresh separates bytes, reading and adoption', read('规则刷新广播包.md'), ['必要正文实际呈现', '补读' , '分段范围', 'text_reading=COMPLETE', '单次输出的截断只表示本段需要继续读取', '不能替代正文理解', '任一必需条目核验失败', '不得以“其余文件已读”宣称刷新完成', '外部工具目录与统一自动对接规范也是必需条目']],
  ['manual bootstrap carries saved local adoption and the dual-root rule', read('01-操作者操作手册.md'), ['请完整读取并采用规则目录中已保存的最新本地正文', '规则加载、项目接入、身份确认和控制面写入分开处理', '以 `.github/` 开头的文件，按规则根向上两级得到的仓库根读取', '不要猜测身份、授权或任务清单', '不执行远端写入']],
  ['receipt is minimal pass or fail', read('规则刷新接收回执模板.md'), ['正常成功只回复', 'result：PASS', 'result：FAIL', 'RULE_REFRESH：PASS/FAIL', 'PROJECT_ENROLLMENT：ENROLLED/NOT_ENROLLED/UNKNOWN', 'IDENTITY_CONTROL_PLANE：VERIFIED/NOT_REQUESTED/UNKNOWN', '规则加载结果不使用 `WARN/BLOCKED`']],
  ['project migration is independent', read('项目配置迁移清单.md'), ['不再随规则广播自动执行', '本清单存在缺口也不得降低规则加载结果']],
  ['project state cannot block rule loading', read('09-自动化授权与风险分级.md'), ['规则刷新是纯规则加载事件', '规则加载只允许两种最终结果：`PASS` 或 `FAIL`', '不得产生 `WARN/BLOCKED`']],
  ['affirmative reply binds the latest unique plan', `${read('02-总指挥核心规则.md')}\n${read('09-自动化授权与风险分级.md')}`, ['最近唯一、范围明确且可恢复的执行方案', '我同意你的做法', '不因缺少固定授权句式', '不得要求操作者改用固定授权口令']],
  ['affirmative authorization preserves scoped gates', read('09-自动化授权与风险分级.md'), ['多个方案或母任务', '肯定只针对判断而非执行', '方案外后来新增的动作', '可以作为这次最终确认', '分次或双重确认', '其他独立且已授权的工作继续推进']],
  ['complexity budget replaces patch accumulation', `${read('00-第二代工作流总览.md')}\n${read('06-复盘与优化规则.md')}`, ['默认复杂度预算不得增加', '先删除、替换或合并旧机制', '连续两次采用相近补丁仍未改善', '停止继续叠加']],
  ['navigation registers support docs', read('00-第二代工作流总览.md'), ['交接阶段矩阵.md', '规则刷新广播包.md', '项目配置迁移清单.md', '规则刷新接收回执模板.md']],
  ['state index separates logical phase from seal phase', read('10-自动状态索引规范.md'), ['逻辑交接阶段', '封条 `handoff_phase`', 'RECEIVED_VERIFIED']],
  ['schema v3 requires source root_ref', fs.readFileSync(path.join(workflow, 'templates', 'HANDOFF_STATE.schema.json'), 'utf8'), ['sourceV3', '"root_ref"']]
];
checks.push(['local-to-remote route keeps release separate', `${read('01-操作者操作手册.md')}\n${read('02-总指挥核心规则.md')}`, ['场景 4K：将本地最新成果同步到远端', '不必先决定是否提 PR', '同步源码不会自动生成下载页中的新 Release', '精确纳入/排除范围']]);
checks.push(['PR scope and local sync follow project rules', `${read('01-操作者操作手册.md')}\n${read('02-总指挥核心规则.md')}`, ['操作者不必先划定可验收范围', '个人项目可以建议直接 Push', '团队项目必须先遵守团队规则', '多个功能不自动合成一个 PR', '不能绕过隐私、验证和远端最终确认']]);
checks.push(['handoff identity conflict has migration split', read('项目配置迁移清单.md'), ['CONTROL_PLANE_MIGRATION_REQUIRED', 'CONTROL_IDENTITY_CONFLICT', '操作者称呼或确认本身不能替代', '不覆盖旧记录、不生成新封条']]);
checks.push(['platform thread failure freezes handoff writes', read('04-状态、目标变更与交接规范.md'), ['thread not found', '暂停控制面写入、封条追加和正式切换', '不能据此证明或否定', '重新读取状态索引']]);
checks.push(['empty cross-task output is an explicit failure', read('09-自动化授权与风险分级.md'), ['目标任务完成但最终文本为空', '不得写成 `RECEIVED`、`COMPLETED`', '非空的 `BLOCKED` 或 `FAILED`', '空输出不能作为成功回执']]);
checks.push(['operator-visible receipt precedes tools and blocks empty closeout', `${read('09-自动化授权与风险分级.md')}\n${fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8')}`, ['首个可见文本', '只能记为 `OUTPUT_UNVERIFIED/BLOCKED`', '暂停恢复原主线', '本地反馈不产生对外发送权限']]);
checks.push(['core rules carry the cross-project closeout hard gate', read('02-总指挥核心规则.md'), ['总指挥核心收口硬门', '无对外回执授权', '必须先向当前操作者输出非空的收件状态', '所有启用本工作流的项目均适用', '`AGENTS.md` 只能作为本项目附加护栏']]);
checks.push(['same-window authority reuse preserves source and permission boundaries', `${read('规则刷新广播包.md')}\n${read('01-操作者操作手册.md')}`, ['当前窗口已核验且仍有效的权威来源绑定', '可回源', '未被撤销、替换', '不要求操作者重复确认路径', '裸历史路径和其他窗口声明仍不可用']]);
checks.push(['refresh continuity preserves exact reading and real stop conditions', `${read('规则刷新广播包.md')}\n${read('02-总指挥核心规则.md')}\n${read('09-自动化授权与风险分级.md')}`, ['真实停止条件触发后正文没读完', '下一位置', '正常分段', '不能替代正文理解', 'NOT_ATTESTED', '--offset 0 --length 2000', '规则来源故障仅指规则根本身', '必须注明停止原因，不得写成规则来源故障', '状态的缺口不否定纯规则加载']]);
checks.push(['refresh result belongs to its current event rather than old business', `${read('规则刷新接收回执模板.md')}\n${read('09-自动化授权与风险分级.md')}`, ['最终结果必须对应当前刷新事件', '旧业务答复', 'MESSAGE_ID', '待确认', '平台完成']]);
checks.push(['rule refresh separates source authority, adoption record and identity control', `${read('规则刷新广播包.md')}\n${read('规则刷新接收回执模板.md')}\n${read('09-自动化授权与风险分级.md')}`, ['规则来源选择门禁', 'RULE_SOURCE_LOCATOR', 'SOURCE_NOT_LOCATED', 'STALE_SOURCE_UNCONFIRMED', '规则采用记录', 'RULE_ADOPTION=PASS', 'PROJECT_REGISTRATION=SYNC_PENDING', '不得修改总指挥、唯一写者、CURRENT', '正式交接前必须由项目唯一写者处理']]);
checks.push(['rule drift has automatic rebase without operator version choice', `${read('规则刷新广播包.md')}\n${read('01-操作者操作手册.md')}\n${read('02-总指挥核心规则.md')}\n${read('04-状态、目标变更与交接规范.md')}\n${read('10-自动状态索引规范.md')}`, ['rule_baseline', 'RULE_REBASE_PENDING', 'SUPERSEDED_BY_RULE_REBASE', '不要求操作者选择版本', '只暂停受影响阶段', 'PINNED_CURRENT / RULE_REBASE_PENDING / REBASED / REBASE_BLOCKED']]);
checks.push(['feedback triages before costly 2C and repairs within scope', `${read('01-操作者操作手册.md')}\n${read('docs/PIPELINE_DIAGNOSIS_AND_ALGORITHM_TUNING_STANDARD.md')}`, ['先描述现象；AI 定点核对后决定是否进入 2C', '最小定点核对后仍无法定位', '原因及修复边界已有可靠证据的，在现有授权内局部修复与回归', '已有同一问题的修复授权时直接修复与回归', '仅报结果且没有开放目标', '一次列明拟改范围、影响和验证以请求差额授权']]);
checks.push(['workflow entry points load triage before full diagnosis', `${read('00-第二代工作流总览.md')}\n${read('02-总指挥核心规则.md')}\n${read('docs/WORKFLOW_OVERVIEW.md')}`, ['先读 `docs/PIPELINE_DIAGNOSIS_AND_ALGORITHM_TUNING_STANDARD.md` 的 2.1 做最小分流', '先读取 `docs/PIPELINE_DIAGNOSIS_AND_ALGORITHM_TUNING_STANDARD.md` 的 2.1 并完成最小定点核对', '2E 失败反馈先按 2.1 最小分流']]);
checks.push(['diagnosis keeps node-level evidence while reporting results first', `${read('00-第二代工作流总览.md')}\n${read('01-操作者操作手册.md')}\n${read('docs/PIPELINE_DIAGNOSIS_AND_ALGORITHM_TUNING_STANDARD.md')}`, ['逐项核对输入、处理、输出、不变量、观测证据和失败信号', '可证伪对照验证根因', '默认先报告复现和版本', '完整节点和证据留在工作项中供回查', '复杂分叉、证据争议']]);
checks.push(['diagnosis references resolve to the current section', `${read('02-总指挥核心规则.md')}\n${read('06-复盘与优化规则.md')}\n${read('docs/PIPELINE_DIAGNOSIS_AND_ALGORITHM_TUNING_STANDARD.md')}`, ['#21-2e-分流与-2c-连续执行', '<a id="21-2e-分流与-2c-连续执行"></a>']]);
checks.push(['bounded test scenario is distinct from feedback, diagnosis and legacy 2G', `${read('00-第二代工作流总览.md')}\n${read('01-操作者操作手册.md')}\n${read('02-总指挥核心规则.md')}`, ['场景 2G：用真实数据做有界自动测试、修复和复测', '旧版精简提示词的“2G”按内容和规则版本映射到当前 2B', '2E 用于反馈你已经观察到的结果；2C 是原因不明时的逐节点查因方法', '收到当前版 2G 的真实数据有界测试请求时走 2G', '可终止本轮进程及其子进程', '不因重试、换卡或切换窗口重置', '质量标准无法直接核验、又无可靠真值或必要人工确认时']]);
checks.push(['cross-task receipt is an executable hard gate', `${read('02-总指挥核心规则.md')}\n${read('09-自动化授权与风险分级.md')}\n${fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8')}`, ['两阶段首步', '首个可见文本', '首个工具动作', '回执先行硬门禁（事故回归）', '实际跨任务发送工具', '缺少真实发送证据的事件不得收口', '不得写成已回执']]);
checks.push(['receipt threshold explains content signals and inbound events', `${read('02-总指挥核心规则.md')}\n${read('09-自动化授权与风险分级.md')}\n${fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8')}`, ['场景五/场景 5A–5D', '对抗式反馈', '希望征求建议', '希望帮忙分析', '需要回执', '通信授权', '入站事件']]);
checks.push(['delegated tool-result ingress is normalized and source-isolated', `${read('02-总指挥核心规则.md')}\n${read('09-自动化授权与风险分级.md')}\n${fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8')}`, ['宿主转交载体解析硬门', 'functionCallOutput', '<codex_delegation>', '独立 `INBOUND_EVENT`', '不得从上一轮 Kaggle、Cargo', '不得输出符号', 'RECEIVED_LOCAL_PENDING', 'RECEIPT_RESULT_RECORDED', '来源错配']]);
checks.push(['cross-task completion separates local work from source confirmation', `${read('02-总指挥核心规则.md')}\n${read('04-状态、目标变更与交接规范.md')}\n${read('09-自动化授权与风险分级.md')}`, ['local_processing_status', 'source_delivery_status', 'SENT_PENDING_CONFIRMATION', 'RECEIVED_CONFIRMED', '不得把“状态=COMPLETED，等待对方确认”', '事件总状态才可为 `COMPLETED`']]);
checks.push(['in-app reply policy reuses direct user authorization within scope', read('09-自动化授权与风险分级.md'), ['同一应用内的来源回复预授权', '不再逐次询问', '其他使用者须有自己的授权依据', '发送方不能代授权限', '新来信或范围内的不同来源不自动使其失效', '恢复或换窗时回读核验']]);
checks.push(['in-app reply decision keeps opt-out, privacy and local feedback', read('09-自动化授权与风险分级.md'), ['未说明是否需要回执时，自主判断', '明示“无需回复”时不回', '纯确认、重复知悉且没有新问题时不启动互答', '不转发私聊全文', '无论已回复、决定不回、排队还是受阻', '只暂停发送和依赖回执的动作']]);
checks.push(['bootstrap grants scoped replies without proactively contacting tasks', `${read('01-操作者操作手册.md')}\n${read('10-自动状态索引规范.md')}`, ['同时授权你按09的同应用回复预授权', '无需逐次向我确认', '本条0A只登记该预授权', '直接授权依据', '通信政策与业务动作授权分开记录']]);
const sceneFiveReceipt = read('09-自动化授权与风险分级.md').split('14. **场景五请求必须闭环。**')[1]?.split('15. **回执先行硬门禁')[0] || '';
checks.push(['scene-five follow-ups respect opt-out and the agreed round limit', sceneFiveReceipt, ['明示“无需回复”优先于场景标签', '纯确认且未要求回复只登记并向操作者反馈', '到轮次上限或明确收口即停止本批互答', '到限仍有未决项不写通过', '单方完成审查不冒充对方确认']]);
checks.push(['cross-task workflow review routes separately from source business', `${read('09-自动化授权与风险分级.md')}\n${fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8')}`, ['公共工作流审查的正向分流', '按 FIFO 在取得处理时隙后完成最小只读核对', '只提取判断工作流缺陷所需的最小事实', '工作流部分继续处理，专项业务部分单独标记 `BLOCKED`', '没有回执要求时不强制向来源发送消息', '公共工作流审查与来源业务二分', '混合消息必须拆分处理']]);
checks.push(['Goal input boundary is explicit', read('01-操作者操作手册.md'), ['Goal 模板怎么用', '完整正文并提交', '不要重复粘贴', '一、最终目标：', '二、细节描述：', '三、素材提供：', '四、角色配置：', '五、操作许可：', '明确允许：', '明确禁止：', '未写明的普通低风险本地动作，不自动视为禁止，也不自动视为允许', '即使没有写“禁止”，也不得按“未禁止”执行', '六、默认规则约束（仅限 Goal 启动前由操作者决定是否删减', 'Goal 正式启动后，本栏约束保持不变', '不得自行删除、放宽或改写', '七、平台状态硬门：', '八、能力剖面：', '九、自动化验证：', '十、停止条件：', '十一、额度保护', '十二、执行要求：', 'Agency Agents', '不是 Goal 启动的前置条件', '审查意见按模板从“一、最终目标”到“十二、执行要求”的顺序输出', '原文10—20字短摘录', '动作（保留/删除/替换/新增）', '可复制替换文本', '影响', '验证方式', '不得为了凑齐清单虚构问题']]);
checks.push(['Goal closeout receipt separates cycle stop from completion', `${read('01-操作者操作手册.md')}\n${read('02-总指挥核心规则.md')}`, ['目标类型（由 Gen1.2 核对）', 'PLAN_ONLY / IMPLEMENT_AND_VERIFY / HYBRID', '每次停止后的固定回执', '本轮实际完成的目标与动作', '停止条件编号、具体原因及触发证据', '未完成/待确认事项、精确断点和下一行动方', '阶段性方案完成不等于最终 Goal 完成', '`CYCLE_STOPPED`、`PAUSE_REQUIRED`、`BLOCKED` 不等于取消或清除 Goal', '只有操作者明确取消或替换且平台实际回读已清除']]);
checks.push(['complex preflight groups known questions without expanding authorization', read('02-总指挥核心规则.md'), ['复杂指令的启动前预检与集中询问', '不为预检全仓扫描', '前两类自行解决', '没有必问项时直接按既有授权执行', '只询问差额并暂停受影响动作', '不能靠启动时概括同意替代', '不保证所有问题都能提前发现']]);
checks.push(['necessary questions include supported recommendations, not implied consent', read('09-自动化授权与风险分级.md'), ['名称末尾标注“（推荐）”', '不虚构最优解', '预选、跳过、未回复和超时都不构成授权', '不能用低风险分类绕过']]);
checks.push(['Goal review and execution both front-load necessary decisions', read('01-操作者操作手册.md'), ['② 启动预检与路线选择', '将当前可预见且必须由我回答的问题集中提前提出', '已有选择不因阶段变化重复询问', '执行中新发现的问题只询问新增差额']]);
checks.push(['Goal review distinguishes valid permissions, draft grants and substantive revisions', read('01-操作者操作手册.md'), ['不包含高资源运行授权', '不把草稿候选说成已经授权', '拟随正式正文授予的范围', '对照模板版本（无法核验时写待确认）', '实质改动', '没有特殊权限需求时不生成空授权卡']]);
checks.push(['bounded resource permission preserves scope, limits and project gates', read('09-自动化授权与风险分级.md'), ['本地高资源运行的有界授权与复用', '预计耗时', '并发/浏览器/模型实例上限', '累计时限上限', '准备事项', '终止方式', '直接确认后才生效', '新脚本仍须核验实际动作和资源风险', '已有明确单次授权不得扩大成整个 Goal 的长期许可', '项目规定每次高资源运行前另行确认时']]);
checks.push(['Goal resource permission reuse does not reset the resource budget', read('05-模型选择与资源策略.md'), ['准备稿和授权候选不自动生效', '已有范围未变且仍有效时不重复询问', '允许运行与剩余资源限额分别核验', '不以本周期8小时或总迭代预算替代高资源授权']]);
checks.push(['external tool scenario is operator-facing and path-addressable', read('01-操作者操作手册.md'), ['可选功能场景：外部工具调用', '### 外部工具总体接入规则', '[EXT-001：Agency Agents]', '### EXT-001：Agency Agents', '[EXT-002：CLI-Anything]', '### EXT-002：CLI-Anything', '它是做什么的：', '操作者入口：', '工具子目录的 `README.md` 是该工具唯一的操作者入口', 'agency agents/README.md', 'cli-anything/README.md', 'CLI-Hub', 'ChatGPT-Workflows/引用的外部工具/agency agents/README.md', 'ChatGPT-Workflows/引用的外部工具/cli-anything/README.md']]);
checks.push(['operator manual defines the natural-language update and path-check contract', read('01-操作者操作手册.md'), ['01 手册的场景编写与路径变更规范', '一个场景只解决一个操作者目标', '正文固定按四段写', '入口必须完整可寻址', '自然语言改手册的固定动作', '路径检查在三处触发']]);
checks.push(['scenario zero has a unified entry and scoped commander broadcast', `${read('01-操作者操作手册.md')}\n${read('规则刷新广播包.md')}\n${read('09-自动化授权与风险分级.md')}`, ['场景 0A：统一接入与规则更新', '场景 0B：总指挥广播最新工作流', 'broadcast_scope', 'ALL', 'SELECTED', '逐目标', '强制接收', '不保证平台一定送达', '兼容分支']]);
checks.push(['scenario 0B operator prompt is Chinese-first', read('01-操作者操作手册.md'), ['广播范围：【全部子任务 / 指定子任务】', '指定子任务：【选择“指定子任务”时填写名称或任务编号；全部子任务时留空】']]);
const manual = read('01-操作者操作手册.md');
const scene0A = manual.split('### 场景 0A：')[1]?.split('### 场景 0B：')[0] || '';
const scene0B = manual.split('### 场景 0B：')[1]?.split('### 兼容分支：')[0] || '';
checks.push(['0A acts only on its direct receiver', scene0A, ['这条指令只针对当前正在与我对话的 AI', '无论你是总指挥、普通任务还是专项任务', '不要替其他对话更新，也不要盘点其他对话、向它们广播或转达指令', '只暂停需要确认身份才能执行的动作，仍可完成普通规则刷新', 'RULE_SOURCE_STATUS', 'PROJECT_ADOPTION_RECORD', 'live_rule_epoch', '不要让我在版本之间选择']]);
checks.push(['0B is commander-only and project-scoped', scene0B, ['只发给已核验的本项目现任总指挥', '可以只指定一个专项', '不得跨项目转达', '不是或无法确认时停止转达', '由AI核对唯一对象']]);
checks.push(['0A requires source locator and task-id discovery evidence', `${scene0A}\n${read('10-自动状态索引规范.md')}`, ['本条指令明确路径 > 当前项目启用声明', 'RULE_SOURCE_LOCATOR', 'SOURCE_NOT_LOCATED', 'STALE_SOURCE_UNCONFIRMED', 'PLATFORM_TASK_ID_STATUS=UNAVAILABLE_AFTER_PROBES', '没有执行探针不得写“平台未暴露”']]);
checks.push(['dual-root resolution cannot report false missing files', read('规则刷新广播包.md'), ['repository_root_ref', '解析后的根（规则根或仓库根）', '禁止把仓库根条目直接拼到规则根后再报告缺失']]);
checks.push(['broadcast serializes refreshes and stops on rate limits or empty output', read('规则刷新广播包.md'), ['默认串行发送', '一次只保持一个规则刷新请求', '429', 'Too Many Requests', 'RATE_LIMITED', 'OUTPUT_UNVERIFIED', '停止新增发送和盲目重试']]);
const legacy0C = manual.split('### 兼容分支：把已运行项目的现有窗口接入工作流（原场景 0C）')[1]?.split('```text')[1]?.split('```')[0] || '';
checks.push(['legacy 0C copy block preserves current 0B gates', legacy0C, ['本旧入口按现行0B处理', '本项目现任总指挥，否则停止转达', '本项目当前清单中全部可核验子任务', '不扩大到其他项目', '不迁移控制面']]);
checks.push(['identity reference does not confer authority or require manual IDs', read('10-自动状态索引规范.md'), ['接收本条指令的对话', '中央登记的现任总指挥', '原/旧对话', '平台任务ID、逻辑 `writer_id`、总指挥世代和任务标题分别记录', '不能冒充平台ID', '不要求操作者手填技术ID', '不自动产生世代切换、中央写权、旧授权继承或远端权限', '已证明平台不可见时，ID UNKNOWN 不单独撤销已有中央证据确认的身份或切换状态', '普通规则刷新可以独立PASS', '在旧对话发送', '在新对话发送', '在接收对话发送']]);
checks.push(['handoff and task continuation distinguish receiver from source', manual, ['本次拟建立或恢复的总指挥是接收本条指令的对话', '这里的当前窗口指接收本条指令、拟移交职责的旧对话', '接收本条指令的对话现在是本项目的新总指挥候选', '调度权移交给当前接收指令的新候选对话', '你是准备移交工作的旧任务窗口', '你是接收续接材料的新任务窗口', '原对话与接收对话分别定位']]);
checks.push(['4K resolves reversible preparation problems without weakening publish gates', `${read('01-操作者操作手册.md')}\n${read('02-总指挥核心规则.md')}\n${read('09-自动化授权与风险分级.md')}`, ['4K简单问题自主处理', '无法在原范围安全修复的验证失败', '远端动作前还必须逐项读取目标 Commit/Head 的 Checks 和 Actions', '失败项默认全部进入本轮处理清单', '不得以取消测试、降低验收', '关闭检查或空提交掩盖失败', '同类修复连续两次无改善', '修复改变纳入内容时', '结果未知不重复副作用', '先完成可审阅候选', '最终远端确认仍适用', '已有有效精确确认不重复索权']]);
checks.push(['cross-project route separates affiliation from operator authorization', `${read('09-自动化授权与风险分级.md')}\n${fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8')}`, ['跨项目默认路由', '本项目 AI / 其他项目 AI / 归属未知', '当前操作者在接收窗口直接明确要求处理来源业务', '来源归属与通信授权分开核验', '其他项目或归属未知的 AI 来信默认进入 `WORKFLOW_FEEDBACK`']]);
checks.push(['cross-window feedback reads accessible material before execution gating', `${fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8')}\n${read('09-自动化授权与风险分级.md')}\n${read('06-复盘与优化规则.md')}`, ['完整取得并阅读当前消息提供的可访问材料', '只读范围内检索互联网', '读取、核验和总结不等于接管来源业务', '来源业务未授权', '缺失材料仍需标为 `INPUT_REQUIRED`']]);
checks.push(['cross-task operator report has six explicit sections', `${fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8')}\n${read('01-操作者操作手册.md')}\n${read('09-自动化授权与风险分级.md')}`, ['跨任务事件的操作者可见六段汇报', '来源与要求', '读取与分析', '执行决定', '来源回执', '操作者干预', '处理状态与主线', '恢复原主线断点', '已发送待确认', '尚未向来源回执', '事件阻断或待回调时，不得写“处理完毕”']]);
checks.push(['automation capability is layered before human handoff', `${read('09-自动化授权与风险分级.md')}\n${read('06-复盘与优化规则.md')}`, ['命令行层', '浏览器层', '原生窗口层', '项目专用层', '`ADAPTER_FAILURE`', '`CAPABILITY_UNAVAILABLE`', '`TEST_ASSET_MISSING`', '`HUMAN_JUDGMENT_REQUIRED`', '读取适用 Skill', '首选路径和一个明确备用路径', '能力证据表', '单个适配器错误或缺少测试资产不得单独结束 Goal']]);
checks.push(['natural-language routing uses a minimal scenario pack', `${read('00-第二代工作流总览.md')}\n${read('02-总指挥核心规则.md')}\n${read('10-自动状态索引规范.md')}`, ['自然语言入口与场景提示词按需加载', '只加载一个最匹配的场景提示词包', '有限候选', '无法判断', 'loaded_sections', 'route_confidence']]);
checks.push(['legacy tasks migrate with dual-read single-write', `${read('04-状态、目标变更与交接规范.md')}\n${read('10-自动状态索引规范.md')}`, ['场景路由与旧任务兼容过渡', '双读、单写', 'LEGACY_READABLE', 'MIGRATION_REQUIRED', 'MIGRATED', 'MIGRATION_BLOCKED', '不得被静默重启']]);
checks.push(['independent review requires evidence-complete reading', `${read('docs/EXECUTION_AND_INDEPENDENT_REVIEW.md')}\n${read('06-复盘与优化规则.md')}\n${fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8')}`, ['必要正文', '`UNKNOWN/INCOMPLETE_REVIEW`', '读取清单、证据指针', 'REVIEW_COMPLETED', '不得输出“审查通过”']]);
checks.push(['recurrence triage requires a permanent measure', `${read('02-总指挥核心规则.md')}\n${read('06-复盘与优化规则.md')}`, ['故障复发性与永久修复门禁', '一次性环境因素', '可复现的操作失误', '系统性流程缺口', '永久措施', '回归验证']]);
checks.push(['Goal acceptance evidence and raw platform states stay bounded', `${read('01-操作者操作手册.md')}\n${read('02-总指挥核心规则.md')}\n${read('04-状态、目标变更与交接规范.md')}\n${read('10-自动状态索引规范.md')}`, ['AUTO_VERIFIABLE', 'VISUAL_REVIEW', 'PROXY_ONLY', 'HUMAN_OR_PROFESSIONAL_GATE', '没有严格量化定义的自然语言目标', '有界试验或可逆替代', '平台原始状态：保留客户端或工具实际返回值', '来源项目归属核验']]);
checks.push(['handoff obeys current-turn precedence and formal route', `${read('01-操作者操作手册.md')}\n${read('02-总指挥核心规则.md')}\n${read('04-状态、目标变更与交接规范.md')}\n${fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8')}`, ['自然语言在这里仅是路由信号，不是交接快照授权', '上一轮“下一轮再交接”等说法只保留为背景', '不得仅凭历史意图生成正式快照', '当前轮优先于历史时序约定', '自然语言不构成捷径', '必须补齐 1C/1D 的预检、收口核账、快照交付', '不存在“场景 EC”', '1B 预处理']]);
checks.push(['handoff closeout distinguishes pending work from blockers', read('04-状态、目标变更与交接规范.md'), ['收口”是把执行中或结果未知的动作停在安全原子边界', '普通未完成项只要有状态、责任对象、精确断点、下一行动和失效条件', '高风险动作未安全停止', '必须 `BLOCKED`']]);
checks.push(['handoff content reconciles before sealing', `${read('01-操作者操作手册.md')}\n${read('04-状态、目标变更与交接规范.md')}`, ['内容一致性回读', '中央 CURRENT、AI 状态索引、实际 Git/工作区/远端', '旧编号、旧世代、旧工作区计数或交付状态残留', '封条或哈希通过不能代替', '以候选当前消息实际收到附件作为送达事实']]);
checks.push(['handoff preflight closes before snapshot', `${read('01-操作者操作手册.md')}\n${read('02-总指挥核心规则.md')}\n${read('总指挥轻量交接启动配置.md')}`, ['场景 1B：交接预处理与收口判断', '不生成 `final-*`', '不存在“场景 EC”', '1B→1C', '本地与远端尚未同步', '低风险、可回滚']]);
checks.push(['handoff identity gate rejects mis-sent commander prompt', `${read('00-第二代工作流总览.md')}\n${read('01-操作者操作手册.md')}\n${read('02-总指挥核心规则.md')}`, ['1C 是总指挥必经入口并自带最小可行性预检和身份硬门禁', '当前窗口不是总指挥，可能误发了场景 1C', '不得生成、覆盖、删除 `final-*`', '普通或专项任务即使收到 1C 提示词，也不得升级身份', '改用场景 1E/1F']]);
checks.push(['handoff continuation and scoped automation', `${read('01-操作者操作手册.md')}\n${read('02-总指挥核心规则.md')}`, ['“继续”只有在上一轮明确给出可进入下一阶段且当前基线未漂移时才沿用', '只记录与本任务或项目有明确绑定证据的自动化', '不得扫描或列出账户级、其他项目或无绑定证据的自动化', '无；未扫描账户级任务']]);
checks.push(['handoff baseline separates pinned snapshot, live epoch and adoption record', `${read('01-操作者操作手册.md')}\n${read('04-状态、目标变更与交接规范.md')}\n${read('总指挥轻量交接启动配置.md')}\n${read('交接阶段矩阵.md')}\n${read('07-总指挥交接记录模板.md')}`, ['候选 `rule_baseline` 快照', '公共规则源 `live_rule_epoch`', '项目登记采用记录', '`RULE_REBASE_PENDING`', '`NEWER_COMPATIBLE`', '`AFFECTED_RECHECK`', '`SUPERSEDED_BY_RULE_REBASE`', '不要求操作者选择旧/新版本']]);
checks.push(['workflow enablement does not confuse rule source with project adoption', `${read('../工作流启用声明.md')}\n${fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8')}\n${read('规则刷新广播包.md')}\n${read('规则刷新接收回执模板.md')}`, ['RULE_SOURCE_STATUS', 'PROJECT_ADOPTION_RECORD', '项目登记旧指纹或待同步不否定规则刷新', 'RULE_ADOPTION_RECORD：SYNCED / SYNC_PENDING', '只有依赖控制面的动作标记 `UNKNOWN/BLOCKED`']]);
checks.push(['handoff verification is executable and layered', `${read('07-总指挥交接记录模板.md')}\n${read('01-操作者操作手册.md')}`, ['封条验证入口', '直接使用其中的完整命令', '`INPUT_REQUIRED`', '不得把调用缺参写成来源损坏']]);
checks.push(['handoff candidate reply is human-first', `${read('01-操作者操作手册.md')}\n${read('04-状态、目标变更与交接规范.md')}\n${read('总指挥轻量交接启动配置.md')}\n${read('07-总指挥交接记录模板.md')}`, ['默认先用四句人话回答', '真正阻断', '默认不展示机器字段', '只有操作者明确要求技术细节', '不得把 `NOT_RUN`、`GENERATED_NOT_DELIVERED`', '不阻止当前候选阶段，写入“补充限制”而不是“真正阻断”', '下列字段只供机器记录和异常定位']]);
checks.push(['handoff preflight is first gate and candidate is unique', `${read('04-状态、目标变更与交接规范.md')}\n${read('10-自动状态索引规范.md')}\n${read('06-复盘与优化规则.md')}`, ['把 `preflight_only` 当作第一道机器门', '固定 `fact_cutoff`', 'SUPERSEDED', '有限重试和退避', '当前唯一 active candidate', '附件与封条保持两阶段']]);
checks.push(['handoff scoring separates control confidence from switch and acceptance states', `${read('04-状态、目标变更与交接规范.md')}\n${read('总指挥轻量交接启动配置.md')}`, ['控制面必要证据全部通过且没有真实控制面冲突或缺口时必须记为 `HIGH`', '候选阶段旧写者 `IDLE/UNKNOWN`', '运行/专业状态 `UNKNOWN/NOT_RUN/FAIL` 不得降低控制面评分', '“尚未正式切换”本身不是降分理由']]);
checks.push(['goal handoff stops business execution and verifies available platform controls', read('01-操作者操作手册.md'), ['不得开始新的业务步骤', '平台恢复成功', '不能把该命令作为跨版本通用恢复方式', '确认平台已暂停', '暂停后才执行收口', '没有我的“恢复 Goal”或“从断点继续”指令及平台恢复证据，不得恢复']]);
checks.push(['goal preparation separates draft permissions and optional role use from launch', read('01-操作者操作手册.md'), ['场景 Gen1.1', '场景 Gen1.2', '场景 Gen1.3：暂停、恢复与交接收口', '不把草稿或附件中的允许操作当成本轮业务授权', '不在本轮安装', '不因此阻断审查', '已激活或已执行角色任务', '登记缺项不等于未安装', '旧模板仍叫“身份赋予”', '不是 Goal 启动的前置条件']]);
checks.push(['goal handoff has a platform pause gate', `${read('01-操作者操作手册.md')}\n${read('04-状态、目标变更与交接规范.md')}\n${read('交接阶段矩阵.md')}\n${read('07-总指挥交接记录模板.md')}\n${read('10-自动状态索引规范.md')}`, ['PAUSE_REQUIRED', 'PAUSED', 'Goal 交接权限', 'CLOSEOUT_ONLY', '交接材料生成并回读成功后必须为 `NONE`', '不能覆盖上述平台状态']]);
checks.push(['final status separates exclusions from open work', `${read('02-总指挥核心规则.md')}\n${read('03-专项任务卡模板.md')}\n${read('06-复盘与优化规则.md')}`, ['排除项反查', '`EXCLUDED`', '`CANCELLED`', '`SUPERSEDED`', '不得出现在“未完成项、待办或下一步”中']]);
const goalBudget = read('05-模型选择与资源策略.md');
checks.push(['Goal continuation has a usable operator entry', read('01-操作者操作手册.md'), ['问题解决后恢复', '周期到限后继续', '追加预算也用完时', '只准备下一周期，不立即执行', '不记为违规的“14/10”']]);
checks.push(['Goal repeated limits require bounded approval and preserve history', goalBudget, ['追加周期也到限时重复审查与批准流程', '不混用两种记账方式', '执行前在既有获准记录保存批准依据', '最新明确批准的新周期预算约束当前执行']]);
checks.push(['Goal approval and platform recovery are separate', read('01-操作者操作手册.md'), ['文本批准不保证平台自动恢复', '客户端独立硬限额', '只说“继续”或点击恢复按钮，不自动增加预算', '状态未知时不声称已恢复']]);
checks.push(['unselected permission menu is not an authorization', goalBudget, ['旧权限菜单未选择而原样发送时', '不视为全选', '删除整个栏目仍只沿用已有授权']]);
checks.push(['Goal recovery or window change does not reset a cycle', goalBudget, ['都不自动开始新工作周期', '不默认归零', '明确暂停不计时但不清零', '不能修改平台 Goal 的持久预算']]);
checks.push(['new cycle cannot repeat exhausted failed methods', goalBudget, ['操作者明确批准新工作周期的目标与预算后', '保留上周期记录及关联', '不因周期预算更新获准重复旧失败方法', '硬上限不得绕过']]);
checks.push(['manual step pauses only dependent work', read('01-操作者操作手册.md'), ['只暂停依赖该问题的步骤', '没有安全且有意义的已授权工作可继续时才收口', '总预算到限按各自规则停止']]);
checks.push(['prompt language review stays in the existing workflow', read('06-复盘与优化规则.md'), ['文档质量检查并入现有生成、验证和审查流程，不新增审批层', '谁执行、执行什么、针对什么对象、在什么条件下执行', '作者从操作者角度完整读一遍实际复制块', '润色没有改变权限、停止条件和验证义务', '不能证明语言正确']]);
checks.push(['unavailable quota opt-out is explicit and scoped', `${read('01-操作者操作手册.md')}\n${read('05-模型选择与资源策略.md')}`, ['当无法查看额度时，允许忽略依赖额度读数的停止项', '不能仅因API登录或读取失败推定已有许可', '没有这项许可时，按原额度保护约定安全收口', '不新增费用或高资源权限', '不把缺失期间的用量记为零', '额度读取失败时按上面的明确许可处理，不因此单独停止']]);
checks.push(['quota direction and reset preserve task budget', read('05-模型选择与资源策略.md'), ['usedPercent', '100-usedPercent', 'rateLimitsByLimitId', 'windowDurationMins', 'resetsAt', '禁止取绝对差', '已用22%→42%等于剩余78%→58%', '剩余22%→100%不构成78个百分点消耗', '不把不同池差值相加', '不能清零预算', '新观测段不重复计算此前增量', '重置间未采到的消耗记 `UNKNOWN`', '已知累计已到限仍停止', '有限数值必须在0至100范围内']]);
checks.push(['quota inspection preserves fixed epoch and recovery boundaries', read('05-模型选择与资源策略.md'), ['Inspect-QuotaProtection.mjs', '固定锚点不能随相邻读数滑移', '同时间不同读数', '恢复必须提供原 `nextState`', '不得用初始化清零', '`nextState:null` 不覆盖旧可靠状态', '数值归一、比较及累计统一到小数点后9位', '不能覆盖可核到限、冻结、权限或其他停止门', '省略账号/池的终点不能写成这些字段也已直接核到']]);
checks.push(['Goal quality gates calibrate early and pause only dependent work', read('02-总指挥核心规则.md'), ['### Goal质量反馈节点', '大量迭代前校准质量', '不固定每轮问人', '确需人的判断才转2E', '等待标签不证明平台暂停', '必需验收未满足不complete', '累计预算与终止交付仍按05']]);
checks.push(['verification cadence preserves real runtime, counterexamples and valid evidence', read('docs/AUTOMATED_TESTING_LESSONS.md'), ['### 2.5 验证时机与证据复用', '不等于每消息、每命令或每轮全量重测', '无关版本标签变化不使全部证据失效', '对应真实产物/入口核验', 'Bug修复后立即匹配回归', '不代签自然路径', '受影响旧结论暂不作为验收依据', '不新增平行账本或固定测试轮']]);
checks.push(['Goal templates plan quality nodes and distinguish active continuation from paused recovery', read('01-操作者操作手册.md'), ['详细触发与最小判断包见02', '准备可预见的质量校准、自动验证和人工触发节点', '每个完整工作批次按变更影响和证据缺口', '且没有人工暂停、交接或等待你明确继续的要求时', '只有你明确要求继续、平台恢复已实际核验', '不代替你解除暂停，不清零预算']]);
checks.push(['5A shares all operator inputs with readable originals and transparent exceptions', read('docs/EXECUTION_AND_INDEPENDENT_REVIEW.md'), ['### 1.4 场景5A的原始要求与参考资料对等', '全部附件、本地路径、网页链接、截图及其他参考资料', '作者的分析、推断与原文分开', '共享原件，不只共享总结', '逐项说明收到、可读取或具体缺口', '不证明材料已读', '新增资料同步，稳定材料复用', '不清零轮次', '不新建平行账本', '资料可读不等于可外发', '只限制依赖部分']]);
checks.push(['5A template and dispatch distinguish minimal authorization evidence from full reference sharing', `${read('01-操作者操作手册.md')}\n${read('02-总指挥核心规则.md')}\n${read('09-自动化授权与风险分级.md')}`, ['按协作规范1.4', '对方实际可读且版本绑定的入口', '不能只转述你的总结', '新增资料及时同步', '不转发受禁止外发的原件', '不以摘要代原件', '授权核验的最小摘录不替代讨论所需原件共享']]);
let failed = 0;
checks.push(['manual candidate and final prompts retain the pre-stop readback gate', read('01-操作者操作手册.md'), ['不要仅凭 READY 或材料置信度高提示我停旧', '先按轻量配置完成停旧前轮换准备及候选回读', '有本轮有效通信授权才可自动联络', '同时回读停旧前已经准备、已由本候选确认的匹配轮换票据', '不事后补造或倒填']]);
checks.push(['lightweight entry separates material readiness from stopping', read('总指挥轻量交接启动配置.md'), ['`status=READY / READY_WITH_RESTRICTIONS` 只表示材料通过', '`rotation.status=MATCHED`、`can_stop_old=true`', '正常 `NOT_PREPARED` 只表示下一步由旧写者准备', '由 AI 填好完整轮换准备请求']]);
checks.push(['rotation recovery preserves source immutability and fresh stop confirmation', read('04-状态、目标变更与交接规范.md'), ['停旧前轮换准备与过早停旧的恢复', '票据和运输回执均不写入已被封条覆盖的来源', '不能代替修复完成后的新确认', '不自行授予跨任务发送权限']]);
checks.push(['workflow regression is wired into the real repository quality entry', fs.readFileSync(path.join(root, '.github/scripts/Test-Repository.ps1'), 'utf8'), ["& node (Join-Path $PSScriptRoot 'Test-Verify-Handoff-Candidate.mjs')", "if ($LASTEXITCODE -ne 0) { throw '候选材料与停旧前轮换准备组合检查失败。' }"]]);
checks.push(['in-flight scope preserves strict defaults and live source separation', read('04-状态、目标变更与交接规范.md'), ['在途专项与交接保护范围', 'git-scoped-index-worktree-sha256-v2', 'ownership_source_ref', '候选不能临时扩大排除范围', '分别核验 Git 索引与工作树', '旧票据恢复只登记旧来源漂移', '旧封条、票据及恢复记录不改签', '交接保存可靠阶段观察']]);
checks.push(['scope behavioral regression is part of repository quality', fs.readFileSync(path.join(root, '.github/scripts/Test-Repository.ps1'), 'utf8'), ["& node (Join-Path $PSScriptRoot 'Test-HandoffWorkspaceScope.mjs')"]]);
for (const [name, text, needles] of checks) {
  const missing = needles.filter(needle => !text.includes(needle));
  if (missing.length) { failed += 1; console.error(`FAIL: ${name}: missing ${missing.join(', ')}`); }
  else console.log(`PASS: ${name}`);
}
const syntheticRoute = ({ workflowReview, sourceBusiness, operatorAuthorized = false }) => ({
  workflow: workflowReview ? 'PROCESS_READ_ONLY' : 'NONE',
  business: sourceBusiness ? (operatorAuthorized ? 'AUTHORIZED_SCOPED' : 'BLOCKED') : 'NONE'
});
const routeCases = [
  ['pure source business', { workflowReview: false, sourceBusiness: true }, { workflow: 'NONE', business: 'BLOCKED' }],
  ['pure public workflow review', { workflowReview: true, sourceBusiness: false }, { workflow: 'PROCESS_READ_ONLY', business: 'NONE' }],
  ['mixed workflow and source business', { workflowReview: true, sourceBusiness: true }, { workflow: 'PROCESS_READ_ONLY', business: 'BLOCKED' }],
  ['direct operator authorization scopes source business', { workflowReview: false, sourceBusiness: true, operatorAuthorized: true }, { workflow: 'NONE', business: 'AUTHORIZED_SCOPED' }],
  ['direct operator authorization may accompany workflow review', { workflowReview: true, sourceBusiness: true, operatorAuthorized: true }, { workflow: 'PROCESS_READ_ONLY', business: 'AUTHORIZED_SCOPED' }]
];
for (const [name, input, expected] of routeCases) {
  const actual = syntheticRoute(input);
  if (actual.workflow !== expected.workflow || actual.business !== expected.business) {
    failed += 1;
    console.error(`FAIL: synthetic cross-task route ${name}`);
  } else console.log(`PASS: synthetic cross-task route ${name}`);
}
if (!failed) console.log('PASS: cross-task route cases are synthetic contract checks, not live Agent behavior');
const receiptOutcome = ({ operatorFeedback, sourceReplyAuth, sourceReplyResult, finalText }) => {
  if (!operatorFeedback || !finalText?.trim()) return 'OUTPUT_UNVERIFIED/BLOCKED';
  if (sourceReplyAuth && !sourceReplyResult) return 'BLOCKED';
  if (!sourceReplyAuth) return 'LOCAL_FEEDBACK_ONLY';
  return sourceReplyResult;
};
const receiptCases = [
  ['no source authorization still reports locally', { operatorFeedback: true, sourceReplyAuth: false, finalText: '已收到，未向来源回执。' }, 'LOCAL_FEEDBACK_ONLY'],
  ['missing operator feedback blocks even with tool success', { operatorFeedback: false, sourceReplyAuth: true, sourceReplyResult: 'COMPLETED', finalText: '' }, 'OUTPUT_UNVERIFIED/BLOCKED'],
  ['blank final text cannot close a successful tool call', { operatorFeedback: true, sourceReplyAuth: true, sourceReplyResult: 'COMPLETED', finalText: '   ' }, 'OUTPUT_UNVERIFIED/BLOCKED'],
  ['send tool failure remains a failed source route', { operatorFeedback: true, sourceReplyAuth: true, sourceReplyResult: 'FAILED', finalText: '已收到，向来源回执失败。' }, 'FAILED'],
  ['valid two-channel completion remains reportable', { operatorFeedback: true, sourceReplyAuth: true, sourceReplyResult: 'COMPLETED', finalText: '已收到并完成处理。' }, 'COMPLETED']
];
for (const [name, input, expected] of receiptCases) {
  const actual = receiptOutcome(input);
  if (actual !== expected) { failed += 1; console.error(`FAIL: synthetic cross-task receipt ${name}: ${actual} <> ${expected}`); }
  else console.log(`PASS: synthetic cross-task receipt ${name}`);
}
if (!failed) console.log('PASS: cross-task receipt cases are synthetic contract checks, not live Agent behavior');
const rebaseOutcome = ({ sourceStable, impact, rebasePass }) => {
  if (!sourceStable) return 'REBASE_BLOCKED';
  if (!rebasePass) return 'REBASE_BLOCKED';
  return impact === 'identity-permission-security' ? 'REBASE_REQUIRED' : 'REBASED';
};
const rebaseCases = [
  ['stable compatible update rebases automatically', { sourceStable: true, impact: 'documentation', rebasePass: true }, 'REBASED'],
  ['identity or security change requires affected-stage recheck', { sourceStable: true, impact: 'identity-permission-security', rebasePass: true }, 'REBASE_REQUIRED'],
  ['unstable source blocks only rebase-dependent stage', { sourceStable: false, impact: 'documentation', rebasePass: false }, 'REBASE_BLOCKED'],
  ['failed rebase never preserves old ready state', { sourceStable: true, impact: 'documentation', rebasePass: false }, 'REBASE_BLOCKED']
];
for (const [name, input, expected] of rebaseCases) {
  const actual = rebaseOutcome(input);
  if (actual !== expected) { failed += 1; console.error(`FAIL: synthetic rule rebase ${name}: ${actual} <> ${expected}`); }
  else console.log(`PASS: synthetic rule rebase ${name}`);
}
if (!failed) console.log('PASS: rule rebase cases are synthetic contract checks, not live Agent behavior');
if (failed) process.exit(1);
const scoreControlConfidence = ({ controlEvidence, switchStatus, oldWriterStatus, editorBuffer, runtime, professional }) => {
  if (controlEvidence !== 'PASS') return 'MEDIUM';
  return 'HIGH';
};
const scoreCases = [
  ['complete control evidence with candidate-only restrictions stays HIGH', {
    controlEvidence: 'PASS', switchStatus: 'READY_WITH_RESTRICTIONS', oldWriterStatus: 'IDLE', editorBuffer: 'UNKNOWN', runtime: 'UNKNOWN', professional: 'FAIL'
  }, 'HIGH'],
  ['control evidence conflict is not promoted to HIGH', {
    controlEvidence: 'CONFLICT', switchStatus: 'READY_WITH_RESTRICTIONS', oldWriterStatus: 'IDLE', editorBuffer: 'UNKNOWN', runtime: 'UNKNOWN', professional: 'NOT_RUN'
  }, 'MEDIUM']
];
for (const [name, input, expected] of scoreCases) {
  const actual = scoreControlConfidence(input);
  if (actual !== expected) { failed += 1; console.error(`FAIL: synthetic handoff score ${name}: ${actual} <> ${expected}`); }
  else console.log(`PASS: synthetic handoff score ${name}`);
}
if (failed) process.exit(1);
console.log('PASS: handoff score cases are synthetic contract checks, not live Agent behavior');
const goalHandoffDecision = ({ platform, permission, output }) => {
  if (platform === 'ACTIVE' || platform === 'UNKNOWN') return 'PAUSE_REQUIRED';
  if ((output === 'MATERIAL_PREPARED' || output === 'GENERATED_NOT_DELIVERED') && platform !== 'PAUSED' && platform !== 'CLEARED') return 'PAUSE_REQUIRED';
  if (output === 'MATERIAL_PREPARED' && platform === 'PAUSED' && permission === 'CLOSEOUT_ONLY') return 'CLOSEOUT_ONLY';
  if (output === 'GENERATED_NOT_DELIVERED' && permission === 'BUSINESS_ALLOWED') return 'INVALID';
  if (output === 'GENERATED_NOT_DELIVERED' && permission === 'NONE') return 'NONE';
  return permission;
};
const goalHandoffCases = [
  ['active platform cannot continue after handoff request', { platform: 'ACTIVE', permission: 'BUSINESS_ALLOWED', output: 'MATERIAL_PREPARED' }, 'PAUSE_REQUIRED'],
  ['paused platform may only close out', { platform: 'PAUSED', permission: 'CLOSEOUT_ONLY', output: 'MATERIAL_PREPARED' }, 'CLOSEOUT_ONLY'],
  ['generated material leaves old Goal terminal', { platform: 'PAUSED', permission: 'NONE', output: 'GENERATED_NOT_DELIVERED' }, 'NONE'],
  ['unknown platform state cannot authorize continuation', { platform: 'UNKNOWN', permission: 'BUSINESS_ALLOWED', output: 'GENERATED_NOT_DELIVERED' }, 'PAUSE_REQUIRED']
];
for (const [name, input, expected] of goalHandoffCases) {
  const actual = goalHandoffDecision(input);
  if (actual !== expected) { failed += 1; console.error(`FAIL: synthetic Goal handoff gate ${name}: ${actual} <> ${expected}`); }
  else console.log(`PASS: synthetic Goal handoff gate ${name}`);
}
if (failed) process.exit(1);
console.log('PASS: Goal handoff gate cases are synthetic contract checks, not live platform control');
const diagnosticDocs = `${read('00-第二代工作流总览.md')}\n${read('01-操作者操作手册.md')}\n${read('02-总指挥核心规则.md')}\n${read('docs/PIPELINE_DIAGNOSIS_AND_ALGORITHM_TUNING_STANDARD.md')}`;
if (diagnosticDocs.includes('默认交付紧凑文本执行图') || diagnosticDocs.includes('排查的基础交付必须先确认实际运行身份，再给')) {
  console.error('FAIL: diagnosis still requires a diagram before the finding or repair');
  process.exit(1);
}
console.log('PASS: diagnosis does not require a diagram before findings or repair');
const coreRules = read('02-总指挥核心规则.md');
const diagnosisEntry = coreRules.match(/^9\. 命中“输出异常的链路排查触发门禁”时，(.+)$/m)?.[1];
const diagnosisMethod = coreRules.match(/^1\. 输出质量不符合预期时，(.+)$/m)?.[1];
const diagnosisCollaboration = coreRules.match(/^5\. 操作者可以只用日常语言描述现象或“不确定”。(.+)$/m)?.[1];
const diagnosisGraph = coreRules.match(/^7\. 排查时先确认实际运行身份；(.+)$/m)?.[1];
if (!diagnosisEntry?.includes('先读取 `docs/PIPELINE_DIAGNOSIS_AND_ALGORITHM_TUNING_STANDARD.md` 的 2.1') ||
    !diagnosisEntry.includes('进入完整 2C 时再完整读取该标准') ||
    diagnosisEntry.startsWith('完整读取') ||
    !diagnosisMethod?.includes('以下第 2-4 条仅在进入完整 2C 后适用') ||
    !diagnosisCollaboration?.includes('进入完整 2C 时逐节点补齐') ||
    !diagnosisGraph?.includes('2E 定点路径记录与异常有关的节点和证据，进入完整 2C 后再建立')) {
  console.error('FAIL: output anomalies must triage through 2.1 before full 2C loading');
  process.exit(1);
}
console.log('PASS: output anomalies do not force full 2C loading');
const bilateralRoute = coreRules.match(/^\| 双方有尚未相互包含且需保留的有效成果，当前确需汇合 \| (.+) \|$/m)?.[1];
if (!bilateralRoute?.startsWith('进入 4I 方案') ||
    !coreRules.includes('不调用 4I') ||
    !coreRules.includes('评估是否调用 4I') ||
    !coreRules.includes('旧 2D 汇合归入 4I') ||
    !coreRules.includes('按证据进入完整 2C 时再完整读取该标准')) {
  console.error('FAIL: bilateral integration must route to 4I while legacy aliases and full 2C remain available');
  process.exit(1);
}
console.log('PASS: bilateral integration routes to 4I with legacy compatibility');
const modelSuggestions = read('01-操作者操作手册.md').split(/\r?\n/).filter(line => line.includes('**模型建议：**'));
const unversionedSuggestions = modelSuggestions.filter(line => /\b(?:Sol|Luna|Astra|Terra)\b/.test(line.replace(/GPT-\d+(?:\.\d+)? (?:Sol|Luna|Astra|Terra)\b/g, '')));
if (modelSuggestions.length < 40 || unversionedSuggestions.length) {
  console.error(`FAIL: model suggestions need explicit versions (${modelSuggestions.length} found, ${unversionedSuggestions.length} ambiguous)`);
  process.exit(1);
}
console.log(`PASS: model suggestions name their version (${modelSuggestions.length} scenarios)`);
const v3SourceRef = schema.allOf?.find(rule => rule.if?.properties?.schema_version?.const === 3)?.then?.properties?.sources?.additionalProperties?.$ref;
if (schema.properties?.sources?.additionalProperties?.$ref !== '#/$defs/source' || v3SourceRef !== '#/$defs/sourceV3') {
  console.error('FAIL: schema must keep legacy source compatibility and bind v3 sources to sourceV3');
  process.exit(1);
}
const matrix = read('交接阶段矩阵.md');
if (matrix.includes('候选材料状态') || !matrix.includes('只能描述第六行')) {
  console.error('FAIL: matrix retains mixed status dimensions or stale row reference');
  process.exit(1);
}
const broadcast = read('规则刷新广播包.md');
if (broadcast.includes('发送方事件封套模板') || broadcast.includes('规则 manifest SHA-256：<预期摘要>')) {
  console.error('FAIL: operator broadcast still requires a technical event envelope');
  process.exit(1);
}
const manifestPath = path.join(workflow, '规则刷新manifest.json');
const manifestBytes = fs.readFileSync(manifestPath);
const manifest = JSON.parse(manifestBytes.toString('utf8'));
const versionedRules = ['00-第二代工作流总览.md', '02-总指挥核心规则.md', '09-自动化授权与风险分级.md', '10-自动状态索引规范.md', '总指挥轻量交接启动配置.md'];
const versions = versionedRules.map(name => read(name).match(/^版本：(\d{4}-\d{2}-\d{2}\.\d+)$/m)?.[1]);
if (manifest.schema_version !== 1 || !Array.isArray(manifest.rules) || !manifest.rule_version || manifest.scope !== 'core_workflow_full' || manifest.path_base !== 'rule_root' || manifest.repository_root_ref !== '../..' || !Array.isArray(manifest.repository_root_prefixes) || !['.github/', '引用的外部工具/'].every(prefix => manifest.repository_root_prefixes.includes(prefix))) {
  console.error('FAIL: rule refresh manifest must declare schema, version, full core scope, dual-root path bases and a rules array');
  process.exit(1);
}
if (versions.some(version => version !== manifest.rule_version)) {
  console.error(`FAIL: rule version and manifest version differ: ${versions.join(', ')} <> ${manifest.rule_version}`);
  process.exit(1);
}
for (const required of REFRESH_REQUIRED_RULES) {
  const item = required.endsWith('-')
    ? manifest.rules.find(entry => entry.path_ref.startsWith(required))
    : manifest.rules.find(entry => entry.path_ref === required);
  if (!item) {
    console.error(`FAIL: rule refresh manifest missing full workflow entry: ${required}`);
    process.exit(1);
  }
}
for (const item of manifest.rules) {
  const base = manifest.repository_root_prefixes.some(prefix => item.path_ref.startsWith(prefix))
    ? path.resolve(workflow, manifest.repository_root_ref)
    : workflow;
  const absolute = path.resolve(base, item.path_ref);
  if (!absolute.startsWith(`${base}${path.sep}`) || !fs.existsSync(absolute) || item.sha256 !== sha256(fs.readFileSync(absolute))) {
    console.error(`FAIL: rule refresh manifest digest mismatch: ${item.path_ref}`);
    process.exit(1);
  }
}
console.log(`Rule refresh manifest: PASS (${sha256(manifestBytes)})`);
const managedPaths = manifest.rules.map(item => manifest.repository_root_prefixes.some(prefix => item.path_ref.startsWith(prefix))
  ? item.path_ref : `总指挥工作流/第二代总指挥的工作模式/${item.path_ref}`);
managedPaths.push('总指挥工作流/第二代总指挥的工作模式/规则刷新manifest.json');
const attrs = spawnSync('git', ['check-attr', '-z', '--stdin', 'eol'], { cwd: root, input: `${managedPaths.join('\0')}\0`, encoding: 'utf8' });
const fields = attrs.stdout?.split('\0') || [];
if (attrs.status !== 0 || fields.length !== managedPaths.length * 3 + 1 || managedPaths.some((file, index) =>
  fields[index * 3] !== file || fields[index * 3 + 1] !== 'eol' || fields[index * 3 + 2] !== 'lf' ||
  fs.readFileSync(path.join(root, file)).includes(13))) {
  console.error('FAIL: every raw-hash-managed file must use LF bytes and an explicit LF checkout attribute');
  process.exit(1);
}
console.log(`Managed checkout line endings: PASS (${managedPaths.length} files)`);
console.log(`Workflow refresh contract: PASS (${checks.length} cases)`);
