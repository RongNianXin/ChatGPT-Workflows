// Opt-in handoff scope. Paths outside explicit in-flight roots remain strict.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

export const SCOPED_WORKSPACE_ALGORITHM = 'git-scoped-index-worktree-sha256-v2';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const exact = (object, keys) => object && typeof object === 'object' && !Array.isArray(object) && Object.keys(object).length === keys.length && keys.every(key => Object.hasOwn(object, key));
const validRef = ref => typeof ref === 'string' && ref.length > 0 && !/[\\\0\r\n:]/.test(ref) && !ref.startsWith('/') && ref.split('/').every(part => part && part !== '.' && part !== '..' && !part.endsWith('.') && !part.endsWith(' '));
const key = ref => ref.normalize('NFC').toLowerCase();
const overlaps = (a, b) => key(a) === key(b) || key(a).startsWith(key(b) + '/') || key(b).startsWith(key(a) + '/');
const mandatoryRoots = ['AGENTS.md', '.git', '.gitignore', '.gitattributes', '.gitmodules', '.github', '总指挥工作流', '引用的外部工具'];

export function validateInflightScope(scope, { protectedRefs = [], requiredRefs = [] } = {}) {
  const errors = [];
  if (!exact(scope, ['excluded_roots']) || !Array.isArray(scope.excluded_roots) || !scope.excluded_roots.length) return ['invalid in-flight workspace scope'];
  const seen = [];
  for (const item of scope.excluded_roots) {
    const fields = ['path_ref', 'owner', 'reason', 'ownership_source_ref', ...(item && Object.hasOwn(item, 'ownership_root_ref') ? ['ownership_root_ref'] : [])];
    if (!exact(item, fields) || !validRef(item.path_ref) || !validRef(item.ownership_source_ref) || (item.ownership_root_ref !== undefined && !['source_root', 'external_control_plane'].includes(item.ownership_root_ref)) || typeof item.owner !== 'string' || !item.owner.trim() || typeof item.reason !== 'string' || !item.reason.trim()) {
      errors.push('invalid in-flight root or ownership evidence'); continue;
    }
    if ([...mandatoryRoots, ...protectedRefs, ...requiredRefs, ...scope.excluded_roots.filter(root => root?.ownership_root_ref !== 'external_control_plane').map(root => root?.ownership_source_ref).filter(ref => typeof ref === 'string')].some(ref => overlaps(item.path_ref, ref))) errors.push(`in-flight root overlaps protected evidence: ${item.path_ref}`);
    if (seen.some(ref => overlaps(item.path_ref, ref))) errors.push(`duplicate or overlapping in-flight roots: ${item.path_ref}`);
    seen.push(item.path_ref);
  }
  return errors;
}

export function validateScopedWorkspaceSources(workspace, sources = {}, { sourceRoot, externalControlPlaneRoot, ruleBaseline, workflowRepositoryRoot } = {}) {
  if (!workspace?.inflight_scope) return [];
  if (!sources || typeof sources !== 'object' || Array.isArray(sources)) return ['invalid scoped seal sources'];
  const protectedRefs = Object.values(sources).filter(source => source?.root_ref !== 'external_control_plane').map(source => source?.path_ref);
  if (ruleBaseline?.mode === 'PINNED_SNAPSHOT') protectedRefs.push(ruleBaseline.snapshot_ref);
  if (sourceRoot) {
    try {
      const physicalRoot = fs.realpathSync(sourceRoot);
      if (workflowRepositoryRoot) {
        const relative = path.relative(physicalRoot, fs.realpathSync(workflowRepositoryRoot));
        if (relative && !relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative)) protectedRefs.push(relative.replaceAll('\\', '/'));
      }
      for (const source of Object.values(sources).filter(source => source?.root_ref === 'external_control_plane')) {
        if (!externalControlPlaneRoot) return ['external control-plane root required for scoped protection'];
        const physical = fs.realpathSync(path.resolve(externalControlPlaneRoot, source.path_ref));
        const relative = path.relative(physicalRoot, physical);
        if (relative && !relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative)) protectedRefs.push(relative.replaceAll('\\', '/'));
      }
    } catch (error) { return [`cannot resolve physical scoped protection: ${error.message}`]; }
  }
  if (protectedRefs.some(ref => !validRef(ref))) return ['invalid protected workspace source path'];
  const errors = validateInflightScope(workspace.inflight_scope, { protectedRefs, requiredRefs: workspace.required_untracked?.map(item => item.path_ref) ?? [] });
  if (errors.length) return errors;
  for (const item of workspace.inflight_scope.excluded_roots ?? []) {
    if (!Object.values(sources).some(source => source?.path_ref === item.ownership_source_ref && (source.root_ref ?? 'source_root') === (item.ownership_root_ref ?? 'source_root'))) errors.push('in-flight ownership evidence must be a strict seal source with the same root binding');
  }
  return errors;
}

