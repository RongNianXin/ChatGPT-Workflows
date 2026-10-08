// Atomic formal-handoff preparation. It creates a final-* artifact only after every gate passes.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { SCOPED_WORKSPACE_ALGORITHM, readScopedWorkspaceBaseline, validateScopedWorkspaceSources } from './HandoffWorkspaceScope.mjs';
import { fileURLToPath } from 'node:url';
import { appendSeal, sealDigest, validateControlPlaneRegistry, verifyChain, verifyControlIdentity } from './HandoffSeal.mjs';

export const REQUIRED_RULES = [
  '.github/scripts/HandoffWorkspaceScope.mjs',
  '.github/scripts/HandoffSeal.mjs',
  '.github/scripts/Prepare-Handoff.mjs',
  '.github/scripts/Mark-Handoff-Delivered.mjs',
  '总指挥工作流/第二代总指挥的工作模式/templates/HANDOFF_STATE.schema.json',
  '总指挥工作流/第二代总指挥的工作模式/02-总指挥核心规则.md',
  '总指挥工作流/第二代总指挥的工作模式/04-状态、目标变更与交接规范.md',
  '总指挥工作流/第二代总指挥的工作模式/07-总指挥交接记录模板.md',
  '总指挥工作流/第二代总指挥的工作模式/09-自动化授权与风险分级.md',
  '总指挥工作流/第二代总指挥的工作模式/10-自动状态索引规范.md',
  '总指挥工作流/第二代总指挥的工作模式/总指挥轻量交接启动配置.md'
];
const CONFIG_KEYS = new Set(['seal_directory', 'source_root', 'external_control_plane_root', 'draft_path', 'snapshot_template_path', 'final_output_path', 'receipt_output_path', 'rule_manifest_path', 'live_rule_manifest_path', 'expected_previous_digest', 'transition_ticket', 'project_key', 'preflight_only']);
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const resolveFrom = (base, value) => path.resolve(base, value);
const isInside = (root, candidate) => {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
};
const physicalTarget = target => {
  const suffix = [];
  let cursor = path.resolve(target);
  while (!fs.existsSync(cursor)) {
    const parent = path.dirname(cursor);
    if (parent === cursor) throw new Error(`cannot resolve an existing ancestor for: ${target}`);
    suffix.unshift(path.basename(cursor));
    cursor = parent;
  }
  return path.join(fs.realpathSync(cursor), ...suffix);
};
const verificationCommandPattern = /node\s+"[^"]*HandoffSeal\.mjs"\s+verify\s+"[^"]+"\s+"[^"]+"(?:\s+"[^"]+")?/;

