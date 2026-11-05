import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { enterSyntheticSuite, syntheticGitEnvironment } from './SyntheticTestRuntime.mjs';

const synthetic = await enterSyntheticSuite(import.meta.url, { timeoutMs: 45000 });
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const checks = [];
async function check(name, run) {
  await run(); checks.push(name); console.log('PASS: ' + name);
}
const fixture = fs.mkdtempSync(path.join(synthetic.artifacts, 'small-fixture-'));
const hashState = directory => fs.readdirSync(directory).sort().map(name => [name, fs.readFileSync(path.join(directory, name), 'utf8')]);

await check('all inherited Git routing, trace and config injection is replaced, including mixed-case names', () => {
  const hostile = {
    PATH: process.env.PATH, GIT_DIR: 'untrusted', GIT_WORK_TREE: 'untrusted', GIT_COMMON_DIR: 'untrusted',
    GIT_INDEX_FILE: 'untrusted', GIT_OBJECT_DIRECTORY: 'untrusted', GIT_ALTERNATE_OBJECT_DIRECTORIES: 'untrusted',
    GIT_EXEC_PATH: 'untrusted', GIT_CONFIG_PARAMETERS: 'untrusted', GIT_TRACE: 'untrusted',
    GIT_TRACE2_EVENT: 'untrusted', GIT_TRACE_SETUP: 'untrusted', GIT_REDIRECT_STDOUT: 'untrusted',
    git_config_key_900: 'core.worktree', git_config_value_900: 'untrusted',
    GIT_CONFIG_SYSTEM: 'untrusted', GIT_CONFIG_GLOBAL: 'untrusted', GIT_CONFIG_COUNT: '999',
    NODE_OPTIONS: '--require=untrusted', GIT_ASKPASS: 'untrusted'
  };
  const env = syntheticGitEnvironment(hostile, fixture);
  assert.equal(env.PATH, hostile.PATH);
  for (const [key, value] of Object.entries(env)) assert.notEqual(value, 'untrusted', key);
  assert.equal(env.GIT_DIR, undefined); assert.equal(env.GIT_TRACE, undefined);
  assert.equal(env.git_config_key_900, undefined); assert.equal(env.NODE_OPTIONS, undefined);
  assert.equal(env.GIT_CONFIG_NOSYSTEM, '1'); assert.equal(env.GIT_TERMINAL_PROMPT, '0');
  assert.equal(env.GIT_ALLOW_PROTOCOL, 'file');
  assert.equal(env.GIT_CONFIG_COUNT, undefined);
  assert(!Object.keys(env).some(key => /^GIT_CONFIG_(?:COUNT|KEY_.*|VALUE_.*)$/i.test(key)));
  assert.equal(env.GIT_CONFIG_GLOBAL, path.join(fixture, 'isolated-git-config'));
  assert.equal(process.env.GIT_DIR, undefined); assert.equal(process.env.GIT_TRACE2_EVENT, undefined);
  assert.throws(() => synthetic.environment({ GIT_DIR: 'untrusted' }), /cannot override/);
});

