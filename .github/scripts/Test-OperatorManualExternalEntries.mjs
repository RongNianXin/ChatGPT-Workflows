import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const manual = path.join(root, '总指挥工作流', '第二代总指挥的工作模式', '01-操作者操作手册.md');
const files = [
  manual,
  path.join(root, '引用的外部工具', 'README.md'),
  path.join(root, '引用的外部工具', '外部工具目录.md'),
  path.join(root, '引用的外部工具', '外部工具自动对接规范.md'),
  path.join(root, '引用的外部工具', '外部工具接入模板.md'),
  path.join(root, '引用的外部工具', 'agency agents', '跨项目引用提示词.md'),
  path.join(root, '引用的外部工具', 'agency agents', '个性化配置建议.md'),
  path.join(root, '引用的外部工具', 'agency agents', 'README.md')
];
const read = file => fs.readFileSync(file, 'utf8');
const fail = message => { console.error(`FAIL: ${message}`); failures += 1; };
let failures = 0;

// Validate the one summary table; this does not prove live AI tool selection.
const inspectDirectory = text => {
  const begin = '<!-- TOOL_DIRECTORY:BEGIN -->';
  const end = '<!-- TOOL_DIRECTORY:END -->';
  const issues = [];
  if (text.split(begin).length !== 2 || text.split(end).length !== 2 ||
      text.indexOf(begin) > text.indexOf(end)) return { issues: ['directory markers must be unique and ordered'], rows: [] };
  const table = text.slice(text.indexOf(begin) + begin.length, text.indexOf(end));
  const rows = table.split('\n').filter(line => /^\|\s*`EXT-\d{3}`\s*\|/.test(line))
    .map(line => line.split('|').slice(1, -1).map(cell => cell.trim()));
  if (!rows.length) issues.push('directory is empty');
  const ids = rows.map(row => row[0]);
  if (new Set(ids).size !== ids.length) issues.push('duplicate directory ID');
  for (const row of rows) {
    if (row.length !== 7 || row.some(cell => !cell)) { issues.push(`missing summary fields: ${row[0]}`); continue; }
    if (!/DOCUMENTED_ONLY|READY_FOR_ACTIVATION|UNKNOWN|RETIRED/.test(row[4])) issues.push(`missing state: ${row[0]}`);
    if (!/https:\/\//.test(row[5]) || !/\]\([^)]*\/README\.md\)/.test(row[5]) ||
        !/\]\([^)]*\/安装与维护记录\.md\)/.test(row[6])) issues.push(`missing source or unique detail links: ${row[0]}`);
  }
  return { issues, rows };
};

for (const file of files) {
  if (!fs.existsSync(file)) fail(`required document is missing: ${path.relative(root, file)}`);
}

if (!failures) {
  const text = read(manual);
  const externalStart = text.indexOf('## 可选功能场景：外部工具调用');
  const externalEnd = text.indexOf('## 可选功能场景：个性化协作', externalStart);
  const externalSection = text.slice(externalStart, externalEnd === -1 ? undefined : externalEnd);
  const expectedHeading = '### EXT-001：Agency Agents';
  const expectedPath = '`ChatGPT-Workflows/引用的外部工具/agency agents/README.md`';
  const required = [
    '### 外部工具总体接入规则',
    expectedHeading,
    '它是做什么的：',
    '操作者入口：',
    '工具子目录的 `README.md` 是该工具唯一的操作者入口',
    expectedPath,
    '本手册只负责索引',
    '不重复放置第三方工具的详细提示词',
  ];
  for (const needle of required) if (!externalSection.includes(needle)) fail(`operator manual is missing: ${needle}`);
  for (const needle of ['[EXT-001：Agency Agents]', '[EXT-001：Agency Agents](#scenario-agency-agents)', '自然语言改手册的固定动作', '路径检查在三处触发']) {
    if (!text.includes(needle)) fail(`operator manual is missing: ${needle}`);
  }
  if (externalSection.includes('EXT-001 Agency Agents')) fail('operator manual retains the old inconsistent EXT-001 label');
  for (const obsolete of ['小白固定入口（推荐直接复制）', '微信小程序例子']) { if (externalSection.includes(obsolete)) fail(`operator manual duplicates tool-specific template content: ${obsolete}`); }
  const extStart = externalSection.indexOf(expectedHeading);
  const extBody = externalSection.slice(extStart);
  if (extBody.includes('新增工具时，由中央总指挥')) fail('generic external-tool registration guidance remains under EXT-001');
  const windowsUserPath = ['C:', 'Users'].join('\\') + '\\';
  const slashUserPath = ['C:', 'Users'].join('/') + '/';
  if (externalSection.includes(windowsUserPath) || externalSection.includes(slashUserPath)) fail('external tool section contains a machine-specific absolute path');
}