const RULE_CRITICAL_PATHS = new Set(['01-操作者操作手册.md', '02-总指挥核心规则.md', '04-状态、目标变更与交接规范.md', '07-总指挥交接记录模板.md', '09-自动化授权与风险分级.md', '10-自动状态索引规范.md', '总指挥轻量交接启动配置.md', 'templates/HANDOFF_STATE.schema.json', '.github/scripts/HandoffSeal.mjs', '.github/scripts/Prepare-Handoff.mjs', '.github/scripts/Verify-Handoff-Candidate.mjs', '.github/scripts/HandoffWorkspaceScope.mjs', '.github/scripts/Rebase-Handoff-Draft.mjs', '.github/scripts/Mark-Handoff-Delivered.mjs']);
const RULE_CRITICAL_NAMES = new Set([...RULE_CRITICAL_PATHS].map(value => path.posix.basename(value)));
function ruleEpoch(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4}-\d{2}-\d{2})(?:\.(\d+))?$/.exec(value);
  if (!match) return null;
  const date = new Date(`${match[1]}T00:00:00.000Z`);
  const revision = Number(match[2] ?? 0);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== match[1] || !Number.isSafeInteger(revision)) return null;
  return [date.getTime(), revision];
}
export function classifyRuleDrift({ pinned, live, changedPaths = null } = {}) {
  const oldEpoch = ruleEpoch(pinned?.rule_version), newEpoch = ruleEpoch(live?.rule_version);
  if (!oldEpoch || !newEpoch || !/^[0-9a-f]{64}$/i.test(pinned?.manifest_sha256 ?? '') || !/^[0-9a-f]{64}$/i.test(live?.manifest_sha256 ?? '')) return { status: 'UNAVAILABLE', action: 'STOP_AFFECTED' };
  if (String(pinned.rule_version) === String(live.rule_version) && String(pinned.manifest_sha256).toLowerCase() === String(live.manifest_sha256).toLowerCase()) return { status: 'SAME', action: 'CONTINUE' };
  // Compatibility is only a classification; production still needs trusted delta evidence.
  if (newEpoch[0] < oldEpoch[0] || (newEpoch[0] === oldEpoch[0] && newEpoch[1] <= oldEpoch[1])) return { status: 'AFFECTED_RECHECK', action: 'REBASE' };
  const validPaths = Array.isArray(changedPaths) && changedPaths.every(value => typeof value === 'string' && value.length > 0 && !/^[A-Za-z]:/.test(value) && !path.isAbsolute(value) && !value.replaceAll('\\', '/').split('/').some(part => !part || part === '.' || part === '..'));
  const normalized = validPaths ? changedPaths.map(value => value.replaceAll('\\', '/')) : null;
  const affected = normalized === null || normalized.some(value => RULE_CRITICAL_PATHS.has(value) || RULE_CRITICAL_NAMES.has(path.posix.basename(value)) || value.split('/').includes('templates'));
  return affected ? { status: 'AFFECTED_RECHECK', action: 'REBASE' } : { status: 'NEWER_COMPATIBLE', action: 'CONTINUE' };
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function verifyCurrentDocument(file, label) {
  const content = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  const markers = ['<!-- CURRENT:BEGIN -->', '<!-- CURRENT:END -->', '<!-- HISTORY:BEGIN -->'];
  for (const marker of markers) if (content.split(marker).length !== 2) throw new Error(`${label}: ${marker} must appear exactly once`);
  const begin = content.indexOf(markers[0]);
  const end = content.indexOf(markers[1]);
  const history = content.indexOf(markers[2]);
  if (!(begin < end && end < history)) throw new Error(`${label}: CURRENT/HISTORY markers are out of order`);
  if (!content.slice(begin + markers[0].length, end).trim()) throw new Error(`${label}: CURRENT block is empty`);
  const gap = content.slice(end + markers[1].length, history).replace(/<!--[\s\S]*?-->/g, '').trim();
  if (gap) throw new Error(`${label}: body text exists outside CURRENT and before HISTORY`);
}

function currentBlock(file, label) {
  const content = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  verifyCurrentDocument(file, label);
  const begin = content.indexOf('<!-- CURRENT:BEGIN -->') + '<!-- CURRENT:BEGIN -->'.length;
  const end = content.indexOf('<!-- CURRENT:END -->');
  return content.slice(begin, end);
}

function verifyProjectBinding(sourceRoot, statusIndexPath, draft, projectKey) {
  const block = currentBlock(statusIndexPath, 'status_index');
  if (!/^项目键：[^\r\n]+$/m.test(block)) throw new Error('status_index current block is missing a project key');
  const statusProjectKey = block.match(/^项目键：([^\r\n]+)$/m)?.[1]?.trim();
  if (!projectKey || statusProjectKey !== projectKey) throw new Error(`status_index project key does not match configuration: ${projectKey}`);
  const remoteRef = draft.remote?.default_ref;
  const remoteLine = block.split(/\r?\n/).find(line => line.startsWith('远端目标：'));
  if (!remoteRef || !remoteLine || remoteLine.slice('远端目标：'.length).trim() !== remoteRef) {
    throw new Error(`status_index current block does not bind the handoff to remote target: ${remoteRef}`);
  }
  if (!draft.workspace?.head || !block.includes(draft.workspace.head)) throw new Error('status_index current block does not contain the sealed workspace HEAD');
  const rootPrefix = spawnSync('git', ['-C', sourceRoot, 'rev-parse', '--show-prefix'], { encoding: 'utf8' });
  if (rootPrefix.status !== 0 || rootPrefix.stdout.trim() !== '') throw new Error('source_root is not the Git repository root used by the handoff');
}

function verifyRuleManifestBinding(statusIndexPath, manifestDigest) {
  const block = currentBlock(statusIndexPath, 'status_index');
  const match = block.match(/规则清单摘要：([0-9a-f]{64})/i);
  if (!match) throw new Error('status_index current block is missing 规则清单摘要');
  if (match[1].toLowerCase() !== manifestDigest.toLowerCase()) throw new Error(`status_index rule manifest digest mismatch: expected ${manifestDigest}, found ${match[1]}`);
}

export function findActiveControlPlaneIndexes(sourceRoot, canonicalStatusIndex, registry = null) {
  const historical = new Set((registry?.legacy_indexes ?? []).filter(item => item?.status === 'HISTORICAL_ONLY').map(item => item.path));
  const found = [];
  const walk = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      // Skip protected subtrees before enumeration; all other real directories remain in scope.
      if (entry.isDirectory() && ['其他资料', '全局提示词（严禁AI自动修改）'].includes(entry.name)) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (entry.isFile() && entry.name === 'AI状态索引.md') {
        const resolved = fs.realpathSync(absolute);
        if (resolved !== canonicalStatusIndex) {
          const content = fs.readFileSync(resolved, 'utf8');
          const relative = path.relative(sourceRoot, resolved).replaceAll('\\', '/');
          if (content.includes('<!-- CURRENT:BEGIN -->') && !historical.has(relative)) found.push(relative);
        }
      }
    }
  };
  walk(sourceRoot);
  return found;
}

export function verifyRuleManifest(ruleRoot, manifestPath) {
  const manifest = readJson(manifestPath);
  if (manifest?.schema_version !== 1 || !Array.isArray(manifest.rules)) throw new Error('rule manifest must use schema_version 1 and a rules array');
  const rootRef = manifest.repository_root_ref ?? '../..';
  const prefixes = manifest.repository_root_prefixes ?? ['.github/'];
  if (rootRef !== '../..' || !Array.isArray(prefixes) || !prefixes.includes('.github/') ||
      prefixes.some(prefix => typeof prefix !== 'string' || !/^[^/\\]+(?:\/[^/\\]+)*\/$/.test(prefix) || prefix.split('/').some(part => part === '..' || part === '.'))) {
    throw new Error('rule manifest has invalid repository root metadata');
  }
  const repositoryRoot = path.resolve(ruleRoot, rootRef);
  const entries = new Map(manifest.rules.map(item => [item?.path_ref, item]));
  if (entries.size !== manifest.rules.length) throw new Error('rule manifest contains duplicate paths');
  for (const relative of REQUIRED_RULES) {
    const ruleRelative = relative.startsWith('总指挥工作流/第二代总指挥的工作模式/') ? relative.slice('总指挥工作流/第二代总指挥的工作模式/'.length) : relative;
    const item = entries.get(relative) ?? entries.get(ruleRelative);
    if (!item || !/^[0-9a-f]{64}$/i.test(item.sha256 || '')) throw new Error(`rule manifest is missing a valid digest: ${relative}`);
  }
  // Required legacy entries and new registered dependencies share one digest gate.
  for (const item of manifest.rules) {
    const relative = item?.path_ref;
    if (typeof relative !== 'string' || !relative || path.isAbsolute(relative) || relative.split(/[\\/]/).includes('..') || !/^[0-9a-f]{64}$/i.test(item.sha256 || '')) {
      throw new Error('rule manifest contains an invalid entry');
    }
    const ruleRelative = relative.startsWith('总指挥工作流/第二代总指挥的工作模式/')
      ? relative.slice('总指挥工作流/第二代总指挥的工作模式/'.length) : relative;
    const fromRepository = prefixes.some(prefix => relative.startsWith(prefix));
    const baseRoot = fromRepository ? repositoryRoot : ruleRoot;
    const absolute = fs.realpathSync(path.resolve(baseRoot, fromRepository ? relative : ruleRelative));
    if (!isInside(fs.realpathSync(baseRoot), absolute)) throw new Error(`rule path escapes workflow root: ${relative}`);
    if (sha256(fs.readFileSync(absolute)).toLowerCase() !== String(item.sha256).toLowerCase()) throw new Error(`rule digest mismatch: ${relative}`);
  }
  for (const tool of ['.github/scripts/HandoffSeal.mjs', '.github/scripts/Prepare-Handoff.mjs']) {
    const tracked = spawnSync('git', ['-C', repositoryRoot, 'ls-files', '--error-unmatch', '--', tool], { encoding: 'utf8' });
    if (tracked.status !== 0) throw new Error(`handoff tool is not tracked in the verified workflow repository: ${tool}`);
  }
  return manifest;
}