await check('real fixture Git and product-derived Git use the isolated repository and leave the forbidden sentinel unchanged', async () => {
  const repo = path.join(fixture, 'repo'); fs.mkdirSync(repo);
  const forbidden = process.env.SYNTHETIC_TEST_FORBIDDEN_ROOT;
  const before = forbidden ? hashState(forbidden) : null;
  const git = args => {
    const result = synthetic.runSync('git', ['-C', repo, ...args], { encoding: 'utf8' });
    assert.equal(result.error, undefined, result.error?.message);
    assert.equal(result.status, 0, result.stderr); return result.stdout.trim();
  };
  git(['init', '--quiet', '--initial-branch=main']);
  fs.writeFileSync(path.join(repo, '.gitignore'), '.control/\n'); fs.writeFileSync(path.join(repo, 'probe.txt'), 'synthetic\n');
  git(['add', '--', '.gitignore', 'probe.txt']);
  git(['-c', 'user.name=Synthetic Test', '-c', 'user.email=test@example.invalid', 'commit', '--quiet', '-m', 'synthetic']);
  assert.equal(fs.realpathSync(git(['rev-parse', '--absolute-git-dir'])), fs.realpathSync(path.join(repo, '.git')));
  assert.equal(git(['config', '--get', 'commit.gpgSign']), 'false');
  assert.equal(git(['config', '--get', 'tag.gpgSign']), 'false');
  assert.equal(git(['config', '--get', 'credential.interactive']), 'false');
  assert.equal(fs.realpathSync(git(['config', '--get', 'core.hooksPath'])), fs.realpathSync(path.join(synthetic.artifacts, 'empty-hooks')));
  const { readGitWorkspaceBaseline } = await import(pathToFileURL(path.join(root, '.github/scripts/Prepare-Handoff.mjs')).href);
  const baseline = readGitWorkspaceBaseline(repo);
  assert.equal(baseline.branch, 'main'); assert.equal(baseline.head, git(['rev-parse', 'HEAD']));
  const directory = path.join(repo, '.control'); fs.mkdirSync(directory);
  fs.writeFileSync(path.join(directory, 'index.md'), 'synthetic only');
  const { assertPrivateControlStorage } = await import(pathToFileURL(path.join(root, '.github/scripts/HandoffControl.mjs')).href);
  assertPrivateControlStorage({ sources: { status_index: { path_ref: '.control/index.md' } } }, { sourceRoot: repo });
  const { inspect } = await import(pathToFileURL(path.join(root, '.github/scripts/Inspect-WorktreeLifecycle.mjs')).href);
  const normal = inspect({ worktree: repo, event: 'audit' });
  assert.notEqual(normal.decision, 'OBSERVATION_BLOCKED', normal.gaps.join('; '));
  assert.equal(normal.observed.head, baseline.head);
  // The product's rejection stays strict; isolation must not request a bypass.
  process.env.GIT_CONFIG_COUNT = '0';
  try {
    const injected = inspect({ worktree: repo, event: 'audit' });
    assert.equal(injected.decision, 'OBSERVATION_BLOCKED');
    assert(injected.gaps.some(gap => gap.includes('GIT_ENVIRONMENT_OVERRIDE')));
  } finally { delete process.env.GIT_CONFIG_COUNT; }
  if (forbidden) assert.deepEqual(hashState(forbidden), before);
});

await check('normal child failure retains its original exit code, stderr and evidence', async () => {
  const result = await synthetic.runNode(['-e', "process.stderr.write('original-synthetic-failure');process.exit(7)"], { timeoutMs: 3000 });
  assert.equal(result.status, 7); assert.equal(result.error, null);
  assert.equal(result.stderr, 'original-synthetic-failure');
  assert.equal(fs.readFileSync(path.join(result.evidence, 'stderr.log'), 'utf8'), result.stderr);
});
await check('owned asynchronous child timeout is bounded and does not report success', async () => {
  const before = performance.now();
  const result = await synthetic.runNode(['-e', "process.stdout.write('synthetic-started');setInterval(()=>{},1000)"], { timeoutMs: 250, cleanupMs: 1000 });
  assert.equal(result.status, null); assert.match(result.error, /deadline exceeded/);
  assert.equal(result.cleanup.confirmed, true, JSON.stringify(result.cleanup));
  assert.ok(performance.now() - before < 7000);
  assert.equal(fs.existsSync(path.join(result.evidence, 'result.json')), true);
});
await check('synchronous child wait has its own timeout inside the separately supervised suite', () => {
  const before = performance.now();
  const result = synthetic.runSync(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { timeoutMs: 250 });
  assert.equal(result.status, null); assert.equal(result.error?.code, 'ETIMEDOUT');
  assert.ok(performance.now() - before < 5000);
});

