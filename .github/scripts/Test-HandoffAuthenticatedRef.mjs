// Synthetic secrets only. Never invoke a credential provider or a network client.
import assert from 'node:assert/strict';
import { readAuthenticatedGitHubRef } from './Query-HandoffAuthenticatedRef.mjs';

const endpoint = 'https://api.github.com/repos/synthetic/example/git/ref/heads/main';
const head = 'a'.repeat(40);
const secret = 'ghp_SYNTHETIC_ONLY_123';
const payload = {
  ref: 'refs/heads/main', url: 'https://api.github.com/repos/synthetic/example/git/refs/heads/main',
  object: { type: 'commit', sha: head }
};
let passed = 0;
const check = (label, fn) => { fn(); passed++; console.log(`PASS: ${label}`); };
function fixture({ token = `${secret}\n`, gh = {}, curl = {}, status = 200, body = payload, cost = 0, missing } = {}) {
  const calls = [];
  let clock = 0;
  const run = (exe, args, options) => {
    calls.push({ exe, args, options });
    clock += typeof cost === 'function' ? cost(exe, options) : cost;
    return exe.endsWith('/gh')
      ? { status: 0, stdout: token, ...gh }
      : { status: 0, stdout: `${JSON.stringify(body)}\n${status}`, ...curl };
  };
  const options = { run, now: () => clock, timeoutMs: 100,
    resolveCommand: name => name === missing ? null : `/SYNTHETIC/${name}`,
    environment: { PATH: '/SYNTHETIC', GH_DEBUG: 'api', GH_HOST: 'wrong.invalid', SSLKEYLOGFILE: '/SYNTHETIC/forbidden' } };
  return { calls, execute: (url = endpoint) => readAuthenticatedGitHubRef(url, options) };
}
check('same bound ref succeeds with an internal credential pipe', () => {
  const f = fixture();
  assert.equal(f.execute(), head);
  assert.deepEqual(f.calls.map(x => x.exe), ['/SYNTHETIC/gh', '/SYNTHETIC/curl']);
  const [gh, curl] = f.calls;
  assert.deepEqual(gh.args, ['auth', 'token', '--hostname', 'github.com']);
  assert.equal(gh.options.stdio[0], 'ignore');
  assert.equal(curl.options.stdio[0], 'pipe');
  assert.equal(curl.options.input, `header = "Authorization: Bearer ${secret}"\n`);
  assert.ok(!JSON.stringify([gh.args, curl.args]).includes(secret));
  assert.equal(curl.args[0], '--disable');
  assert.ok(!curl.args.some(x => ['-L', '--location', '--location-trusted', '--insecure'].includes(x)));
  assert.equal(curl.args[curl.args.indexOf('--url') + 1], endpoint);
  for (const call of f.calls) {
    assert.equal(call.options.shell, false);
    assert.equal(call.options.env.GH_PROMPT_DISABLED, '1');
    for (const key of ['GH_DEBUG', 'GH_HOST', 'SSLKEYLOGFILE']) assert.equal(call.options.env[key], undefined);
  }
});
for (const status of [301, 302, 307, 308, 401, 403, 404]) check(`HTTP ${status} never follows or produces readiness`, () => {
  const f = fixture({ status });
  assert.equal(f.execute(), '');
  assert.equal(f.calls.length, 2);
});
for (const token of ['bad\rvalue', 'bad\nvalue', 'bad\0value', 'bad"value', 'bad\\value',
  'bad value', 'bad\nurl=https://other.invalid', '', `${secret}\n\n`]) {
  check('credential control/config characters cannot add a request', () => {
    const f = fixture({ token });
    assert.equal(f.execute(), '');
    assert.equal(f.calls.length, 1);
  });
}
for (const missing of ['gh', 'curl']) check(`optional missing ${missing} never retrieves a credential`, () => {
  const f = fixture({ missing });
  assert.equal(f.execute(), '');
  assert.equal(f.calls.length, 0);
});
check('unavailable login is ordinary unobservability without another request', () => {
  const f = fixture({ gh: { status: 1, stderr: secret } });
  assert.equal(f.execute(), '');
  assert.equal(f.calls.length, 1);
});
for (const code of ['ETIMEDOUT', 'ENOBUFS']) check(`credential provider ${code} preserves hard error class without secret output`, () => {
  const f = fixture({ gh: { status: null, error: { code, message: secret } } });
  assert.throws(f.execute, error => error.code === (code === 'ETIMEDOUT' ? 'REMOTE_PROBE_TIMEOUT' : 'REMOTE_PROBE_ABORTED') &&
    !String(error).includes(secret));
});
check('native curl 28 remains an explicit timeout', () => {
  assert.throws(fixture({ curl: { status: 28, stderr: secret } }).execute,
    error => error.code === 'REMOTE_PROBE_TIMEOUT' && !String(error).includes(secret));
});
check('credential and curl share one deadline', () => {
  const f = fixture({ cost: 55 });
  assert.throws(f.execute, error => error.code === 'REMOTE_PROBE_TIMEOUT');
  assert.deepEqual(f.calls.map(x => x.options.timeout), [100, 45]);
});
check('budget exhausted by credentials starts no curl', () => {
  const f = fixture({ cost: 100 });
  assert.throws(f.execute, error => error.code === 'REMOTE_PROBE_TIMEOUT');
  assert.equal(f.calls.length, 1);
});
for (const body of [
  { ...payload, ref: 'refs/heads/other' },
  { ...payload, url: payload.url.replace('synthetic/example', 'other/example') },
  { ...payload, object: { type: 'tag', sha: head } },
  { ...payload, object: { type: 'commit', sha: 'a'.repeat(41) } },
  { ...payload, object: { type: 'commit', sha: [head] } },
  { ...payload, ref: secret }
]) check('response cannot substitute a different repository/ref/object or leak echoed credentials', () => {
  const result = fixture({ body }).execute();
  assert.equal(result, '');
  assert.ok(!result.includes(secret));
});
for (const url of ['https://other.invalid/repos/synthetic/example/git/ref/heads/main',
  endpoint + '?other=1', endpoint.replace('https:', 'http:'), endpoint.replace('/main', '/..'),
  endpoint.replace('synthetic/example', '../example')]) {
  check('invalid target is rejected before credential access', () => {
    const f = fixture();
    assert.throws(() => f.execute(url), /target/);
    assert.equal(f.calls.length, 0);
  });
}
check('encoded slash branches stay bound', () => {
  const branch = 'feature/fix';
  const f = fixture({ body: { ...payload, ref: `refs/heads/${branch}`,
    url: `https://api.github.com/repos/synthetic/example/git/refs/heads/${branch}` } });
  assert.equal(f.execute(endpoint.replace('/main', '/feature%2Ffix')), head);
});
for (const [token, echoed] of [
  ['b'.repeat(40), 'b'.repeat(40)],
  ['c'.repeat(64), 'c'.repeat(64)],
  ['D'.repeat(40), 'd'.repeat(40)],
  ['e'.repeat(40), 'E'.repeat(40)],
  ['Ab'.repeat(32), 'ab'.repeat(32)],
  ['beef'.repeat(5), '0'.repeat(10) + 'beef'.repeat(5) + '1'.repeat(10)]
]) check('synthetic credential cannot escape as a valid or normalized object ID', () => {
  const body = { ...payload, object: { type: 'commit', sha: echoed } };
  assert.equal(fixture({ token: `${token}\n`, body }).execute(), '');
});
console.log(`Authenticated ref: ${passed} checks passed (synthetic credentials; no subprocesses or network).`);