function readGitWorkspaceBaseline(sourceRoot, requiredRefs = [], inflightScope = null) {
  if (inflightScope !== null) return readScopedWorkspaceBaseline(sourceRoot, requiredRefs, inflightScope);
  const run = args => spawnSync('git', ['-C', sourceRoot, ...args], { encoding: 'utf8' });
  const head = run(['rev-parse', 'HEAD']);
  if (head.status !== 0) return null;
  const branch = run(['symbolic-ref', '--short', '-q', 'HEAD']);
  const tree = run(['rev-parse', 'HEAD^{tree}']);
  const status = run(['status', '--porcelain=v1', '-z']);
  const diff = spawnSync('git', ['-C', sourceRoot, 'diff', '--binary', 'HEAD', '--'], { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 });
  const untracked = spawnSync('git', ['-C', sourceRoot, 'ls-files', '-z', '--others', '--exclude-standard'], { encoding: 'buffer', maxBuffer: 16 * 1024 * 1024 });
  if ([head, tree, status, diff, untracked].some(result => result.status !== 0)) throw new Error('cannot read live Git workspace baseline');
  const tokens = status.stdout.split('\0').filter(Boolean);
  const entries = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const entry = tokens[index];
    if (!/^[ MARCUDT?!]{2}/.test(entry)) continue;
    entries.push(entry);
    if (entry[0] === 'R' || entry[0] === 'C' || entry[1] === 'R' || entry[1] === 'C') index += 1;
  }
  const staged = entries.filter(entry => entry[0] !== ' ' && entry.slice(0, 2) !== '??').length;
  const trackedModified = entries.filter(entry => entry[1] !== ' ' && entry.slice(0, 2) !== '??').length;
  const untrackedCount = entries.filter(entry => entry.slice(0, 2) === '??').length;
  const refs = new Set(untracked.stdout.toString('utf8').split('\0').filter(Boolean).map(value => value.replaceAll('\\', '/')));
  for (const ref of requiredRefs) refs.add(ref.replaceAll('\\', '/'));
  const untrackedFiles = [...refs].sort().map(ref => {
    const absolute = path.resolve(sourceRoot, ref);
    if (!isInside(sourceRoot, absolute) || !fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) throw new Error(`cannot fingerprint untracked path: ${ref}`);
    return { path_ref: ref, sha256: sha256(fs.readFileSync(absolute)) };
  });
  const untrackedDigest = sha256(Buffer.from(JSON.stringify(untrackedFiles), 'utf8'));
  return { head: head.stdout.trim(), branch: branch.stdout.trim() || 'HEAD', tree: tree.stdout.trim(), staged_count: staged, tracked_modified_count: trackedModified, untracked_count: untrackedCount, worktree_fingerprint: { algorithm: 'git-diff-binary+untracked-content-sha256-v1', tracked_diff_sha256: sha256(diff.stdout), untracked_digest: untrackedDigest } };
}