await check('CommonJS async cleanup remains supervised even with a pending close and live handles', async () => {
  const runtimeUrl = new URL('./SyntheticTestRuntime.mjs', import.meta.url).href;
  const lifecycle = path.join(root, '.github/scripts/SessionDeskTestLifecycle.cjs');
  const childFile = path.join(fixture, 'cleanup-hangs.cjs');
  fs.writeFileSync(childFile, [
    'module.exports=(async()=>{',
    `const {enterSyntheticSuite}=await import(${JSON.stringify(runtimeUrl)});`,
    'await enterSyntheticSuite(require("node:url").pathToFileURL(__filename).href,{timeoutMs:500});',
    `const {finishCleanup}=require(${JSON.stringify(lifecycle)});`,
    'setInterval(()=>{},100);',
    'try { await finishCleanup(new Error("original-cleanup-failure"),[()=>new Promise(()=>{})],{timeoutMs:20}); }',
    'catch(error){console.error(error.message);console.error(error.errors.map(item=>item.message).join("\\n"));process.exitCode=1;}',
    '})();'
  ].join('\n'));
  const result = await synthetic.runNode([childFile], {
    timeoutMs: 8000, envExtra: { SYNTHETIC_TEST_ARTIFACT_ROOT: synthetic.artifacts }
  });
  assert.equal(result.error, null, result.error);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /original-cleanup-failure/);
  assert.match(result.stderr, /cleanup deadline exceeded/);
  assert.match(result.stderr, /Owned command deadline exceeded/);
  const rejectionFile = path.join(fixture, 'async-reject.cjs');
  fs.writeFileSync(rejectionFile, [
    'module.exports=(async()=>{',
    `const {enterSyntheticSuite}=await import(${JSON.stringify(runtimeUrl)});`,
    'await enterSyntheticSuite(require("node:url").pathToFileURL(__filename).href,{timeoutMs:2000});',
    'await new Promise(resolve=>setTimeout(resolve,20));throw new Error("exported-promise-rejected");',
    '})();'
  ].join('\n'));
  const rejected = await synthetic.runNode([rejectionFile], {
    timeoutMs: 7000, envExtra: { SYNTHETIC_TEST_ARTIFACT_ROOT: synthetic.artifacts }
  });
  assert.equal(rejected.error, null); assert.equal(rejected.status, 1);
  assert.match(rejected.stderr, /exported-promise-rejected/);
  assert.doesNotMatch(rejected.stderr, /Owned command deadline exceeded/);
});

await check('actual browser failure is saved before cleanup outlives the supervisor deadline', async () => {
  const source = fs.readFileSync(path.join(root, '.github/scripts/Test-WindowsSessionDesk.cjs'), 'utf8').replaceAll('\r\n', '\n');
  const start = source.indexOf('}catch(error){\nprimaryError=error;');
  const end = source.indexOf("\nfs.writeFileSync(path.join(out,'result-dev7.json')", start);
  assert.ok(start >= 0 && end > start, 'Actual browser catch/finally block not found');
  const runtimeUrl = new URL('./SyntheticTestRuntime.mjs', import.meta.url).href;
  const out = path.join(fixture, 'early-failure'); fs.mkdirSync(out);
  const childFile = path.join(fixture, 'early-failure.cjs');
  fs.writeFileSync(childFile, [
    'module.exports=(async()=>{',
    `const {enterSyntheticSuite}=await import(${JSON.stringify(runtimeUrl)});`,
    'await enterSyntheticSuite(require("node:url").pathToFileURL(__filename).href,{timeoutMs:500});',
    'const fs=require("node:fs"),path=require("node:path");',
    `const {finishCleanup}=require(${JSON.stringify(path.join(root, '.github/scripts/SessionDeskTestLifecycle.cjs'))});`,
    `const root=${JSON.stringify(root)},out=${JSON.stringify(out)},checks=[];`,
    'const browser={close:()=>new Promise(()=>{})},stop=async()=>{};let primaryError;',
    'try{throw new Error("original-before-close");',
    source.slice(start, end), '})();'
  ].join('\n'));
  const result = await synthetic.runNode([childFile], {
    timeoutMs: 8000, envExtra: { SYNTHETIC_TEST_ARTIFACT_ROOT: synthetic.artifacts }
  });
  assert.equal(result.error, null); assert.equal(result.status, 1);
  assert.match(result.stderr, /original-before-close/);
  assert.match(result.stderr, /Owned command deadline exceeded/);
  assert.match(JSON.parse(fs.readFileSync(path.join(out, 'primary-failure.json'), 'utf8')).error, /original-before-close/);
  const stalledFile = path.join(fixture, 'export-stalled.cjs');
  fs.writeFileSync(stalledFile, [
    'module.exports=(async()=>{',
    `const {enterSyntheticSuite}=await import(${JSON.stringify(runtimeUrl)});`,
    'await enterSyntheticSuite(require("node:url").pathToFileURL(__filename).href,{timeoutMs:500});',
    'await new Promise(()=>{});})();'
  ].join('\n'));
  const stalled = await synthetic.runNode([stalledFile], {
    timeoutMs: 8000, envExtra: { SYNTHETIC_TEST_ARTIFACT_ROOT: synthetic.artifacts }
  });
  assert.equal(stalled.error, null); assert.equal(stalled.status, 1);
  assert.match(stalled.stderr, /Owned command deadline exceeded/);
});

