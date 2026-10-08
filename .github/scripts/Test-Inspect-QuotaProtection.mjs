import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { evaluateQuotaProtection, normalizeQuotaObservation } from './Inspect-QuotaProtection.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const sample = (usedPercent = 22, observedAt = 100, resetsAt = 1000, extra = {}) => ({
  accountKey: 'fictional-account-a', limitId: 'fictional-weekly-pool',
  windowDurationMins: 10080, resetsAt, observedAt, usedPercent, ...extra
});
const initialize = (current = sample(), budget = { limit: 20, reserve: 5 }) =>
  evaluateQuotaProtection({ current, initialize: true, budget });
const advance = (state, current, extra = {}) => evaluateQuotaProtection({ state, current, ...extra });
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`PASS: ${name}`); };

test('used 22 to 42 consumes 20 while remaining stays above 50', () => {
  const result = advance(initialize().nextState, sample(42, 200));
  assert.equal(result.decision, 'STOP'); assert.equal(result.usage.remainingPercent, 58);
  assert.equal(result.usage.knownConsumed, 20); assert.equal(result.usage.historyComplete, true);
});
test('remaining 22 to 100 is a reset and never 78 consumed', () => {
  const old = { ...sample(), usedPercent: undefined, remainingPercent: 22 };
  const next = { ...sample(0, 1100, 2000), usedPercent: undefined, remainingPercent: 100 };
  const result = advance(initialize(old).nextState, next);
  assert.equal(result.decision, 'UNKNOWN'); assert.equal(result.usage.knownConsumed, 0);
  assert.equal(result.usage.historyComplete, false); assert.equal(result.usage.segmentDelta, null);
});
test('fixed reset anchor accepts one second jitter without sliding', () => {
  let state = initialize().nextState;
  state = advance(state, sample(24, 110, 1001)).nextState;
  state = advance(state, sample(27, 120, 1000)).nextState;
  const result = advance(state, sample(28, 130, 1002));
  assert.equal(result.decision, 'UNKNOWN'); assert.equal(result.usage.knownConsumed, 5);
  assert.ok(result.reasonCodes.includes('RESET_CHANGED'));
});
test('same sample is idempotent and equal time conflicts remain unknown', () => {
  const first = advance(initialize().nextState, sample(30, 200));
  const again = advance(first.nextState, sample(30, 200));
  assert.equal(again.usage.knownConsumed, 8); assert.equal(again.usage.segmentDelta, 0);
  assert.deepEqual(again.nextState, first.nextState);
  assert.equal(advance(first.nextState, sample(31, 200)).decision, 'UNKNOWN');
});
test('backward time neither clears budget nor replaces last sample', () => {
  const first = advance(initialize().nextState, sample(30, 200));
  const result = advance(first.nextState, sample(35, 150));
  assert.equal(result.decision, 'UNKNOWN'); assert.equal(result.usage.knownConsumed, 8);
  assert.equal(result.nextState.previous.observedAt, 200);
});
test('stale or conflicting sample cannot falsely trigger current balance floor', () => {
  const state = advance(initialize().nextState, sample(30, 200)).nextState;
  for (const at of [150, 200]) assert.equal(advance(state, sample(99, at)).decision, 'UNKNOWN');
});
test('decimal subtraction does not miss a mathematically exact task limit', () => {
  const result = advance(initialize(sample(20.3)).nextState, sample(40.3, 200));
  assert.equal(result.decision, 'STOP'); assert.equal(result.usage.knownConsumed, 20);
});
test('decimal used and remaining equivalents are zero consumption and idempotent', () => {
  const state = initialize(sample(22.3)).nextState;
  for (const at of [100, 200]) {
    const current = { ...sample(22.3, at), usedPercent: undefined, remainingPercent: 77.7 };
    const result = advance(state, current);
    assert.equal(result.decision, 'CONTINUE'); assert.equal(result.usage.knownConsumed, 0);
    assert.equal(result.usage.segmentDelta, 0);
  }
  assert.equal(advance(initialize(sample(22.300000001)).nextState, sample(22.3, 200)).decision, 'UNKNOWN');
});
test('different account pool and duration cannot be combined', () => {
  for (const extra of [{ accountKey: 'fictional-account-b' }, { limitId: 'other-pool' }, { windowDurationMins: 300 }]) {
    const result = advance(initialize().nextState, sample(50, 200, 1000, extra));
    assert.equal(result.decision, 'UNKNOWN'); assert.equal(result.usage.knownConsumed, 0);
    assert.equal(result.nextState.previous.accountKey, 'fictional-account-a');
  }
});
test('new reset is not subtracted even when used rises', () => {
  const result = advance(initialize().nextState, sample(50, 200, 2000));
  assert.equal(result.usage.knownConsumed, 0); assert.equal(result.decision, 'UNKNOWN');
});
test('same reset declining used is not negative usage or budget restoration', () => {
  const state = advance(initialize().nextState, sample(30, 150)).nextState;
  const result = advance(state, sample(0, 200));
  assert.equal(result.usage.knownConsumed, 8); assert.equal(result.decision, 'UNKNOWN');
});
test('crossing even the unchanged reset boundary creates an unknown gap', () => {
  const result = advance(initialize(sample(22, 999)).nextState, sample(23, 1000));
  assert.equal(result.decision, 'UNKNOWN'); assert.equal(result.usage.knownConsumed, 0);
});
test('known segments survive reset without double counting', () => {
  let state = advance(initialize().nextState, sample(30, 200)).nextState;
  state = advance(state, sample(0, 1100, 2000)).nextState;
  const result = advance(state, sample(7, 1200, 2000), { ignoreUnknown: true });
  assert.equal(result.usage.knownConsumed, 15); assert.equal(result.decision, 'CONTINUE_WITH_RESTRICTIONS');
  assert.equal(result.usage.historyComplete, false);
  assert.equal(advance(result.nextState, sample(7, 1200, 2000), { ignoreUnknown: true }).usage.knownConsumed, 15);
});
test('known exhausted budget survives reset invalid readings and opt out', () => {
  const state = advance(initialize().nextState, sample(42, 200)).nextState;
  for (const current of [sample(0, 1100, 2000), sample(null, 300), sample(50, 300, 1000, { accountKey: 'other' })]) {
    assert.equal(advance(state, current, { ignoreUnknown: true }).decision, 'STOP');
  }
});
test('reserve includes equality and unknown permission cannot override it', () => {
  const result = advance(initialize().nextState, sample(95, 200, 2000), { ignoreUnknown: true });
  assert.equal(result.decision, 'STOP'); assert.ok(result.reasonCodes.includes('RESERVE_REACHED'));
});
test('zero is valid while null strings missing and invalid percentages are not', () => {
  assert.equal(normalizeQuotaObservation(sample(0)).valid, true);
  for (const value of [null, undefined, '22', NaN, Infinity, -1, 101]) {
    assert.equal(normalizeQuotaObservation({ ...sample(), usedPercent: value }).valid, false);
  }
  assert.equal(normalizeQuotaObservation(sample(22, 100, 1000, { remainingPercent: 22 })).valid, false);
});
test('ambiguous identity epoch and clock are rejected', () => {
  for (const extra of [{ accountKey: '' }, { limitId: null }, { resetsAt: null }, { observedAt: '100' }, { windowDurationMins: 0 }]) {
    assert.equal(normalizeQuotaObservation(sample(22, 100, 1000, extra)).valid, false);
  }
});
test('expired reset cannot initialize a supposedly reliable baseline', () => {
  assert.equal(initialize(sample(22, 1000, 1000)).decision, 'UNKNOWN');
});
test('missing state is not implicit task restart and malformed state is rejected', () => {
  assert.equal(evaluateQuotaProtection({ current: sample() }).decision, 'UNKNOWN');
  for (const extra of [{ knownConsumed: -1 }, { historyComplete: null }, { resetAnchor: 900 }, { limit: null }]) {
    assert.equal(advance({ ...initialize().nextState, ...extra }, sample(30, 200)).decision, 'UNKNOWN');
  }
});
test('explicit initialization freezes limit and continuation cannot amend it', () => {
  const initial = evaluateQuotaProtection({ current: sample(96), initialize: true });
  assert.equal(initial.nextState.limit, 0); assert.equal(initial.decision, 'STOP');
  assert.equal(advance(initialize().nextState, sample(30, 200), { budget: { limit: 99, reserve: 0 } }).decision, 'UNKNOWN');
  assert.equal(evaluateQuotaProtection({ state: initialize().nextState, current: sample(), initialize: true }).decision, 'UNKNOWN');
  for (const budget of [null, '20', []]) assert.equal(initialize(sample(), budget).decision, 'UNKNOWN');
});
test('CLI evaluates stdin without files or network and preserves API decision', () => {
  const before = fs.readFileSync(path.join(here, 'Inspect-QuotaProtection.mjs'));
  const input = { state: initialize().nextState, current: sample(42, 200) };
  const result = spawnSync(process.execPath, [path.join(here, 'Inspect-QuotaProtection.mjs')], { input: JSON.stringify(input), encoding: 'utf8', cwd: path.parse(here).root });
  assert.equal(result.status, 0); assert.equal(JSON.parse(result.stdout).decision, 'STOP');
  assert.deepEqual(fs.readFileSync(path.join(here, 'Inspect-QuotaProtection.mjs')), before);
});
test('CLI rejects malformed JSON and arguments without echoing private input', () => {
  for (const [args, input] of [[[], '{private-secret'], [['--write', 'private-secret'], '{}'], [[], JSON.stringify({ padding: 'x'.repeat(1024 * 1024) })]]) {
    const result = spawnSync(process.execPath, [path.join(here, 'Inspect-QuotaProtection.mjs'), ...args], { input, encoding: 'utf8' });
    assert.equal(result.status, 1); assert.equal((result.stdout + result.stderr).includes('private-secret'), false);
  }
});
console.log(`Quota protection: PASS (${passed} deterministic API/CLI cases; not live model behavior)`);