// A handoff draft may have been assembled before a local push completed.  The
// draft's remote block is therefore only a claim until the final preflight
// queries the configured remote again.  This probe deliberately avoids fetch:
// it reads the remote advertisement without changing the repository.
export function readLiveRemoteBaseline(sourceRoot, defaultRef) {
  const head = spawnSync('git', ['-C', sourceRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
  // Synthetic contract fixtures may not have a commit or a remote.  A real
  // formal handoff always has a Git HEAD; callers treat null as a test-only
  // unavailable probe and keep the existing workspace gate in force.
  if (head.status !== 0) return null;
  const remotes = spawnSync('git', ['-C', sourceRoot, 'remote'], { encoding: 'utf8' });
  if (remotes.status !== 0) throw new Error('cannot enumerate Git remotes for live handoff verification');
  const names = remotes.stdout.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
  let remoteName;
  let ref;
  if (/^refs\//.test(defaultRef)) {
    remoteName = names.includes('origin') ? 'origin' : names[0];
    ref = defaultRef;
  } else {
    const slash = defaultRef.indexOf('/');
    remoteName = slash > 0 ? defaultRef.slice(0, slash) : undefined;
    const branch = slash > 0 ? defaultRef.slice(slash + 1) : defaultRef;
    ref = branch.startsWith('refs/') ? branch : `refs/heads/${branch}`;
  }
  if (!remoteName || !names.includes(remoteName)) throw new Error(`remote target is not configured locally: ${defaultRef}`);
  const result = spawnSync('git', ['-C', sourceRoot, 'ls-remote', '--exit-code', remoteName, ref], { encoding: 'utf8' });
  let advertised = result.status === 0 ? result.stdout.trim().split(/\s+/)[0] : '';
  // Some locked-down environments allow api.github.com but reset the Git
  // smart-HTTP request to github.com. For a public GitHub remote, use the
  // read-only REST ref endpoint as a transport fallback; do not change the
  // repository or silently fall back for non-GitHub remotes.
  if (!/^[0-9a-f]{40,64}$/i.test(advertised)) {
    const remoteUrl = spawnSync('git', ['-C', sourceRoot, 'remote', 'get-url', remoteName], { encoding: 'utf8' });
    const match = remoteUrl.status === 0
      ? remoteUrl.stdout.trim().match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/i)
      : null;
    const branchMatch = ref.match(/^refs\/heads\/(.+)$/);
    if (match && branchMatch) {
      const apiUrl = `https://api.github.com/repos/${match[1]}/${match[2]}/git/ref/heads/${encodeURIComponent(branchMatch[1])}`;
      const api = spawnSync(process.platform === 'win32' ? 'curl.exe' : 'curl', ['-fsSL', '--max-time', '20', apiUrl], { encoding: 'utf8' });
      if (api.status === 0) {
        try { advertised = JSON.parse(api.stdout)?.object?.sha || ''; } catch { advertised = ''; }
      }
    }
  }
  if (!/^[0-9a-f]{40,64}$/i.test(advertised)) throw new Error(`cannot read live remote baseline for ${defaultRef}: ${String(result.stderr || '').trim() || 'ls-remote and GitHub API fallback failed'}`);
  if (!/^[0-9a-f]{40,64}$/i.test(advertised)) throw new Error(`live remote returned an invalid head for ${defaultRef}`);
  return { head: advertised.toLowerCase(), observed_at: new Date().toISOString(), remote_name: remoteName, ref };
}

export { readGitWorkspaceBaseline };

export function verifyWorkspaceBaseline(sourceRoot, workspace, sources = {}, context = {}) {
  const algorithm = workspace?.worktree_fingerprint?.algorithm;
  if (workspace && Object.hasOwn(workspace, 'inflight_scope') && !workspace.inflight_scope) return ['explicit workspace scope cannot be null or empty'];
  if (algorithm && !['git-diff-binary+untracked-content-sha256-v1', SCOPED_WORKSPACE_ALGORITHM].includes(algorithm)) return ['unknown workspace fingerprint algorithm'];
  if ((algorithm === SCOPED_WORKSPACE_ALGORITHM) !== Boolean(workspace?.inflight_scope)) return ['workspace scope and algorithm must match'];
  const scopeErrors = validateScopedWorkspaceSources(workspace, sources, { ...context, sourceRoot });
  if (scopeErrors.length) return scopeErrors;
  let live;
  try { live = readGitWorkspaceBaseline(sourceRoot, workspace?.required_untracked?.map(item => item.path_ref) ?? [], workspace?.inflight_scope ?? null); }
  catch (error) { return [`workspace verification failed: ${error.message}`]; }
  if (!live) return [];
  if (!workspace) return ['workspace baseline is missing'];
  if (!/^[0-9a-f]{40,64}$/i.test(workspace.head || '') || !workspace.worktree_fingerprint) return ['workspace baseline fingerprint is missing or invalid'];
  const errors = [];
  for (const key of ['head', 'tree', 'branch', 'staged_count', 'tracked_modified_count', 'untracked_count']) {
    if (String(live[key]) !== String(workspace[key])) errors.push(`workspace baseline drift: ${key} expected ${workspace[key]}, found ${live[key]}`);
  }
  for (const key of ['algorithm', 'tracked_diff_sha256', 'untracked_digest', ...(algorithm === SCOPED_WORKSPACE_ALGORITHM ? ['index_sha256'] : [])]) {
    if (String(live.worktree_fingerprint[key]) !== String(workspace.worktree_fingerprint[key])) errors.push(`workspace baseline drift: worktree_fingerprint.${key}`);
  }
  return errors;
}

export function detectUnicodeCollisions(items) {
  const normalized = new Map();
  for (const item of items) {
    const key = item.normalize('NFC');
    if (normalized.has(key) && normalized.get(key) !== item) throw new Error(`Unicode normalization collision: ${normalized.get(key)} <> ${item}`);
    normalized.set(key, item);
  }
}

function unicodeInventory(sourceRoot, refs) {
  const result = spawnSync('git', ['-C', sourceRoot, 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], { encoding: 'buffer', maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0) throw new Error('cannot read the source repository path inventory with NUL-delimited Git output');
  const paths = new Set(refs);
  for (const item of result.stdout.toString('utf8').split('\0')) if (item) paths.add(item.replaceAll('\\', '/'));
  detectUnicodeCollisions(paths);
  return { mode: 'GIT_NUL', count: paths.size };
}

function sourceRootFor(source, sourceRoot, externalControlPlaneRoot) {
  if (source?.root_ref === 'external_control_plane') {
    if (!externalControlPlaneRoot) throw new Error('external control-plane source requires external_control_plane_root');
    return externalControlPlaneRoot;
  }
  return sourceRoot;
}

function resolveSource(source, sourceRoot, externalControlPlaneRoot, label) {
  const root = sourceRootFor(source, sourceRoot, externalControlPlaneRoot);
  const resolved = fs.realpathSync(path.resolve(root, source.path_ref));
  if (!isInside(root, resolved)) throw new Error(`${label} escapes its declared source root`);
  return resolved;
}

function atomicWriteExclusive(finalPath, bytes) {
  fs.mkdirSync(path.dirname(finalPath), { recursive: true });
  if (fs.existsSync(finalPath)) throw new Error(`refusing to overwrite existing output: ${finalPath}`);
  const tempPath = path.join(path.dirname(finalPath), `.${path.basename(finalPath)}.${process.pid}.tmp`);
  const fd = fs.openSync(tempPath, 'wx');
  try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.linkSync(tempPath, finalPath);
  fs.unlinkSync(tempPath);
}

function hydrateSnapshotTemplate(template, { draft, sourceRoot, externalControlPlaneRoot, ruleRoot, ruleManifest, ruleManifestDigest, sealDirectory, receiptPath }) {
  const machineRecord = draft.sources?.handoff_inventory?.path_ref
    ? resolveSource(draft.sources.handoff_inventory, sourceRoot, externalControlPlaneRoot, 'handoff_inventory')
    : '待见机器记录';
  const rows = [
    ['总指挥轻量交接启动配置.md', ruleManifest.rules.find(item => item.path_ref === '总指挥轻量交接启动配置.md')?.sha256],
    ...['02-总指挥核心规则.md', '04-状态、目标变更与交接规范.md', '07-总指挥交接记录模板.md', '09-自动化授权与风险分级.md', '10-自动状态索引规范.md']
      .map(name => [name, ruleManifest.rules.find(item => item.path_ref === name)?.sha256])
  ];
  // Synthetic unit-test manifests may intentionally contain only a minimal rule set;
  // production manifests are checked by Inspect-RuleRefresh before this path.
  if (rows.some(([, digest]) => !digest)) return template;
  const baseline = [
    '## 轻量加载基线', '',
    `完整读取“总指挥轻量交接启动配置.md”（版本${ruleManifest.rule_version}），自行建立加载记录。以下路径均相对规则根；指纹一致时候选不全文读取02/04/07/09/10，冲突或下一动作依赖才展开受影响正文。`, '',
    '| 文件 | SHA-256 |', '|---|---|',
    ...rows.map(([name, digest]) => `| ${name} | ${digest} |`), '',
    `规则总清单：规则刷新manifest.json，SHA-256=${ruleManifestDigest}。必要未提交测试为${draft.workspace?.required_untracked?.map(item => item.path_ref).join('、') || '无'}；全部保留清单及工作区聚合指纹见机器记录与封条。`, ''
  ].join('\n');
  let rendered = template.replace(/## 轻量加载基线[\s\S]*?(?=\n## 使用边界)/, baseline);
  const replacements = new Map([
    ['{{SOURCE_ROOT}}', sourceRoot],
    ['{{RULE_ROOT}}', ruleRoot],
    ['{{SEAL_DIRECTORY}}', sealDirectory],
    ['{{MACHINE_RECORD}}', machineRecord],
    ['{{RECEIPT_PATH}}', receiptPath],
  ]);
  for (const [token, value] of replacements) rendered = rendered.replaceAll(token, value);
  rendered = rendered.replace(/^- 项目根：.*$/m, `- 项目根：${sourceRoot}`)
    .replace(/^- 规则根：.*$/m, `- 规则根：${ruleRoot}`)
    .replace(/^- 本轮规则版本：.*$/m, `- 本轮规则版本：${ruleManifest.rule_version}`)
    .replace(/^- 机器记录：.*$/m, `- 机器记录：${machineRecord}`)
    .replace(/^- 当前封条目录：.*$/m, `- 当前封条目录：${sealDirectory}`)
    .replace(/^- 独立生成回执：.*$/m, `- 独立生成回执：${receiptPath}；生成未发送是正常状态，本附件实际收到才构成送达，不继承旧回执。`);
  if (rendered.includes('2534edaee5ebf7e06111e662a0f99b73c75419795a49c242c0f04a880b138e8c') || rendered.includes('230eb69c68b8b5bc346564dd4c6104f460d3a6cea7822f1f563bde8d1ec01525')) {
    throw new Error('snapshot template contains a stale rule fingerprint');
  }
  return rendered;
}

export function prepareFormalHandoff(configPath) {
  const absoluteConfig = path.resolve(configPath);
  const configDir = path.dirname(absoluteConfig);
  const config = readJson(absoluteConfig);
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('configuration must be an object');
  for (const key of Object.keys(config)) if (!CONFIG_KEYS.has(key)) throw new Error(`unknown configuration field: ${key}`);
  for (const key of ['seal_directory', 'source_root', 'draft_path', 'snapshot_template_path', 'final_output_path', 'receipt_output_path', 'rule_manifest_path', 'project_key']) if (typeof config[key] !== 'string' || !config[key]) throw new Error(`missing configuration field: ${key}`);
  if (config.preflight_only !== undefined && typeof config.preflight_only !== 'boolean') throw new Error('preflight_only must be boolean');
  const preflightOnly = config.preflight_only === true;

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const workflowRoot = fs.realpathSync(path.resolve(scriptDir, '..', '..'));
  const ruleRoot = fs.realpathSync(path.join(workflowRoot, '总指挥工作流', '第二代总指挥的工作模式'));
  const sealDirectory = resolveFrom(configDir, config.seal_directory);
  const sourceRoot = fs.realpathSync(resolveFrom(configDir, config.source_root));
  const externalControlPlaneRoot = config.external_control_plane_root ? fs.realpathSync(resolveFrom(configDir, config.external_control_plane_root)) : null;
  const draftPath = resolveFrom(configDir, config.draft_path);
  const templatePath = resolveFrom(configDir, config.snapshot_template_path);
  const finalPath = resolveFrom(configDir, config.final_output_path);
  const receiptPath = resolveFrom(configDir, config.receipt_output_path);
  const manifestPath = resolveFrom(configDir, config.rule_manifest_path);
  if (!/^[a-z0-9][a-z0-9._-]*-commander-handoff-\d{8}-final-\d+\.md$/i.test(path.basename(finalPath))) throw new Error('formal output filename must include project slug, date, final, and an incrementing number');
  if (finalPath === receiptPath) throw new Error('formal output and receipt must use different paths');
  const physicalFinalPath = physicalTarget(finalPath);
  const physicalReceiptPath = physicalTarget(receiptPath);
  if (isInside(workflowRoot, physicalFinalPath) || isInside(workflowRoot, physicalReceiptPath) || isInside(sourceRoot, physicalFinalPath) || isInside(sourceRoot, physicalReceiptPath) || (externalControlPlaneRoot && (isInside(externalControlPlaneRoot, physicalFinalPath) || isInside(externalControlPlaneRoot, physicalReceiptPath)))) throw new Error('formal output and receipt must be stored outside the workflow, source, and external control-plane repositories');
  if (fs.existsSync(finalPath) || fs.existsSync(receiptPath)) throw new Error('formal output or receipt already exists');

  const physicalSealDirectory = physicalTarget(sealDirectory);
  if (!isInside(sourceRoot, physicalSealDirectory)) throw new Error('seal directory must stay inside the source repository');
  if (!preflightOnly) fs.mkdirSync(sealDirectory, { recursive: true });
  const realSealDirectory = preflightOnly ? physicalSealDirectory : fs.realpathSync(sealDirectory);
  if (!isInside(sourceRoot, realSealDirectory)) throw new Error('seal directory must stay inside the source repository');
  const sealRelative = path.relative(sourceRoot, realSealDirectory).replaceAll('\\', '/');
  const ignored = spawnSync('git', ['-C', sourceRoot, 'check-ignore', '-q', '--', sealRelative]);
  if (ignored.status !== 0) throw new Error('seal directory must be excluded by the source repository .gitignore');

  const ruleManifestDigest = sha256(fs.readFileSync(manifestPath));
  const ruleManifest = verifyRuleManifest(ruleRoot, manifestPath);
  const liveManifestPath = config.live_rule_manifest_path ? resolveFrom(configDir, config.live_rule_manifest_path) : null;
  const liveRuleManifest = liveManifestPath ? verifyRuleManifest(ruleRoot, liveManifestPath) : null;
  const liveRuleManifestDigest = liveManifestPath ? sha256(fs.readFileSync(liveManifestPath)) : ruleManifestDigest;
  const draft = readJson(draftPath);
  if (draft.rule_baseline?.manifest_sha256?.toLowerCase() !== ruleManifestDigest.toLowerCase() || draft.rule_baseline?.rule_version !== ruleManifest.rule_version) throw new Error('RULE_REBASE_REQUIRED: candidate rule baseline is stale; rerun 1C/1D from the same breakpoint and current stable manifest');
  if (liveRuleManifest) {
    const drift = classifyRuleDrift({ pinned: { rule_version: ruleManifest.rule_version, manifest_sha256: ruleManifestDigest }, live: { rule_version: liveRuleManifest.rule_version, manifest_sha256: liveRuleManifestDigest } });
    const declared = draft.rule_baseline?.compatibility ?? 'SAME';
    if (drift.status !== declared && !(drift.status === 'SAME' && declared === 'NEWER_COMPATIBLE')) throw new Error(`RULE_REBASE_REQUIRED: live rule epoch is ${drift.status}; candidate declared ${declared}`);
  }
  const existingSealState = verifyChain(realSealDirectory, { sourceRoot, externalControlPlaneRoot, verifyLatestSources: false });
  const hasLegacySealRecords = existingSealState.records.some(record => record.schema_version < 3);
  if (draft.handoff_phase === 'CURRENT_MIGRATION' && hasLegacySealRecords) {
    throw new Error('LEGACY_MIGRATION_REQUIRES_EMPTY_V3_DIRECTORY: keep the v1/v2 seal directory read-only and configure a separate empty directory for the first v3 migration seal');
  }
  const allowedPreflightPhase = preflightOnly && draft.handoff_phase === 'CURRENT_MIGRATION';
  if (draft.schema_version !== 3 || (!allowedPreflightPhase && draft.handoff_phase !== 'MATERIAL_PREPARED') || (!allowedPreflightPhase && !['READY', 'READY_WITH_RESTRICTIONS'].includes(draft.switch_status))) throw new Error('formal handoff requires a schema v3 MATERIAL_PREPARED draft in READY or READY_WITH_RESTRICTIONS');
  const sourceRefs = Object.values(draft.sources ?? {}).filter(item => item.root_ref !== 'external_control_plane').map(item => item.path_ref);
  // required_untracked is a protection summary, not a formal source inventory.
  const inventory = unicodeInventory(sourceRoot, sourceRefs);
  for (const name of ['central_work_items', 'current_view', 'status_index']) {
    const source = draft.sources?.[name];
    if (!source) throw new Error(`missing canonical source: ${name}`);
    const sourcePath = resolveSource(source, sourceRoot, externalControlPlaneRoot, name);
    verifyCurrentDocument(sourcePath, name);
  }
  const canonicalStatusIndex = resolveSource(draft.sources.status_index, sourceRoot, externalControlPlaneRoot, 'status_index');
  verifyProjectBinding(sourceRoot, canonicalStatusIndex, draft, config.project_key);
  verifyRuleManifestBinding(canonicalStatusIndex, ruleManifestDigest);
  let registry = null;
  const registryRef = draft.sources?.control_plane_registry?.path_ref;
  if (registryRef) {
    const registryPath = resolveSource(draft.sources.control_plane_registry, sourceRoot, externalControlPlaneRoot, 'control_plane_registry');
    registry = readJson(registryPath);
    // A registry is owned by its declared source root. The canonical status
    // index may live in an external control plane, but legacy indexes listed
    // by the registry live alongside the registry in the code source root.
    const registryRoot = sourceRootFor(draft.sources.control_plane_registry, sourceRoot, externalControlPlaneRoot);
    const registryErrors = validateControlPlaneRegistry(registry, registryRoot, draft.sources.status_index.path_ref);
    if (registryErrors.length) throw new Error(`control-plane registry invalid: ${registryErrors.join('; ')}`);
  }
  const duplicateIndexes = findActiveControlPlaneIndexes(sourceRoot, canonicalStatusIndex, registry);
  if (duplicateIndexes.length) throw new Error(`DUPLICATE_CONTROL_PLANE: active AI status indexes outside canonical source: ${duplicateIndexes.join(', ')}`);

  // Validate and render the template before appending an immutable seal. A malformed
  // delivery template must not advance the seal chain without producing an artifact.
  let rendered = hydrateSnapshotTemplate(fs.readFileSync(templatePath, 'utf8'), {
    draft, sourceRoot, externalControlPlaneRoot, ruleRoot, ruleManifest, ruleManifestDigest, sealDirectory, receiptPath
  });
  const snapshotId = path.basename(finalPath, '.md');
  const templateTokens = ['{{SNAPSHOT_ID}}', '{{SEAL_DIGEST}}', '{{FACT_CUTOFF}}', '{{EVENT_ID}}'];
  for (const token of templateTokens) if (!rendered.includes(token)) throw new Error(`snapshot template is missing placeholder: ${token}`);

  const sourceDigestErrors = [];
  for (const [name, source] of Object.entries(draft.sources ?? {})) {
    const sourcePath = resolveSource(source, sourceRoot, externalControlPlaneRoot, name);
    if (sha256(fs.readFileSync(sourcePath)) !== source.digest) sourceDigestErrors.push(`${name}: source digest mismatch`);
    if (Date.parse(source.fact_cutoff) > Date.parse(draft.fact_cutoff)) sourceDigestErrors.push(`${name}: source fact_cutoff is after draft fact_cutoff`);
  }
  if (sourceDigestErrors.length) throw new Error(`preflight source verification failed: ${sourceDigestErrors.join('; ')}`);
  const identity = verifyControlIdentity(draft, { sourceRoot, externalControlPlaneRoot });
  if (identity.status !== 'PASS') throw new Error(`control identity preflight failed: ${identity.errors.join('; ')}`);
  const workspaceErrors = verifyWorkspaceBaseline(sourceRoot, draft.workspace, draft.sources, { externalControlPlaneRoot, ruleBaseline: draft.rule_baseline, workflowRepositoryRoot: workflowRoot });
  if (workspaceErrors.length) throw new Error(`preflight workspace verification failed: ${workspaceErrors.join('; ')}`);
  if (draft.remote?.status === 'PASS') {
    let liveRemote;
    try {
      liveRemote = readLiveRemoteBaseline(sourceRoot, draft.remote.default_ref);
    } catch (error) {
      // Only failed observation may be downgraded. An observed HEAD conflict
      // remains a drift error even for a restricted candidate.
      if (draft.switch_status !== 'READY_WITH_RESTRICTIONS') throw error;
      draft.remote = { status: 'UNKNOWN', default_ref: draft.remote.default_ref, head: null, observed_at: null };
      draft.control_handoff_confidence = 'MEDIUM';
      draft.candidate_verification_status = 'PASS_WITH_RESTRICTIONS';
    }
    if (liveRemote) {
        if (liveRemote.head !== String(draft.remote.head || '').toLowerCase()) {
          throw new Error(`preflight remote baseline drift: expected ${draft.remote.head}, found ${liveRemote.head}`);
        }
        // A retry for the same event must reuse the immutable observation that
        // already belongs to its seal.  Replacing only the timestamp on every
        // retry would make an otherwise reusable seal look different.
        const prior = existingSealState.latest;
        if (prior?.event_id === draft.event_id && prior.remote?.head === liveRemote.head) {
          draft.remote.head = prior.remote.head;
          draft.remote.observed_at = prior.remote.observed_at;
          draft.fact_cutoff = prior.fact_cutoff;
          draft.sealed_at = prior.sealed_at;
        } else {
          draft.remote.head = liveRemote.head;
          draft.remote.observed_at = liveRemote.observed_at;
          draft.fact_cutoff = liveRemote.observed_at;
          draft.sealed_at = liveRemote.observed_at;
        }
    }
  }
  if (preflightOnly) return {
    status: draft.switch_status === 'READY_WITH_RESTRICTIONS' ? 'READY_WITH_RESTRICTIONS' : 'READY',
    mode: 'PREFLIGHT_ONLY',
    project_key: config.project_key,
    source_root: sourceRoot,
    external_control_plane_root: externalControlPlaneRoot,
    source_count: Object.keys(draft.sources ?? {}).length,
    workspace_protection: {
      staged_count: draft.workspace?.staged_count ?? null,
      tracked_modified_count: draft.workspace?.tracked_modified_count ?? null,
      untracked_count: draft.workspace?.untracked_count ?? null,
      required_untracked_count: draft.workspace?.required_untracked?.length ?? 0,
      required_untracked_is_inventory: false
    },
    legacy_migration: draft.handoff_phase === 'CURRENT_MIGRATION' ? 'BOUND_TO_LEGACY_SUMMARY' : 'NONE'
  };

  // If a previous attempt appended the immutable seal but failed while writing
  // the external artifact, reuse that exact seal. This makes preparation
  // retryable without advancing the chain or inventing a second event.
  const preAppend = verifyChain(realSealDirectory, { sourceRoot, externalControlPlaneRoot, verifyLatestSources: false });
  let seal;
  const reusable = preAppend.latest && preAppend.latest.event_id === draft.event_id
    && preAppend.latest.generation === draft.generation
    && preAppend.latest.writer_id === draft.writer_id
    && preAppend.latest.handoff_phase === draft.handoff_phase
    && preAppend.latest.seal_digest === (() => {
      const candidate = { ...draft, seal_sequence: preAppend.latest.seal_sequence, previous_seal_digest: preAppend.latest.previous_seal_digest };
      return sealDigest(candidate);
    })();
  if (reusable) {
    seal = preAppend.latest;
  } else {
    seal = appendSeal(realSealDirectory, draft, {
      expectedPreviousDigest: config.expected_previous_digest,
      sourceRoot,
      externalControlPlaneRoot,
      transitionTicket: config.transition_ticket ? resolveFrom(configDir, config.transition_ticket) : undefined
    });
  }
  const verified = verifyChain(realSealDirectory, { sourceRoot, externalControlPlaneRoot });
  if (verified.status !== 'PASS' || !verified.handoff_ready || verified.latest?.seal_digest !== seal.seal_digest || verified.latest_source_status !== 'PASS') throw new Error(`new seal did not pass live verification: ${verified.errors.join('; ')}`);

  const replacements = {
    '{{SNAPSHOT_ID}}': snapshotId,
    '{{SEAL_DIGEST}}': seal.seal_digest,
    '{{FACT_CUTOFF}}': seal.fact_cutoff,
    '{{EVENT_ID}}': seal.event_id
  };
  const verificationCommand = `node "${path.join(scriptDir, 'HandoffSeal.mjs')}" verify "${realSealDirectory}" "${sourceRoot}"${externalControlPlaneRoot ? ` "--external-control-plane-root=${externalControlPlaneRoot}"` : ''}`;
  if (!rendered.includes('{{VERIFICATION_COMMAND}}') && !verificationCommandPattern.test(rendered)) {
    throw new Error('snapshot template is missing verification command placeholder or entry');
  }
  replacements['{{VERIFICATION_COMMAND}}'] = verificationCommand;
  for (const [token, value] of Object.entries(replacements)) {
    if (token === '{{VERIFICATION_COMMAND}}' && !rendered.includes(token)) continue;
    if (!rendered.includes(token)) throw new Error(`snapshot template is missing placeholder: ${token}`);
    rendered = rendered.replaceAll(token, value);
  }
  rendered = rendered.replace(verificationCommandPattern, verificationCommand);
  const renderedVerificationCommand = rendered.match(verificationCommandPattern)?.[0];
  if (renderedVerificationCommand !== verificationCommand) {
    throw new Error('snapshot verification command does not match the live seal directory and source root');
  }
  const finalBytes = Buffer.from(rendered, 'utf8');
  const tempSnapshot = path.join(path.dirname(finalPath), `.${path.basename(finalPath)}.${process.pid}.tmp`);
  fs.mkdirSync(path.dirname(finalPath), { recursive: true });
  const tempFd = fs.openSync(tempSnapshot, 'wx');
  try { fs.writeFileSync(tempFd, finalBytes); fs.fsyncSync(tempFd); } finally { fs.closeSync(tempFd); }
  try {
    if (sha256(fs.readFileSync(manifestPath)) !== ruleManifestDigest) throw new Error('RULE_SOURCE_DRIFTED: rule manifest changed while preparing the attachment; mark candidate RULE_REBASE_PENDING and rerun from the same breakpoint');
    verifyRuleManifest(ruleRoot, manifestPath);
    const finalVerification = verifyChain(realSealDirectory, { sourceRoot, externalControlPlaneRoot });
    if (finalVerification.status !== 'PASS' || !finalVerification.handoff_ready || finalVerification.latest?.seal_digest !== seal.seal_digest || finalVerification.latest_source_status !== 'PASS') throw new Error(`facts drifted while rendering the attachment: ${finalVerification.errors.join('; ')}`);
    const finalWorkspaceErrors = verifyWorkspaceBaseline(sourceRoot, seal.workspace, seal.sources, { externalControlPlaneRoot, ruleBaseline: seal.rule_baseline, workflowRepositoryRoot: workflowRoot });
    if (finalWorkspaceErrors.length) throw new Error(`workspace drifted while rendering the attachment: ${finalWorkspaceErrors.join('; ')}`);
    if (seal.remote?.status === 'PASS') {
      const finalLiveRemote = readLiveRemoteBaseline(sourceRoot, seal.remote.default_ref);
      if (finalLiveRemote && finalLiveRemote.head !== String(seal.remote.head || '').toLowerCase()) throw new Error(`remote baseline drifted while rendering the attachment: expected ${seal.remote.head}, found ${finalLiveRemote.head}`);
    }
    const receipt = {
      schema_version: 1,
      artifact_status: 'GENERATED_NOT_DELIVERED',
      snapshot_id: path.basename(finalPath, '.md'),
      snapshot_file: path.basename(finalPath),
      snapshot_sha256: sha256(finalBytes),
      seal_digest: seal.seal_digest,
      fact_cutoff: seal.fact_cutoff,
      event_id: seal.event_id,
      rule_manifest_sha256: ruleManifestDigest,
      rule_baseline: draft.rule_baseline ?? { rule_version: ruleManifest.rule_version, manifest_sha256: ruleManifestDigest, mode: 'LIVE', source_role: 'PUBLIC_RULE_SOURCE', compatibility: 'SAME', action: 'CONTINUE' },
      rule_drift_status: draft.rule_baseline?.compatibility ?? 'SAME',
      live_rule_manifest_sha256: liveRuleManifestDigest,
      unicode_inventory: inventory,
      verification: {
        tool: 'HandoffSeal.mjs',
        command: verificationCommand,
        source_root: sourceRoot,
        external_control_plane_root: externalControlPlaneRoot,
        expected: { status: 'PASS', latest_source_status: 'PASS', handoff_ready: true }
      }
    };
    if (physicalTarget(finalPath) !== physicalFinalPath || physicalTarget(receiptPath) !== physicalReceiptPath) throw new Error('output path resolution drifted while preparing the attachment');
    atomicWriteExclusive(receiptPath, Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`, 'utf8'));
    if (physicalTarget(finalPath) !== physicalFinalPath) throw new Error('formal output path resolution drifted before finalization');
    fs.linkSync(tempSnapshot, finalPath);
    fs.unlinkSync(tempSnapshot);
    return { final_path: finalPath, receipt_path: receiptPath, receipt, chain_status: finalVerification.status };
  } catch (error) {
    if (fs.existsSync(tempSnapshot)) fs.unlinkSync(tempSnapshot);
    throw error;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  if (process.argv.length !== 3) { console.error('usage: node Prepare-Handoff.mjs <config-json>'); process.exitCode = 2; }
  else {
    try { console.log(JSON.stringify(prepareFormalHandoff(process.argv[2]), null, 2)); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
  }
}
