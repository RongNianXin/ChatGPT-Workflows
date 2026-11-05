// Test-only isolation and owned-process supervision. This is not an OS sandbox.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const self = fileURLToPath(import.meta.url);
let activeSuite = null;
const owned = new WeakSet();
const positive = (value, label) => {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error('Invalid ' + label);
  return value;
};
export function syntheticGitEnvironment(input, directory) {
  const env = Object.fromEntries(Object.entries(input).filter(([key]) =>
    !/^GIT_/i.test(key) && !/^(NODE_OPTIONS|NODE_PATH|GCM_INTERACTIVE)$/i.test(key)));
  const empty = path.join(directory, 'empty-git-metadata');
  const hooks = path.join(directory, 'empty-hooks');
  Object.assign(env, {
    GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_SYSTEM: empty,
    GIT_CONFIG_GLOBAL: path.join(directory, 'isolated-git-config'), GIT_TERMINAL_PROMPT: '0',
    GIT_ASKPASS: '', GIT_ALLOW_PROTOCOL: 'file', GIT_OPTIONAL_LOCKS: '0',
    GIT_NO_REPLACE_OBJECTS: '1', GIT_TEMPLATE_DIR: hooks, GIT_PAGER: '', GCM_INTERACTIVE: 'Never'
  });
  return env;
}
function installEnvironment(env) {
  for (const key of Object.keys(process.env)) {
    if (/^GIT_/i.test(key) || /^(NODE_OPTIONS|NODE_PATH|GCM_INTERACTIVE)$/i.test(key)) delete process.env[key];
  }
  Object.assign(process.env, env);
}
function detachedStreams(child) {
  child.stdout?.destroy(); child.stderr?.destroy();
  if (child.connected) { try { child.disconnect(); } catch {} }
  child.unref();
}
async function stopOwned(child, graceMs) {
  if (!owned.has(child)) throw new Error('Refusing to stop an unowned child');
  const problems = [];
  if (!child.pid) return { confirmed: true, problems };
  if (child.exitCode !== null || child.signalCode !== null) {
    return { confirmed: false, problems: ['Direct child exited before cleanup; descendant state is unknown'] };
  }
  if (process.platform === 'win32') {
    await new Promise(resolve => {
      const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'],
        { stdio: 'ignore', windowsHide: true });
      owned.add(killer);
      let finished = false;
      const done = message => { if (finished) return; finished = true; clearTimeout(timer); if (message) problems.push(message); resolve(); };
      const timer = setTimeout(() => {
        try { killer.kill('SIGKILL'); } catch (error) { problems.push(error.message); }
        killer.unref(); done('Owned taskkill did not finish before cleanup deadline');
      }, graceMs);
      killer.once('error', error => done(error.message));
      killer.once('close', code => done(code === 0 ? null : 'Owned taskkill exit ' + code));
    });
  } else {
    try { process.kill(-child.pid, 'SIGKILL'); }
    catch (error) { if (error.code !== 'ESRCH') problems.push(error.message); }
  }
  // Exit confirmation is separately bounded; never await an unlimited close.
  if (child.exitCode === null && child.signalCode === null) await new Promise(resolve => {
    const exited = () => { clearTimeout(timer); resolve(); };
    const timer = setTimeout(() => { child.off('exit', exited); resolve(); }, graceMs);
    child.once('exit', exited);
  });
  const confirmed = child.exitCode !== null || child.signalCode !== null;
  if (!confirmed) problems.push('Owned child termination remains unconfirmed');
  return { confirmed, problems };
}
function createRuntime(artifacts, timeoutMs) {
  const started = process.hrtime.bigint();
  const remaining = limit => {
    const left = timeoutMs - Number((process.hrtime.bigint() - started) / 1000000n);
    if (left <= 0) throw new Error('Synthetic suite deadline exceeded');
    return Math.max(1, Math.min(positive(limit, 'command timeout'), left));
  };
  const env = syntheticGitEnvironment(process.env, artifacts);
  const commandEnvironment = extra => {
    if (Object.keys(extra || {}).some(key => /^GIT_/i.test(key) || /^(NODE_OPTIONS|NODE_PATH)$/i.test(key))) {
      throw new Error('Command extras cannot override synthetic isolation');
    }
    return { ...env, ...extra };
  };
  const allocation = () => fs.mkdtempSync(path.join(artifacts, 'command-'));
  const runtime = { artifacts, remaining, environment: commandEnvironment };
  runtime.runSync = (command, args, options = {}) => {
    const directory = allocation();
    const record = { command: path.basename(command), args, cwd: options.cwd || process.cwd() };
    fs.writeFileSync(path.join(directory, 'started.json'), JSON.stringify(record), { flag: 'wx' });
    const result = spawnSync(command, args, {
      cwd: options.cwd, input: options.input, encoding: options.encoding,
      env: commandEnvironment(options.envExtra), windowsHide: true,
      timeout: remaining(options.timeoutMs || 15000), killSignal: 'SIGKILL', maxBuffer: 8 * 1024 * 1024
    });
    fs.writeFileSync(path.join(directory, 'stdout.log'), result.stdout || '');
    fs.writeFileSync(path.join(directory, 'stderr.log'), result.stderr || '');
    fs.writeFileSync(path.join(directory, 'result.json'), JSON.stringify({ status: result.status, signal: result.signal,
      error: result.error?.message || null }));
    return { ...result, evidence: directory };
  };
  runtime.run = (command, args, options = {}) => new Promise(resolve => {
    const directory = allocation(), limit = remaining(options.timeoutMs || 15000);
    const stdoutFile = path.join(directory, 'stdout.log'), stderrFile = path.join(directory, 'stderr.log');
    fs.writeFileSync(stdoutFile, '', { flag: 'wx' }); fs.writeFileSync(stderrFile, '', { flag: 'wx' });
    fs.writeFileSync(path.join(directory, 'started.json'), JSON.stringify({ command: path.basename(command), args, limit }));
    const child = spawn(command, args, { cwd: options.cwd, env: commandEnvironment(options.envExtra),
      windowsHide: true, detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe', ...(options.ipc ? ['ipc'] : [])] });
    owned.add(child);
    let done = false, closing = false, primary = null, stdoutChunks = [], stderrChunks = [], bytes = 0;
    const finish = (status, signal, cleanup = null) => {
      if (done) return; done = true; clearTimeout(timer);
      const result = { status: primary ? null : status, signal, error: primary?.message || null,
        stdout: Buffer.concat(stdoutChunks).toString('utf8'), stderr: Buffer.concat(stderrChunks).toString('utf8'), cleanup, evidence: directory };
      fs.writeFileSync(path.join(directory, 'result.json'), JSON.stringify({ ...result, stdout: undefined, stderr: undefined }));
      if (primary) detachedStreams(child);
      resolve(result);
    };
    const fail = async error => {
      if (done || closing) return; closing = true; primary = error;
      const cleanup = await stopOwned(child, options.cleanupMs || 1000).catch(problem => ({ confirmed: false, problems: [problem.message] }));
      finish(null, child.signalCode, cleanup);
    };
    const timer = setTimeout(() => { void fail(new Error('Owned command deadline exceeded (' + limit + ' ms)')); }, limit);
    const collect = (kind, buffer) => {
      if (done || closing) return;
      bytes += buffer.length;
      if (bytes > 8 * 1024 * 1024) { void fail(new Error('Owned command output limit exceeded; bounded prefix retained')); return; }
      try {
        fs.appendFileSync(kind === 'stdout' ? stdoutFile : stderrFile, buffer);
        if (kind === 'stdout') stdoutChunks.push(buffer); else stderrChunks.push(buffer);
      } catch (error) { void fail(error); }
    };
    child.stdout.on('data', chunk => collect('stdout', chunk));
    child.stderr.on('data', chunk => collect('stderr', chunk));
    child.once('error', error => { primary = error; if (!closing) finish(null, null); });
    child.once('close', (status, signal) => { if (!closing) finish(status, signal); });
  });
  runtime.runNode = (args, options) => runtime.run(process.execPath, args, options);
  return runtime;
}
function makeArtifacts(suiteFile) {
  const parent = process.env.SYNTHETIC_TEST_ARTIFACT_ROOT || path.resolve(path.dirname(suiteFile), '../..', '.codex-manual-cache');
  fs.mkdirSync(parent, { recursive: true });
  if (fs.lstatSync(parent).isSymbolicLink()) throw new Error('Linked synthetic artifact parent');
  const directory = fs.mkdtempSync(path.join(fs.realpathSync(parent), 'synthetic-quality-'));
  fs.mkdirSync(path.join(directory, 'empty-hooks'));
  fs.writeFileSync(path.join(directory, 'empty-git-metadata'), '', { flag: 'wx' });
  // This file belongs only to this synthetic run; no real user/system config is read.
  // Keep config policy in the file rather than GIT_CONFIG_COUNT/KEY/VALUE,
  // which the read-only lifecycle product correctly refuses.
  const quote = value => JSON.stringify(value.replaceAll('\\', '/'));
  const hooks = quote(path.join(directory, 'empty-hooks'));
  const empty = quote(path.join(directory, 'empty-git-metadata'));
  const config = ['[core]', ' hooksPath = ' + hooks, ' attributesFile = ' + empty,
    ' excludesFile = ' + empty, ' fsmonitor = false', ' pager = ', ' askPass = ',
    '[init]', ' templateDir = ' + hooks, '[commit]', ' gpgSign = false', '[tag]', ' gpgSign = false',
    '[credential]', ' helper = ', ' interactive = false', '[protocol]', ' allow = never',
    '[protocol "file"]', ' allow = always', '[gc]', ' auto = 0', '[maintenance]', ' auto = false', ''].join('\n');
  fs.writeFileSync(path.join(directory, 'isolated-git-config'), config, { flag: 'wx' });
  return directory;
}
export async function enterSyntheticSuite(suiteUrl, { timeoutMs = 120000 } = {}) {
  const file = fs.realpathSync(fileURLToPath(suiteUrl));
  if (activeSuite?.file === file) return activeSuite.runtime;
  positive(timeoutMs, 'suite timeout');
  const artifacts = makeArtifacts(file), runtime = createRuntime(artifacts, timeoutMs);
  const config = Buffer.from(JSON.stringify({ file, artifacts, timeoutMs })).toString('base64url');
  const result = await runtime.runNode([self, '--synthetic-worker', config, ...process.argv.slice(2)],
    { cwd: process.cwd(), timeoutMs, ipc: true });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) console.error(result.error + '; evidence: ' + result.evidence);
  process.exit(result.error ? 1 : (result.status ?? 1));
}
if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(self)) {
  if (process.argv[2] === '--synthetic-worker') {
    if (!process.send || !process.connected) throw new Error('Synthetic worker requires its supervising parent');
    const config = JSON.parse(Buffer.from(process.argv[3], 'base64url').toString());
    const file = fs.realpathSync(config.file);
    positive(config.timeoutMs, 'worker timeout');
    const runtime = createRuntime(config.artifacts, config.timeoutMs);
    installEnvironment(runtime.environment());
    activeSuite = { file, runtime };
    process.argv = [process.execPath, file, ...process.argv.slice(4)];
    process.channel.ref();
    // Finish evaluating this helper before the suite imports it again.
    // The referenced IPC channel keeps a stalled suite alive for the parent deadline.
    setImmediate(() => {
      import(pathToFileURL(file).href).then(module => {
        // CommonJS suites export their async work so supervision covers cleanup.
        if (module.default && typeof module.default.then === 'function') return module.default;
      }).catch(error => {
        console.error(error.stack || error.message); process.exitCode = 1;
      }).finally(() => { if (process.connected) process.disconnect(); });
    });
  } else if (process.argv[2] === '--run-native') {
    const separator = process.argv.indexOf('--', 3);
    if (separator < 0 || process.argv[3] !== '--timeout-ms' || process.argv[5] !== '--cwd') throw new Error('Invalid bounded native invocation');
    const timeoutMs = positive(Number(process.argv[4]), 'native timeout'), cwd = process.argv[6];
    const command = process.argv[separator + 1], args = process.argv.slice(separator + 2);
    const runtime = createRuntime(makeArtifacts(self), timeoutMs);
    const result = await runtime.run(command, args, { cwd, timeoutMs });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.error) console.error(result.error + '; evidence: ' + result.evidence);
    process.exitCode = result.error ? 1 : (result.status ?? 1);
  } else throw new Error('Unknown synthetic runtime command');
}