export function validWorkspaceFingerprint(workspace, sources = {}, context = {}) {
  const fingerprint = workspace?.worktree_fingerprint;
  if (fingerprint?.algorithm === 'git-diff-binary+untracked-content-sha256-v1') return !Object.hasOwn(workspace, 'inflight_scope') && exact(fingerprint, ['algorithm', 'tracked_diff_sha256', 'untracked_digest']) && /^[0-9a-f]{64}$/.test(fingerprint.tracked_diff_sha256) && /^[0-9a-f]{64}$/.test(fingerprint.untracked_digest);
  return fingerprint?.algorithm === SCOPED_WORKSPACE_ALGORITHM && Boolean(workspace?.inflight_scope) && exact(fingerprint, ['algorithm', 'tracked_diff_sha256', 'untracked_digest', 'index_sha256']) && ['tracked_diff_sha256', 'untracked_digest', 'index_sha256'].every(field => /^[0-9a-f]{64}$/.test(fingerprint[field])) && validateScopedWorkspaceSources(workspace, sources, context).length === 0;
}

export function validateScopeInventory(scope, refs) {
  const prefixes = new Map();
  for (const ref of [...scope.excluded_roots.map(item => item.path_ref), ...refs]) {
    if (!validRef(ref)) throw new Error(`unsafe or non-normalized inventory path: ${ref}`);
    const parts = ref.split('/');
    for (let i = 1; i <= parts.length; i++) {
      const prefix = parts.slice(0, i).join('/');
      if (prefixes.has(key(prefix)) && prefixes.get(key(prefix)) !== prefix) throw new Error('workspace directory case or Unicode path collision');
      prefixes.set(key(prefix), prefix);
    }
  }
}

