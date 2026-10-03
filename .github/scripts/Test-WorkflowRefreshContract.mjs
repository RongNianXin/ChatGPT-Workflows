import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const workflow = path.join(root, '总指挥工作流', '第二代总指挥的工作模式');
const read = name => fs.readFileSync(path.join(workflow, name), 'utf8');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex').toUpperCase();
const schema = JSON.parse(fs.readFileSync(path.join(workflow, 'templates', 'HANDOFF_STATE.schema.json'), 'utf8'));
const REFRESH_REQUIRED_RULES = [
  '.github/scripts/HandoffSeal.mjs',
  '.github/scripts/Prepare-Handoff.mjs',
  '.github/scripts/Mark-Handoff-Delivered.mjs',
  ...Array.from({ length: 12 }, (_, index) => `${String(index).padStart(2, '0')}-`),
  '总指挥轻量交接启动配置.md',
  '规则刷新广播包.md',
  '规则刷新接收回执模板.md'
];
const checks = [
  ['matrix separates logical and machine phases', read('交接阶段矩阵.md'), ['逻辑交接阶段', '封条阶段', '附件交付状态', '候选核验状态']],
  ['broadcast is load-only and self-describing', read('规则刷新广播包.md'), ['规则广播只做一件事', '规则更新指令 + 第二代规则路径', '不需要手工填写 `RULE_REFRESH_ID`', '项目问题另列待办', '规则根向上两级得到的仓库根', '以 `.github/` 开头']],
  ['broadcast limits failure to rule-root faults', read('规则刷新广播包.md'), ['路径不可访问', '必需文件缺失', '哈希不一致', '更高优先级规则冲突', '不得触发 `WARN/BLOCKED`']],
  ['broadcast requires a frozen source', read('规则刷新广播包.md'), ['广播前冻结门禁', '不得一边修改同一规则根一边要求其他总指挥刷新', '立即取消本批']],
  ['manual bootstrap carries the dual-root manifest rule', read('01-操作者操作手册.md'), ['不需要填写事件编号、哈希、版本、变化清单或写入范围', '这是操作者下达的规则更新指令', '【第二代总指挥工作模式的实际路径】', '本次只更新规则，不做项目体检、配置迁移或交接', '以 `.github/` 开头的文件，按规则根向上两级得到的仓库根读取', '不得复制文件，也不得把所有条目都拼到同一个根目录', '长期人工兜底模板', '不必随版本号、manifest 摘要或接收者身份改写']],
  ['receipt is minimal pass or fail', read('规则刷新接收回执模板.md'), ['正常成功只回复', 'result：PASS', 'result：FAIL', '规则加载结果不使用 `WARN/BLOCKED`']],
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
checks.push(['feedback triages before costly 2C and repairs within scope', `${read('01-操作者操作手册.md')}\n${read('docs/PIPELINE_DIAGNOSIS_AND_ALGORITHM_TUNING_STANDARD.md')}`, ['先描述现象；AI 定点核对后决定是否进入 2C', '最小定点核对后仍无法定位', '原因及修复边界已有可靠证据的，在现有授权内局部修复与回归', '已有同一问题的修复授权时直接修复与回归', '仅报结果且没有开放目标', '一次列明拟改范围、影响和验证以请求差额授权']]);
checks.push(['workflow entry points load triage before full diagnosis', `${read('00-第二代工作流总览.md')}\n${read('02-总指挥核心规则.md')}\n${read('docs/WORKFLOW_OVERVIEW.md')}`, ['先读 `docs/PIPELINE_DIAGNOSIS_AND_ALGORITHM_TUNING_STANDARD.md` 的 2.1 做最小分流', '先读取 `docs/PIPELINE_DIAGNOSIS_AND_ALGORITHM_TUNING_STANDARD.md` 的 2.1 并完成最小定点核对', '2E 失败反馈先按 2.1 最小分流']]);
checks.push(['diagnosis keeps node-level evidence while reporting results first', `${read('00-第二代工作流总览.md')}\n${read('01-操作者操作手册.md')}\n${read('docs/PIPELINE_DIAGNOSIS_AND_ALGORITHM_TUNING_STANDARD.md')}`, ['逐项核对输入、处理、输出、不变量、观测证据和失败信号', '可证伪对照验证根因', '默认先报告复现和版本', '完整节点和证据留在工作项中供回查', '复杂分叉、证据争议']]);
checks.push(['diagnosis references resolve to the current section', `${read('02-总指挥核心规则.md')}\n${read('06-复盘与优化规则.md')}\n${read('docs/PIPELINE_DIAGNOSIS_AND_ALGORITHM_TUNING_STANDARD.md')}`, ['#21-2e-分流与-2c-连续执行', '<a id="21-2e-分流与-2c-连续执行"></a>']]);
checks.push(['bounded test scenario is distinct from feedback, diagnosis and legacy 2G', `${read('00-第二代工作流总览.md')}\n${read('01-操作者操作手册.md')}\n${read('02-总指挥核心规则.md')}`, ['场景 2G：用真实数据做有界自动测试、修复和复测', '旧版精简提示词的“2G”按内容和规则版本映射到当前 2B', '2E 用于反馈你已经观察到的结果；2C 是原因不明时的逐节点查因方法', '收到当前版 2G 的真实数据有界测试请求时走 2G', '可终止本轮进程及其子进程', '不因重试、换卡或切换窗口重置', '质量标准无法直接核验、又无可靠真值或必要人工确认时']]);
checks.push(['cross-task receipt is an executable hard gate', `${read('02-总指挥核心规则.md')}\n${read('09-自动化授权与风险分级.md')}\n${fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8')}`, ['取得处理时隙后的第一项动作必须是实际发送回执并读取工具结果', '回执先行硬门禁（事故回归）', '实际跨任务发送工具', '缺少真实发送证据的事件不得收口', '不得写成已回执']]);
checks.push(['receipt threshold explains content signals and inbound events', `${read('02-总指挥核心规则.md')}\n${read('09-自动化授权与风险分级.md')}\n${fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8')}`, ['场景五/场景 5A–5D', '对抗式反馈', '希望征求建议', '希望帮忙分析', '需要回执', '通信授权', '入站事件']]);
checks.push(['cross-task workflow review routes separately from source business', `${read('09-自动化授权与风险分级.md')}\n${fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8')}`, ['公共工作流审查的正向分流', '按 FIFO 在取得处理时隙后完成最小只读核对', '只提取判断工作流缺陷所需的最小事实', '工作流部分继续处理，专项业务部分单独标记 `BLOCKED`', '没有回执要求时不强制向来源发送消息', '公共工作流审查与来源业务二分', '混合消息必须拆分处理']]);
checks.push(['Goal input boundary is explicit', read('01-操作者操作手册.md'), ['Goal 模板怎么用', '整段代码块一次粘贴', '不要重复粘贴', 'Agency Agents', '不是 Goal 启动的前置条件']]);
checks.push(['cross-project route separates affiliation from operator authorization', `${read('09-自动化授权与风险分级.md')}\n${fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8')}`, ['跨项目默认路由', '本项目 AI / 其他项目 AI / 归属未知', '当前操作者在接收窗口直接明确要求处理来源业务', '来源归属与通信授权分开核验', '其他项目或归属未知的 AI 来信默认进入 `WORKFLOW_FEEDBACK`']]);
checks.push(['cross-window feedback reads accessible material before execution gating', `${fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8')}\n${read('09-自动化授权与风险分级.md')}\n${read('06-复盘与优化规则.md')}`, ['完整取得并阅读当前消息提供的可访问材料', '只读范围内检索互联网', '读取、核验和总结不等于接管来源业务', '来源业务未授权', '缺失材料仍需标为 `INPUT_REQUIRED`']]);
checks.push(['Goal acceptance evidence and raw platform states stay bounded', `${read('01-操作者操作手册.md')}\n${read('02-总指挥核心规则.md')}\n${read('04-状态、目标变更与交接规范.md')}\n${read('10-自动状态索引规范.md')}`, ['AUTO_VERIFIABLE', 'VISUAL_REVIEW', 'PROXY_ONLY', 'HUMAN_OR_PROFESSIONAL_GATE', '没有严格量化定义的自然语言目标', '有界试验或可逆替代', '平台原始状态：保留客户端或工具实际返回值', '来源项目归属核验']]);
checks.push(['handoff obeys current-turn precedence and formal route', `${read('01-操作者操作手册.md')}\n${read('02-总指挥核心规则.md')}\n${read('04-状态、目标变更与交接规范.md')}\n${fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8')}`, ['自然语言在这里仅是路由信号，不是交接快照授权', '上一轮“下一轮再交接”等说法只保留为背景', '不得仅凭历史意图生成正式快照', '当前轮优先于历史时序约定', '自然语言不构成捷径', '必须补齐 1C/1D 的预检、收口核账、快照交付', '不存在“场景 EC”', '1B 预处理']]);
checks.push(['handoff closeout distinguishes pending work from blockers', read('04-状态、目标变更与交接规范.md'), ['收口”是把执行中或结果未知的动作停在安全原子边界', '普通未完成项只要有状态、责任对象、精确断点、下一行动和失效条件', '高风险动作未安全停止', '必须 `BLOCKED`']]);
checks.push(['handoff content reconciles before sealing', `${read('01-操作者操作手册.md')}\n${read('04-状态、目标变更与交接规范.md')}`, ['内容一致性回读', '中央 CURRENT、AI 状态索引、实际 Git/工作区/远端', '旧编号、旧世代、旧工作区计数或交付状态残留', '封条或哈希通过不能代替', '以候选当前消息实际收到附件作为送达事实']]);
checks.push(['handoff preflight closes before snapshot', `${read('01-操作者操作手册.md')}\n${read('02-总指挥核心规则.md')}\n${read('总指挥轻量交接启动配置.md')}`, ['场景 1B：交接预处理与收口判断', '不生成 `final-*`', '不存在“场景 EC”', '1B→1C', '本地与远端尚未同步', '低风险、可回滚']]);
checks.push(['handoff baseline is frozen only until takeover', `${read('01-操作者操作手册.md')}\n${read('04-状态、目标变更与交接规范.md')}\n${read('总指挥轻量交接启动配置.md')}`, ['规则版本和 manifest 必须保持冻结', '当前候选标为 `SUPERSEDED`', '普通进度更新不要求重新生成候选附件', '只有新规则明确改变当前授权、单写者、安全边界或正在进行的高影响动作时']]);
checks.push(['handoff verification is executable and layered', `${read('07-总指挥交接记录模板.md')}\n${read('01-操作者操作手册.md')}`, ['封条验证入口', '直接使用其中的完整命令', '`INPUT_REQUIRED`', '不得把调用缺参写成来源损坏']]);
checks.push(['handoff candidate reply is human-first', `${read('01-操作者操作手册.md')}\n${read('04-状态、目标变更与交接规范.md')}\n${read('总指挥轻量交接启动配置.md')}\n${read('07-总指挥交接记录模板.md')}`, ['默认先用四句人话回答', '真正阻断', '默认不展示机器字段', '只有操作者明确要求技术细节', '不得把 `NOT_RUN`、`GENERATED_NOT_DELIVERED`', '不阻止当前候选阶段，写入“补充限制”而不是“真正阻断”', '下列字段只供机器记录和异常定位']]);
checks.push(['handoff preflight is first gate and candidate is unique', `${read('04-状态、目标变更与交接规范.md')}\n${read('10-自动状态索引规范.md')}\n${read('06-复盘与优化规则.md')}`, ['把 `preflight_only` 当作第一道机器门', '固定 `fact_cutoff`', 'SUPERSEDED', '有限重试和退避', '当前唯一 active candidate', '附件与封条保持两阶段']]);
checks.push(['handoff scoring separates control confidence from switch and acceptance states', `${read('04-状态、目标变更与交接规范.md')}\n${read('总指挥轻量交接启动配置.md')}`, ['控制面必要证据全部通过且没有真实控制面冲突或缺口时必须记为 `HIGH`', '候选阶段旧写者 `IDLE/UNKNOWN`', '运行/专业状态 `UNKNOWN/NOT_RUN/FAIL` 不得降低控制面评分', '“尚未正式切换”本身不是降分理由']]);
checks.push(['goal handoff stops business execution and exposes platform controls', `${read('01-操作者操作手册.md')}\n${read('05-模型选择与资源策略.md')}\n${read('06-复盘与优化规则.md')}`, ['不得开始新的业务步骤', '`/goal pause`', '`/goal resume`', '`/goal clear`', '垃圾桶删除聊天', '不能代替客户端改变持久 Goal 状态', '操作者先暂停平台状态', '暂停后才执行收口', '只有我明确要求“恢复 Goal”或“从断点继续”时才恢复']]);
checks.push(['goal handoff has a platform pause gate', `${read('01-操作者操作手册.md')}\n${read('04-状态、目标变更与交接规范.md')}\n${read('交接阶段矩阵.md')}\n${read('07-总指挥交接记录模板.md')}\n${read('10-自动状态索引规范.md')}`, ['PAUSE_REQUIRED', 'PAUSED', 'Goal 交接权限', 'CLOSEOUT_ONLY', '交接材料生成并回读成功后必须为 `NONE`', '不能覆盖上述平台状态']]);
let failed = 0;
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
if (manifest.schema_version !== 1 || !Array.isArray(manifest.rules) || !manifest.rule_version || manifest.scope !== 'core_workflow_full' || manifest.path_base !== 'rule_root' || manifest.repository_root_ref !== '../..' || !Array.isArray(manifest.repository_root_prefixes) || manifest.repository_root_prefixes.length !== 1 || manifest.repository_root_prefixes[0] !== '.github/') {
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
console.log(`Workflow refresh contract: PASS (${checks.length} cases)`);
