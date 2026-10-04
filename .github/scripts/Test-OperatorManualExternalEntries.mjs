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
  for (const needle of ['[EXT-001：Agency Agents]', '[EXT-001：Agency Agents](#ext-001agency-agents)', '自然语言改手册的固定动作', '路径检查在三处触发']) {
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
  for (const needle of ['用户只需要打开具体工具目录里的 `README.md`', '标准使用路径', 'NOT_INSTALLED', '只读适配判断']) {
    if (!externalReadme.includes(needle)) fail(`external tool root README is missing: ${needle}`);
  }
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

if (failures) process.exit(1);
console.log(`Operator manual and external entry checks: PASS (${files.length} documents)`);