if (!failures) {
  const registry = read(path.join(root, '引用的外部工具', '外部工具目录.md'));
  for (const issue of inspectDirectory(registry).issues) fail(issue);
  const ids = [...registry.matchAll(/\|\s*`(EXT-\d{3})`\s*\|/g)].map(match => match[1]);
  if (new Set(ids).size !== ids.length) fail(`external tool registry has duplicate IDs: ${ids.join(', ')}`);
  if (!registry.includes('`EXT-001`') || !registry.includes('Agency Agents')) fail('external tool registry does not expose EXT-001 Agency Agents');
  if (!registry.includes('https://github.com/msitarzewski/agency-agents')) fail('registered source is missing from the discovery index');
  const guide = read(path.join(root, '引用的外部工具', '外部工具自动对接规范.md'));
  for (const needle of ['不先扫描用户级 skills', '来源已知但未安装', '共享记录声明已安装', '不能登记为已理解或已采用', '新窗口仅有规则根', 'EXT-002', '仓库改名']) {
    if (!guide.includes(needle)) fail(`discovery contract is missing: ${needle}`);
  }
  for (const name of ['00-第二代工作流总览.md', '02-总指挥核心规则.md']) {
    const core = read(path.join(root, '总指挥工作流', '第二代总指挥的工作模式', name));
    if (!core.includes('引用的外部工具/外部工具目录.md') || !core.includes('引用的外部工具/外部工具自动对接规范.md')) fail(`workflow entry does not route to the tool registry: ${name}`);
  }
  const toolEntry = read(path.join(root, '引用的外部工具', 'agency agents', 'README.md'));
  if (!toolEntry.includes('https://github.com/msitarzewski/agency-agents') || !toolEntry.includes('共享安装记录')) fail('Agency entry does not resolve source and shared-state checks');
  const internalContract = read(path.join(root, '引用的外部工具', 'agency agents', '跨项目引用提示词.md'));
  if (internalContract.includes('请先阅读本项目的 Agency Agents README')) fail('cross-project contract still resolves from the product project');
  const personalization = read(path.join(root, '引用的外部工具', 'agency agents', '个性化配置建议.md'));
  if (personalization.includes('先查阅项目中的') || !personalization.includes('已核验第二代规则根')) fail('optional personalization reintroduces product-root discovery');
}

if (!failures) {
  const externalReadme = read(path.join(root, '引用的外部工具', 'README.md'));
  for (const needle of ['先看[外部工具通讯录]', '选中后再打开具体工具目录里的 `README.md`', '标准使用路径', 'NOT_INSTALLED', '只读适配判断', '本导览不重复列举工具', '<a id="外部工具调用入口"></a>']) {
    if (!externalReadme.includes(needle)) fail(`external tool root README is missing: ${needle}`);
  }
  const english = read(path.join(root, '引用的外部工具', 'README.en.md'));
  if (!english.includes('<a id="external-tool-entry"></a>')) fail('external overview lost its legacy English heading anchor');
}

