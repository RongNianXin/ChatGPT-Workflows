// Explicit receiving-agent repair evidence. Historical seals are never rewritten.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { byteDigest as hash } from './HandoffControl.mjs';
import { readGitWorkspaceBaseline } from './Prepare-Handoff.mjs';

const assert = (ok, message) => { if (!ok) throw new Error(`WORKSPACE_AMENDMENT: ${message}`); };
const digest = value => hash(Buffer.from(JSON.stringify(value)));
const manifestRef = '总指挥工作流/第二代总指挥的工作模式/规则刷新manifest.json';
function git(root, args) {
  const r = spawnSync('git', ['-C', root, ...args], { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' } });
  assert(r.status === 0, `cannot read Git ${args[0]}`); return r.stdout;
}
function safe(root, ref) {
  assert(typeof ref === 'string' && ref && !ref.includes('\\') && !ref.includes(':') && !ref.includes('\0') && !path.posix.isAbsolute(ref) && ref.split('/').every(p => p && !['.', '..', '.git'].includes(p)), 'unsafe exact path');
  const base = fs.realpathSync(root); let file = base;
  for (const part of ref.split('/')) {
    file = path.join(file, part);
    if (fs.existsSync(file)) assert(!fs.lstatSync(file).isSymbolicLink(), 'symbolic links are not allowed');
    else { try { fs.lstatSync(file); assert(false, 'dangling symbolic link'); } catch (e) { if (e.code !== 'ENOENT') throw e; } }
  }
  return file;
}
function observe(previous, options, removed) {
  const root = options.sourceRoot;
  const required = previous.workspace.required_untracked.filter(f => !removed.has(f.path_ref));
  const workspace = { ...previous.workspace, ...readGitWorkspaceBaseline(root, required.map(f => f.path_ref)), required_untracked: required };
  const names = git(root, ['diff', '--name-only', '-z', 'HEAD', '--']).toString('utf8').split('\0').filter(Boolean);
  const patches = names.map(ref => ({ path_ref: ref, bytes: git(root, ['diff', '--binary', 'HEAD', '--', `:(literal)${ref}`]).toString('base64') }));
  const diff = git(root, ['diff', '--binary', 'HEAD', '--']);
  assert(Buffer.concat(patches.map(f => Buffer.from(f.bytes, 'base64'))).equals(diff), 'renames or ambiguous patches require a separate recovery');
  const refs = new Set([...git(root, ['ls-files', '-z', '--others', '--exclude-standard']).toString('utf8').split('\0').filter(Boolean), ...required.map(f => f.path_ref)]);
  const untracked = [...refs].sort().map(ref => ({ path_ref: ref, sha256: hash(fs.readFileSync(safe(root, ref))) }));
  return { workspace, patches, untracked, index: git(root, ['ls-files', '--stage', '-z']).toString('base64') };
}
function ordered(patches) { return [...patches].sort((a, b) => Buffer.compare(Buffer.from(a.path_ref), Buffer.from(b.path_ref))); }

export function createWorkspaceAmendment(previous, options, grant) {
  const maintenance = grant.maintenance.map(f => { const bytes = fs.readFileSync(safe(options.sourceRoot, f.path_ref)); return { ...f, after_sha256: hash(bytes), ...(f.path_ref === manifestRef ? { after_base64: bytes.toString('base64') } : {}) }; });
  const a = { version: 1, origin: 'CURRENT_OPERATOR_MESSAGE', scope: 'HANDOFF_WORKSPACE_REPAIR_ONLY', evidence_ref: grant.evidence_ref,
    previous_seal_digest: previous.seal_digest, recipient_writer_id: options.recipient.writerId, recipient_platform_id: options.recipient.platformTaskId,
    deletions: [...grant.deletions], maintenance, evidence: observe(previous, options, new Set(grant.deletions)) };
  validateWorkspaceAmendment(previous, { ...options, workspaceAmendment: a }); return a;
}

export function validateWorkspaceAmendment(previous, options, live = true) {
  const a = options.workspaceAmendment;
  if (!a) return previous;
  assert(a.version === 1 && a.origin === 'CURRENT_OPERATOR_MESSAGE' && a.scope === 'HANDOFF_WORKSPACE_REPAIR_ONLY' && typeof a.evidence_ref === 'string' && a.evidence_ref.trim(), 'explicit versioned operator repair grant required');
  assert(a.previous_seal_digest === previous.seal_digest && a.recipient_writer_id === options.recipient?.writerId && a.recipient_platform_id === options.recipient?.platformTaskId && a.recipient_writer_id !== previous.writer_id, 'predecessor or receiving identity mismatch');
  assert(previous.workspace.worktree_fingerprint.algorithm === 'git-diff-binary+untracked-content-sha256-v1' && !previous.workspace.inflight_scope && previous.workspace.staged_count === 0, 'only an unstaged strict V1 baseline is supported');
  assert(Array.isArray(a.deletions) && a.deletions.length && Array.isArray(a.maintenance), 'exact deletion and maintenance lists required');
  const paths = [...a.deletions, ...a.maintenance.map(f => f.path_ref)];
  assert(new Set(paths).size === paths.length, 'duplicate or overlapping repair paths');
  paths.forEach(ref => safe(options.sourceRoot, ref));
  const sourcePaths = new Set(Object.values(previous.sources).filter(s => s.root_ref !== 'external_control_plane').map(s => s.path_ref));
  assert(paths.every(ref => !sourcePaths.has(ref)), 'sealed source is not a repair target');
  const proof = a.evidence, before = previous.workspace, fp = before.worktree_fingerprint;
  assert(proof?.workspace && Array.isArray(proof.patches) && Array.isArray(proof.untracked), 'complete repair evidence required');
  const removed = new Set(a.deletions), maintenance = new Map(a.maintenance.map(f => [f.path_ref, f]));
  assert(new Set(proof.patches.map(f => f.path_ref)).size === proof.patches.length && new Set(proof.untracked.map(f => f.path_ref)).size === proof.untracked.length, 'duplicate evidence paths');
  assert(hash(Buffer.concat(proof.patches.map(f => Buffer.from(f.bytes, 'base64')))) === proof.workspace.worktree_fingerprint.tracked_diff_sha256 && digest(proof.untracked) === proof.workspace.worktree_fingerprint.untracked_digest, 'live evidence fingerprint mismatch');
  const originalPatches = new Map(proof.patches.map(f => [f.path_ref, f.bytes]));
  for (const ref of a.deletions) {
    assert(!live || !fs.existsSync(safe(options.sourceRoot, ref)), 'deleted file reappeared');
    const required = before.required_untracked.find(f => f.path_ref === ref);
    assert(required || originalPatches.has(ref), 'deletion was not in the sealed workspace');
    originalPatches.delete(ref);
  }
  for (const f of a.maintenance) {
    assert(f.path_ref === manifestRef || /^\.github\/scripts\/[A-Za-z0-9._-]+\.mjs$/.test(f.path_ref), 'maintenance must be an exact handoff script or manifest');
    assert(!before.required_untracked.some(r => r.path_ref === f.path_ref), 'required original evidence cannot be a maintenance target');
    assert(typeof f.before_diff === 'string' && (f.before_base64 === null || typeof f.before_base64 === 'string') && /^[a-f0-9]{64}$/.test(f.after_sha256), 'maintenance before/after evidence required');
    if (live) assert(hash(fs.readFileSync(safe(options.sourceRoot, f.path_ref))) === f.after_sha256, 'maintenance file changed');
    if (f.before_diff) originalPatches.set(f.path_ref, f.before_diff); else originalPatches.delete(f.path_ref);
  }
  const restored = ordered([...originalPatches].map(([path_ref, bytes]) => ({ path_ref, bytes })));
  assert(hash(Buffer.concat(restored.map(f => Buffer.from(f.bytes, 'base64')))) === fp.tracked_diff_sha256 && restored.length === before.tracked_modified_count, 'unapproved tracked drift or invalid original patch evidence');
  const originalUntracked = new Map(proof.untracked.map(f => [f.path_ref, f.sha256]));
  for (const f of a.maintenance) {
    if (f.before_base64 === null) originalUntracked.delete(f.path_ref);
    else if (originalUntracked.has(f.path_ref)) originalUntracked.set(f.path_ref, hash(Buffer.from(f.before_base64, 'base64')));
  }
  for (const ref of a.deletions) { const f = before.required_untracked.find(f => f.path_ref === ref); if (f) originalUntracked.set(ref, f.sha256); }
  const untracked = [...originalUntracked].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([path_ref, sha256]) => ({ path_ref, sha256 }));
  assert(digest(untracked) === fp.untracked_digest, 'unapproved untracked drift');
  const expectedRequired = before.required_untracked.filter(f => !removed.has(f.path_ref));
  assert(JSON.stringify(proof.workspace.required_untracked) === JSON.stringify(expectedRequired), 'required evidence scope changed');
  for (const key of ['root_ref', 'head', 'tree', 'branch']) assert(proof.workspace[key] === before[key], `${key} changed`);
  assert(proof.workspace.staged_count === 0, 'index staging is not permitted');
  const manifest = maintenance.get(manifestRef);
  let ruleBaseline = previous.rule_baseline;
  if (manifest) {
    const oldBytes = Buffer.from(manifest.before_base64 || '', 'base64');
    assert(hash(oldBytes) === previous.rule_baseline.manifest_sha256, 'original rule manifest is not sealed');
    assert(typeof manifest.after_base64 === 'string' && hash(Buffer.from(manifest.after_base64, 'base64')) === manifest.after_sha256, 'anchored rule manifest bytes required');
    const old = JSON.parse(oldBytes), current = JSON.parse(Buffer.from(manifest.after_base64, 'base64'));
    assert(JSON.stringify({ ...old, rules: null }) === JSON.stringify({ ...current, rules: null }), 'rule contract or version changed outside repair');
    const oldRules = new Map(old.rules.map(f => [f.path_ref, f]));
    assert(new Set(current.rules.map(f => f.path_ref)).size === current.rules.length, 'duplicate live rule paths');
    for (const f of current.rules) {
      const prior = oldRules.get(f.path_ref), changed = maintenance.get(f.path_ref);
      assert(prior ? (changed ? JSON.stringify({ ...prior, sha256: f.sha256 }) === JSON.stringify(f) : JSON.stringify(prior) === JSON.stringify(f)) : changed?.before_base64 === null, 'unapproved rule manifest change');
      if (changed) assert(f.sha256.toLowerCase() === changed.after_sha256, 'maintenance rule fingerprint mismatch');
      oldRules.delete(f.path_ref);
    }
    assert(oldRules.size === 0, 'rule entry removed');
    assert(!live || hash(fs.readFileSync(safe(options.sourceRoot, manifestRef))) === manifest.after_sha256, 'manifest changed');
    ruleBaseline = { ...ruleBaseline, manifest_sha256: manifest.after_sha256 };
  }
  if (live) assert(digest(observe(previous, options, removed)) === digest(proof), 'repair evidence no longer matches the workspace or index');
  return { ...previous, workspace: proof.workspace, rule_baseline: ruleBaseline };
}
