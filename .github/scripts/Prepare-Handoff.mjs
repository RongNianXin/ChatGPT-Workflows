// Atomic formal-handoff preparation. It creates a final-* artifact only after every gate passes.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { SCOPED_WORKSPACE_ALGORITHM, FULL_WORKSPACE_ALGORITHM, LEGACY_WORKSPACE_ALGORITHM, readWorkspaceFile, readScopedWorkspaceBaseline, validateScopedWorkspaceSources } from './HandoffWorkspaceScope.mjs';
import { fileURLToPath } from 'node:url';
import { appendSeal, inspectHistoricalRestrictedRecovery, planSealAppend, validateControlPlaneRegistry, validateSealDraftForAppend, verifyChain, verifyControlIdentity, HISTORICAL_UNVERIFIED, HISTORICAL_WORKSPACE_RESTRICTION, HISTORICAL_SOURCE_RESTRICTION, normalizeCurrentMigrationDraft } from './HandoffSeal.mjs';
import { assertPrivateControlStorage } from './HandoffControl.mjs';
import { readAuthenticatedGitHubRef, verifiedGitHubHead } from './Query-HandoffAuthenticatedRef.mjs';
import { verifyReceiverReadiness } from './Receiver-Readiness.mjs';

export const REQUIRED_RULES = [
  '.github/scripts/HandoffControl.mjs',
  '.github/scripts/HandoffTransactionWorkspace.mjs',
  '.github/scripts/Takeover-Handoff.mjs',
  '.github/scripts/Recover-CommanderAuthority.mjs',
  '.github/scripts/Receiver-State-Adoption.mjs',
  '.github/scripts/Receiver-Readiness.mjs',
  '.github/scripts/HandoffWorkspaceScope.mjs',
  '.github/scripts/HandoffSeal.mjs',
  '.github/scripts/Prepare-Handoff.mjs',
  '.github/scripts/Query-HandoffAuthenticatedRef.mjs',
  '.github/scripts/Mark-Handoff-Delivered.mjs',
  '总指挥工作流/第二代总指挥的工作模式/templates/HANDOFF_STATE.schema.json',
  '总指挥工作流/第二代总指挥的工作模式/01-操作者操作手册.md',
  '总指挥工作流/第二代总指挥的工作模式/02-总指挥核心规则.md',
  '总指挥工作流/第二代总指挥的工作模式/04-状态、目标变更与交接规范.md',
  '总指挥工作流/第二代总指挥的工作模式/07-总指挥交接记录模板.md',
  '总指挥工作流/第二代总指挥的工作模式/09-自动化授权与风险分级.md',
  '总指挥工作流/第二代总指挥的工作模式/10-自动状态索引规范.md',
  '总指挥工作流/第二代总指挥的工作模式/总指挥轻量交接启动配置.md'
];
const CONFIG_KEYS = new Set(['seal_directory', 'legacy_seal_directory', 'source_root', 'external_control_plane_root', 'draft_path', 'snapshot_template_path', 'final_output_path', 'receipt_output_path', 'rule_manifest_path', 'live_rule_manifest_path', 'expected_previous_digest', 'transition_ticket', 'project_key', 'preflight_only']);
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
const verificationCommandPattern = /node\s+"[^"]*HandoffSeal\.mjs"\s+verify\s+"[^"]+"\s+"[^"]+"(?:\s+"--external-control-plane-root=[^"]+")?(?:\s+--summary)?/;

const RULE_CRITICAL_PATHS = new Set(['.github/scripts/Query-HandoffAuthenticatedRef.mjs', '.github/scripts/HandoffControl.mjs', '.github/scripts/Takeover-Handoff.mjs', '01-操作者操作手册.md', '02-总指挥核心规则.md', '04-状态、目标变更与交接规范.md', '07-总指挥交接记录模板.md', '09-自动化授权与风险分级.md', '10-自动状态索引规范.md', '总指挥轻量交接启动配置.md', 'templates/HANDOFF_STATE.schema.json', '.github/scripts/HandoffSeal.mjs', '.github/scripts/Prepare-Handoff.mjs', '.github/scripts/Verify-Handoff-Candidate.mjs', '.github/scripts/HandoffWorkspaceScope.mjs', '.github/scripts/Rebase-Handoff-Draft.mjs', '.github/scripts/Mark-Handoff-Delivered.mjs']);
RULE_CRITICAL_PATHS.add('.github/scripts/HandoffTransactionWorkspace.mjs');
RULE_CRITICAL_PATHS.add('.github/scripts/Recover-CommanderAuthority.mjs');
RULE_CRITICAL_PATHS.add('.github/scripts/Receiver-State-Adoption.mjs');
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

function collectFullWorkspaceBaseline(sourceRoot, requiredRefs, algorithm) {
  sourceRoot = fs.realpathSync(sourceRoot);
  const env = { ...process.env, GIT_OPTIONAL_LOCKS: '0' };
  const run = args => spawnSync('git', ['-C', sourceRoot, ...args], { encoding: 'utf8', env, windowsHide: true, timeout: 30000 });
  const head = run(['rev-parse', 'HEAD']);
  if (head.status !== 0) throw new Error('cannot read live Git HEAD');
  const branch = run(['symbolic-ref', '--short', '-q', 'HEAD']);
  const tree = run(['rev-parse', 'HEAD^{tree}']);
  const status = run(['status', '--porcelain=v1', '-z']);
  const bytes = args => spawnSync('git', ['-C', sourceRoot, ...args], { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024, env, windowsHide: true, timeout: 30000 });
  const diff = bytes(['diff', '--binary', 'HEAD', '--']);
  const untracked = bytes(['ls-files', '-z', '--others', '--exclude-standard']);
  const index = algorithm === FULL_WORKSPACE_ALGORITHM ? bytes(['ls-files', '--stage', '-z']) : null;
  if ([head, tree, status, diff, untracked, ...(index ? [index] : [])].some(result => result.status !== 0)
    || ![0, 1].includes(branch.status)) throw new Error('cannot read live Git workspace baseline');
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
    return { path_ref: ref, sha256: sha256(readWorkspaceFile(sourceRoot, ref)) };
  });
  const untrackedDigest = sha256(Buffer.from(JSON.stringify(untrackedFiles), 'utf8'));
  return { head: head.stdout.trim(), branch: branch.stdout.trim() || 'HEAD', tree: tree.stdout.trim(), staged_count: staged, tracked_modified_count: trackedModified, untracked_count: untrackedCount, worktree_fingerprint: { algorithm, tracked_diff_sha256: sha256(diff.stdout), untracked_digest: untrackedDigest, ...(index ? { index_sha256: sha256(index.stdout) } : {}) } };
}

