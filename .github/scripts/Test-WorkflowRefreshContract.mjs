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
  ...Array.from({ length: 12 }, (_, index) => `${String(index).padStart(2, '0')}-`),
  '总指挥轻量交接启动配置.md',
  '规则刷新广播包.md',
  '规则刷新接收回执模板.md'
];
const checks = [
  ['matrix separates logical and machine phases', read('交接阶段矩阵.md'), ['逻辑交接阶段', '封条阶段', '附件交付状态', '候选核验状态']],
  ['broadcast is load-only and self-describing', read('规则刷新广播包.md'), ['规则广播只做一件事', '规则更新指令 + 第二代规则路径', '不需要手工填写 `RULE_REFRESH_ID`', '项目问题另列待办']],
  ['broadcast limits failure to rule-root faults', read('规则刷新广播包.md'), ['路径不可访问', '必需文件缺失', '哈希不一致', '更高优先级规则冲突', '不得触发 `WARN/BLOCKED`']],
  ['broadcast requires a frozen source', read('规则刷新广播包.md'), ['广播前冻结门禁', '不得一边修改同一规则根一边要求其他总指挥刷新', '立即取消本批']],
  ['manual bootstrap is one path command', read('01-操作者操作手册.md'), ['不需要填写事件编号、哈希、版本、变化清单或写入范围', '这是操作者下达的规则更新指令', '【第二代总指挥工作模式的实际路径】', '本次只更新规则，不做项目体检、配置迁移或交接', '长期人工兜底模板', '不必随版本号、manifest 摘要或接收者身份改写']],
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
checks.push(['cross-task workflow review routes separately from source business', `${read('09-自动化授权与风险分级.md')}\n${fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8')}`, ['公共工作流审查的正向分流', '按 FIFO 在取得处理时隙后完成最小只读核对', '只提取判断工作流缺陷所需的最小事实', '工作流部分继续处理，专项业务部分单独标记 `BLOCKED`', '没有回执要求时不强制向来源发送消息', '公共工作流审查与来源业务二分', '混合消息必须拆分处理']]);
checks.push(['handoff obeys current-turn precedence and formal route', `${read('01-操作者操作手册.md')}\n${read('02-总指挥核心规则.md')}\n${read('04-状态、目标变更与交接规范.md')}\n${fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8')}`, ['自然语言在这里仅是路由信号，不是交接快照授权', '上一轮“下一轮再交接”等说法只保留为背景', '不得仅凭历史意图生成正式快照', '当前轮优先于历史时序约定', '自然语言不构成捷径', '必须补齐 1C/1D 的预检、收口核账、快照交付', '仓库没有独立的“场景 EC”']]);
checks.push(['handoff closeout distinguishes pending work from blockers', read('04-状态、目标变更与交接规范.md'), ['收口”是把执行中或结果未知的动作停在安全原子边界', '普通未完成项只要有状态、责任对象、精确断点、下一行动和失效条件', '高风险动作未安全停止', '必须 `BLOCKED`']]);
let failed = 0;
for (const [name, text, needles] of checks) {
  const missing = needles.filter(needle => !text.includes(needle));
  if (missing.length) { failed += 1; console.error(`FAIL: ${name}: missing ${missing.join(', ')}`); }
  else console.log(`PASS: ${name}`);
}
const syntheticRoute = ({ workflowReview, sourceBusiness }) => ({
  workflow: workflowReview ? 'PROCESS_READ_ONLY' : 'NONE',
  business: sourceBusiness ? 'BLOCKED' : 'NONE'
});
const routeCases = [
  ['pure source business', { workflowReview: false, sourceBusiness: true }, { workflow: 'NONE', business: 'BLOCKED' }],
  ['pure public workflow review', { workflowReview: true, sourceBusiness: false }, { workflow: 'PROCESS_READ_ONLY', business: 'NONE' }],
  ['mixed workflow and source business', { workflowReview: true, sourceBusiness: true }, { workflow: 'PROCESS_READ_ONLY', business: 'BLOCKED' }]
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
if (manifest.schema_version !== 1 || !Array.isArray(manifest.rules) || !manifest.rule_version || manifest.scope !== 'core_workflow_full' || manifest.path_base !== 'rule_root') {
  console.error('FAIL: rule refresh manifest must declare schema, version, full core scope, rule-root base and a rules array');
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
  const absolute = path.resolve(workflow, item.path_ref);
  if (!absolute.startsWith(`${workflow}${path.sep}`) || !fs.existsSync(absolute) || item.sha256 !== sha256(fs.readFileSync(absolute))) {
    console.error(`FAIL: rule refresh manifest digest mismatch: ${item.path_ref}`);
    process.exit(1);
  }
}
console.log(`Rule refresh manifest: PASS (${sha256(manifestBytes)})`);
console.log(`Workflow refresh contract: PASS (${checks.length} cases)`);