await check('repository checks reject failed ignore observations and unsafe Git environment before native work', () => {
  const ps = process.env.SYNTHETIC_TEST_POWERSHELL || (process.platform === 'win32' ? 'powershell.exe' : 'pwsh');
  const source = process.env.SYNTHETIC_REPOSITORY_CHECK_FILE || path.join(root, '.github/scripts/Test-Repository.ps1');
  const script = [
    '$ErrorActionPreference="Stop"',
    '$text=[IO.File]::ReadAllText($env:SYNTHETIC_REPOSITORY_CHECK_FILE)',
    '$repositoryScriptRoot=Split-Path -Parent $env:SYNTHETIC_REPOSITORY_CHECK_FILE',
    '$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseInput($text,[ref]$tokens,[ref]$errors)',
    'if($errors.Count){throw "PowerShell parse failed"}',
    '$names=@("Assert-RepositoryGitEnvironment","Test-RepositoryPathPortability")',
    '$functions=$ast.FindAll({param($a)$a -is [Management.Automation.Language.FunctionDefinitionAst] -and $a.Name -in $names},$true)',
    'if($functions.Count -ne 2){throw "Missing repository guard functions"}',
    'foreach($function in $functions){Invoke-Expression $function.Extent.Text}',
    '$script:gitCalls=0',
    'function git { $script:gitCalls++;if($args -contains "ls-files"){$global:LASTEXITCODE=0;return "synthetic.bin"};if($args -contains "check-ignore"){$global:LASTEXITCODE=$script:ignoreExit;return};throw "Unexpected Git command" }',
    '$repoRoot=$env:SYNTHETIC_PATH_BASE;$additionalCheckFiles=@()',
    'foreach($code in @(0,1,128)){',
    '$script:ignoreExit=$code;$caught=$null',
    'try{Test-RepositoryPathPortability}catch{$caught=$_}',
    'if(($code -eq 1) -ne ($null -eq $caught)){throw ("Wrong ignore result: "+$code)}',
    'if($code -eq 128 -and $caught.Exception.Message -notmatch "exit 128"){throw "Missing failure diagnostic"}',
    '}',
    '$unsafeNames=@("GIT_DIR","GIT_WORK_TREE","GIT_INDEX_FILE","GIT_TRACE","GIT_TRACE2_EVENT","GIT_CONFIG_PARAMETERS","git_config_key_900","GIT_REDIRECT_STDOUT","GIT_EXEC_PATH","GIT_CONFIG_GLOBAL","GIT_CONFIG_SYSTEM","GIT_CONFIG_NOSYSTEM")',
    'foreach($name in $unsafeNames){',
    '$old=[Environment]::GetEnvironmentVariable($name);$beforeCalls=$script:gitCalls;$caught=$null',
    'try{[Environment]::SetEnvironmentVariable($name,"synthetic-override");try{Test-RepositoryPathPortability}catch{$caught=$_}}finally{[Environment]::SetEnvironmentVariable($name,$old)}',
    'if($null -eq $caught -or $caught.Exception.Message -notmatch "refuse Git environment overrides" -or $script:gitCalls -ne $beforeCalls){throw ("Unsafe Git override was not rejected before native work: "+$name)}',
    '}',
    '$prefix=$text.Substring(0,$text.IndexOf("$"+"additionalCheckFiles = @("))',
    '$old=[Environment]::GetEnvironmentVariable("GIT_TRACE");$caught=$null',
    'try{[Environment]::SetEnvironmentVariable("GIT_TRACE","synthetic-override");try{& ([scriptblock]::Create($prefix))}catch{$caught=$_}}finally{[Environment]::SetEnvironmentVariable("GIT_TRACE",$old)}',
    'if($null -eq $caught -or $caught.Exception.Message -notmatch "refuse Git environment overrides"){throw "Top-level Git guard is missing"}',
    '$config=[IO.File]::ReadAllText($env:GIT_CONFIG_GLOBAL);$caught=$null',
    'try{[IO.File]::AppendAllText($env:GIT_CONFIG_GLOBAL,"[include]`n path = untrusted`n");try{Assert-RepositoryGitEnvironment}catch{$caught=$_}}finally{[IO.File]::WriteAllText($env:GIT_CONFIG_GLOBAL,$config)}',
    'if($null -eq $caught){throw "Modified synthetic policy accepted"}',
    'Assert-RepositoryGitEnvironment',
    '$absolute=$env:GIT_CONFIG_GLOBAL;$base=[IO.Path]::GetFullPath((Join-Path $repositoryScriptRoot "../.."))',
    '$relativeCases=@($absolute.Substring($base.Length+1))',
    'if($absolute -match "^[A-Za-z]:\\\\"){$relativeCases+=@($absolute.Substring(2),$absolute.Remove(2,1))}',
    'if([IO.Path]::DirectorySeparatorChar -eq [char]92 -and $relativeCases.Count -ne 3){throw "Missing Windows relative path cases"}',
    'foreach($relative in $relativeCases){$caught=$null;$beforeCalls=$script:gitCalls;try{$env:GIT_CONFIG_GLOBAL=$relative;try{Test-RepositoryPathPortability}catch{$caught=$_}}finally{$env:GIT_CONFIG_GLOBAL=$absolute};if($null -eq $caught -or $script:gitCalls -ne $beforeCalls){throw "Relative config was not rejected before Git"}}',
    'Assert-RepositoryGitEnvironment',
    'Write-Output "IGNORE_CASES=3;ENVIRONMENT_CASES=12;EARLY_GUARD=PASS;CONFIG_TAMPER_REJECTED;RELATIVE_CONFIG_REJECTED"'
  ].join('\n');
  const result = synthetic.runSync(ps, ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')],
    { encoding: 'utf8', timeoutMs: 15000, envExtra: { SYNTHETIC_REPOSITORY_CHECK_FILE: source, SYNTHETIC_PATH_BASE: fixture } });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  assert.match(result.stdout, /IGNORE_CASES=3;ENVIRONMENT_CASES=12;EARLY_GUARD=PASS;CONFIG_TAMPER_REJECTED;RELATIVE_CONFIG_REJECTED/);
});