{
  const row = '| `EXT-999` | Sample tool | Test / review | First read the selected guide | `DOCUMENTED_ONLY / NOT_INSTALLED` | [source](https://example.invalid/tool); [details](sample/README.md) | [maintenance](sample/安装与维护记录.md) |';
  const wrap = rows => `<!-- TOOL_DIRECTORY:BEGIN -->\n${rows}\n<!-- TOOL_DIRECTORY:END -->`;
  const cases = [
    ['complete summary', wrap(row), true],
    ['duplicate ID', wrap(`${row}\n${row}`), false],
    ['missing task tags', wrap(row.replace('Test / review', '')), false],
    ['missing starting step', wrap(row.replace('First read the selected guide', '')), false],
    ['missing status', wrap(row.replace('DOCUMENTED_ONLY / NOT_INSTALLED', '')), false],
    ['missing selected README', wrap(row.replace('sample/README.md', 'sample/other.md')), false],
    ['empty table', wrap(''), false],
    ['duplicate marker', `${wrap(row)}\n<!-- TOOL_DIRECTORY:BEGIN -->`, false]
  ];
  for (const [name, text, expected] of cases) {
    if ((inspectDirectory(text).issues.length === 0) !== expected) fail(`directory fixture: ${name}`);
  }
  console.log(`Tool directory summary fixtures: ${cases.length} checked (static, not live routing)`);
}

