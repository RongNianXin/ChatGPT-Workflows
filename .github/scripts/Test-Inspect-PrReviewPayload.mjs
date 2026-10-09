import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { inspectPrReviewPayload } from './Inspect-PrReviewPayload.mjs';

const head = 'a'.repeat(40);
const body = '本轮处理清单\n\nB1：修正状态提交。定位 src/state.js:12；依据与复验步骤见本段。\nS1：可选改进。\n未验证：设备现场。';
const summary = { commit_id: head, event: 'REQUEST_CHANGES', body };
// Reproduce the incident's delivery shape, never its private code or findings.
const fragmented = { ...summary, body: '具体意见见下方行评论。', comments: Array.from({ length: 5 }, (_, i) => ({ path: `src/file${i}.js`, line: 12, side: 'RIGHT', body: `发现 ${i + 1}` })) };
let count = 0;
function check(name, run) { run(); count++; }
check('one API Review with five threads is rejected by default', () => {
  const result = inspectPrReviewPayload(fragmented);
  assert.equal(result.status, 'FAIL');
  assert.equal(result.review_submissions, 1);
  assert.equal(result.inline_comments, 5);
  assert.ok(result.errors.includes('FRAGMENTED_REVIEW_REQUIRES_EXPLICIT_EXCEPTION'));
});
check('complete body keeps the final Review event', () => assert.equal(inspectPrReviewPayload(summary).status, 'PASS'));
check('empty comments stays a single body', () => assert.equal(inspectPrReviewPayload({ ...summary, comments: [] }).delivery_mode, 'SINGLE_BODY'));
check('one inline thread is still an exception', () => assert.equal(inspectPrReviewPayload({ ...fragmented, comments: fragmented.comments.slice(0, 1) }).status, 'FAIL'));
check('flag alone is insufficient', () => assert.equal(inspectPrReviewPayload(fragmented, { allowInline: true }).status, 'FAIL'));
check('reason alone is insufficient', () => assert.equal(inspectPrReviewPayload(fragmented, { inlineReason: '已核团队逐线程流程' }).status, 'FAIL'));
check('explicit inline exception is not remote authorization', () => {
  const result = inspectPrReviewPayload({ ...fragmented, body }, { allowInline: true, inlineReason: '已核团队逐线程流程；载荷与数量已确认' });
  assert.equal(result.status, 'PASS');
  assert.equal(result.requires_semantic_and_authorization_review, true);
  assert.equal(result.remote_actions_performed, 0);
});
for (const event of ['COMMENT', 'APPROVE']) check(`preserve ${event}`, () => assert.equal(inspectPrReviewPayload({ ...summary, event }).status, 'PASS'));
for (const [name, value] of [['absent Head', { ...summary, commit_id: undefined }], ['pending event', { ...summary, event: undefined }], ['empty body', { ...summary, body: ' ' }], ['bad comments', { ...summary, comments: {} }], ['null payload', null], ['payload array', []]]) {
  check(name, () => assert.equal(inspectPrReviewPayload(value).status, 'FAIL'));
}
check('malformed approved inline comment is rejected', () => assert.equal(inspectPrReviewPayload({ ...summary, comments: [null] }, { allowInline: true, inlineReason: 'explicit' }).status, 'FAIL'));
check('new Head remains eligible for a new separately authorized review', () => assert.equal(inspectPrReviewPayload({ ...summary, commit_id: 'b'.repeat(40) }).status, 'PASS'));
check('input object is unchanged', () => { const before = JSON.stringify(fragmented); inspectPrReviewPayload(fragmented); assert.equal(JSON.stringify(fragmented), before); });
const script = fileURLToPath(new URL('./Inspect-PrReviewPayload.mjs', import.meta.url));
const fixtureParent = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.codex-manual-cache/pr-review-payload-tests');
fs.mkdirSync(fixtureParent, { recursive: true });
assert.equal(fs.realpathSync(fixtureParent), fixtureParent);
const temp = fs.mkdtempSync(path.join(fixtureParent, 'case-'));
try {
  const input = path.join(temp, 'payload.json');
  const bytes = '\uFEFF' + JSON.stringify(fragmented);
  fs.writeFileSync(input, bytes);
  const invoke = args => spawnSync(process.execPath, [script, ...args], { cwd: temp, encoding: 'utf8' });
  check('CLI rejects original shape from any cwd without touching input', () => {
    const result = invoke([`--payload=${input}`]);
    assert.equal(result.status, 1); assert.equal(JSON.parse(result.stdout).inline_comments, 5);
    assert.equal(fs.readFileSync(input, 'utf8'), bytes); assert.deepEqual(fs.readdirSync(temp), ['payload.json']);
  });
  check('CLI supports explicit exception without publishing', () => {
    const result = invoke([`--payload=${input}`, '--allow-inline', '--inline-reason=已核例外，权限另核']);
    assert.equal(result.status, 0); assert.equal(JSON.parse(result.stdout).remote_actions_performed, 0);
  });
  check('CLI parse failure does not disclose payload', () => {
    fs.writeFileSync(input, 'PRIVATE_SENTINEL not JSON');
    const result = invoke([`--payload=${input}`]);
    assert.equal(result.status, 1); assert.ok(!result.stdout.includes('PRIVATE_SENTINEL')); assert.equal(result.stderr, '');
  });
  check('CLI rejects ambiguous duplicate options', () => assert.equal(invoke([`--payload=${input}`, `--payload=${input}`]).status, 1));
} finally {
  const resolved = fs.realpathSync(temp);
  assert.equal(path.dirname(resolved), fixtureParent);
  fs.rmSync(resolved, { recursive: true, force: true });
}
console.log(`PR review payload: PASS (${count}; synthetic delivery structure and read-only CLI, not live publishing or model compliance)`);
