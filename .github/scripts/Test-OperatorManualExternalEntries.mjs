import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const manual = path.join(root, '总指挥工作流', '第二代总指挥的工作模式', '01-操作者操作手册.md');
const files = [
  manual,
  path.join(root, '引用的外部工具', 'README.md'),
  path.join(root, '引用的外部工具', '外部工具目录.md'),
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
    '什么时候用、怎么做：',
    '最小例子：',
    expectedPath,
    '你不需要知道 `EXT-001`、角色名称、安装命令',
    '正式流程：',
    '小白固定入口（推荐直接复制）：',
    '微信小程序例子：'
  ];
  for (const needle of required) if (!externalSection.includes(needle)) fail(`operator manual is missing: ${needle}`);
  for (const needle of ['[EXT-001：Agency Agents]', '[EXT-001：Agency Agents](#ext-001agency-agents)', '自然语言改手册的固定动作', '路径检查在三处触发']) {
    if (!text.includes(needle)) fail(`operator manual is missing: ${needle}`);
  }
  if (externalSection.includes('EXT-001 Agency Agents')) fail('operator manual retains the old inconsistent EXT-001 label');
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
}

if (!failures) {
  const externalReadme = read(path.join(root, '引用的外部工具', 'README.md'));
  for (const needle of ['用户只需要打开具体工具目录里的 `README.md`', '新手最短路径', 'NOT_INSTALLED', '只读适配判断']) {
    if (!externalReadme.includes(needle)) fail(`external tool root README is missing: ${needle}`);
  }
}

const markdownLink = /!?\[[^\]]*\]\(([^)]+)\)/g;
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