function readGitWorkspaceBaseline(sourceRoot, requiredRefs = [], inflightScope = null, { algorithm = inflightScope ? SCOPED_WORKSPACE_ALGORITHM : FULL_WORKSPACE_ALGORITHM } = {}) {
  if (inflightScope !== null) {
    if (algorithm !== SCOPED_WORKSPACE_ALGORITHM) throw new Error('workspace scope and algorithm must match');
    return readScopedWorkspaceBaseline(sourceRoot, requiredRefs, inflightScope);
  }
  if (![LEGACY_WORKSPACE_ALGORITHM, FULL_WORKSPACE_ALGORITHM].includes(algorithm)) throw new Error('unknown workspace fingerprint algorithm');
  const first = collectFullWorkspaceBaseline(sourceRoot, requiredRefs, algorithm);
  // Historical V1 keeps its exact digest definition. New observations bind the
  // index separately and reject changes between two complete reads.
  if (algorithm === LEGACY_WORKSPACE_ALGORITHM) return first;
  const second = collectFullWorkspaceBaseline(sourceRoot, requiredRefs, algorithm);
  if (JSON.stringify(first) !== JSON.stringify(second)) throw new Error('workspace changed during full observation');
  return second;
}

// A handoff draft may have been assembled before a local push completed.  The
// draft's remote block is therefore only a claim until the final preflight
// queries the configured remote again.  This probe deliberately avoids fetch:
// it reads the remote advertisement without changing the repository.
export function readLiveRemoteBaseline(sourceRoot, defaultRef, {
  run = spawnSync, now = () => performance.now(), timeoutMs = 10000, authenticatedFallback = true, resolveCommand
} = {}) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) throw new Error('invalid remote observation time limit');
  if (typeof authenticatedFallback !== 'boolean') throw new Error('invalid authenticated transport policy');
  const validHead = value => typeof value === 'string' && /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(value);
  const deadline = now() + timeoutMs;
  const env = { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never', GIT_OPTIONAL_LOCKS: '0' };
  for (const key of Object.keys(env)) if (/^(?:GIT_ASKPASS|SSH_ASKPASS|GIT_SSH|GIT_SSH_COMMAND|GIT_CONFIG_COUNT|GIT_CONFIG_(?:KEY|VALUE)_\d+)$/i.test(key)) delete env[key];
  env.GIT_SSH_COMMAND = 'ssh -oBatchMode=yes -oStrictHostKeyChecking=yes -oConnectTimeout=3';
  env.GIT_SSH_VARIANT = 'ssh';
  const fail = (code, message) => Object.assign(new Error(message), { code });
  const probe = (exe, args, { timeoutCap = 5000, optional = false, environment = env } = {}) => {
    const remaining = Math.floor(deadline - now());
    if (remaining <= 0) throw fail('REMOTE_PROBE_TIMEOUT', 'remote observation time limit exceeded');
    const result = run(exe, args, { encoding: 'utf8', env: environment, shell: false, windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'], timeout: Math.min(remaining, timeoutCap), killSignal: 'SIGKILL', maxBuffer: 1024 * 1024 });
    if (now() > deadline) throw fail('REMOTE_PROBE_TIMEOUT', 'remote observation time limit exceeded');
    if (optional && result.error?.code === 'ENOENT' && !result.signal) return { status: 1, stdout: '' };
    if (result.error || result.signal || result.status === null) throw fail(
      result.error?.code === 'ETIMEDOUT' ? 'REMOTE_PROBE_TIMEOUT' : 'REMOTE_PROBE_ABORTED',
      'remote observation aborted; no readiness evidence was produced');
    return result;
  };
  const git = args => probe('git', ['-C', sourceRoot, '-c', 'credential.helper=', '-c', 'core.askPass=',
    '-c', 'credential.interactive=never', '-c', 'protocol.ext.allow=never', ...args]);
  const head = git(['rev-parse', 'HEAD']);
  if (head.status !== 0) throw fail('REMOTE_PROBE_UNAVAILABLE', 'cannot read Git HEAD before remote observation');
  const remotes = git(['remote']);
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
  if (!ref.startsWith('refs/') || /[\x00-\x20\x7f~^:?*\[\\]/.test(ref) || ref.includes('..') || ref.includes('@{') ||
      ref.split('/').some(part => !part || part.startsWith('.') || part.endsWith('.') || part.endsWith('.lock'))) {
    throw new Error('invalid remote reference');
  }
  let result;
  let transportTimedOut = false;
  try { result = git(['ls-remote', '--exit-code', remoteName, ref]); }
  catch (error) {
    if (error.code !== 'REMOTE_PROBE_TIMEOUT') throw error;
    transportTimedOut = true;
  }
  const matched = result?.status === 0 ? result.stdout.trim().split(/\r?\n/).map(line => line.split(/\s+/)).filter(item => item[1] === ref) : [];
  let advertised = matched.length === 1 ? matched[0][0] : '';
  // The strict authenticated fallback shares this deadline and never follows redirects.
  if (!validHead(advertised)) {
    const remoteUrl = git(['remote', 'get-url', remoteName]);
    const match = remoteUrl.status === 0
      ? remoteUrl.stdout.trim().match(/^https:\/\/github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/i)
      : null;
    const branchMatch = ref.match(/^refs\/heads\/(.+)$/);
    if (match && !['.', '..'].includes(match[2]) && branchMatch) {
      const apiUrl = `https://api.github.com/repos/${match[1]}/${match[2]}/git/ref/heads/${encodeURIComponent(branchMatch[1])}`;
      const verifiedHead = response => verifiedGitHubHead(response, `${match[1]}/${match[2]}`, ref);
      const anonymousBudget = Math.max(1, Math.min(5000,
        Math.floor((deadline - now()) / (authenticatedFallback ? 2 : 1))));
      try {
        const api = probe(process.platform === 'win32' ? 'curl.exe' : 'curl', ['--disable', '-fsS', '--proto', '=https',
          '--max-time', String(anonymousBudget / 1000), apiUrl], { timeoutCap: anonymousBudget });
        if (api.status === 28) transportTimedOut = true;
        advertised = verifiedHead(api);
      } catch (error) {
        if (error.code !== 'REMOTE_PROBE_TIMEOUT') throw error;
        transportTimedOut = true;
      }
      if (authenticatedFallback && !advertised && deadline > now()) {
        advertised = readAuthenticatedGitHubRef(apiUrl, {
          run, now, timeoutMs: Math.floor(deadline - now()), environment: env,
          ...(resolveCommand ? { resolveCommand } : {})
        });
      }
    }
  }
  if (!validHead(advertised)) {
    if (transportTimedOut) throw fail('REMOTE_PROBE_TIMEOUT', 'remote transport timed out and bounded fallback did not verify a head');
    throw new Error(`cannot read live remote baseline for ${defaultRef}: advertisement and permitted fallback unavailable`);
  }
  return { head: advertised.toLowerCase(), observed_at: new Date().toISOString(), remote_name: remoteName, ref };
}

export { readGitWorkspaceBaseline };

export function verifyWorkspaceBaseline(sourceRoot, workspace, sources = {}, context = {}) {
  const algorithm = workspace?.worktree_fingerprint?.algorithm;
  if (workspace && Object.hasOwn(workspace, 'inflight_scope') && !workspace.inflight_scope) return ['explicit workspace scope cannot be null or empty'];
  if (algorithm && ![LEGACY_WORKSPACE_ALGORITHM, FULL_WORKSPACE_ALGORITHM, SCOPED_WORKSPACE_ALGORITHM].includes(algorithm)) return ['unknown workspace fingerprint algorithm'];
  if ((algorithm === SCOPED_WORKSPACE_ALGORITHM) !== Boolean(workspace?.inflight_scope)) return ['workspace scope and algorithm must match'];
  const scopeErrors = validateScopedWorkspaceSources(workspace, sources, { ...context, sourceRoot });
  if (scopeErrors.length) return scopeErrors;
  const requiredErrors = [];
  for (const item of workspace?.required_untracked ?? []) {
    const ref = item?.path_ref;
    if (typeof ref !== 'string' || !ref) {
      requiredErrors.push('workspace required file has an invalid path_ref');
      continue;
    }
    const absolute = path.resolve(sourceRoot, ref);
    if (!isInside(sourceRoot, absolute) || (fs.existsSync(absolute) && !isInside(fs.realpathSync(sourceRoot), fs.realpathSync(absolute)))) {
      requiredErrors.push(`workspace required file escapes source_root: ${ref}`);
      continue;
    }
    if (!fs.existsSync(absolute)) {
      requiredErrors.push(`workspace required file missing: ${ref}`);
      continue;
    }
    if (!fs.statSync(absolute).isFile()) {
      requiredErrors.push(`workspace required file is not a file: ${ref}`);
      continue;
    }
    if (typeof item.sha256 !== 'string' || !/^[0-9a-f]{64}$/i.test(item.sha256)) {
      requiredErrors.push(`workspace required file has an invalid sha256: ${ref}`);
      continue;
    }
    if (typeof item.sha256 === 'string' && /^[0-9a-f]{64}$/i.test(item.sha256)) {
      const actual = sha256(fs.readFileSync(absolute));
      if (actual.toLowerCase() !== item.sha256.toLowerCase()) {
        requiredErrors.push(`workspace required file drift: ${ref}`);
      }
    }
  }
  if (requiredErrors.length) return requiredErrors;
  let live;
  try { live = readGitWorkspaceBaseline(sourceRoot, workspace?.required_untracked?.map(item => item.path_ref) ?? [], workspace?.inflight_scope ?? null, { algorithm }); }
  catch (error) { return [`workspace verification failed: ${error.message}`]; }
  if (!workspace) return ['workspace baseline is missing'];
  if (!/^[0-9a-f]{40,64}$/i.test(workspace.head || '') || !workspace.worktree_fingerprint) return ['workspace baseline fingerprint is missing or invalid'];
  const errors = [];
  for (const key of ['head', 'tree', 'branch', 'staged_count', 'tracked_modified_count', 'untracked_count']) {
    if (String(live[key]) !== String(workspace[key])) errors.push(`workspace baseline drift: ${key} expected ${workspace[key]}, found ${live[key]}`);
  }
  for (const key of ['algorithm', 'tracked_diff_sha256', 'untracked_digest', ...([FULL_WORKSPACE_ALGORITHM, SCOPED_WORKSPACE_ALGORITHM].includes(algorithm) ? ['index_sha256'] : [])]) {
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

function linkedArtifactTemp(finalPath, stat) {
  if (stat.nlink === 1) return null;
  if (stat.nlink !== 2) throw new Error('artifact must be an independent ordinary file');
  const dir = path.dirname(finalPath), prefix = `.${path.basename(finalPath)}.`;
  const matches = [];
  for (const name of fs.readdirSync(dir).filter(name => name.startsWith(prefix) && /^[0-9a-f]{20}\.tmp$/.test(name.slice(prefix.length)))) {
    const file = path.join(dir, name);
    let other;
    try { other = fs.lstatSync(file); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    if (other.isFile() && !other.isSymbolicLink() && other.dev === stat.dev && other.ino === stat.ino && other.nlink === 2) matches.push(file);
  }
  // Both links are confined to this output pair. Preserve the companion:
  // its name and bytes do not prove that this process created it.
  if (matches.length !== 1) throw new Error('artifact has an unbound hard link; preserve it');
  return matches[0];
}
function existingArtifact(finalPath) {
  let before;
  try { before = fs.lstatSync(finalPath); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  if (!before.isFile() || before.isSymbolicLink()) throw new Error('artifact must be an independent ordinary file');
  const companion = linkedArtifactTemp(finalPath, before);
  const physical = fs.realpathSync(finalPath);
  const fd = fs.openSync(finalPath, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  try {
    const opened = fs.fstatSync(fd);
    if (opened.dev !== before.dev || opened.ino !== before.ino || opened.nlink !== before.nlink) throw new Error('artifact identity changed before read');
    const bytes = fs.readFileSync(fd), after = fs.fstatSync(fd), named = fs.lstatSync(finalPath);
    if (after.size !== opened.size || after.mtimeMs !== opened.mtimeMs || after.ctimeMs !== opened.ctimeMs
      || after.nlink !== opened.nlink || named.dev !== opened.dev || named.ino !== opened.ino || named.nlink !== opened.nlink || named.isSymbolicLink()
      || linkedArtifactTemp(finalPath, named) !== companion
      || fs.realpathSync(finalPath) !== physical) throw new Error('artifact changed during read');
    return bytes;
  } finally { fs.closeSync(fd); }
}
function requireExactArtifact(finalPath, bytes) {
  const actual = existingArtifact(finalPath);
  if (!actual || !actual.equals(bytes)) throw new Error('existing artifact conflicts with the exact prepared bytes; preserve it');
}
function pendingArtifactTemps(paths, pending = []) {
  const result = new Map(pending.map(item => [item.path, item]));
  for (const file of paths) {
    if (!fs.existsSync(file)) continue;
    const companion = linkedArtifactTemp(file, fs.lstatSync(file));
    if (companion && !result.has(companion)) result.set(companion, { path: companion, reason: 'linked temporary file preserved; deletion ownership is not established' });
  }
  return [...result.values()];
}
function assertOwnedArtifactTemp(temp) {
  const stat = fs.lstatSync(temp.path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.dev !== temp.dev || stat.ino !== temp.ino) throw new Error('temporary artifact path was replaced; preserve it');
}
function cleanupArtifactTemp(temp, primaryError = null) {
  try {
    try { assertOwnedArtifactTemp(temp); } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
    fs.unlinkSync(temp.path);
    return [];
  } catch (error) {
    const diagnostic = `temporary cleanup blocked: ${error.message}`;
    if (primaryError) primaryError.message += `; ${diagnostic}`;
    return [{ path: temp.path, reason: diagnostic }];
  }
}
function createArtifactTemp(finalPath, bytes) {
  fs.mkdirSync(path.dirname(finalPath), { recursive: true });
  const tempPath = path.join(path.dirname(finalPath), `.${path.basename(finalPath)}.${crypto.randomBytes(10).toString('hex')}.tmp`);
  const fd = fs.openSync(tempPath, 'wx'), stat = fs.fstatSync(fd);
  const temp = { path: tempPath, dev: stat.dev, ino: stat.ino };
  try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); }
  catch (error) { cleanupArtifactTemp(temp, error); throw error; }
  finally { fs.closeSync(fd); }
  return temp;
}
function publishArtifact(temp, finalPath, bytes) {
  assertOwnedArtifactTemp(temp);
  requireExactArtifact(temp.path, bytes);
  try { fs.linkSync(temp.path, finalPath); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    requireExactArtifact(finalPath, bytes);
  }
}
function atomicWriteExclusive(finalPath, bytes) {
  fs.mkdirSync(path.dirname(finalPath), { recursive: true });
  const existing = existingArtifact(finalPath);
  if (existing) { requireExactArtifact(finalPath, bytes); return []; }
  const temp = createArtifactTemp(finalPath, bytes);
  try { publishArtifact(temp, finalPath, bytes); }
  catch (error) { cleanupArtifactTemp(temp, error); throw error; }
  const pending = cleanupArtifactTemp(temp);
  requireExactArtifact(finalPath, bytes);
  return pending;
}

// Hashes bind bytes, not their meaning. Check explicitly declared source facts
// against the prepared candidate, never against a later completed identity.
export function verifyHandoffInventory(draft, { sourceRoot, externalControlPlaneRoot } = {}) {
  const source = draft.sources?.handoff_inventory;
  if (!source) return { status: 'NOT_DECLARED', checked_fields: [], business_freshness: 'REQUIRES_SOURCE_READBACK' };
  const bytes = fs.readFileSync(resolveSource(source, sourceRoot, externalControlPlaneRoot, 'handoff_inventory'));
  if (sha256(bytes) !== source.digest) throw new Error('HANDOFF_INVENTORY_MISMATCH: handoff_inventory source digest mismatch');
  const record = JSON.parse(bytes.toString('utf8'));
  if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('INPUT_REQUIRED: handoff_inventory must be an object');
  const checked = [];
  const match = (field, actual, expected, digest = false) => {
    if (digest ? typeof actual !== 'string' || actual.toLowerCase() !== String(expected).toLowerCase() : actual !== expected) throw new Error(`HANDOFF_INVENTORY_MISMATCH: ${field}; refresh the source record from current facts before freezing a new candidate`);
    checked.push(field);
  };
  for (const field of ['generation', 'commander_generation']) if (Object.hasOwn(record, field)) match(field, record[field], draft.generation);
  if (Object.hasOwn(record, 'writer_id')) match('writer_id', record.writer_id, draft.writer_id);
  const controlIdentity = verifyControlIdentity(draft, { sourceRoot, externalControlPlaneRoot });
  if (controlIdentity.status !== 'PASS') throw new Error(`HANDOFF_INVENTORY_MISMATCH: canonical source identity unavailable: ${controlIdentity.errors.join('; ')}`);
  for (const field of ['platform_task_id', 'window_task_id']) if (Object.hasOwn(record, field)) match(field, record[field], controlIdentity.identity.platform_task_id);
  if (Object.hasOwn(record, 'rule_baseline')) {
    match('rule_baseline.rule_version', record.rule_baseline?.rule_version, draft.rule_baseline?.rule_version);
    match('rule_baseline.manifest_sha256', record.rule_baseline?.manifest_sha256, draft.rule_baseline?.manifest_sha256, true);
  }
  if (Object.hasOwn(record, 'objective')) {
    match('objective.summary', record.objective?.summary, draft.objective?.summary);
    match('objective.breakpoint', record.objective?.breakpoint, draft.objective?.breakpoint);
  }
  if (record.remote && typeof record.remote === 'object') {
    if (record.remote.head != null) match('remote.head', record.remote.head, draft.remote?.head, true);
    for (const field of ['ref', 'default_ref']) if (Object.hasOwn(record.remote, field)) match(`remote.${field}`, record.remote[field], draft.remote?.default_ref);
  }
  const complete = ['generation', 'commander_generation'].some(field => Object.hasOwn(record, field)) && ['writer_id', 'rule_baseline', 'objective'].every(field => Object.hasOwn(record, field)) && ['platform_task_id', 'window_task_id'].some(field => Object.hasOwn(record, field));
  if (record.record_type === 'handoff_inventory' && !complete) throw new Error('INPUT_REQUIRED: handoff_inventory requires source generation, writer_id, source platform task ID, rule_baseline and objective; fill from current facts, not the old filename');
  return { status: complete ? 'PASS' : 'NOT_DECLARED', checked_fields: checked, business_freshness: 'REQUIRES_SOURCE_READBACK' };
}

export function handoffReceptionRoute(seal) {
  const restrictions = seal.restrictions === undefined ? [] : seal.restrictions;
  const allowed = new Set(['REMOTE_UNOBSERVED', HISTORICAL_WORKSPACE_RESTRICTION, HISTORICAL_SOURCE_RESTRICTION]);
  if (!Array.isArray(restrictions) || restrictions.some(item => !allowed.has(item))) throw new Error('INPUT_REQUIRED: unsupported handoff restrictions');
  const controlOnly = restrictions.some(item => [HISTORICAL_WORKSPACE_RESTRICTION, HISTORICAL_SOURCE_RESTRICTION].includes(item));
  return {
    protocol: controlOnly ? 'CONTROL_ONLY_V1' : 'DIRECT_OPERATOR_V1',
    entry: `.github/scripts/${controlOnly ? 'Recover-CommanderAuthority' : 'Takeover-Handoff'}.mjs`,
    confirmation_scope: controlOnly ? 'CONTROL_ONLY_TAKEOVER' : 'HANDOFF_PREPARE_COMMIT_ONLY',
    current_operator_message_required: true,
    inherited_restrictions: [...restrictions]
  };
}

function canonicalTakeoverPrompt(ruleRoot) {
  const manual = fs.readFileSync(path.join(ruleRoot, '01-操作者操作手册.md'), 'utf8');
  const section = manual.split('<a id="scenario-commander-takeover"></a>')[1]?.split('<a id="scenario-ordinary-handoff"></a>')[0];
  const prompts = [...(section ?? '').matchAll(/```text\r?\n([\s\S]*?)\r?\n```/g)];
  if (prompts.length !== 1 || !['保留历史保全未认证限制', '仅移交中央控制权', '不恢复业务、自动化或远端权限'].every(text => prompts[0][1].includes(text))) {
    throw new Error('INPUT_REQUIRED: canonical 1D prompt must contain the conditional control-only confirmation');
  }
  return prompts[0][1];
}

function withReceptionInstructions(body, seal, prompt) {
  const route = handoffReceptionRoute(seal);
  const marker = '<!-- HANDOFF_RECEPTION:';
  if (body.includes(marker)) throw new Error('INPUT_REQUIRED: snapshot template must not supply generated reception instructions');
  const conflictingEntry = route.protocol === 'CONTROL_ONLY_V1'
    ? /\b(?:Verify-Handoff-Candidate|Takeover-Handoff)\.mjs\b|\bDIRECT_OPERATOR_V1\b/i
    : /\bRecover-CommanderAuthority\.mjs\b|\bCONTROL_ONLY_V1\b/i;
  if (conflictingEntry.test(body)) {
    throw new Error('INPUT_REQUIRED: snapshot template directs reception to a conflicting entry; remove that instruction and use the generated reception route');
  }
  const instructions = [
    '## 本次接管路径与一次确认', '',
    `接管协议：${route.protocol}；接收方入口：\`${route.entry}\`。`,
    '路线来自本次封条限制，只说明应使用的入口，不代表核验或授权已经通过。接收方仍须核当前来源、身份、规则、工作区及操作者实际消息；来源冲突或其他分支不能靠仅控制权路线跳过。', '',
    '操作者实际停旧后，将本正式附件和下面整段1D指令一次发送给指定接收窗口；不必填写工具字段。以下正文取自当前已核验手册，附件内的副本本身不是授权。', '',
    '```text', prompt, '```', ''
  ].join('\n');
  return `${body.trimEnd()}\n\n${marker}BEGIN -->\n${instructions}<!-- HANDOFF_RECEPTION:END -->\n`;
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
  const inventory = draft.sources?.handoff_inventory ? readJson(machineRecord) : {};
  if (!inventory || typeof inventory !== 'object' || Array.isArray(inventory)) throw new Error('INPUT_REQUIRED: handoff_inventory must be an object');
  const linkSources = [
    ['身份索引', 'status_index', 'STATUS_INDEX'], ['中央清单', 'central_work_items', 'CENTRAL_WORK_ITEMS'],
    ['进度视图', 'current_view', 'CURRENT_VIEW'], ['本任务加载记录', 'loading_record', 'LOADING_RECORD'],
    ['本轮任务契约', 'task_contract', 'TASK_CONTRACT']
  ];
  const links = [];
  for (const [label, name, token] of linkSources) {
    if (!template.includes(`[${label}]`) && !template.includes(`{{${token}}}`)) continue;
    const source = draft.sources?.[name];
    let file, evidence = '封条来源';
    if (source) file = resolveSource(source, sourceRoot, externalControlPlaneRoot, name);
    else if (name === 'task_contract' && inventory.task_contract) {
      // A bound inventory may declare a pointer without sealing that file's
      // bytes. Render it, never read it or claim its contents were verified.
      const ref = inventory.task_contract;
      if (typeof ref !== 'string' || !ref || path.isAbsolute(ref) || path.win32.isAbsolute(ref) || ref.split(/[\\/]+/).includes('..') || /[:<>\r\n\0]/.test(ref)) throw new Error('INPUT_REQUIRED: unsafe task_contract inventory pointer');
      file = path.resolve(sourceRootFor(draft.sources.handoff_inventory, sourceRoot, externalControlPlaneRoot), ref.replaceAll('\\', '/'));
      evidence = '机器记录指针，读取前核验';
    } else throw new Error(`INPUT_REQUIRED: ${name} source required by snapshot template`);
    if (/[<>\r\n\0]/.test(file)) throw new Error(`INPUT_REQUIRED: unsafe ${name} Markdown link`);
    if (source && ['loading_record', 'task_contract'].includes(name) && inventory[name] !== undefined && (typeof inventory[name] !== 'string' || inventory[name].replaceAll('\\', '/') !== source.path_ref.replaceAll('\\', '/'))) throw new Error(`INPUT_REQUIRED: ${name} inventory/source mismatch`);
    links.push({ label, token, file: file.replaceAll('\\', '/').replaceAll('#', '%23').replaceAll('?', '%3F'), evidence });
  }
  const baseline = [
    '## 轻量加载基线', '',
    `完整读取“总指挥轻量交接启动配置.md”（版本${ruleManifest.rule_version}）；接收方加载记录由1D接收方状态采用自动建立。以下路径均相对规则根；指纹一致时候选不全文读取02/04/07/09/10，冲突或下一动作依赖才展开受影响正文。`, '',
    '| 文件 | SHA-256 |', '|---|---|',
    ...rows.map(([name, digest]) => `| ${name} | ${digest} |`), '',
    `规则总清单：规则刷新manifest.json，SHA-256=${ruleManifestDigest}。必要未跟踪保留文件：${draft.workspace?.required_untracked?.map(item => item.path_ref).join('、') || '无'}；已跟踪但未提交的代码、配置和测试见机器记录保留清单，工作区聚合指纹见封条。`, ''
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
  for (const { label, token, file, evidence } of links) {
    rendered = rendered.replaceAll(`{{${token}}}`, file)
      .replace(new RegExp(`^- \\[${label}\\]\\([^\\r\\n]*$`, 'gm'), `- [${label}](<${file}>)；${evidence}`);
  }
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
  const draft = readJson(draftPath);
  const isCurrentMigration = draft?.handoff_phase === 'CURRENT_MIGRATION';
  let legacySealDirectory = null;
  if (isCurrentMigration) {
    if (typeof config.legacy_seal_directory !== 'string' || !config.legacy_seal_directory) throw new Error('CURRENT_MIGRATION requires legacy_seal_directory');
    legacySealDirectory = fs.realpathSync(resolveFrom(configDir, config.legacy_seal_directory));
    if (!isInside(sourceRoot, legacySealDirectory)) throw new Error('legacy seal directory must stay inside the source repository');
  }
  if (!/^[a-z0-9][a-z0-9._-]*-commander-handoff-\d{8}-final-\d+\.md$/i.test(path.basename(finalPath))) throw new Error('formal output filename must include project slug, date, final, and an incrementing number');
  if (finalPath === receiptPath) throw new Error('formal output and receipt must use different paths');
  const physicalFinalPath = physicalTarget(finalPath);
  const physicalReceiptPath = physicalTarget(receiptPath);
  if (isInside(workflowRoot, physicalFinalPath) || isInside(workflowRoot, physicalReceiptPath) || isInside(sourceRoot, physicalFinalPath) || isInside(sourceRoot, physicalReceiptPath) || (externalControlPlaneRoot && (isInside(externalControlPlaneRoot, physicalFinalPath) || isInside(externalControlPlaneRoot, physicalReceiptPath)))) throw new Error('formal output and receipt must be stored outside the workflow, source, and external control-plane repositories');
  const existingFinal = existingArtifact(finalPath), existingReceipt = existingArtifact(receiptPath);

  const physicalSealDirectory = physicalTarget(sealDirectory);
  if (!isInside(sourceRoot, physicalSealDirectory)) throw new Error('seal directory must stay inside the source repository');
  const targetComparable = fs.existsSync(sealDirectory) ? fs.realpathSync(sealDirectory) : physicalSealDirectory;
  if (isCurrentMigration) {
    if (isInside(legacySealDirectory, targetComparable) || isInside(targetComparable, legacySealDirectory)) throw new Error('CURRENT_MIGRATION requires separate, non-nested legacy and target seal directories');
    if (fs.existsSync(targetComparable) && fs.readdirSync(targetComparable).length) throw new Error('CURRENT_MIGRATION target seal directory must be empty');
  }
  if (!preflightOnly) fs.mkdirSync(sealDirectory, { recursive: true });
  const realSealDirectory = preflightOnly ? physicalSealDirectory : fs.realpathSync(sealDirectory);
  if (!isInside(sourceRoot, realSealDirectory)) throw new Error('seal directory must stay inside the source repository');
  let historicalMigration = null;
  const sealRelative = path.relative(sourceRoot, realSealDirectory).replaceAll('\\', '/');
  const ignored = spawnSync('git', ['-C', sourceRoot, 'check-ignore', '-q', '--', sealRelative]);
  if (ignored.status !== 0) throw new Error('seal directory must be excluded by the source repository .gitignore');

  const ruleManifestDigest = sha256(fs.readFileSync(manifestPath));
  const ruleManifest = verifyRuleManifest(ruleRoot, manifestPath);
  const liveManifestPath = config.live_rule_manifest_path ? resolveFrom(configDir, config.live_rule_manifest_path) : null;
  const liveRuleManifest = liveManifestPath ? verifyRuleManifest(ruleRoot, liveManifestPath) : null;
  const liveRuleManifestDigest = liveManifestPath ? sha256(fs.readFileSync(liveManifestPath)) : ruleManifestDigest;
  if (draft.rule_baseline?.manifest_sha256?.toLowerCase() !== ruleManifestDigest.toLowerCase() || draft.rule_baseline?.rule_version !== ruleManifest.rule_version) throw new Error('RULE_REBASE_REQUIRED: candidate rule baseline is stale; rerun 1C/1D from the same breakpoint and current stable manifest');
  if (liveRuleManifest) {
    const drift = classifyRuleDrift({ pinned: { rule_version: ruleManifest.rule_version, manifest_sha256: ruleManifestDigest }, live: { rule_version: liveRuleManifest.rule_version, manifest_sha256: liveRuleManifestDigest } });
    const declared = draft.rule_baseline?.compatibility ?? 'SAME';
    if (drift.status !== declared && !(drift.status === 'SAME' && declared === 'NEWER_COMPATIBLE')) throw new Error(`RULE_REBASE_REQUIRED: live rule epoch is ${drift.status}; candidate declared ${declared}`);
  }
  if (isCurrentMigration) {
    historicalMigration = inspectHistoricalRestrictedRecovery(legacySealDirectory);
    if (historicalMigration.status !== HISTORICAL_UNVERIFIED || historicalMigration.historical_chain_status !== 'PASS') throw new Error(`historical restricted chain is not migratable: ${historicalMigration.errors.join('; ') || historicalMigration.historical_chain_status}`);
  }
  const existingSealState = verifyChain(realSealDirectory, { sourceRoot, externalControlPlaneRoot, verifyLatestSources: false });
  const hasLegacySealRecords = existingSealState.records.some(record => record.schema_version < 3);
  if (draft.handoff_phase === 'CURRENT_MIGRATION' && hasLegacySealRecords) {
    throw new Error('LEGACY_MIGRATION_REQUIRES_EMPTY_V3_DIRECTORY: keep the v1/v2 seal directory read-only and configure a separate empty directory for the first v3 migration seal');
  }
  const allowedPreflightPhase = preflightOnly && isCurrentMigration;
  const allowedFormalMigration = !preflightOnly && isCurrentMigration;
  if (![3, 4].includes(draft.schema_version) || (!allowedPreflightPhase && !allowedFormalMigration && draft.handoff_phase !== 'MATERIAL_PREPARED') || (!allowedPreflightPhase && !allowedFormalMigration && !['READY', 'READY_WITH_RESTRICTIONS'].includes(draft.switch_status))) throw new Error('formal handoff requires a schema v3/v4 MATERIAL_PREPARED draft in READY or READY_WITH_RESTRICTIONS, or a separately bound CURRENT_MIGRATION');
  if (isCurrentMigration) {
    if (config.expected_previous_digest !== undefined && config.expected_previous_digest !== null) throw new Error('CURRENT_MIGRATION must start with no expected predecessor digest');
    if (draft.workspace?.inflight_scope || draft.workspace?.worktree_fingerprint?.algorithm !== FULL_WORKSPACE_ALGORITHM) throw new Error('CURRENT_MIGRATION requires a full strict V2 workspace without an in-flight scope');
    const migration = draft.migration;
    const historicalLatest = historicalMigration.latest;
    if (!migration || migration.legacy_latest_seal_digest !== historicalLatest.seal_digest || migration.legacy_generation !== historicalLatest.generation || migration.legacy_writer_id !== historicalLatest.writer_id || migration.basis !== 'CURRENT_ONLY_NO_RETROACTIVE_TRANSITION' || typeof migration.migrated_at !== 'string' || Date.parse(migration.migrated_at) < Date.parse(historicalLatest.sealed_at)) throw new Error('CURRENT_MIGRATION draft does not bind the inspected historical seal');
    Object.assign(draft, normalizeCurrentMigrationDraft(draft));
  }
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

  const sourceDigestErrors = [];
  for (const [name, source] of Object.entries(draft.sources ?? {})) {
    const sourcePath = resolveSource(source, sourceRoot, externalControlPlaneRoot, name);
    if (sha256(fs.readFileSync(sourcePath)) !== source.digest) sourceDigestErrors.push(`${name}: source digest mismatch`);
    if (Date.parse(source.fact_cutoff) > Date.parse(draft.fact_cutoff)) sourceDigestErrors.push(`${name}: source fact_cutoff is after draft fact_cutoff`);
  }
  if (sourceDigestErrors.length) throw new Error(`preflight source verification failed: ${sourceDigestErrors.join('; ')}`);
  if (draft.handoff_phase === 'MATERIAL_PREPARED') verifyReceiverReadiness(draft, { sourceRoot, externalControlPlaneRoot, sealDirectory });
  const inventoryVerification = verifyHandoffInventory(draft, { sourceRoot, externalControlPlaneRoot });
  // Sources are verified before parsing their inventory or rendering links.
  // A malformed delivery template must not advance the immutable seal chain.
  let rendered = hydrateSnapshotTemplate(fs.readFileSync(templatePath, 'utf8'), {
    draft, sourceRoot, externalControlPlaneRoot, ruleRoot, ruleManifest, ruleManifestDigest, sealDirectory, receiptPath
  });
  const takeoverPrompt = canonicalTakeoverPrompt(ruleRoot);
  const snapshotId = path.basename(finalPath, '.md');
  const templateTokens = ['{{SNAPSHOT_ID}}', '{{SEAL_DIGEST}}', '{{FACT_CUTOFF}}', '{{EVENT_ID}}'];
  for (const token of templateTokens) if (!rendered.includes(token)) throw new Error(`snapshot template is missing placeholder: ${token}`);
  const verificationCommand = `node "${path.join(scriptDir, 'HandoffSeal.mjs')}" verify "${realSealDirectory}" "${sourceRoot}"${externalControlPlaneRoot ? ` "--external-control-plane-root=${externalControlPlaneRoot}"` : ''} --summary`;
  if (!rendered.includes('{{VERIFICATION_COMMAND}}') && !verificationCommandPattern.test(rendered)) {
    throw new Error('snapshot template is missing verification command placeholder or entry');
  }
  const identity = verifyControlIdentity(draft, { sourceRoot, externalControlPlaneRoot });
  if (identity.status !== 'PASS') throw new Error(`control identity preflight failed: ${identity.errors.join('; ')}`);
  assertPrivateControlStorage(draft, { sourceRoot, externalControlPlaneRoot });
  const workspaceErrors = verifyWorkspaceBaseline(sourceRoot, draft.workspace, draft.sources, { externalControlPlaneRoot, ruleBaseline: draft.rule_baseline, workflowRepositoryRoot: workflowRoot });
  if (workspaceErrors.length) throw new Error(`preflight workspace verification failed: ${workspaceErrors.join('; ')}`);
  if (draft.remote?.status === 'PASS') {
    let liveRemote;
    try {
      liveRemote = readLiveRemoteBaseline(sourceRoot, draft.remote.default_ref);
    } catch (error) {
      // Only failed observation may be downgraded. An observed HEAD conflict
      // remains a drift error even for a restricted candidate.
      if (draft.switch_status !== 'READY_WITH_RESTRICTIONS' || ['REMOTE_PROBE_TIMEOUT', 'REMOTE_PROBE_ABORTED'].includes(error.code)) throw error;
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
  const draftErrors = validateSealDraftForAppend(draft);
  if (draftErrors.length) throw new Error(`draft preflight validation failed: ${draftErrors.join('; ')}`);
  const appendOptions = {
    expectedPreviousDigest: config.expected_previous_digest,
    sourceRoot,
    externalControlPlaneRoot,
    transitionTicket: config.transition_ticket ? resolveFrom(configDir, config.transition_ticket) : undefined
  };
  const appendPlan = planSealAppend(realSealDirectory, draft, { ...appendOptions, allowReuse: true });
  if ((existingFinal || existingReceipt) && appendPlan.action !== 'REUSE') throw new Error('existing artifacts require the exact already-sealed event');
  const renderArtifacts = seal => {
    let body = rendered;
    const replacements = {
      '{{SNAPSHOT_ID}}': snapshotId,
      '{{SEAL_DIGEST}}': seal.seal_digest,
      '{{FACT_CUTOFF}}': seal.fact_cutoff,
      '{{EVENT_ID}}': seal.event_id,
      '{{VERIFICATION_COMMAND}}': verificationCommand
    };
    for (const [token, value] of Object.entries(replacements)) {
      if (token === '{{VERIFICATION_COMMAND}}' && !body.includes(token)) continue;
      if (!body.includes(token)) throw new Error(`snapshot template is missing placeholder: ${token}`);
      body = body.replaceAll(token, value);
    }
    body = body.replace(verificationCommandPattern, verificationCommand);
    if (body.match(verificationCommandPattern)?.[0] !== verificationCommand) {
      throw new Error('snapshot verification command does not match the live seal directory and source root');
    }
    body = withReceptionInstructions(body, seal, takeoverPrompt);
    const finalBytes = Buffer.from(body, 'utf8');
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
      inventory_verification: inventoryVerification,
      reception_route: handoffReceptionRoute(seal),
      verification: {
        tool: 'HandoffSeal.mjs',
        command: verificationCommand,
        source_root: sourceRoot,
        external_control_plane_root: externalControlPlaneRoot,
        expected: { status: 'PASS', latest_source_status: 'PASS', handoff_ready: true }
      }
    };
    return { finalBytes, receipt, receiptBytes: Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`, 'utf8') };
  };
  const preview = renderArtifacts(appendPlan.seal);
  if (existingReceipt) requireExactArtifact(receiptPath, preview.receiptBytes);
  if (existingFinal) requireExactArtifact(finalPath, preview.finalBytes);
  if (preflightOnly) return {
    status: draft.switch_status === 'READY_WITH_RESTRICTIONS' ? 'READY_WITH_RESTRICTIONS' : 'READY',
    mode: 'PREFLIGHT_ONLY',
    append_action: appendPlan.action,
    project_key: config.project_key,
    source_root: sourceRoot,
    external_control_plane_root: externalControlPlaneRoot,
    source_count: Object.keys(draft.sources ?? {}).length,
    inventory_verification: inventoryVerification,
    reception_route: preview.receipt.reception_route,
    workspace_protection: {
      staged_count: draft.workspace?.staged_count ?? null,
      tracked_modified_count: draft.workspace?.tracked_modified_count ?? null,
      untracked_count: draft.workspace?.untracked_count ?? null,
      required_untracked_count: draft.workspace?.required_untracked?.length ?? 0,
      required_untracked_is_inventory: false
    },
    legacy_migration: draft.handoff_phase === 'CURRENT_MIGRATION' ? 'BOUND_TO_LEGACY_SUMMARY' : 'NONE',
    cleanup_pending: pendingArtifactTemps([receiptPath, finalPath])
  };

  // If a previous attempt appended the immutable seal but failed while writing
  // the external artifact, reuse that exact seal. This makes preparation
  // retryable without advancing the chain or inventing a second event.
  const currentPlan = planSealAppend(realSealDirectory, draft, { ...appendOptions, allowReuse: true });
  const seal = currentPlan.action === 'REUSE' ? currentPlan.seal : appendSeal(realSealDirectory, draft, appendOptions);
  const verified = verifyChain(realSealDirectory, { sourceRoot, externalControlPlaneRoot });
  if (verified.status !== 'PASS' || !verified.handoff_ready || verified.latest?.seal_digest !== seal.seal_digest || verified.latest_source_status !== 'PASS') throw new Error(`new seal did not pass live verification: ${verified.errors.join('; ')}`);

  const { finalBytes, receipt, receiptBytes } = renderArtifacts(seal);
  const tempSnapshot = createArtifactTemp(finalPath, finalBytes);
  try {
    if (sha256(fs.readFileSync(manifestPath)) !== ruleManifestDigest) throw new Error('RULE_SOURCE_DRIFTED: rule manifest changed while preparing the attachment; mark candidate RULE_REBASE_PENDING and rerun from the same breakpoint');
    verifyRuleManifest(ruleRoot, manifestPath);
    const finalVerification = verifyChain(realSealDirectory, { sourceRoot, externalControlPlaneRoot });
    if (finalVerification.status !== 'PASS' || !finalVerification.handoff_ready || finalVerification.latest?.seal_digest !== seal.seal_digest || finalVerification.latest_source_status !== 'PASS') throw new Error(`facts drifted while rendering the attachment: ${finalVerification.errors.join('; ')}`);
    const finalWorkspaceErrors = verifyWorkspaceBaseline(sourceRoot, seal.workspace, seal.sources, { externalControlPlaneRoot, ruleBaseline: seal.rule_baseline, workflowRepositoryRoot: workflowRoot });
    assertPrivateControlStorage(seal, { sourceRoot, externalControlPlaneRoot });
    if (finalWorkspaceErrors.length) throw new Error(`workspace drifted while rendering the attachment: ${finalWorkspaceErrors.join('; ')}`);
    if (seal.remote?.status === 'PASS') {
      const finalLiveRemote = readLiveRemoteBaseline(sourceRoot, seal.remote.default_ref);
      if (finalLiveRemote && finalLiveRemote.head !== String(seal.remote.head || '').toLowerCase()) throw new Error(`remote baseline drifted while rendering the attachment: expected ${seal.remote.head}, found ${finalLiveRemote.head}`);
    }
    if (physicalTarget(finalPath) !== physicalFinalPath || physicalTarget(receiptPath) !== physicalReceiptPath) throw new Error('output path resolution drifted while preparing the attachment');
    // Compare both remnants before filling either half of an interrupted pair.
    if (existingArtifact(receiptPath)) requireExactArtifact(receiptPath, receiptBytes);
    if (existingArtifact(finalPath)) requireExactArtifact(finalPath, finalBytes);
    const receiptCleanup = atomicWriteExclusive(receiptPath, receiptBytes);
    if (physicalTarget(finalPath) !== physicalFinalPath) throw new Error('formal output path resolution drifted before finalization');
    publishArtifact(tempSnapshot, finalPath, finalBytes);
    const snapshotCleanup = cleanupArtifactTemp(tempSnapshot);
    requireExactArtifact(receiptPath, receiptBytes);
    requireExactArtifact(finalPath, finalBytes);
    return { final_path: finalPath, receipt_path: receiptPath, receipt, chain_status: finalVerification.status,
      cleanup_pending: pendingArtifactTemps([receiptPath, finalPath], [...receiptCleanup, ...snapshotCleanup]) };
  } catch (error) {
    cleanupArtifactTemp(tempSnapshot, error);
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