await check('real redirected Git reads the other synthetic index but the guarded entry rejects it without trace writes', () => {
  const first = path.join(fixture, 'routing-first'), second = path.join(fixture, 'routing-second');
  for (const [directory, name] of [[first, 'first.bin'], [second, 'second.bin']]) {
    fs.mkdirSync(directory);
    let result = synthetic.runSync('git', ['-C', directory, 'init', '--quiet', '--initial-branch=main'], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    fs.writeFileSync(path.join(directory, name), 'synthetic\n');
    result = synthetic.runSync('git', ['-C', directory, 'add', '--', name], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
  const before = [first, second].map(directory => fs.readFileSync(path.join(directory, '.git/index')));
  const ps = process.env.SYNTHETIC_TEST_POWERSHELL || (process.platform === 'win32' ? 'powershell.exe' : 'pwsh');
  const source = process.env.SYNTHETIC_REPOSITORY_CHECK_FILE || path.join(root, '.github/scripts/Test-Repository.ps1');
  const script = [
    '$ErrorActionPreference="Stop";$text=[IO.File]::ReadAllText($env:SYNTHETIC_REPOSITORY_CHECK_FILE)',
    '$repositoryScriptRoot=Split-Path -Parent $env:SYNTHETIC_REPOSITORY_CHECK_FILE',
    '$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseInput($text,[ref]$tokens,[ref]$errors)',
    '$names=@("Assert-RepositoryGitEnvironment","Get-TrackedFiles")',
    '$functions=$ast.FindAll({param($a)$a -is [Management.Automation.Language.FunctionDefinitionAst] -and $a.Name -in $names},$true)',
    'if($errors.Count -or $functions.Count -ne 2){throw "Missing actual guarded entry"}',
    'foreach($function in $functions){Invoke-Expression $function.Extent.Text}',
    '$repoRoot=$env:SYNTHETIC_FIRST_REPO',
    '$env:GIT_DIR=Join-Path $env:SYNTHETIC_SECOND_REPO ".git"',
    '$env:GIT_TRACE=Join-Path $env:SYNTHETIC_PATH_BASE "before-guard.trace"',
    '$observed=@(& git -C $repoRoot ls-files)',
    'if($LASTEXITCODE -ne 0 -or $observed.Count -ne 1 -or $observed[0] -ne "second.bin"){throw "Redirection counterexample not established"}',
    'if(-not [IO.File]::Exists($env:GIT_TRACE)){throw "Trace counterexample not established"}',
    '$env:GIT_TRACE=Join-Path $env:SYNTHETIC_PATH_BASE "after-guard.trace";$caught=$null',
    'try{Get-TrackedFiles -Pattern "*"}catch{$caught=$_}',
    'if($null -eq $caught -or $caught.Exception.Message -notmatch "refuse Git environment overrides"){throw "Guarded entry did not reject"}',
    'if([IO.File]::Exists($env:GIT_TRACE)){throw "Guard allowed trace side effect"}',
    'Write-Output "REAL_ROUTING_REPRODUCED;GUARDED_REJECTED;TRACE_NOT_WRITTEN"'
  ].join('\n');
  const result = synthetic.runSync(ps, ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')],
    { encoding: 'utf8', timeoutMs: 15000, envExtra: { SYNTHETIC_REPOSITORY_CHECK_FILE: source,
      SYNTHETIC_PATH_BASE: fixture, SYNTHETIC_FIRST_REPO: first, SYNTHETIC_SECOND_REPO: second } });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  assert.match(result.stdout, /REAL_ROUTING_REPRODUCED;GUARDED_REJECTED;TRACE_NOT_WRITTEN/);
  [first, second].forEach((directory, index) => assert.deepEqual(fs.readFileSync(path.join(directory, '.git/index')), before[index]));
});

await check('held real control lock and deliberately late invocation have reproducible distinct outcomes', async () => {
  const lockRoot = path.join(fixture, 'lock-case'); fs.mkdirSync(lockRoot);
  const index = path.join(lockRoot, 'index.md'); fs.writeFileSync(index, 'old');
  const source = { sources: { status_index: { path_ref: 'index.md' } } }, options = { sourceRoot: lockRoot };
  const moduleUrl = pathToFileURL(path.join(root, '.github/scripts/HandoffControl.mjs')).href;
  const { withControlLock } = await import(moduleUrl);
  const worker = 'import fs from "node:fs";import {withControlLock} from ' + JSON.stringify(moduleUrl) + ';' +
    'withControlLock(' + JSON.stringify(source) + ',' + JSON.stringify(options) + ',()=>{' +
    'if(fs.readFileSync(' + JSON.stringify(index) + ',"utf8")!=="old")throw new Error("SYNTHETIC_STALE_EVIDENCE");' +
    'fs.writeFileSync(' + JSON.stringify(index) + ',"new");console.log("SYNTHETIC_WINNER");});';
  const run = () => synthetic.runSync(process.execPath, ['--input-type=module', '-e', worker], { encoding: 'utf8', timeoutMs: 5000 });
  withControlLock(source, options, () => {
    const blocked = run(); assert.equal(blocked.error, undefined); assert.notEqual(blocked.status, 0);
    assert.match(blocked.stderr, /EEXIST/); assert.equal(fs.readFileSync(index, 'utf8'), 'old');
  });
  const winner = run(); assert.equal(winner.status, 0, winner.stderr); assert.match(winner.stdout, /SYNTHETIC_WINNER/);
  const late = run(); assert.notEqual(late.status, 0); assert.match(late.stderr, /SYNTHETIC_STALE_EVIDENCE/);
  assert.doesNotMatch(late.stderr, /EEXIST/); assert.equal(fs.readFileSync(index, 'utf8'), 'new');
});

await check('actual PowerShell path helpers reject HTML masking and lookalike siblings while preserving explicit placeholders', () => {
  const ps = process.env.SYNTHETIC_TEST_POWERSHELL || (process.platform === 'win32' ? 'powershell.exe' : 'pwsh');
  const source = process.env.SYNTHETIC_REPOSITORY_CHECK_FILE || path.join(root, '.github/scripts/Test-Repository.ps1');
  const script = [
    '$ErrorActionPreference="Stop"',
    '$text=Get-Content -LiteralPath $env:SYNTHETIC_REPOSITORY_CHECK_FILE -Raw -Encoding UTF8',
    '$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseInput($text,[ref]$tokens,[ref]$errors)',
    'if($errors.Count){throw "Candidate PowerShell parse failed"}',
    '$names=@("Test-ExplicitPlaceholderPath","Get-MachineBoundAbsolutePaths","Test-RepositoryLinkBoundary")',
    '$functions=$ast.FindAll({param($a)$a -is [Management.Automation.Language.FunctionDefinitionAst] -and $a.Name -in $names},$true)',
    'if($functions.Count -ne 3){throw "Missing candidate path functions"}',
    'foreach($function in $functions){Invoke-Expression $function.Extent.Text}',
    '$drive="C"+[char]58+[char]92;$tick=[char]96;$unixHome="/ho"+"me/";$unixUsers="/Us"+"ers/"',
    '$cases=@(',
    '@{Text=($drive+"Example\\notes.txt");Count=1},',
    '@{Text=("<div>"+$drive+"Example\\notes.txt</div>");Count=1},',
    '@{Text=("<PROJECT_ROOT> "+$drive+"Example\\notes.txt");Count=1},',
    '@{Text=($drive+"<PROJECT_ROOT>\\notes.txt");Count=0},',
    '@{Text=($drive+"Users\\<USER>\\repo");Count=0},',
    '@{Text=($drive+"users\\<USER>\\repo");Count=0},',
    '@{Text=($drive+"USERS\\<USER>\\repo");Count=0},',
    '@{Text=($drive+"Users\\actual\\<PROJECT_ROOT>\\repo");Count=1},',
    '@{Text=($unixHome+"synthetic/repo");Count=1},',
    '@{Text=("<span>"+$unixHome+"synthetic/repo</span>");Count=1},',
    '@{Text=($unixHome+"<USER>/repo");Count=0},',
    '@{Text=($drive+"...");Count=0},',
    '@{Text=($tick+$drive+"..."+$tick);Count=0},',
    '@{Text=($tick+$drive+"Example\\notes.txt"+$tick);Count=1},',
    '@{Text=($tick+$drive+"<PROJECT_ROOT>"+$tick+" "+$drive+"Example\\notes.txt");Count=1},',
    '@{Text=($drive+"<PROJECT_ROOT> "+$unixUsers+"actual/repo");Count=1})',
    'foreach($case in $cases){$actual=@(Get-MachineBoundAbsolutePaths -Line $case.Text);if($actual.Count -ne $case.Count){throw ("Path counterexample failed: "+$case.Text+" count="+$actual.Count)}}',
    '$sampleRoot=[IO.Path]::GetFullPath((Join-Path $env:SYNTHETIC_PATH_BASE "repo"))',
    'if(-not(Test-RepositoryLinkBoundary $sampleRoot (Join-Path $sampleRoot "child.md"))){throw "valid child rejected"}',
    'if(-not(Test-RepositoryLinkBoundary $sampleRoot $sampleRoot)){throw "root itself rejected"}',
    'if(Test-RepositoryLinkBoundary $sampleRoot ($sampleRoot+"-other/child.md")){throw "lookalike sibling accepted"}',
    'if(Test-RepositoryLinkBoundary $sampleRoot (Join-Path $sampleRoot "../other/child.md")){throw "normalized parent escape accepted"}',
    '[pscustomobject]@{path_cases=$cases.Count;boundary_cases=4;status="PASS"}|ConvertTo-Json -Compress'
  ].join('\n');
  const result = synthetic.runSync(ps, ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')],
    { encoding: 'utf8', timeoutMs: 15000, envExtra: { SYNTHETIC_REPOSITORY_CHECK_FILE: source, SYNTHETIC_PATH_BASE: fixture } });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  const report = JSON.parse(result.stdout.replace(/^\uFEFF/, '').trim());
  assert.equal(report.path_cases, 16); assert.equal(report.boundary_cases, 4);
});

await check('rendering failure survives hung browser cleanup and exits within supervision', async () => {
  const source = fs.readFileSync(path.join(root, '.github/scripts/Test-SessionDeskRendering.cjs'), 'utf8').replaceAll('\r\n', '\n');
  let start = source.indexOf('  } catch (error) {');
  if (start < 0) start = source.indexOf('  } finally {');
  assert.ok(start > 0, 'Actual rendering cleanup block not found');
  const childFile = path.join(fixture, 'rendering-cleanup.cjs');
  fs.writeFileSync(childFile, [
    'module.exports=(async()=>{',
    `const {enterSyntheticSuite}=await import(${JSON.stringify(new URL('./SyntheticTestRuntime.mjs', import.meta.url).href)});`,
    'await enterSyntheticSuite(require("node:url").pathToFileURL(__filename).href,{timeoutMs:600});',
    `const {finishCleanup}=require(${JSON.stringify(path.join(root, '.github/scripts/SessionDeskTestLifecycle.cjs'))});`,
    'let primaryError;const browser={close:()=>new Promise(()=>{})};',
    'try{throw new Error("rendering-original-before-close");',
    source.slice(start)
  ].join('\n'));
  const result = await synthetic.runNode([childFile], {
    timeoutMs: 7000, envExtra: { SYNTHETIC_TEST_ARTIFACT_ROOT: synthetic.artifacts }
  });
  assert.equal(result.error, null);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /rendering-original-before-close/);
  assert.match(result.stderr, /Owned command deadline exceeded/);
});

await check('browser quality entry propagates dependency and either suite failure', () => {
  const ps = process.env.SYNTHETIC_TEST_POWERSHELL || (process.platform === 'win32' ? 'powershell.exe' : 'pwsh');
  const source = path.join(root, '.github/scripts/Test-Repository.ps1');
  const script = [
    '$ErrorActionPreference="Stop"',
    '$source=Get-Content -LiteralPath $env:SYNTHETIC_REPOSITORY_CHECK_FILE -Raw -Encoding utf8',
    '$ast=[Management.Automation.Language.Parser]::ParseInput($source,[ref]$null,[ref]$null)',
    '$fn=$ast.Find({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq "Test-SessionDeskBrowserRegressions"},$true)',
    'if(-not $fn){throw "Browser entry function missing"}',
    'Invoke-Expression $fn.Extent.Text',
    '$repositoryScriptRoot=$env:SYNTHETIC_PATH_BASE',
    'function node { $script:calls++; $global:LASTEXITCODE=if($script:calls -eq $script:failAt){1}else{0} }',
    'foreach($failAt in @(0,1,2,3)){',
    '$script:failAt=$failAt;$script:calls=0;$failed=$false',
    'try{Test-SessionDeskBrowserRegressions}catch{$failed=$true}',
    'if($failed -ne ($failAt -ne 0)){throw "Browser failure not propagated"}',
    '$expected=if($failAt){$failAt}else{3};if($script:calls -ne $expected){throw "Execution continued after browser failure"}',
    '}',
    '$script:failAt=0;$script:calls=0;Test-SessionDeskBrowserRegressions -PreflightOnly',
    'if($script:calls -ne 1){throw "Preflight ran a suite"}',
    'Write-Output "Browser entry propagation: PASS (5 cases)"'
  ].join('\n');
  const result = synthetic.runSync(ps, ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], {
    encoding: 'utf8', timeoutMs: 15000,
    envExtra: { SYNTHETIC_REPOSITORY_CHECK_FILE: source, SYNTHETIC_PATH_BASE: fixture }
  });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  assert.match(result.stdout, /Browser entry propagation: PASS/);
});

fs.writeFileSync(path.join(synthetic.artifacts, 'small-regression-result.json'), JSON.stringify({
  status: 'PASS', checks, formal_writes: 0,
  boundaries: ['Only synthetic Git, timer children, a dummy control index and extracted PowerShell functions ran',
    'No full takeover, recovery, rule-refresh or repository regression ran; no service or remote operation ran']
}, null, 2));
console.log('Synthetic test runtime small regression: PASS (' + checks.length + ' cases); evidence: ' + synthetic.artifacts);