function safePhysicalPath(root, ref, { directory = false } = {}) {
  if (!validRef(ref)) throw new Error(`unsafe workspace path: ${ref}`);
  let target = root;
  for (const segment of ref.split('/')) {
    target = path.join(target, segment);
    if (!fs.existsSync(target)) {
      // lstat also detects dangling symlinks.
      try { if (fs.lstatSync(target).isSymbolicLink()) throw new Error('workspace symlink'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (directory) throw new Error(`in-flight root is missing: ${ref}`);
      return target;
    }
    if (fs.lstatSync(target).isSymbolicLink()) throw new Error(`workspace symlink is not scoped: ${ref}`);
  }
  if (directory && !fs.statSync(target).isDirectory()) throw new Error(`in-flight root is not a directory: ${ref}`);
  return target;
}

function collectScopedWorkspaceBaseline(sourceRoot, requiredRefs, scope) {
  const errors = validateInflightScope(scope, { requiredRefs });
  if (errors.length) throw new Error(errors.join('; '));
  const root = fs.realpathSync(sourceRoot);
  for (const item of scope.excluded_roots) safePhysicalPath(root, item.path_ref, { directory: true });
  const excluded = ref => !['agents.md', '.gitignore', '.gitattributes', '.gitmodules', 'ai状态索引.md', '当前进度视图.md', '中央工作项清单.md'].includes(key(path.posix.basename(ref))) && scope.excluded_roots.some(item => ref.startsWith(item.path_ref + '/'));
  const run = args => {
    const result = spawnSync('git', ['-C', root, ...args], { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 });
    if (result.status !== 0) throw new Error(`cannot read scoped Git evidence: ${args[0]}`);
    return result.stdout;
  };
  const head = run(['rev-parse', 'HEAD']).toString('utf8').trim();
  const tree = run(['rev-parse', 'HEAD^{tree}']).toString('utf8').trim();
  const branchResult = spawnSync('git', ['-C', root, 'symbolic-ref', '--short', '-q', 'HEAD'], { encoding: 'utf8' });
  if (![0, 1].includes(branchResult.status)) throw new Error('cannot read scoped branch');
  const index = run(['ls-files', '--stage', '-z']).toString('utf8').split('\0').filter(Boolean).map(token => {
    const match = token.match(/^(\d+) ([0-9a-f]+) (\d)\t([\s\S]+)$/);
    if (!match || match[3] !== '0' || !['100644', '100755'].includes(match[1])) throw new Error('scoped workspace requires ordinary files and no unresolved index');
    return { mode: match[1], oid: match[2], path_ref: match[4] };
  });
  const headPaths = run(['ls-tree', '-r', '--name-only', '-z', 'HEAD']).toString('utf8').split('\0').filter(Boolean);
  const untracked = run(['ls-files', '--others', '--exclude-standard', '-z']).toString('utf8').split('\0').filter(Boolean);
  const ownershipRefs = scope.excluded_roots.filter(item => item.ownership_root_ref !== 'external_control_plane').map(item => item.ownership_source_ref);
  const allRefs = [...new Set([...index.map(item => item.path_ref), ...headPaths, ...untracked, ...requiredRefs, ...ownershipRefs])].sort();
  validateScopeInventory(scope, allRefs);
  const seen = new Map();
  for (const ref of allRefs) {
    if (!validRef(ref)) throw new Error(`unsafe or non-normalized inventory path: ${ref}`);
    if (seen.has(key(ref)) && seen.get(key(ref)) !== ref) throw new Error('workspace case or Unicode path collision');
    seen.set(key(ref), ref);
    const absolute = safePhysicalPath(root, ref);
    if (fs.existsSync(absolute) && !fs.statSync(absolute).isFile()) throw new Error(`non-file workspace evidence: ${ref}`);
    if ((requiredRefs.includes(ref) || ownershipRefs.includes(ref)) && !fs.existsSync(absolute)) throw new Error(`required workspace evidence missing: ${ref}`);
  }
  // Bind the index and worktree independently: HEAD-to-worktree alone loses staging.
  const protectedIndex = index.filter(item => !excluded(item.path_ref));
  const worktree = allRefs.filter(ref => !excluded(ref)).map(ref => {
    const absolute = safePhysicalPath(root, ref);
    if (!fs.existsSync(absolute)) return { path_ref: ref, status: 'MISSING' };
    const stat = fs.statSync(absolute);
    return { path_ref: ref, mode: process.platform === 'win32' ? 'FILE' : (stat.mode & 0o111 ? 'EXECUTABLE' : 'FILE'), sha256: hash(fs.readFileSync(absolute)) };
  });
  const strictUntracked = [...new Set([...untracked, ...requiredRefs, ...ownershipRefs.filter(ref => !index.some(item => item.path_ref === ref))])].filter(ref => !excluded(ref)).sort().map(ref => ({ path_ref: ref, sha256: hash(fs.readFileSync(safePhysicalPath(root, ref))) }));
  const statusTokens = run(['status', '--porcelain=v1', '-z', '--untracked-files=all']).toString('utf8').split('\0').filter(Boolean);
  const statuses = [];
  for (let i = 0; i < statusTokens.length; i++) {
    const token = statusTokens[i], ref = token.slice(3);
    if (!validRef(ref)) throw new Error('invalid scoped Git status path');
    if (/[RC]/.test(token.slice(0, 2))) {
      const previous = statusTokens[++i];
      if (!validRef(previous) || excluded(previous) !== excluded(ref)) throw new Error('cross-boundary workspace rename or copy');
    }
    if (!excluded(ref)) statuses.push(token);
  }
  return {
    head, tree, branch: branchResult.stdout.trim() || 'HEAD',
    staged_count: statuses.filter(item => item[0] !== ' ' && item.slice(0, 2) !== '??').length,
    tracked_modified_count: statuses.filter(item => item[1] !== ' ' && item.slice(0, 2) !== '??').length,
    untracked_count: statuses.filter(item => item.slice(0, 2) === '??').length,
    inflight_scope: structuredClone(scope),
    worktree_fingerprint: { algorithm: SCOPED_WORKSPACE_ALGORITHM, tracked_diff_sha256: hash(Buffer.from(JSON.stringify(worktree))), untracked_digest: hash(Buffer.from(JSON.stringify(strictUntracked))), index_sha256: hash(Buffer.from(JSON.stringify(protectedIndex))) }
  };
}

export function readScopedWorkspaceBaseline(sourceRoot, requiredRefs, scope) {
  const first = collectScopedWorkspaceBaseline(sourceRoot, requiredRefs, scope);
  const second = collectScopedWorkspaceBaseline(sourceRoot, requiredRefs, scope);
  if (JSON.stringify(first) !== JSON.stringify(second)) throw new Error('protected workspace changed during scoped observation');
  return second;
}