const markdownLink = /!?\[[^\]]*\]\(([^)]+)\)/g;
// These are document and registry contracts, not claims about live agent behavior.
if (!failures) {
  const toolDir = path.join(root, '引用的外部工具', 'agency agents');
  for (const name of ['调用指南.md', '跨项目引用提示词.md', 'README.md']) {
    const text = read(path.join(toolDir, name));
    for (const obsolete of ['只推荐一个最小角色', '第二步：选择一个角色']) {
      if (text.includes(obsolete)) fail(`role coverage is narrowed in ${name}: ${obsolete}`);
    }
    if (!text.includes('职责') || !text.includes('阶段')) fail(`responsibility/stage distinction is missing: ${name}`);
  }
  const contract = read(path.join(root, '引用的外部工具', '外部工具自动对接规范.md'));
  for (const needle of ['### 5.0 准备、传递与实际就绪', '`goal=null` 不阻断准备', '不预造标识', '不并发改写专项卡', '无通信授权只暂停传递', '准备卡不自动创建、启动或恢复 Goal', '准备性读取不消费正式角色尝试', '不能把已读角色后的基线称为干净的无角色对照']) {
    if (!contract.includes(needle)) fail(`trial preparation boundary is missing: ${needle}`);
  }
  const entry = read(path.join(toolDir, 'README.md'));
  for (const needle of ['### 普通对话中持续使用', '现在只配置，不执行业务', '项目启动或交接入口能够找到它', '不按关键词机械切换', '单个业务任务结束则关闭该任务绑定', '同一个 AI 切换审查角色仍是自查']) {
    if (!entry.includes(needle)) fail(`ordinary-chat adaptation entry is missing: ${needle}`);
  }
  const guide = read(path.join(toolDir, '调用指南.md'));
  for (const needle of ['external_role_policy', '业务结束关闭任务绑定，项目约定独立保留', '旧卡复活已撤销角色', '真实恢复仍NOT_RUN', '没有可靠对照则UNKNOWN', '主任务无适用预算时提出最小有界计划']) {
    if (!guide.includes(needle)) fail(`persistent adaptation boundary is missing: ${needle}`);
  }
  if (!contract.includes('external_role_policy') || !contract.includes('启动、恢复及新业务适配时先回读该指针')) fail('project policy recovery pointer is missing from the shared contract');
  for (const needle of ['### 常规使用模板', '### 普通对话中持续使用', '完整上游角色目录', '实际获准位置', '保留原业务目标、额度和停止条件']) {
    if (!entry.includes(needle)) fail(`operator preparation entry is missing: ${needle}`);
  }
  if (entry.includes('### 首次试验准备模板')) fail('operator entry retains the removed trial-preparation template');
  for (const needle of ['先匹配完整上游角色目录，再核对本地安装', '确认目录未截断', '必要时补齐分页', '目录版本/获取时间', '不每条消息联网', '已有精确安装授权则直接取得并使用', '项目临时副本与用户级共享安装分别登记', '同一阶段的普通反馈、短消息和逐条命令不重跑完整匹配', '不能强制调用或当持续授权', '不算多个独立审查者', '不伪称原生多角色同时注册', '不覆盖项目“不自动安装”等门禁']) {
    if (!contract.includes(needle)) fail(`Agency full-catalog, permission or stage contract is missing: ${needle}`);
  }
  for (const needle of ['原始索引到候选索引的提取覆盖', '保留任意目录深度的角色', '排除 README、模板等辅助文件须有上游索引或文件内容依据', '分类未知项保留待核', '`truncated=false` 只证明接口未截断，不证明过滤无遗漏', '发现遗漏先补齐再匹配', '已安装集合不缩小全集', '所用目录覆盖证据与当前任务匹配理由', '可引用有效旧证据，不新增平行账本']) {
    if (!contract.includes(needle)) fail(`Agency catalog-projection evidence contract is missing: ${needle}`);
  }
  const defaultStart = contract.indexOf('### 2.3 Agency 默认适配与执行核验');
  const defaultEnd = contract.indexOf('## 3. 规则刷新', defaultStart);
  const defaults = contract.slice(defaultStart, defaultEnd);
  const defaultCases = [
    ['new professional task without a keyword', ['每个新实质任务先轻量检查专业职责', '不等操作者补 Agency 口令']],
    ['simple task and explicit request', ['纯确认、简单事实问答、纯格式', '不用复杂度门槛忽略请求']],
    ['opt-out and stricter project limits', ['明确暂停、关闭、本次不用和项目更严格', '缺政策指针不推翻可核验的关闭记录']],
    ['preparation and formal-use distinction', ['候选核验、只配置及已暂停业务', '正式调用仍须第5.1节持久消费并回读']],
    ['missing record stays local', ['保留候选与具体恢复条件', '独立且获准的主任务继续']],
    ['stage reuse and transition', ['同阶段有效选择复用', '验收变化时重评']],
    ['recovery preserves consumption and stop state', ['接收实例独立读取所需正文', '不借恢复清零或重跑完成部分']],
    ['review reminder merges', ['显式提醒与该阶段已有检查合并', '角色名称和“已自检”声明不能代替']],
    ['actual evidence and honest validation', ['首次实际采用、职责实质变化或出现缺口时', '真实可靠性须观察无显式提示的触发']]
  ];
  if (defaultStart === -1 || defaultEnd === -1 || (contract.match(/id="agency-default-adaptation"/g) || []).length !== 1) fail('Agency default contract must have one reachable authoritative anchor');
  for (const [name, needles] of defaultCases) {
    for (const needle of needles) if (!defaults.includes(needle)) fail(`Agency default branch (${name}) is missing: ${needle}`);
  }
  for (const obsolete of ['除此之外，没有指定工具的普通任务不自动加载工具', '项目持续模式须有明确启用依据', '未启用该政策时，首次可用工具请求']) {
    if (contract.includes(obsolete)) fail(`Agency default retains a conflicting explicit-only condition: ${obsolete}`);
  }
  const routeFiles = ['AGENTS.md', ...['00-第二代工作流总览.md', '02-总指挥核心规则.md', '03-专项任务卡模板.md', '10-自动状态索引规范.md', '总指挥轻量交接启动配置.md'].map(name => path.join('总指挥工作流', '第二代总指挥的工作模式', name))];
  for (const file of routeFiles) {
    const routed = read(path.join(root, file));
    if (!routed.includes('#agency-default-adaptation')) fail(`Agency default startup/recovery route is missing: ${file}`);
    if (routed.includes('普通开发目标不自动加载工具')) fail(`Agency default startup route has a conflicting exclusion: ${file}`);
  }
  for (const needle of ['无需先发持续模板', '角色名字不能证明已经使用', '只继续独立且获准的主任务']) {
    if (!entry.includes(needle)) fail(`Agency operator default boundary is missing: ${needle}`);
  }
  const english = read(path.join(toolDir, 'README.en.md'));
  for (const needle of ['a persistent-use template is not a prerequisite', 'stricter project restriction takes precedence', 'Without a reliable consumption record', '#agency-default-adaptation']) {
    if (!english.includes(needle)) fail(`English Agency default boundary is missing: ${needle}`);
  }
  console.log(`Agency default route contracts: ${defaultCases.length} branches, ${routeFiles.length} entries (static; live triggering NOT_VERIFIED)`);
  for (const needle of ['或 Agency 按第2.3节已有适用依据时', '或 Agency 按第2.3节在有效业务授权与正式条件内建立绑定时', 'Agency 默认入口按第2.3节']) {
    if (!contract.includes(needle)) fail(`Agency default formal-use lifecycle is missing: ${needle}`);
  }
  const agencyGuide = read(path.join(toolDir, '调用指南.md'));
  for (const needle of ['显式定制项目持续模式时', '交接材料始终引用当前任务绑定', '有定制约定再回读其政策', '不因缺定制约定判默认恢复失败']) {
    if (!agencyGuide.includes(needle)) fail(`Agency default recovery without custom policy is missing: ${needle}`);
  }
  for (const obsolete of ['交接材料至少引用项目约定及当前任务绑定', '必须自行定位两层记录']) {
    if (agencyGuide.includes(obsolete)) fail(`Agency default recovery requires an unnecessary custom policy: ${obsolete}`);
  }
  for (const needle of ['安装集合、本阶段加载和单次调用分别确认', 'attempts_consumed', '回读成功才开始', '开始后未完成或失败也消费一次', '继续同次', '同一当前行动', '迟到旧卡不覆盖停止/撤销', '未通知并取得实际加载确认时不得称已迁移']) {
    if (!contract.includes(needle)) fail(`role lifecycle contract is missing: ${needle}`);
  }
  const ruleDir = path.join(root, '总指挥工作流', '第二代总指挥的工作模式');
  for (const name of ['03-专项任务卡模板.md', '04-状态、目标变更与交接规范.md', '07-总指挥交接记录模板.md', '10-自动状态索引规范.md', '总指挥轻量交接启动配置.md']) {
    const text = read(path.join(ruleDir, name));
    if (!text.includes('external_role_binding') || !text.includes('外部工具自动对接规范.md')) fail(`role recovery entry is missing: ${name}`);
  }
  const shared = JSON.parse(read(path.join(root, '引用的外部工具', '角色共享状态.json')));
  const roles = shared.roles;
  if (!Array.isArray(roles)) fail('shared role registry must contain a roles array');
  else {
    const names = new Set();
    const paths = new Set();
    for (const role of roles) {
      if (!role.slug || names.has(`${role.tool_id}/${role.slug}`) || paths.has(role.path_ref)) fail(`duplicate or missing role identity: ${role.slug}`);
      names.add(`${role.tool_id}/${role.slug}`);
      paths.add(role.path_ref);
      if (!/^<USER_CODEX_HOME>\/agents\/[a-z0-9-]+\.toml$/u.test(role.path_ref)) fail(`role path is not a portable shared TOML reference: ${role.slug}`);
      for (const field of ['source_sha256', 'file_sha256', 'instructions_sha256']) {
        if (!/^[a-f0-9]{64}$/u.test(role[field])) fail(`invalid ${field}: ${role.slug}`);
      }
      if (role.scope !== 'user_shared' || role.task_binding_required !== true) fail(`role bypasses project binding: ${role.slug}`);
      if (role.loading_mode !== 'workflow_managed_explicit_read' || role.native_auto_discovery !== 'NOT_VERIFIED') fail(`native discovery claim requires new runtime evidence and a test update: ${role.slug}`);
      if (role.status !== 'READY_FOR_ACTIVATION') fail(`shared role state claims execution without a project binding: ${role.slug}`);
    }
    for (const slug of ['workflow-architect', 'game-designer', 'level-designer', 'technical-artist', 'ui-designer', 'test-automation-engineer', 'code-reviewer']) {
      if (!names.has(`EXT-001/${slug}`)) fail(`verified role is absent from shared registry: ${slug}`);
    }
  }
}

