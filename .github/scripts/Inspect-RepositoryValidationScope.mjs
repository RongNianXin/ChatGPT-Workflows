import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ruleRoot = '总指挥工作流/第二代总指挥的工作模式/';
export const manualPath = ruleRoot + '01-操作者操作手册.md';
export const metadataPath = ruleRoot + 'templates/OPERATOR_MANUAL_REFERENCES.json';
export const manifestPath = ruleRoot + '规则刷新manifest.json';
export const navigationRecord = '- 补齐或调整操作手册目录；正文、场景编号、提示词和权限不变。验证范围及未验项见本次交付记录。';
export const recordPaths = ['CHANGELOG.md', ruleRoot + '06-复盘与优化规则.md'];
export const versionPaths = ['00-第二代工作流总览.md', '02-总指挥核心规则.md',
  '09-自动化授权与风险分级.md', '10-自动状态索引规范.md', '总指挥轻量交接启动配置.md'].map(p => ruleRoot + p);
const allowed = new Set([manualPath, metadataPath, manifestPath, ...versionPaths, ...recordPaths]);
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const full = reason => ({ profile: 'Full', reason });
const normalizeVersion = text => text.replace(/^版本：\d{4}-\d{2}-\d{2}\.\d+\r?$/m, 'VERSION');
const json = bytes => JSON.parse(bytes.toString('utf8'));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// This classifier grants no write/publish rights; unknown content retains full validation.
export function classifyNavigationChanges(changes, readCurrent) {
  try {
    if (!changes.length || !changes.some(c => c.path === manualPath)) return full('No manual navigation change');
    if (changes.some(c => !allowed.has(c.path) || !c.before || !c.after || c.mode !== '100644')) return full('Non-navigation path, deletion, addition or file mode');
    for (const change of changes) {
      const before = change.before.toString('utf8'), after = change.after.toString('utf8');
      if (!Buffer.from(before).equals(change.before) || !Buffer.from(after).equals(change.after)) return full('Invalid UTF-8');
      if (change.path === manualPath) {
        const split = text => {
          if (text.split('## 目录\n').length !== 2 || text.split('## 快速上手\n').length !== 2) throw Error('Ambiguous outline');
          const start = text.indexOf('## 目录\n'), end = text.indexOf('## 快速上手\n');
          if (end <= start) throw Error('Invalid outline');
          return { prefix: text.slice(0, start), toc: text.slice(start + '## 目录\n'.length, end), body: text.slice(end) };
        };
        const old = split(before), current = split(after);
        if (old.prefix !== current.prefix || old.body !== current.body) return full('Manual content outside directory changed');
        // Only ordinary internal link list items and blank lines, no HTML or instructions.
        if (current.toc.split('\n').some(line => line && !/^ *(?:\d+\.|-) \[[^\[\]<>\r\n]+\]\(#[a-z0-9\u3400-\u9fff_-]+\) *$/iu.test(line))) return full('Directory contains other content');
      } else if (recordPaths.includes(change.path)) {
        const insertion = after.slice(before.indexOf('\n') + 1, after.length - (before.length - before.indexOf('\n') - 1));
        if (!/^\n## \d{4}-\d{2}-\d{2}：操作手册导航维护\n\n/.test(insertion) ||
            insertion !== '\n' + insertion.split('\n')[1] + '\n\n' + navigationRecord + '\n' ||
            after !== before.slice(0, before.indexOf('\n') + 1) + insertion + before.slice(before.indexOf('\n') + 1)) return full('Record is not the fixed navigation entry');
      } else if (versionPaths.includes(change.path)) {
        if (normalizeVersion(before) !== normalizeVersion(after) || normalizeVersion(before) === before || normalizeVersion(after) === after) return full('Rule text changed beyond version');
      } else if (change.path === metadataPath) {
        const old = json(change.before), current = json(change.after);
        if (current.manual_sha256 !== hash(readCurrent(manualPath))) return full('Manual metadata digest mismatch');
        delete old.manual_sha256; delete current.manual_sha256;
        if (!same(old, current)) return full('Manual metadata structure changed');
      } else if (change.path === manifestPath) {
        const old = json(change.before), current = json(change.after);
        const permitted = new Set(changes.filter(c => c.path !== manifestPath).map(c => c.path));
        if (!Array.isArray(old.rules) || !Array.isArray(current.rules) || old.rules.length !== current.rules.length) return full('Manifest membership changed');
        const seen = new Set();
        for (let i = 0; i < old.rules.length; i++) {
          const previous = old.rules[i], present = current.rules[i];
          const p = present.path_ref?.startsWith('.github/') || present.path_ref?.startsWith('引用的外部工具/') ? present.path_ref : ruleRoot + present.path_ref;
          if (seen.has(p)) return full('Duplicate manifest member');
          seen.add(p);
          if (!same({ ...previous, sha256: null }, { ...present, sha256: null })) return full('Manifest entry changed');
          if (previous.sha256 !== present.sha256 && (!permitted.has(p) || present.sha256?.toLowerCase() !== hash(readCurrent(p)))) return full('Unrelated or incorrect manifest digest');
        }
        delete old.rule_version; delete current.rule_version;
        old.rules = old.rules.map(r => ({ ...r, sha256: null }));
        current.rules = current.rules.map(r => ({ ...r, sha256: null }));
        if (!same(old, current)) return full('Manifest policy changed');
      }
    }
    return { profile: 'Navigation', reason: 'Only manual directory and bound version/digest metadata changed' };
  } catch { return full('Navigation boundaries or metadata could not be verified'); }
}

export function inspectRepositoryValidationScope(root, { additionalPaths = [] } = {}) {
  const git = args => execFileSync('git', ['--no-pager', '-C', root, ...args], { windowsHide: true, timeout: 15000, maxBuffer: 8 * 1024 * 1024 });
  try {
    if (Object.keys(process.env).some(k => /^GIT_(?!TERMINAL_PROMPT$|OPTIONAL_LOCKS$|PAGER$)/i.test(k))) return full('Git environment overrides require full validation');
    if (fs.realpathSync(root) !== fs.realpathSync(git(['rev-parse', '--show-toplevel']).toString('utf8').trim())) return full('Repository root mismatch');
    const head = git(['rev-parse', '--verify', 'HEAD^{commit}']).toString('utf8').trim();
    const hiddenIndexFlags = git(['ls-files', '-v', '-z']).toString('utf8').split('\0').filter(Boolean).some(line => !line.startsWith('H '));
    const paths = new Set();
    const layers = [];
    for (const args of [['diff', 'HEAD'], ['diff', '--cached', 'HEAD'], ['diff']]) {
      const entries = git([...args, '--no-ext-diff', '--no-textconv', '--no-renames', '--name-only', '-z', '--']).toString('utf8').split('\0').filter(Boolean);
      layers.push(entries);
      for (const p of entries) paths.add(p);
    }
    if (layers[1].length && layers[2].length) return { profile: 'Blocked', reason: 'Index and worktree differ; tests cannot certify a different staged candidate' };
    if (hiddenIndexFlags) return { profile: 'Blocked', reason: 'Index flags may hide working changes; candidate consistency cannot be certified' };
    if (additionalPaths.length) return full('Explicit new files require full validation');
    const untrackedExcluded = git(['ls-files', '--others', '--exclude-standard', '-z']).toString('utf8').split('\0').filter(Boolean).length;
    if ([...paths].some(p => !allowed.has(p))) return { ...full('Changed path outside navigation scope'), untracked_excluded: untrackedExcluded };
    const readCurrent = p => {
      let current = root;
      for (const part of p.split('/')) {
        current = path.join(current, part);
        if (fs.lstatSync(current).isSymbolicLink()) throw Error('Linked path');
      }
      if (!fs.statSync(current).isFile()) throw Error('Non-file');
      return fs.readFileSync(current);
    };
    const changes = [];
    for (const p of paths) {
      const tree = git(['ls-tree', 'HEAD', '--', p]).toString('utf8');
      const mode = tree.match(/^(\d+) /)?.[1];
      const index = git(['ls-files', '--stage', '--', p]).toString('utf8');
      if (!mode || !index.startsWith('100644 ') || !/ 0\t/.test(index)) return full('Unmerged, missing or special index entry');
      const after = readCurrent(p), before = git(['show', 'HEAD:' + p]);
      const staged = git(['show', ':' + p]);
      if (!staged.equals(before) && !staged.equals(after)) return {profile:'Blocked',reason:'Staged and working changes disagree'};
      if (before.equals(after) && !staged.equals(before)) return {profile:'Blocked',reason:'Staged changes hidden by worktree'};
      changes.push({ path: p, before, after, mode, staged_sha256: hash(staged) });
    }
    const selection = classifyNavigationChanges(changes, readCurrent);
    const fingerprints = [...allowed].filter(p => fs.existsSync(path.join(root, p))).map(p => [p, hash(readCurrent(p))]);
    return { ...selection, head, changed_count: paths.size, untracked_excluded: untrackedExcluded,
      candidate_sha256: hash(JSON.stringify({ head, changes: changes.map(c => [c.path, hash(c.before), hash(c.after), c.staged_sha256]), fingerprints })),
      coverage: 'Tracked HEAD/index/worktree candidate only; untracked files are not approved for staging or publication' };
  } catch { return full('Repository evidence unavailable or ambiguous'); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  if (process.argv.slice(2).some(a => a !== '--additional-files')) { console.error('usage: node Inspect-RepositoryValidationScope.mjs [--additional-files]'); process.exitCode = 2; }
  else console.log(JSON.stringify(inspectRepositoryValidationScope(root, { additionalPaths: process.argv.includes('--additional-files') ? ['explicit'] : [] })));
}
