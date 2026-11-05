const assert = require('node:assert/strict');
const { requestJson, stopOwnedServer, finishCleanup } = require('./SessionDeskTestLifecycle.cjs');

(async () => {
  const never = () => new Promise(() => {});
  await assert.rejects(requestJson('http://synthetic.invalid', { timeoutMs: 15, fetchImpl: never }), /deadline/);
  await assert.rejects(requestJson('http://synthetic.invalid', { timeoutMs: 15, fetchImpl: async () => ({ status: 200, json: never }) }), /deadline/);
  const success = await requestJson('http://synthetic.invalid', {
    fetchImpl: async (_url, options) => {
      assert.ok(options.signal);
      assert.equal(options.method, 'POST');
      return { status: 200, json: async () => ({ ok: true }) };
    }, body: {}
  });
  assert.deepEqual(success, { status: 200, data: { ok: true } });
  const server = { pid: 123, exitCode: null, signalCode: null, unref() { this.unreferenced = true; } };
  let polls = 0;
  await assert.rejects(stopOwnedServer(server,
    () => requestJson('http://synthetic.invalid', { timeoutMs: 15, fetchImpl: never }),
    { attempts: 2, delay: async () => { polls++; } }), /exit unconfirmed/);
  assert.equal(polls, 2);
  assert.equal(server.unreferenced, true);
  const closing = { ...server, exitCode: null, unreferenced: false };
  await stopOwnedServer(closing, async () => { closing.exitCode = 0; });
  for (const state of [{ exitCode: 2, signalCode: null }, { exitCode: null, signalCode: 'SIGTERM' }]) {
    await assert.rejects(stopOwnedServer({ ...server, ...state }, never), /not clean/);
  }
  const abnormalClosing = { ...server, exitCode: null, signalCode: null };
  await assert.rejects(stopOwnedServer(abnormalClosing, async () => { abnormalClosing.exitCode = 2; }), /not clean/);
  const primary = new Error('original assertion failed');
  const cleaned = [];
  await assert.rejects(finishCleanup(primary, [
    async () => { cleaned.push('browser'); throw Error('browser close failed'); },
    async () => { cleaned.push('server'); throw Error('server exit unconfirmed'); }
  ]), error => error instanceof AggregateError && error.cause === primary && error.errors.length === 3);
  assert.deepEqual(cleaned, ['browser', 'server']);
  await assert.rejects(finishCleanup(null, [async () => { throw Error('cleanup only'); }]), /cleanup failed/);
  let afterBlockedClose = false;
  await assert.rejects(finishCleanup(primary, [never, async () => { afterBlockedClose = true; }], { timeoutMs: 15 }),
    error => error.cause === primary && error.errors.some(item => /deadline/.test(item.message)));
  assert.equal(afterBlockedClose, true);
  await finishCleanup(null, [async () => {}]);
  console.log('SessionDesk lifecycle: 12 PASS (no browser, network, services or files).');
})().catch(error => { console.error(error); process.exitCode = 1; });
