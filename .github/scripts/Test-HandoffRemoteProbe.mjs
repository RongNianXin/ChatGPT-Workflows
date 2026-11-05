// Deterministic process/clock substitutes: no remote, credentials or config writes.
import assert from 'node:assert/strict';
import { readLiveRemoteBaseline } from './Prepare-Handoff.mjs';

const oid = 'a'.repeat(40);
let count = 0;
const check = (name, fn) => { fn(); count++; console.log(`PASS: ${name}`); };
const payload = (ref = 'refs/heads/main', repository = 'synthetic/example') => ({
  ref, url: `https://api.github.com/repos/${repository}/git/${ref}`,
  object: { type: 'commit', sha: oid }
});
function probe({ ls, api, gh, cost = 0, budget = 100, remoteUrl = 'https://github.com/synthetic/example.git\n',
  defaultRef = 'origin/main', authenticated = true, token = 'ghp_SYNTHETIC_ONLY_123\n' } = {}) {
  let clock = 0;
  const calls = [];
  const run = (exe, args, options) => {
    calls.push({ exe, args, options, start: clock });
    const result = { status: 0, stdout: '', stderr: '' };
    if (args.includes('rev-parse')) result.stdout = oid;
    else if (args.at(-1) === 'remote') result.stdout = 'origin\n';
    else if (args.includes('get-url')) result.stdout = remoteUrl;
    else if (args.includes('ls-remote')) Object.assign(result, ls ?? { stdout: `${oid}\trefs/heads/main\n` });
    else if (/curl/.test(exe)) {
      if (args.includes('--config')) {
        Object.assign(result, gh ?? { status: 1 });
        if (result.status === 0) result.stdout += '\n200';
      } else Object.assign(result, api ?? { stdout: JSON.stringify(payload()) });
    }
    else if (exe === 'gh') {
      if (!gh || gh.error || gh.signal || (gh.status !== undefined && gh.status !== 0)) {
        Object.assign(result, gh ?? { status: null, error: { code: 'ENOENT' } });
      } else result.stdout = token;
    }
    else throw new Error('unexpected synthetic process call');
    clock += typeof cost === 'function' ? cost(exe, args, options, result) : cost;
    return result;
  };
  const options = { run, now: () => clock, timeoutMs: budget,
    authenticatedFallback: authenticated, resolveCommand: name => name };
  return { calls, options, elapsed: () => clock, execute: () => readLiveRemoteBaseline('<SYNTHETIC_ROOT>', defaultRef, options) };
}
check('normal probe uses finite noninteractive subprocess options', () => {
  const p = probe();
  assert.equal(p.execute().head, oid);
  assert.equal(p.calls.length, 3);
  for (const call of p.calls) {
    assert.equal(call.options.shell, false);
    assert.equal(call.options.stdio[0], 'ignore');
    assert.ok(call.options.timeout > 0 && call.options.timeout <= 100);
    assert.equal(call.options.env.GIT_TERMINAL_PROMPT, '0');
    assert.ok(call.args.includes('credential.helper='));
    assert.ok(call.options.env.GIT_SSH_COMMAND.includes('BatchMode=yes'));
  }
});
check('Git advertisement timeout can use a verified bounded transport fallback', () => {
  const p = probe({ ls: { error: { code: 'ETIMEDOUT' }, status: null }, cost: 10 });
  assert.equal(p.execute().head, oid);
  assert.equal(p.calls.length, 5);
  assert.deepEqual(p.calls.map(call => call.options.timeout), [100, 90, 80, 70, 30]);
});
check('Git timeout with malformed fallback remains an explicit timeout', () => {
  const p = probe({ ls: { error: { code: 'ETIMEDOUT' }, status: null }, api: { stdout: '{}' } });
  assert.throws(p.execute, error => error.code === 'REMOTE_PROBE_TIMEOUT');
});
check('Git timeout never widens fallback to another host or protocol', () => {
  const p = probe({ ls: { error: { code: 'ETIMEDOUT' }, status: null }, remoteUrl: 'ssh://synthetic.invalid/repository.git\n' });
  assert.throws(p.execute, error => error.code === 'REMOTE_PROBE_TIMEOUT');
  assert.equal(p.calls.length, 4);
});
check('Git timeout after the shared deadline starts no fallback subprocess', () => {
  const p = probe({ ls: { error: { code: 'ETIMEDOUT' }, status: null }, cost: 34 });
  assert.throws(p.execute, error => error.code === 'REMOTE_PROBE_TIMEOUT');
  assert.equal(p.calls.length, 3);
});
for (const result of [
  { error: { code: 'ENOBUFS' }, status: null },
  { error: { code: 'ENOENT' }, status: null },
  { signal: 'SIGKILL', status: null }
]) check('aborted Git never becomes readiness', () => {
  assert.throws(probe({ ls: result }).execute, error => error.code === 'REMOTE_PROBE_ABORTED');
});
check('transport fallback consumes the same remaining deadline', () => {
  const p = probe({ ls: { status: 1 }, cost: 10 });
  assert.equal(p.execute().head, oid);
  assert.equal(p.calls.length, 5);
  assert.deepEqual(p.calls.map(call => call.options.timeout), [100, 90, 80, 70, 30]);
  const curl = p.calls.at(-1);
  assert.equal(curl.args[0], '--disable');
  assert.ok(curl.args.includes('=https'));
});
check('exhausted shared budget prevents another subprocess', () => {
  const p = probe({ ls: { status: 1 }, cost: 26 });
  assert.throws(p.execute, error => error.code === 'REMOTE_PROBE_TIMEOUT');
  assert.equal(p.calls.length, 4);
});
check('malformed fallback cannot produce a remote head', () => {
  assert.throws(probe({ ls: { status: 1 }, api: { stdout: '{}' } }).execute, /cannot read live remote/);
});
check('invalid time limits are rejected', () => {
  for (const timeoutMs of [0, -1, 30001, NaN]) {
    assert.throws(() => readLiveRemoteBaseline('.', 'origin/main', { timeoutMs }), /time limit/);
  }
});
check('existing authenticated CLI can recover a private ref after Git timeout and anonymous refusal', () => {
  const p = probe({ ls: { status: null, error: { code: 'ETIMEDOUT' } }, api: { status: 22 },
    gh: { stdout: JSON.stringify(payload()) }, cost: 10 });
  assert.equal(p.execute().head, oid);
  const call = p.calls.find(call => call.exe === 'gh');
  assert.equal(call.exe, 'gh');
  assert.deepEqual(call.args, ['auth', 'token', '--hostname', 'github.com']);
  const curl = p.calls.at(-1);
  assert.equal(curl.args[curl.args.indexOf('--url') + 1],
    'https://api.github.com/repos/synthetic/example/git/ref/heads/main');
  assert.ok(!curl.args.some(value => value.includes('ghp_SYNTHETIC')));
  assert.ok(!curl.args.includes('--location'));
  assert.equal(call.options.env.GH_PROMPT_DISABLED, '1');
  assert.equal(call.options.env.GH_HOST, undefined);
  assert.equal(call.options.env.GH_REPO, undefined);
  assert.equal(call.options.env.GH_DEBUG, undefined);
  assert.ok(call.options.timeout <= 50);
});
check('optional missing CLI does not turn ordinary unobservability into a process abort', () => {
  const p = probe({ ls: { status: 1 }, api: { status: 22 } });
  assert.throws(p.execute, error => error.code !== 'REMOTE_PROBE_ABORTED' && error.code !== 'REMOTE_PROBE_TIMEOUT');
  assert.equal(p.calls.at(-1).exe, 'gh');
});
check('missing CLI cannot erase a prior Git timeout', () => {
  assert.throws(probe({ ls: { status: null, error: { code: 'ETIMEDOUT' } }, api: { status: 22 } }).execute,
    error => error.code === 'REMOTE_PROBE_TIMEOUT');
});
for (const failure of [{ status: 1 }, { status: 4 }, { status: 0, stdout: '{}' },
  { status: 0, stdout: '{bad json' }]) {
  check('unavailable authentication or invalid response never creates a verified ref', () => {
    assert.throws(probe({ ls: { status: 1 }, api: { status: 22 }, gh: failure }).execute);
  });
}
for (const failure of [{ status: null, error: { code: 'ETIMEDOUT' } },
  { status: null, error: { code: 'ENOBUFS' } }, { status: null, signal: 'SIGKILL' }]) {
  check('authenticated transport timeout and integrity failures retain their hard error class', () => {
    const expected = failure.error?.code === 'ETIMEDOUT' ? 'REMOTE_PROBE_TIMEOUT' : 'REMOTE_PROBE_ABORTED';
    assert.throws(probe({ ls: { status: 1 }, api: { status: 22 }, gh: failure }).execute,
      error => error.code === expected);
  });
}
check('anonymous transport timeout leaves time for the same-target authenticated fallback', () => {
  const p = probe({ ls: { status: 1 }, api: { status: null, error: { code: 'ETIMEDOUT' } },
    gh: { stdout: JSON.stringify(payload()) }, cost: 10 });
  assert.equal(p.execute().head, oid);
  const anonymous = p.calls.find(call => /curl/.test(call.exe));
  assert.ok(anonymous.options.timeout <= 30);
  assert.ok(!anonymous.args.some(arg => arg === '-fsSL' || arg === '--location'));
});
check('fully consumed Git and anonymous allowances still reserve authenticated time', () => {
  const p = probe({ budget: 10000, ls: { status: null, error: { code: 'ETIMEDOUT' } },
    api: { status: null, error: { code: 'ETIMEDOUT' } }, gh: { stdout: JSON.stringify(payload()) },
    cost: (_exe, _args, options, result) => result.error?.code === 'ETIMEDOUT' ? options.timeout : 10 });
  assert.equal(p.execute().head, oid);
  assert.equal(p.calls[2].options.timeout, 5000);
  const anonymous = p.calls.find(call => /curl/.test(call.exe)), authenticated = p.calls.at(-1);
  assert.match(authenticated.exe, /curl/);
  assert.ok(anonymous.options.timeout > 0 && authenticated.options.timeout > 0);
  assert.ok(p.elapsed() <= 10000);
});
check('a response delivered after the shared deadline cannot produce readiness', () => {
  const p = probe({ ls: { status: 1 }, cost: 21 });
  assert.throws(p.execute, error => error.code === 'REMOTE_PROBE_TIMEOUT');
  assert.ok(!p.calls.some(call => call.exe === 'gh'));
});
check('shared deadline never launches authentication after the budget is gone', () => {
  const p = probe({ ls: { status: 1 }, api: { status: 22 }, cost: 20 });
  assert.throws(p.execute);
  assert.ok(!p.calls.some(call => call.exe === 'gh'));
});
for (const body of [
  { ...payload(), ref: 'refs/heads/other' },
  { ...payload(), url: 'https://api.github.com/repos/other/example/git/refs/heads/main' },
  { ...payload(), url: 'https://example.invalid/repos/synthetic/example/git/refs/heads/main' },
  { ...payload(), object: { type: 'tag', sha: oid } },
  { ...payload(), object: { type: 'commit', sha: 'bad' } },
  { ...payload(), url: payload().url + '?changed=1' }
]) {
  check('a valid-looking SHA cannot substitute for repository and ref binding', () => {
    const response = { stdout: JSON.stringify(body) };
    assert.throws(probe({ ls: { status: 1 }, api: response, gh: response }).execute);
  });
}
for (const remoteUrl of ['https://github.com/../example.git', 'https://github.com/synthetic/..',
  'http://github.com/synthetic/example.git', 'https://github.com.evil.invalid/synthetic/example.git',
  'https://user@github.com/synthetic/example.git', 'https://github.com/synthetic/example.git?other=1']) {
  check('fallback never expands an invalid or non-HTTPS GitHub target', () => {
    const p = probe({ ls: { status: 1 }, remoteUrl });
    assert.throws(p.execute);
    assert.ok(!p.calls.some(call => call.exe === 'gh' || /curl/.test(call.exe)));
  });
}
for (const defaultRef of ['origin/../main', 'origin/main..other', 'origin/.hidden', 'origin/main.lock',
  'origin/main@{other}', 'origin/a//b', 'origin/main\nother']) {
  check('invalid references are rejected before remote advertisement', () => {
    const p = probe({ defaultRef });
    assert.throws(p.execute);
    assert.ok(!p.calls.some(call => call.args.includes('ls-remote')));
  });
}
check('slash branches and canonical host casing stay bound to the exact requested ref', () => {
  const p = probe({ defaultRef: 'origin/feature/fix', remoteUrl: 'https://GitHub.COM/synthetic/example.git',
    ls: { status: 1 }, api: { status: 22 }, gh: { stdout: JSON.stringify(payload('refs/heads/feature/fix')) } });
  assert.equal(p.execute().ref, 'refs/heads/feature/fix');
  const args = p.calls.at(-1).args;
  assert.ok(args[args.indexOf('--url') + 1].endsWith('heads/feature%2Ffix'));
});
check('ambient CLI target and debug overrides cannot replace the pinned request', () => {
  const keys = ['GH_HOST', 'GH_REPO', 'GH_DEBUG', 'GH_HTTP_UNIX_SOCKET', 'GH_TOKEN'];
  const before = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    Object.assign(process.env, { GH_HOST: 'example.invalid', GH_REPO: 'other/repo', GH_DEBUG: 'api',
      GH_HTTP_UNIX_SOCKET: '/synthetic/socket', GH_TOKEN: 'synthetic-not-a-secret' });
    const p = probe({ ls: { status: 1 }, api: { status: 22 }, gh: { stdout: JSON.stringify(payload()) } });
    assert.equal(p.execute().head, oid);
    const call = p.calls.at(-1);
    assert.equal(call.options.env.GH_TOKEN, 'synthetic-not-a-secret');
    for (const key of keys.slice(0, -1)) assert.equal(call.options.env[key], undefined);
    assert.equal(call.args[call.args.indexOf('--url') + 1], 'https://api.github.com/repos/synthetic/example/git/ref/heads/main');
  } finally {
    for (const key of keys) if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key];
  }
});
check('formal default uses the strict authenticated transport without accepting client redirects', () => {
  const p = probe({ ls: { status: 1 }, api: { status: 22 }, gh: { stdout: JSON.stringify(payload()) } });
  delete p.options.authenticatedFallback;
  assert.equal(p.execute().head, oid);
  assert.deepEqual(p.calls.find(call => call.exe === 'gh').args, ['auth', 'token', '--hostname', 'github.com']);
  assert.ok(!p.calls.at(-1).args.includes('--location'));
});
check('native curl timeout remains a timeout when the optional CLI is missing', () => {
  assert.throws(probe({ ls: { status: 1 }, api: { status: 28 } }).execute,
    error => error.code === 'REMOTE_PROBE_TIMEOUT');
  assert.throws(probe({ ls: { status: 1 }, api: { status: 28 }, authenticated: false }).execute,
    error => error.code === 'REMOTE_PROBE_TIMEOUT');
});
check('native curl timeout may still use a successful authenticated simulation inside the deadline', () => {
  assert.equal(probe({ ls: { status: 1 }, api: { status: 28 }, gh: { stdout: JSON.stringify(payload()) } }).execute().head, oid);
});
for (const length of [41, 63, 65]) {
  check('invalid object-id lengths cannot become readiness through either REST transport', () => {
    const body = payload(); body.object.sha = 'a'.repeat(length);
    const result = { stdout: JSON.stringify(body) };
    assert.throws(probe({ ls: { status: 1 }, api: result, gh: result }).execute);
  });
}
check('both supported object-id lengths remain valid', () => {
  const body = payload(); body.object.sha = 'a'.repeat(64);
  assert.equal(probe({ ls: { status: 1 }, api: { stdout: JSON.stringify(body) }, authenticated: false }).execute().head, body.object.sha);
});
for (const length of [40, 64]) check('credential echoed as a valid HEAD cannot escape the complete query', () => {
  const body = payload(); body.object.sha = 'b'.repeat(length);
  const p = probe({ ls: { status: 1 }, api: { status: 22 }, gh: { stdout: JSON.stringify(body) },
    token: 'B'.repeat(length) + '\n' });
  assert.throws(p.execute, error => !String(error).toLowerCase().includes('b'.repeat(length)));
});
console.log(`Remote probe: ${count} checks passed (no network or subprocesses).`);