// Synthetic path fixtures verify the coverage oracle, not a live catalog extractor
// or whether future agents follow the prose. Expected roles are explicit;
// no purportedly correct extraction function creates its own expected answer.
{
  const roles = ['engineering/frontend.md', 'specialized/workflow.md',
    'game-development/unity/architect.md', 'game-development/godot/systems.md',
    'game-development/unreal/rendering/technical-artist.md'];
  const auxiliary = ['README.md', 'engineering/README.md', 'templates/role-template.md'];
  const original = [...roles, ...auxiliary];
  const exclusions = auxiliary.map(file => ({ path: file, evidence: `synthetic fixture classification: ${file}` }));
  const diff = (expected, observed) => expected.filter(file => !observed.includes(file));
  const audit = (candidates, excluded) => {
    const excludedPaths = excluded.map(item => item.path);
    return {
      missingRoles: diff(roles, candidates), unexpectedCandidates: diff(candidates, roles),
      unaccounted: diff(original, [...candidates, ...excludedPaths]),
      invalidExclusions: excluded.filter(item => !auxiliary.includes(item.path) || !item.evidence?.trim()),
      overlap: candidates.filter(file => excludedPaths.includes(file)),
      duplicateCandidates: candidates.length !== new Set(candidates).size,
      duplicateExclusions: excludedPaths.length !== new Set(excludedPaths).size
    };
  };
  const valid = result => Object.values(result).every(value => Array.isArray(value) ? value.length === 0 : value === false);
  const legacy = roles.filter(file => /^[^/]+\/[^/]+\.md$/u.test(file));
  const cases = [
    ['complete multilevel projection', audit([...roles], exclusions), true],
    ['legacy two-level projection', audit(legacy, exclusions), false],
    ['auxiliary Markdown used as role', audit([...roles, auxiliary[0]], exclusions.slice(1)), false],
    ['exclusion without evidence', audit([...roles], exclusions.map(item => ({ ...item, evidence: '' }))), false],
    ['deep role mislabeled auxiliary', audit(roles.slice(0, -1), [...exclusions, { path: roles.at(-1), evidence: 'synthetic wrong classification' }]), false],
    ['installed shallow set used as universe', audit(roles.slice(0, 1), exclusions), false],
    ['valid cached projection reused', audit([...roles], exclusions), true],
    ['unknown classification dropped', audit([...roles], exclusions.slice(1)), false],
    ['duplicate candidate', audit([...roles, roles[0]], exclusions), false]
  ];
  for (const [name, result, expected] of cases) {
    if (valid(result) !== expected) fail(`synthetic projection coverage: ${name}`);
  }
  const missingDeep = audit(legacy, exclusions).missingRoles;
  if (missingDeep.length !== 3 || missingDeep.some(file => !roles.slice(2).includes(file))) fail('synthetic legacy projection must expose the independently enumerated deep-role difference');
  console.log(`Synthetic catalog-projection checks: ${cases.length} cases (offline; live role classification NOT_VERIFIED)`);
}

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  const text = read(file);
  for (const match of text.matchAll(markdownLink)) {
    const target = match[1].trim().split(/\s+/u, 1)[0];
    if (!target || target.startsWith('#') || /^[a-z][a-z0-9+.-]*:/iu.test(target)) continue;
    const withoutAnchor = decodeURIComponent(target.split('#', 1)[0]);
    if (!withoutAnchor) continue;
    const resolved = path.resolve(path.dirname(file), withoutAnchor.replaceAll('/', path.sep));
    if (!fs.existsSync(resolved)) fail(`broken entry link: ${path.relative(root, file)} -> ${target}`);
  }
}

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  const text = read(file);
  for (const match of text.matchAll(/`ChatGPT-Workflows\/([^`]+)`/g)) {
    const displayed = match[1].replace(/[\\/]$/u, '');
    if (!displayed || displayed.includes('<') || displayed.includes('…')) continue;
    const resolved = path.join(root, ...displayed.split('/'));
    if (!fs.existsSync(resolved)) fail(`broken repository-root path display: ${path.relative(root, file)} -> ChatGPT-Workflows/${match[1]}`);
  }
}

// These are document contracts, not proof that a live model selects or reuses tools.
const routingGuide = read(path.join(root, '引用的外部工具', '外部工具自动对接规范.md'));
const routingStart = routingGuide.indexOf('### 1.1 统一按需选择与读取');
const routingEnd = routingGuide.indexOf('\n## 2.', routingStart);
if (routingStart < 0 || routingEnd < 0) fail('unified routing contract has no bounded entry');
const routing = routingGuide.slice(routingStart, routingEnd);
for (const [scenario, needles] of [
  ['simple task and same-phase feedback', ['不重新扫描工具库', '同任务优先复用有效选择与已读证据']],
  ['new capability and explicit invocation boundary', ['实际能力缺口', '具体工具的有效触发依据', '不能把候选推荐当成调用授权']],
  ['overlapping capabilities and independent review', ['同一已验证事项', '独立审查不能由同一实例换角色代签']],
  ['stale evidence and new instance recovery', ['只补受影响核验', '新实例独立读取本次必要正文', '不能继承旧实例']],
  ['plain-language operation and mandatory full refresh', ['不以背诵编号', '教学不抢占原任务', '不改变0A规则刷新或正式交接']],
  ['honest verification limits', ['只能证明静态一致性', '不能承诺零Token成本或绝不遗漏']]
]) {
  for (const needle of needles) if (!routing.includes(needle)) fail(`unified routing contract missing ${scenario}: ${needle}`);
}
for (const needle of ['不依赖操作者粘贴通用提示词', '当前宿主已提供的工具简介', '实际读取并使用，不停在推荐', '基础能力足够时直接完成', '未接入或未加载新版的聊天不保证自动采用', '明确要求主动调用的工具仍须相应请求']) {
  if (!routing.includes(needle)) fail(`default tool selection boundary missing: ${needle}`);
}
if ((routingGuide.match(/id="tool-default-routing"/g) || []).length !== 1) fail('default tool selection requires one authoritative anchor');
for (const file of ['AGENTS.md', ...['00-第二代工作流总览.md', '02-总指挥核心规则.md'].map(name => path.join('总指挥工作流', '第二代总指挥的工作模式', name))]) {
  if (!read(path.join(root, file)).includes('#tool-default-routing')) fail(`default tool selection entry missing: ${file}`);
}
const compositionStart = routingGuide.indexOf('### 1.2 所有场景与角色、技能的协作契约');
const compositionEnd = routingGuide.indexOf('\n## 2.', compositionStart);
if (compositionStart < 0 || compositionEnd < 0) fail('scene/skill composition contract has no bounded entry');
const composition = routingGuide.slice(compositionStart, compositionEnd);
for (const needle of ['所有现有场景及未来新增场景', '同一当前任务', '具体技能要求主动调用', '不重复启动门禁', '缺失的必要步骤才补齐', '方法不适合', '可选增强', '明确要求必须由指定工具完成', '副作用未知', '单一整体汇报', '不能保证未来场景永不冲突']) {
  if (!composition.includes(needle)) fail(`scene/skill composition missing: ${needle}`);
}
const reusablePrompt = read(path.join(root, '其他 Codex 技巧性提示词', '【万能咒语】第一性原理和对抗式审查.md'));
for (const needle of ['例如Agency Agents、Matt Pocock Skills', '遵守具体技能的主动调用限制', '未启用工作流时按普通任务执行', '未安装、不可访问或方法不适配', '不自动安装', '不降低必要验证', '继续原任务', '触发条件和权限齐备时实际使用', '基础能力足够时直接完成', '交付前检查实际产物与验证证据']) {
  if (!reusablePrompt.includes(needle)) fail(`portable generic prompt missing: ${needle}`);
}
const learning = read(path.join(root, '总指挥工作流', '第二代总指挥的工作模式', '06-复盘与优化规则.md'));
for (const needle of ['关键处短解释', '没有必要新概念时不强制附课', '回答后回到原未完成项', '明确取消或替代的项仍须在收口中说明', '不自动启用画像', '解释精简不削减风险']) {
  if (!learning.includes(needle)) fail(`progressive explanation contract missing: ${needle}`);
}
const onboarding = read(path.join(root, '引用的外部工具', '外部工具接入模板.md'));
for (const needle of ['必须主动调用的限制', '重叠/互补职责', '失效后定点重核', '换窗恢复不丢原任务']) {
  if (!onboarding.includes(needle)) fail(`tool onboarding contract missing: ${needle}`);
}

if (failures) process.exit(1);
console.log(`Operator manual and external entry checks: PASS (${files.length} documents)`);
