// A versioned, read-only projection of the four validated control write targets.
// No temporary rollback, arbitrary exclusions, or acceptance of unrelated drift.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { byteDigest as hash, resolveSource } from './HandoffControl.mjs';
import { collectScopedWorkspaceBaseline } from './HandoffWorkspaceScope.mjs';

const assert = (condition, message) => { if (!condition) throw new Error(`workspace changed during transaction: ${message}`); };
const digest = value => hash(Buffer.from(JSON.stringify(value)));
function run(root, args) {
  const result = spawnSync('git', ['-C', root, ...args], { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' } });
  assert(result.status === 0, `cannot read Git ${args[0]}`);
  return result.stdout;
}
function refsFor(plan, options) {
  const root = fs.realpathSync(options.sourceRoot);
  return plan.map(item => path.relative(root, resolveSource(item, options)).replaceAll('\\', '/'))
    .filter(ref => ref !== '..' && !ref.startsWith('../') && !path.isAbsolute(ref));
}
function strip(full, parts) {
  let result = Buffer.from(full);
  for (const part of parts) {
    const bytes = Buffer.from(part, 'base64');
    if (!bytes.length) continue;
    const at = result.indexOf(bytes);
    assert(at >= 0 && result.indexOf(bytes, at + bytes.length) < 0, 'ambiguous control diff; preserve the candidate and use an explicitly scoped baseline');
    result = Buffer.concat([result.subarray(0, at), result.subarray(at + bytes.length)]);
  }
  return hash(result);
}
function observe(workspace, plan, options) {
  const root = options.sourceRoot, refs = refsFor(plan, options), required = workspace.required_untracked?.map(item => item.path_ref) ?? [];
  const controlModes = plan.map(item => {
    const stat = fs.lstatSync(resolveSource(item, options));
    assert(stat.isFile() && !stat.isSymbolicLink(), 'control target must remain an ordinary file');
    return process.platform === 'win32' ? 'FILE' : stat.mode & 0o777;
  });
  const index = run(root, ['ls-files', '--stage', '-z']).toString('base64');
  if (workspace.inflight_scope) {
    const scoped = collectScopedWorkspaceBaseline(root, required, workspace.inflight_scope, true);
    // The existing scope decides which index entries are protected.
    return { refs, controlModes, scoped: true, ...scoped.evidence };
  }
  const tokens = run(root, ['status', '--porcelain=v1', '-z']).toString('utf8').split('\0').filter(Boolean), statuses = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]; statuses.push(token);
    if (/[RC]/.test(token.slice(0, 2))) {
      const old = tokens[++i];
      assert(!refs.includes(token.slice(3)) && !refs.includes(old), 'control rename or copy is outside the write plan');
      statuses.push(old);
    }
  }
  const untrackedRefs = new Set(run(root, ['ls-files', '-z', '--others', '--exclude-standard']).toString('utf8').split('\0').filter(Boolean));
  for (const ref of required) untrackedRefs.add(ref);
  const untracked = [...untrackedRefs].sort().map(ref => {
    const file = path.resolve(root, ref), rel = path.relative(fs.realpathSync(root), fs.realpathSync(file));
    assert(rel && rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel), 'untracked evidence escapes root');
    return { path_ref: ref, sha256: hash(fs.readFileSync(file)) };
  });
  return { refs, controlModes, scoped: false, index, statuses, untracked,
    diff: run(root, ['diff', '--binary', 'HEAD', '--']).toString('base64'),
    controlDiffs: refs.map(ref => run(root, ['diff', '--binary', 'HEAD', '--', `:(literal)${ref}`]).toString('base64')) };
}
function protectedEvidence(evidence) {
  const refs = new Set(evidence.refs), status = evidence.statuses.filter(token => !refs.has(token.slice(3)));
  if (evidence.scoped) return { controlModes: evidence.controlModes, index: digest(evidence.protectedIndex), statuses: status,
    worktree: evidence.worktree.filter(item => !refs.has(item.path_ref)), untracked: evidence.strictUntracked.filter(item => !refs.has(item.path_ref)) };
  return { controlModes: evidence.controlModes, index: evidence.index, statuses: status, diff: strip(Buffer.from(evidence.diff, 'base64'), evidence.controlDiffs), untracked: evidence.untracked.filter(item => !refs.has(item.path_ref)) };
}
function validateBefore(evidence, previous, plan, options) {
  assert(JSON.stringify(evidence.refs) === JSON.stringify(refsFor(plan, options)), 'write scope changed');
  const fp = previous.workspace.worktree_fingerprint;
  if (evidence.scoped) {
    assert(digest(evidence.worktree) === fp.tracked_diff_sha256 && digest(evidence.strictUntracked) === fp.untracked_digest && digest(evidence.protectedIndex) === fp.index_sha256, 'before evidence does not match sealed scoped workspace');
  } else {
    assert(hash(Buffer.from(evidence.diff, 'base64')) === fp.tracked_diff_sha256 && digest(evidence.untracked) === fp.untracked_digest, 'before evidence does not match sealed workspace');
  }
  protectedEvidence(evidence); // Reject ambiguous projections before mutation.
}
export function captureTransactionWorkspace(previous, plan, options) {
  const evidence = observe(previous.workspace, plan, options);
  validateBefore(evidence, previous, plan, options);
  return { version: 2, before: evidence };
}
export function verifyTransactionWorkspace(journal, previous, options) {
  const proof = journal.workspace_projection;
  assert(proof?.version === 2, 'unknown projection version');
  validateBefore(proof.before, previous, journal.plan, options);
  for (const item of journal.plan) assert([item.before_sha256, item.after_sha256].includes(hash(fs.readFileSync(resolveSource(item, options)))), 'control byte conflict');
  for (const field of ['head', 'tree']) {
    const live = run(options.sourceRoot, ['rev-parse', field === 'tree' ? 'HEAD^{tree}' : 'HEAD']).toString('utf8').trim();
    assert(live === previous.workspace[field], `${field} changed`);
  }
  const branch = spawnSync('git', ['-C', options.sourceRoot, 'symbolic-ref', '--short', '-q', 'HEAD'], { encoding: 'utf8' });
  assert([0, 1].includes(branch.status) && (branch.stdout.trim() || 'HEAD') === previous.workspace.branch, 'branch changed');
  const live = observe(previous.workspace, journal.plan, options);
  assert(JSON.stringify(protectedEvidence(live)) === JSON.stringify(protectedEvidence(proof.before)), 'unrelated worktree or index changed');
}
