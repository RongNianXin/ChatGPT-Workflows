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
let failed = 0;
for (const [name, text, needles] of checks) {
  const missing = needles.filter(needle => !text.includes(needle));
  if (missing.length) { failed += 1; console.error(`FAIL: ${name}: missing ${missing.join(', ')}`); }
  else console.log(`PASS: ${name}`);
}
if (failed) process.exit(1);
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
