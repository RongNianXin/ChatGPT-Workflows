import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readGitWorkspaceBaseline, verifyWorkspaceBaseline } from './Prepare-Handoff.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const base = fs.mkdtempSync(path.join(root, '.planning/ws-'));
const source = path.join(base, 'source');
fs.mkdirSync(source);
const git = (...args) => {
  const result = spawnSync('git', ['-C', source, ...args], { encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
};
const put = (ref, text) => fs.writeFileSync(path.join(source, ref), text);
const observe = (options = {}) => readGitWorkspaceBaseline(source, [], null, options);
const seal = value => ({ root_ref: '.', required_untracked: [], ...value });
git('init', '-q', '--initial-branch=main');
assert.throws(() => observe(), /HEAD|Git/);
assert.ok(verifyWorkspaceBaseline(source, { required_untracked: [] }).length);
put('tracked.txt', 'head\n');
put('.gitignore', 'required.local\n');
git('add', '--', 'tracked.txt', '.gitignore');
git('-c', 'user.name=Synthetic', '-c', 'user.email=synthetic@example.invalid', 'commit', '-qm', 'synthetic workspace');
const clean = observe();
assert.equal(clean.worktree_fingerprint.algorithm, 'git-diff-index-untracked-sha256-v2');
assert.match(clean.worktree_fingerprint.index_sha256, /^[0-9a-f]{64}$/);
assert.deepEqual(verifyWorkspaceBaseline(source, seal(clean)), []);
put('tracked.txt', 'stage one\n'); git('add', '--', 'tracked.txt'); put('tracked.txt', 'worktree\n');
const first = observe(), legacy1 = observe({ algorithm: 'git-diff-binary+untracked-content-sha256-v1' });
put('tracked.txt', 'stage two\n'); git('add', '--', 'tracked.txt'); put('tracked.txt', 'worktree\n');
const second = observe(), legacy2 = observe({ algorithm: 'git-diff-binary+untracked-content-sha256-v1' });
assert.equal(first.staged_count, second.staged_count);
assert.equal(first.tracked_modified_count, second.tracked_modified_count);
assert.equal(first.worktree_fingerprint.tracked_diff_sha256, second.worktree_fingerprint.tracked_diff_sha256);
assert.notEqual(first.worktree_fingerprint.index_sha256, second.worktree_fingerprint.index_sha256);
assert.ok(verifyWorkspaceBaseline(source, seal(first)).some(error => error.includes('index_sha256')));
assert.deepEqual(legacy1, legacy2);
assert.throws(() => observe({ algorithm: 'unknown' }), /algorithm/);
const outside = path.join(base, 'outside');
fs.mkdirSync(outside); fs.writeFileSync(path.join(outside, 'sentinel'), 'synthetic outside\n');
const link = path.join(source, 'link');
fs.symlinkSync(outside, link, process.platform === 'win32' ? 'junction' : 'dir');
assert.throws(() => readGitWorkspaceBaseline(source, ['link/sentinel']), /link|symlink|escape/);
assert.throws(() => readGitWorkspaceBaseline(source, ['link/sentinel'], null,
  { algorithm: 'git-diff-binary+untracked-content-sha256-v1' }), /link|symlink|escape/);
if (process.platform === 'win32') fs.rmdirSync(link); else fs.unlinkSync(link);
put('loose.txt', 'first\n');
const originalRead = fs.readFileSync;
let mutated = false;
try {
  fs.readFileSync = function (file, ...args) {
    const result = originalRead.call(this, file, ...args);
    if (!mutated && Buffer.isBuffer(result) && result.toString() === 'first\n') {
      mutated = true; put('loose.txt', 'second\n');
    }
    return result;
  };
  assert.throws(() => observe(), /changed during/);
} finally { fs.readFileSync = originalRead; }
assert.ok(mutated);
console.log('Strict workspace: 11 PASS (synthetic Git only; index, links, missing HEAD, stable sampling and legacy byte semantics).');
