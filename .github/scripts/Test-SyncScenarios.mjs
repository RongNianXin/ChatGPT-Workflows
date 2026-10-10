// Offline evidence fixtures, not a synchronizer or an agent-policy enforcement tool.
// All repositories, Git transports and child processes belong to this temporary run.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawnSync, fork } from 'node:child_process';

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-sync-fixture-'));
const hooks = path.join(temporary, 'hooks');
fs.mkdirSync(hooks);
const config = path.join(temporary, 'empty-git-config');
fs.writeFileSync(config, '');
const env = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: config,
  GIT_ALLOW_PROTOCOL: 'file', GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_COUNT: '0' };
// Avoid inheriting another checkout or repository's process-level Git routing.
for (const key of Object.keys(env)) {
  if (/^GIT_(?:DIR|WORK_TREE|COMMON_DIR|INDEX_FILE|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|CONFIG_PARAMETERS)$/.test(key) ||
      /^GIT_CONFIG_(?:KEY|VALUE)_/.test(key)) delete env[key];
}
const children = new Set();
const deadline = Date.now() + 60000;
function remaining(limit) {
  const milliseconds = deadline - Date.now();
  assert.ok(milliseconds > 0, 'offline fixture deadline exceeded');
  return Math.min(limit, milliseconds);
}
let passed = 0;
function git(cwd, args, expected = 0) {
  const result = spawnSync('git', ['-c', `core.hooksPath=${hooks}`, ...args],
    { cwd, env, encoding: 'utf8', timeout: remaining(15000) });
  assert.equal(result.status, expected, `git ${args[0]}: ${result.error?.message ?? result.stderr}`);
  return result.stdout.trim();
}
function makeRepo(name) {
  const directory = path.join(temporary, name);
  fs.mkdirSync(directory);
  git(directory, ['init', '-b', 'main']);
  identity(directory);
  return directory;
}
function identity(directory) {
  git(directory, ['config', 'user.name', 'Fixture Author']);
  git(directory, ['config', 'user.email', 'fixture@example.invalid']);
  git(directory, ['config', 'commit.gpgsign', 'false']);
  git(directory, ['config', 'core.autocrlf', 'false']);
}
const write = (directory, name, value) => fs.writeFileSync(path.join(directory, name), value);
function commit(directory, names, message) {
  git(directory, ['add', '--', ...names]);
  git(directory, ['commit', '-m', message]);
  return git(directory, ['rev-parse', 'HEAD']);
}
function check(name, body) {
  body(); passed += 1; console.log(`PASS: ${name}`);
}
async function asyncCheck(name, body) {
  await body(); passed += 1; console.log(`PASS: ${name}`);
}
const runner = path.join(temporary, 'runtime.cjs');
fs.writeFileSync(runner, `
const path = require('node:path');
const directory = process.argv[2];
let snapshot;
try { snapshot = { status: 'loaded', implementation: require(path.join(directory, 'app.cjs')),
  build: require(path.join(directory, 'build.cjs')) }; }
catch (error) { snapshot = { status: 'load-failed', code: error.code }; }
process.on('message', () => process.send(snapshot));
process.on('disconnect', () => process.exit(0));
`);
async function query(child) {
  return await new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); child.off('message', message); child.off('error', error); child.off('exit', exit); };
    const message = value => { cleanup(); resolve(value); };
    const error = value => { cleanup(); reject(value); };
    const exit = code => error(new Error(`fixture exited before reply: ${code}`));
    const timer = setTimeout(() => error(new Error('fixture IPC timeout')), remaining(5000));
    child.once('message', message); child.once('error', error); child.once('exit', exit);
    child.send('identity', errorValue => { if (errorValue) error(errorValue); });
  });
}
function start(directory) {
  const child = fork(runner, [directory], { env, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  children.add(child); return child;
}
async function stop(child) {
  if (child.exitCode === null && child.signalCode === null) {
    await new Promise((resolve, reject) => {
      const exited = () => { clearTimeout(timer); resolve(); };
      const timer = setTimeout(() => {
        child.off('exit', exited);
        reject(new Error('owned fixture process did not exit within 5 seconds'));
      }, 5000);
      child.once('exit', exited);
      child.kill('SIGKILL');
    });
  }
  children.delete(child);
}
try {
  const remote = path.join(temporary, 'remote.git');
  git(temporary, ['init', '--bare', '--initial-branch=main', remote]);
  const author = makeRepo('author');
  write(author, '.gitignore', 'local.json\nbuild.cjs\n');
  write(author, 'app.cjs', "const fs=require('node:fs');const p=require('node:path').join(__dirname,'local.json');module.exports={version:'v1',profile:fs.existsSync(p)?JSON.parse(fs.readFileSync(p)).profile:'default'};\n");
  write(author, 'build.cjs', "module.exports={version:'v1'};\n");
  write(author, 'lock.json', '{"dependency":"1"}\n');
  write(author, 'toolchain.txt', 'fixture-toolchain-1\n');
  commit(author, ['.gitignore', 'app.cjs', 'lock.json', 'toolchain.txt'], 'initial fixture');
  git(author, ['remote', 'add', 'origin', remote]);
  git(author, ['push', 'origin', 'HEAD:refs/heads/main']);
  const receiver = path.join(temporary, 'receiver');
  git(temporary, ['clone', '--no-hardlinks', remote, receiver]); identity(receiver);
  write(receiver, 'build.cjs', "module.exports={version:'v1'};\n");

  await asyncCheck('ignored runtime config changes the accepted result despite equal Git trees', async () => {
    write(author, 'local.json', '{"profile":"accepted"}\n');
    assert.equal(git(author, ['rev-parse', 'HEAD^{tree}']), git(receiver, ['rev-parse', 'HEAD^{tree}']));
    assert.equal(git(author, ['status', '--porcelain']), '');
    const a = start(author), b = start(receiver);
    assert.equal((await query(a)).implementation.profile, 'accepted');
    assert.equal((await query(b)).implementation.profile, 'default');
    await stop(a); await stop(b);
  });

  await asyncCheck('an owned runtime exits when its parent IPC connection is lost', async () => {
    const child = start(receiver); await query(child);
    await new Promise((resolve, reject) => {
      const exited = code => {
        clearTimeout(timer);
        if (code === 0) resolve(); else reject(new Error(`fixture disconnect exit: ${code}`));
      };
      const timer = setTimeout(() => {
        child.off('exit', exited); reject(new Error('fixture IPC disconnect did not exit'));
      }, 5000);
      child.once('exit', exited); child.disconnect();
    });
    children.delete(child);
  });

  await asyncCheck('updated HEAD does not update a live process or an ignored old build', async () => {
    const old = start(receiver); assert.equal((await query(old)).implementation.version, 'v1');
    write(author, 'app.cjs', "module.exports={version:'v2',profile:'default'};\n");
    commit(author, ['app.cjs'], 'new implementation'); git(author, ['push', 'origin', 'HEAD:refs/heads/main']);
    git(receiver, ['fetch', 'origin', 'refs/heads/main']); git(receiver, ['merge', '--ff-only', 'FETCH_HEAD']);
    assert.equal(git(receiver, ['rev-parse', 'HEAD']), git(author, ['rev-parse', 'HEAD']));
    assert.equal((await query(old)).implementation.version, 'v1');
    const fresh = start(receiver), actual = await query(fresh);
    assert.equal(actual.implementation.version, 'v2'); assert.equal(actual.build.version, 'v1');
    await stop(old); await stop(fresh);
  });

  await asyncCheck('an untracked required module can work locally but be missing from the candidate', async () => {
    write(author, 'helper.cjs', "module.exports={version:'v3',profile:'default'};\n");
    write(author, 'app.cjs', "module.exports=require('./helper.cjs');\n");
    commit(author, ['app.cjs'], 'incomplete candidate fixture');
    assert.equal(git(author, ['ls-files', '--', 'helper.cjs']), '');
    assert.match(git(author, ['status', '--porcelain']), /\?\? helper\.cjs/);
    const candidate = path.join(temporary, 'candidate');
    git(temporary, ['clone', '--no-hardlinks', author, candidate]);
    write(candidate, 'build.cjs', "module.exports={version:'v3'};\n");
    const a = start(author), b = start(candidate);
    assert.equal((await query(a)).implementation.version, 'v3');
    assert.equal((await query(b)).code, 'MODULE_NOT_FOUND');
    await stop(a); await stop(b);
  });

  check('squash changes commit identity while preserving the accepted content', () => {
    const repo = makeRepo('squash'); write(repo, 'value.txt', 'base\n'); commit(repo, ['value.txt'], 'base');
    git(repo, ['switch', '-c', 'topic']); write(repo, 'value.txt', 'accepted\n');
    const source = commit(repo, ['value.txt'], 'topic'); const tree = git(repo, ['rev-parse', 'HEAD^{tree}']);
    git(repo, ['switch', 'main']); git(repo, ['merge', '--squash', 'topic']);
    const merged = commit(repo, ['value.txt'], 'squashed');
    assert.notEqual(source, merged); assert.equal(git(repo, ['rev-parse', 'HEAD^{tree}']), tree);
    git(repo, ['merge-base', '--is-ancestor', source, merged], 1);
  });

  check('source drift is observed only after reading the actual new reference', () => {
    const approved = git(temporary, ['ls-remote', remote, 'refs/heads/main']).split(/\s/)[0];
    commit(author, ['helper.cjs'], 'complete candidate'); git(author, ['push', 'origin', 'HEAD:refs/heads/main']);
    const current = git(temporary, ['ls-remote', remote, 'refs/heads/main']).split(/\s/)[0];
    assert.notEqual(current, approved); assert.equal(current, git(author, ['rev-parse', 'HEAD']));
  });

  check('unknown push response is reconciled by reference readback, not a second push', () => {
    const candidate = git(author, ['rev-parse', 'HEAD']);
    // Simulate loss of the response to the preceding successful local-transport push.
    // This proves the readback evidence, not a real network timeout or agent retry policy.
    assert.equal(git(temporary, ['ls-remote', remote, 'refs/heads/main']).split(/\s/)[0], candidate);
  });

  check('dirty tracked, staged and untracked content survives an object fetch', () => {
    write(receiver, 'app.cjs', "module.exports={version:'local'};\n");
    write(receiver, 'staged.txt', 'local staged\n'); git(receiver, ['add', '--', 'staged.txt']);
    write(receiver, 'untracked.txt', 'local untracked\n');
    const before = git(receiver, ['status', '--porcelain']); const head = git(receiver, ['rev-parse', 'HEAD']);
    git(receiver, ['fetch', 'origin', 'refs/heads/main']);
    assert.equal(git(receiver, ['status', '--porcelain']), before);
    assert.equal(git(receiver, ['rev-parse', 'HEAD']), head);
    assert.equal(fs.readFileSync(path.join(receiver, 'untracked.txt'), 'utf8'), 'local untracked\n');
  });

  check('a real unresolved merge has an operation marker and retained conflict evidence', () => {
    const repo = makeRepo('conflict'); write(repo, 'value.txt', 'base\n'); commit(repo, ['value.txt'], 'base');
    git(repo, ['switch', '-c', 'topic']); write(repo, 'value.txt', 'topic\n'); commit(repo, ['value.txt'], 'topic');
    git(repo, ['switch', 'main']); write(repo, 'value.txt', 'main\n'); commit(repo, ['value.txt'], 'main');
    git(repo, ['merge', 'topic'], 1);
    assert.ok(fs.existsSync(path.join(repo, '.git', 'MERGE_HEAD')));
    assert.match(git(repo, ['status', '--porcelain']), /UU value\.txt/);
  });

  check('an LFS pointer does not contain or prove availability of its referenced object', () => {
    const repo = makeRepo('lfs'); const bytes = Buffer.from('fixture asset');
    const oid = crypto.createHash('sha256').update(bytes).digest('hex');
    write(repo, 'asset.bin', `version https://git-lfs.github.com/spec/v1\noid sha256:${oid}\nsize ${bytes.length}\n`);
    commit(repo, ['asset.bin'], 'pointer only');
    const pointer = git(repo, ['show', 'HEAD:asset.bin']);
    assert.match(pointer, /^version https:\/\/git-lfs/); assert.notEqual(pointer, bytes.toString());
    assert.equal(fs.existsSync(path.join(repo, '.git', 'lfs', 'objects', oid.slice(0, 2), oid.slice(2, 4), oid)), false);
    // No LFS client/server is invoked; absence here is local object evidence only.
  });

  check('a submodule checkout can disagree with the committed gitlink', () => {
    const sub = makeRepo('sub-source'); write(sub, 'value.txt', 'one\n'); const one = commit(sub, ['value.txt'], 'one');
    const parent = makeRepo('parent'); git(parent, ['submodule', 'add', sub, 'module']);
    commit(parent, ['.gitmodules', 'module'], 'submodule');
    write(sub, 'value.txt', 'two\n'); const two = commit(sub, ['value.txt'], 'two');
    const checkout = path.join(parent, 'module'); git(checkout, ['fetch', 'origin']); git(checkout, ['checkout', two]);
    assert.match(git(parent, ['ls-tree', 'HEAD', 'module']), new RegExp(`160000 commit ${one}`));
    assert.equal(git(checkout, ['rev-parse', 'HEAD']), two); assert.notEqual(one, two);
  });

  check('equal tracked locks do not prove installed dependencies or toolchains agree', () => {
    const repo = makeRepo('dependencies'); write(repo, 'lock.json', '{"dependency":"1"}\n');
    write(repo, 'toolchain.txt', 'fixture-toolchain-1\n'); commit(repo, ['lock.json', 'toolchain.txt'], 'declared environment');
    write(repo, 'installed.json', '{"dependency":"2"}\n');
    assert.notEqual(JSON.parse(git(repo, ['show', 'HEAD:lock.json'])).dependency,
      JSON.parse(fs.readFileSync(path.join(repo, 'installed.json'), 'utf8')).dependency);
    assert.notEqual(git(repo, ['show', 'HEAD:toolchain.txt']), 'fixture-toolchain-2');
    // A synthetic installation observation, not a package-manager integration test.
  });
  console.log(`Offline sync evidence fixtures: PASS (${passed} cases); no real remote or cross-machine acceptance`);
} finally {
  const stopped = await Promise.allSettled([...children].map(stop));
  const resolved = fs.realpathSync(temporary);
  assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()));
  assert.ok(path.basename(resolved).startsWith('workflow-sync-fixture-'));
  fs.rmSync(resolved, { recursive: true, force: true });
  const failedStops = stopped.filter(result => result.status === 'rejected');
  if (failedStops.length) throw new AggregateError(failedStops.map(result => result.reason), 'fixture process cleanup failed');
}
