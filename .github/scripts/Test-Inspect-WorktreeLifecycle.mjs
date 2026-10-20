import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { inspect } from './Inspect-WorktreeLifecycle.mjs';

const script = fileURLToPath(new URL('./Inspect-WorktreeLifecycle.mjs', import.meta.url));
// TEMP may be a short-path alias or junction on hosted runners. Normal cases
// use the canonical root; the explicit alias case below still requires review.
const fixtureParent = fs.realpathSync.native(os.tmpdir());
const fixture = fs.realpathSync.native(fs.mkdtempSync(path.join(fixtureParent, 'worktree-lifecycle-')));
const assertCleanupBoundary = (actual, parent, expected) => {
  assert.equal(actual, expected, 'cleanup must target the originally created fixture');
  assert.ok(path.dirname(actual) === parent && path.basename(actual).startsWith('worktree-lifecycle-'),
    'cleanup fixture must be a direct, named child of the original canonical TEMP');
};
const repo = path.join(fixture, 'repository');
const target = path.join(fixture, 'linked space 测试');
const record = path.join(fixture, 'projection.json');
let count = 0;
const check = (name, fn) => { fn(); count += 1; };
const git = (args, cwd = repo) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const read = (event = 'audit', worktree = target) => inspect({ worktree, event, record });
const gap = (report, name) => report.gaps.some(item => item.startsWith(name));
const snapshot = directory => {
  const files = {};
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name);
    if (item.isDirectory()) Object.assign(files, snapshot(file));
    else files[file] = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  }
  return files;
};
const projection = () => {
  const observed = inspect({ worktree: target, event: 'audit' }).observed;
  return { schema_version: 1, record_ref: 'existing-worktree-table.md#candidate', worktree_path: target,
    observed_head: observed.head, observed_status_fingerprint: observed.status_fingerprint,
    task_state: 'IN_PROGRESS', chat_state: 'NOT_ARCHIVED', resource_state: 'CANDIDATE',
    owner: 'current-project-owner', reason: 'temporary carrier replaced', next_action_owner: 'current-project-owner', recheck_condition: 'before exact-path removal',
    assessments: Object.fromEntries(['ownership', 'preservation', 'dependencies', 'integration', 'authorization'].map(key => [key, { status: 'CONFIRMED', actor: 'current-project-owner', ref: `existing-evidence.md#${key}` }])) };
};
const save = value => fs.writeFileSync(record, JSON.stringify(value));
try {
  assertCleanupBoundary(fixture, fixtureParent, fixture);
  for (const wrong of [fixtureParent, path.join(fixture, 'nested'), path.join(fixtureParent, 'worktree-lifecycle-other')]) {
    assert.throws(() => assertCleanupBoundary(wrong, fixtureParent, fixture));
  }
  assert.throws(() => assertCleanupBoundary(fixture, path.join(fixtureParent, 'other'), fixture));
  fs.mkdirSync(repo);
  git(['init', '-q']);
  git(['config', 'user.email', 'test@example.invalid']);
  git(['config', 'user.name', 'Lifecycle Test']);
  git(['config', 'core.autocrlf', 'false']);
  fs.writeFileSync(path.join(repo, '.gitignore'), 'cache/\nprivate.bin\n');
  fs.writeFileSync(path.join(repo, 'tracked.txt'), 'baseline\n');
  git(['add', '.gitignore', 'tracked.txt']);
  git(['commit', '-qm', 'baseline']);
  git(['worktree', 'add', '-q', '--detach', target, 'HEAD']);
  save(projection());
  check('clean detached remains unverified', () => {
    const r = read(); assert.equal(r.observed.detached, true);
    assert.equal(r.decision, 'CANDIDATE_PENDING_EVIDENCE_REVIEW', `unexpected gaps: ${r.gaps.join(', ')}`);
    assert.equal(r.deletion_authorized, false); assert.equal(r.semantic_verification, 'NOT_PERFORMED');
  });
  check('missing record localized', () => assert.ok(gap(inspect({ worktree: target, event: 'complete' }), 'RECORD_PROJECTION_REQUIRED')));
  check('all event triggers', () => { for (const e of ['create', 'sync', 'complete', 'cancel', 'fail', 'pause', 'handoff', 'audit']) assert.equal(read(e).mode, 'READ_ONLY'); });
  check('primary separate policy', () => assert.ok(gap(read('audit', repo), 'PRIMARY_WORKTREE')));
  check('subdirectory rejected', () => { fs.mkdirSync(path.join(target, 'sub')); assert.equal(read('audit', path.join(target, 'sub')).decision, 'OBSERVATION_BLOCKED'); });
  check('missing directory localized', () => assert.equal(read('audit', path.join(fixture, 'missing')).decision, 'OBSERVATION_BLOCKED'));
  check('non git localized', () => assert.equal(read('audit', fixture).decision, 'OBSERVATION_BLOCKED'));
  check('wrong mapping', () => { const p = projection(); p.worktree_path = repo; save(p); assert.ok(gap(read(), 'RECORD_WORKTREE_MISMATCH')); });
  check('old schema', () => { save({ schema_version: 0 }); assert.ok(gap(read(), 'RECORD_PROJECTION_UNAVAILABLE')); });
  check('invalid json', () => { fs.writeFileSync(record, '{'); assert.ok(gap(read(), 'RECORD_PROJECTION_UNAVAILABLE')); });
  check('unknown owner', () => { const p = projection(); p.owner = 'UNKNOWN'; save(p); assert.ok(gap(read(), 'RECORD_FIELD_REQUIRED:owner')); });
  check('failed proof', () => { const p = projection(); p.assessments.preservation.status = 'FAILED'; save(p); assert.ok(gap(read(), 'ASSESSMENT_REVIEW:preservation')); });
  check('missing recovery proof', () => { const p = projection(); delete p.assessments.preservation; save(p); assert.ok(gap(read(), 'ASSESSMENT_REQUIRED:preservation')); });
  save(projection());
  check('dirty and stale', () => {
    fs.appendFileSync(path.join(target, 'tracked.txt'), 'patch\n');
    assert.ok(gap(read(), 'UNCOMMITTED_OR_UNTRACKED')); assert.ok(gap(read(), 'PROJECTION_OBSERVATION_STALE'));
  });
  check('staged', () => { git(['add', 'tracked.txt'], target); assert.ok(read().observed.status.some(i => i.code === 'M ')); });
  git(['restore', '--staged', 'tracked.txt'], target);
  fs.writeFileSync(path.join(target, 'tracked.txt'), 'baseline\n');
  check('rename consumes original name', () => { git(['mv', 'tracked.txt', 'new name.txt'], target); assert.ok(read().observed.status.some(i => i.original_path === 'tracked.txt' && i.path === 'new name.txt')); });
  git(['mv', 'new name.txt', 'tracked.txt'], target);
  check('untracked', () => { fs.writeFileSync(path.join(target, 'unique.txt'), 'unique'); assert.ok(gap(read(), 'UNCOMMITTED_OR_UNTRACKED')); fs.unlinkSync(path.join(target, 'unique.txt')); });
  check('ignored unique data', () => { fs.writeFileSync(path.join(target, 'private.bin'), 'unique'); assert.ok(gap(read(), 'IGNORED_CONTENT_REVIEW')); fs.unlinkSync(path.join(target, 'private.bin')); });
  check('cache name does not prove rebuildability', () => { fs.mkdirSync(path.join(target, 'cache')); assert.ok(gap(read(), 'IGNORED_CONTENT_REVIEW')); fs.rmdirSync(path.join(target, 'cache')); });
  check('locked', () => { git(['worktree', 'lock', target]); assert.ok(gap(read(), 'LOCKED_WORKTREE')); git(['worktree', 'unlock', target]); });
  check('unreferenced detached result', () => { fs.appendFileSync(path.join(target, 'tracked.txt'), 'commit\n'); git(['add', 'tracked.txt'], target); git(['commit', '-qm', 'detached result'], target); assert.ok(gap(read(), 'NO_CONTAINING_LOCAL_BRANCH_OR_TAG')); });
  git(['switch', '--detach', 'HEAD~1'], target);
  check('archived but running declared conflict', () => { const p = projection(); p.chat_state = 'ARCHIVED'; p.assessments.dependencies.status = 'BLOCKED'; save(p); assert.ok(gap(read(), 'ASSESSMENT_REVIEW:dependencies')); });
  check('unknown task not fabricated complete', () => { const p = projection(); p.task_state = 'UNKNOWN'; save(p); assert.equal(read().declared.task_state, 'UNKNOWN'); });
  check('active/retained independent from task/chat', () => { for (const state of ['ACTIVE', 'RETAIN']) { const p = projection(); p.resource_state = state; save(p); assert.equal(read().decision, `DECLARED_${state}`); } });
  check('path alias requires review', () => { const alias = path.join(fixture, 'alias'); fs.symlinkSync(target, alias, process.platform === 'win32' ? 'junction' : 'dir'); assert.ok(gap(read('audit', alias), 'PATH_ALIAS')); fs.unlinkSync(alias); });
  save(projection());
  check('read-only bytes and missing declarations never infer authority', () => {
    const before = snapshot(fixture); for (const event of ['audit', 'create', 'sync', 'pause']) read(event);
    assert.deepEqual(snapshot(fixture), before); assert.equal(read().deletion_authorized, false);
  });
  check('CLI rejects bad/duplicate/missing parameters', () => { for (const args of [[], ['--force', 'yes'], ['--worktree', target, '--event', 'audit', '--event', 'sync'], ['--worktree', target, '--event', 'delete']]) { const r = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' }); assert.equal(r.status, 1); assert.match(r.stderr, /INPUT_REQUIRED/u); } });
} finally {
  // Use the same native canonical representation as creation, and retain the
  // original TEMP boundary even if the environment changes during the suite.
  const actual = fs.realpathSync.native(fixture);
  assertCleanupBoundary(actual, fixtureParent, fixture);
  fs.rmSync(actual, { recursive: true, force: true });
  assert.equal(fs.existsSync(actual), false, 'fixture cleanup must complete');
}
console.log(`Worktree lifecycle inspector: PASS (${count} real Git/CLI cases and cleanup boundary checks; declarations never authorize deletion)`);
