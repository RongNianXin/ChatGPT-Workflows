import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { inspectTracking, parseArguments } from './Inspect-WorkspaceTracking.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const script = path.join(root, '.github', 'scripts', 'Inspect-WorkspaceTracking.mjs');
const fixtureBase = path.join(root, '.codex-manual-cache', 'tests');
fs.mkdirSync(fixtureBase, { recursive: true });
const fixture = fs.mkdtempSync(path.join(fixtureBase, 'tracking-test-'));
const cleanEnv = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: path.join(fixture, 'empty.gitconfig') };
fs.writeFileSync(cleanEnv.GIT_CONFIG_GLOBAL, '');
try {
  const git = args => execFileSync('git', args, {cwd:fixture,encoding:'utf8',env:cleanEnv});
  git(['init','-q']);
  fs.mkdirSync(path.join(fixture, '.git', 'info'), { recursive: true });
  fs.appendFileSync(path.join(fixture, '.git', 'info', 'exclude'), '\nempty.gitconfig\n');
  fs.writeFileSync(path.join(fixture,'result.md'),'ordinary result');
  fs.writeFileSync(path.join(fixture,'private.md'),'private');
  fs.writeFileSync(path.join(fixture,'.env'),'secret');
  fs.mkdirSync(path.join(fixture,'sub'));
  const invoke = (args=[],cwd=fixture,env=cleanEnv) => spawnSync(process.execPath,[script,...args],{cwd,encoding:'utf8',env,timeout:15000});
  let outcome=invoke([],path.join(fixture,'sub'));
  assert.equal(outcome.status,0);
  const result=JSON.parse(outcome.stdout);
  assert.equal(result.mode,'CLASSIFY_ONLY');
  assert.deepEqual(result.safe_candidates,['result.md']);
  assert.equal(result.review_required[0].path,'private.md');
  assert.equal(result.protected[0].path,'.env');
  assert.equal(git(['diff','--cached','--name-only']).trim(),'');
  const foreign = path.join(fixture, 'foreign');
  fs.mkdirSync(foreign);
  execFileSync('git', ['init', '-q'], { cwd: foreign });
  outcome = invoke([`--project-root=${fixture}`], foreign);
  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(fs.realpathSync(JSON.parse(outcome.stdout).root), fs.realpathSync(fixture), 'explicit root must bind before the first Git call');
  assert.notEqual(invoke(['--stage-safe']).status,0);
  assert.notEqual(invoke(['--stage-safe','--reviewed-path=.env']).status,0);
  assert.notEqual(invoke(['--stage-safe','--reviewed-path=private.md']).status,0);
  assert.notEqual(invoke(['--stage-safe','--reviewed-path=../outside.md']).status,0);
  outcome=invoke(['--stage-safe','--reviewed-path=result.md']);
  assert.equal(outcome.status,0,outcome.stderr);
  assert.equal(git(['diff','--cached','--name-only']).trim(),'result.md');
  const blocked = (args, code, cwd = fixture, env = cleanEnv) => {
    const value = invoke(args, cwd, env);
    assert.equal(value.status, 1, value.stderr);
    const body = JSON.parse(value.stdout);
    assert.equal(body.result, 'BLOCKED');
    assert.equal(body.error.code, code);
    assert.equal(body.complete, false);
    return body;
  };
  blocked(['--unknown'], 'UNKNOWN_ARGUMENT');
  blocked(['--project-root='], 'EMPTY_ARGUMENT');
  blocked([`--project-root=${fixture}`, `--project-root=${foreign}`], 'DUPLICATE_ARGUMENT');
  blocked([`--project-root=${path.join(fixture, 'sub')}`], 'EXPLICIT_ROOT_MISMATCH');
  blocked([`--project-root=${path.join(fixture, 'absent')}`], 'ROOT_UNAVAILABLE');
  blocked([], 'GIT_UNAVAILABLE', fixture, { ...cleanEnv, PATH: '' });
  blocked([], 'GIT_ENVIRONMENT_OVERRIDE', fixture, { ...cleanEnv, GIT_INDEX_FILE: 'do-not-use' });
  blocked([], 'GIT_ENVIRONMENT_OVERRIDE', fixture, { ...cleanEnv, GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'anything', GIT_CONFIG_VALUE_0: 'never-print-this' });
  blocked([], 'GIT_ENVIRONMENT_OVERRIDE', fixture, { ...cleanEnv, GIT_TRACE: path.join(fixture, 'trace-must-not-exist') });
  assert(!fs.existsSync(path.join(fixture, 'trace-must-not-exist')));

  const redirects = ['GIT_REDIRECT_STDIN', 'GIT_REDIRECT_STDOUT', 'GIT_REDIRECT_STDERR'];
  for (const name of [...redirects, 'git_redirect_stdout', 'Git_Redirect_Stderr', 'GIT_REDIRECT_FUTURE']) {
    let spawned = false;
    const value = inspectTracking({ projectRoot: fixture, env: { [name]: 'never-disclose-this-target' },
      spawn: () => { spawned = true; return { status: 0, stdout: fixture + '\n' }; } });
    assert.equal(spawned, false, `${name} must be rejected before the first Git process`);
    assert.equal(value.error.code, 'GIT_ENVIRONMENT_OVERRIDE');
    assert.deepEqual(value.error.variables, [name]);
    assert(!JSON.stringify(value).includes('never-disclose-this-target'));
  }
  for (const name of redirects) {
    const target = path.join(fixture, '.git', `${name}-target`);
    const value = blocked([], 'GIT_ENVIRONMENT_OVERRIDE', fixture, { ...cleanEnv, [name]: target });
    assert.deepEqual(value.error.variables, [name]);
    assert(!JSON.stringify(value).includes(target));
    assert(!fs.existsSync(target), `${name} must not create a redirection target`);
    fs.writeFileSync(target, 'preserve-existing-target');
    blocked([], 'GIT_ENVIRONMENT_OVERRIDE', fixture, { ...cleanEnv, [name]: target });
    assert.equal(fs.readFileSync(target, 'utf8'), 'preserve-existing-target');
  }
  console.log('Git redirection preflight: PASS (no spawn, case-insensitive, no disclosed values, CLI targets untouched)');

  const trap = path.join(fixture, '.git', 'external-helper.cjs');
  const marker = path.join(fixture, '.git', 'helper-ran');
  fs.writeFileSync(trap, `require('fs').writeFileSync(${JSON.stringify(marker)}, 'unexpected');`);
  const trapCommand = `"${process.execPath.replaceAll('\\', '/')}" "${trap.replaceAll('\\', '/')}"`;
  const metadata = () => {
    const value = invoke(['--metadata-only']);
    assert.equal(value.status, 2, value.stdout || value.stderr);
    const body = JSON.parse(value.stdout);
    assert.equal(body.result, 'PARTIAL');
    assert.equal(body.complete, false);
    assert.equal(body.mode, 'PATH_INVENTORY_ONLY');
    for (const key of ['safe_candidates', 'tracked_changes', 'staged_paths']) assert(!(key in body));
    return body;
  };
  fs.writeFileSync(path.join(fixture, '.gitattributes'), '*.md filter=test\n');
  for (const type of ['clean', 'process']) {
    git(['config', `filter.test.${type}`, trapCommand]);
    const failure = blocked([], 'EXECUTABLE_GIT_FILTER');
    assert(!JSON.stringify(failure).includes(trapCommand));
    assert(!fs.existsSync(marker));
    const beforeMetadata = fs.readFileSync(path.join(fixture, '.git', 'index'));
    assert(metadata().index_entries.some(entry => entry.path === 'result.md'));
    assert(!fs.existsSync(marker), 'path inventory must not execute an applicable filter');
    assert.deepEqual(fs.readFileSync(path.join(fixture, '.git', 'index')), beforeMetadata);
    git(['config', '--unset', `filter.test.${type}`]);
  }
  git(['config', 'core.fsmonitor', trapCommand]);
  assert.equal(invoke().status, 0);
  assert(!fs.existsSync(marker));
  git(['config', '--unset', 'core.fsmonitor']);
  fs.unlinkSync(path.join(fixture, '.gitattributes'));

  for (const args of [['--metadata-only', '--stage-safe'], ['--metadata-only', '--reviewed-path=result.md'],
    ['--metadata-only', '--stage-safe', '--reviewed-path=result.md']]) blocked(args, 'INCOMPATIBLE_MODES');
  for (const options of [{ stageSafe: true }, { reviewedPaths: ['result.md'] }]) {
    let spawned = false;
    const body = inspectTracking({ projectRoot: fixture, metadataOnly: true, ...options,
      spawn: () => { spawned = true; } });
    assert.equal(body.error.code, 'INCOMPATIBLE_MODES');
    assert.equal(spawned, false);
  }
  const excludedNames = ['其他资料/inside.md', 'nest/全局提示词（严禁AI自动修改）/inside.md',
    'nest/中间自用文档.docx', '.CoDeX-MaNuAl-CaChE/inside.md', 'nest/.ENV.local', 'nest/secret.PEM'];
  for (const name of excludedNames) {
    fs.mkdirSync(path.dirname(path.join(fixture, name)), { recursive: true });
    fs.writeFileSync(path.join(fixture, name), 'fixture only');
  }
  assert(!JSON.stringify(metadata()).includes('inside.md'));
  for (const name of excludedNames) git(['add', '--', name]);
  const excludedInventory = metadata();
  for (const name of excludedNames) {
    assert(!excludedInventory.index_entries.some(entry => entry.path === name));
    assert(!excludedInventory.untracked_paths.includes(name));
  }
  git(['reset', '-q', '--', ...excludedNames]);
  const unusual = process.platform === 'win32' ? 'space & [a] 中文 🧪.md' : 'tab\tline\n[a] 中文 🧪.md';
  fs.writeFileSync(path.join(fixture, unusual), 'fixture');
  assert(metadata().untracked_paths.includes(unusual));
  // An unborn repository is valid: no HEAD or blob comparison is needed.
  assert(metadata().index_entries.some(entry => entry.path === 'result.md' && entry.stage === 0));

  const identity = ['-c', 'user.name=Fixture', '-c', 'user.email=test@example.invalid'];
  git([...identity, 'commit', '-qm', 'fixture']);
  const snapshot = () => ['index', 'HEAD', 'config'].map(name => fs.readFileSync(path.join(fixture, '.git', name)).toString('hex'));
  const before = snapshot();
  const sourceBefore = fs.readFileSync(path.join(fixture, 'result.md'));
  assert.equal(invoke().status, 0);
  metadata();
  assert.deepEqual(snapshot(), before);
  assert.deepEqual(fs.readFileSync(path.join(fixture, 'result.md')), sourceBefore);

  const modulePath = 'module';
  git(['update-index', '--add', '--cacheinfo', `160000,${git(['rev-parse', 'HEAD']).trim()},${modulePath}`]);
  fs.mkdirSync(path.join(fixture, modulePath));
  execFileSync('git', ['init', '-q'], { cwd: path.join(fixture, modulePath), env: cleanEnv });
  fs.writeFileSync(path.join(fixture, modulePath, 'inside.md'), 'internal untracked');
  const moduleResult = JSON.parse(invoke().stdout);
  assert.deepEqual(moduleResult.observation_scope.unobserved_gitlinks, [modulePath]);
  assert.equal(moduleResult.observation_scope.submodule_commit_changes, 'NOT_OBSERVED');
  assert(!moduleResult.safe_candidates.some(name => name.startsWith('module/')));
  assert.deepEqual(metadata().observation_scope.unobserved_gitlinks, [modulePath]);
  git(['update-index', '--force-remove', modulePath]);

  const special = '中文 space & [a] 🧪.md';
  fs.writeFileSync(path.join(fixture, special), 'data, not instructions');
  outcome = invoke(['--stage-safe', `--reviewed-path=${special}`]);
  assert.equal(outcome.status, 0, outcome.stdout);
  assert.deepEqual(JSON.parse(outcome.stdout).staged_paths, [special]);
  assert(git(['diff', '--cached', '--name-only', '-z']).split('\0').includes(special));
  fs.writeFileSync(path.join(fixture, 'result.md'), 'changed tracked content');
  git(['mv', special, 'renamed.md']);
  const changes = JSON.parse(invoke().stdout).tracked_changes;
  assert(changes.some(item => item.path === 'result.md' && item.code === ' M'));

  const linked = path.join(fixtureBase, `${path.basename(fixture)}-linked`);
  git(['worktree', 'add', '--detach', '-q', linked, 'HEAD']);
  try {
    git(['worktree', 'lock', linked]);
    assert.equal(invoke([`--project-root=${linked}`]).status, 0);
    assert.equal(invoke([`--project-root=${linked}`, '--metadata-only']).status, 2);
  } finally { git(['worktree', 'unlock', linked]); git(['worktree', 'remove', '--force', linked]); }

  let calls = [];
  const fake = (file, args, options) => {
    calls.push({ file, args, options });
    const text = args.includes('rev-parse') ? fixture + '\n' : '';
    return { status: args.includes('config') ? 1 : 0, stdout: text, stderr: '' };
  };
  const inspect = extra => inspectTracking({ projectRoot: fixture, env: {}, spawn: fake, ...extra });
  assert.equal(inspect().result, 'PASS');
  for (const call of calls) {
    assert.equal(call.file, 'git');
    for (const arg of ['--no-optional-locks', '--literal-pathspecs', 'core.fsmonitor=false', 'core.untrackedCache=false']) assert(call.args.includes(arg));
    assert.equal(call.options.shell, false);
    assert.equal(call.options.windowsHide, true);
    assert(call.options.timeout > 0 && call.options.timeout <= 30000);
    assert.equal(call.options.maxBuffer, 16 * 1024 * 1024);
    assert.equal(call.options.env.GIT_NO_LAZY_FETCH, '1');
    assert.equal(call.options.env.GIT_TERMINAL_PROMPT, '0');
  }
  calls = [];
  assert.equal(inspect({ metadataOnly: true }).result, 'PARTIAL');
  assert.equal(calls.length, 5);
  for (const call of calls.filter(call => call.args.includes('ls-files'))) {
    assert(!call.args.includes('--literal-pathspecs'));
    assert(call.args.some(arg => arg.startsWith(':(top,exclude,glob,icase)')));
    assert(!call.args.some(arg => ['status', 'diff', 'add', '--modified', '--eol'].includes(arg)));
    if (call.args.includes('--stage')) assert(call.args.includes('--sparse'));
    else assert(call.args.some(arg => arg.startsWith('--exclude=')));
  }
  let inventoryReads = 0;
  const changedInventory = inspect({ metadataOnly: true, spawn: (file, args, options) => args.includes('--others')
    ? { status: 0, stdout: inventoryReads++ ? 'later.md\0' : '' } : fake(file, args, options) });
  assert.equal(changedInventory.error.code, 'OBSERVATION_CHANGED');
  assert(!('index_entries' in changedInventory));
  for (const raw of ['truncated', '100644 invalid 0\tfile\0', '\0', 'bad\ufffd\0']) {
    assert.equal(inspect({ metadataOnly: true, spawn: (file, args, options) => args.includes('--stage')
      ? { status: 0, stdout: raw } : fake(file, args, options) }).error.code, 'INVALID_INVENTORY');
  }
  const oid = git(['rev-parse', 'HEAD:result.md']).trim();
  execFileSync('git', ['update-index', '--index-info'], { cwd: fixture, env: cleanEnv,
    input: [1, 2, 3].map(stage => `100644 ${oid} ${stage}\tconflict.md\n`).join('') });
  assert.deepEqual(metadata().index_entries.filter(entry => entry.path === 'conflict.md').map(entry => entry.stage), [1, 2, 3]);
  git(['update-index', '--force-remove', 'conflict.md']);

  const sparse = path.join(fixture, 'sparse-fixture');
  fs.mkdirSync(sparse);
  const sparseGit = args => execFileSync('git', args, { cwd: sparse, env: cleanEnv, encoding: 'utf8' });
  sparseGit(['init', '-q']);
  for (const directory of ['keep', 'folded']) {
    fs.mkdirSync(path.join(sparse, directory));
    fs.writeFileSync(path.join(sparse, directory, 'file.md'), directory);
  }
  sparseGit(['add', '--', 'keep/file.md', 'folded/file.md']);
  sparseGit([...identity, 'commit', '-qm', 'sparse fixture']);
  sparseGit(['sparse-checkout', 'init', '--cone', '--sparse-index']);
  sparseGit(['sparse-checkout', 'set', 'keep']);
  const sparseIndex = fs.readFileSync(path.join(sparse, '.git', 'index'));
  outcome = invoke(['--metadata-only'], sparse);
  assert.equal(outcome.status, 2, outcome.stdout);
  const sparseResult = JSON.parse(outcome.stdout);
  assert.deepEqual(sparseResult.observation_scope.unexpanded_sparse_directories, ['folded/']);
  assert(!sparseResult.index_entries.some(entry => entry.path === 'folded/file.md'));
  assert.deepEqual(fs.readFileSync(path.join(sparse, '.git', 'index')), sparseIndex);
  for (const [code, expected] of [['ETIMEDOUT', 'GIT_TIMEOUT'], ['ENOBUFS', 'GIT_OUTPUT_LIMIT'], ['EACCES', 'GIT_PERMISSION_DENIED']]) {
    const value = inspect({ spawn: () => ({ error: { code }, status: null }) });
    assert.equal(value.error.code, expected);
    assert.equal(value.complete, false);
    const partialFailure = inspect({ metadataOnly: true, spawn: () => ({ error: { code }, status: null }) });
    assert.equal(partialFailure.error.code, expected);
    assert.equal(partialFailure.result, 'BLOCKED');
  }
  const unsupportedSparse = inspect({ metadataOnly: true, spawn: (file, args, options) => args.includes('--sparse')
    ? { status: 129, stdout: '', stderr: 'unsupported' } : fake(file, args, options) });
  assert.equal(unsupportedSparse.result, 'BLOCKED');
  assert.equal(unsupportedSparse.error.code, 'GIT_FAILED');
  for (const warningCall of [1, 2, 3, 4]) {
    let metadataCalls = 0;
    const warning = inspect({ metadataOnly: true, spawn: (file, args, options) => {
      const value = fake(file, args, options);
      if (args.includes('ls-files') && ++metadataCalls === warningCall) value.stderr = 'warning: private directory could not open: Permission denied';
      return value;
    } });
    assert.equal(warning.result, 'BLOCKED');
    assert.equal(warning.error.code, 'GIT_INVENTORY_WARNING');
    assert(!JSON.stringify(warning).includes('private directory'));
    assert(!('index_entries' in warning));
  }
  for (const stderr of ['', ' \r\n\t']) {
    assert.equal(inspect({ metadataOnly: true, spawn: (file, args, options) => ({ ...fake(file, args, options), stderr }) }).result, 'PARTIAL');
  }
  let elapsed = 0;
  assert.equal(inspect({ now: () => (elapsed += 100), totalTimeoutMs: 50 }).error.code, 'TOTAL_BUDGET_EXCEEDED');
  let observations = 0;
  assert.equal(inspect({ spawn: (file, args, options) => args.includes('status')
    ? { status: 0, stdout: observations++ ? '?? later.md\0' : '' }
    : fake(file, args, options) }).error.code, 'OBSERVATION_CHANGED');
  assert.equal(inspect({ spawn: (file, args, options) => args.includes('status')
    ? { status: 0, stdout: 'truncated status' } : fake(file, args, options) }).error.code, 'INVALID_STATUS');
  assert.equal(inspect({ spawn: () => ({ status: 128, stdout: '', stderr: 'do not disclose' }) }).error.code, 'GIT_FAILED');
  calls = [];
  assert.equal(inspect({ spawn: (file, args, options) => args.includes('config')
    ? { status: 0, stdout: 'filter.fixture.clean\nsecret-command\0' }
    : fake(file, args, options) }).error.code, 'EXECUTABLE_GIT_FILTER');
  assert(!calls.some(call => call.args.includes('status')));
  assert.throws(() => parseArguments(['--stage-safe', '--stage-safe']));
  const stagedBeforeRejection = git(['diff','--cached','--name-only']);
  fs.writeFileSync(path.join(fixture,'unreviewed.md'),'left untouched');
  assert.equal(invoke(['--stage-safe','--reviewed-path=unreviewed.md','--reviewed-path=.env']).status,1);
  assert.equal(git(['diff','--cached','--name-only']),stagedBeforeRejection);
  console.log('Workspace tracking hardening: PASS (real CLI roots, environment, filters, fsmonitor, literal names, worktree, source bytes; simulated budgets/limits/drift)');
  console.log('Workspace tracking scanner: PASS (default read-only, repository root, protected paths, explicit reviewed paths, atomic rejection)');
  console.log('Partial inventory: PASS (applicable filters never run, exclusions, unborn HEAD, conflicts, sparse index unchanged, gitlinks, linked worktree, NUL names, drift/parse rejection, CLI exit 2)');
} finally {
  const relative = path.relative(fs.realpathSync(fixtureBase), fs.realpathSync(fixture));
  assert(relative && !relative.startsWith('..') && !path.isAbsolute(relative));
  fs.rmSync(fixture,{recursive:true,force:true});
}
