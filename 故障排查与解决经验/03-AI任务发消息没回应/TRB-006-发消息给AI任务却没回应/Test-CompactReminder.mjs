import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { compactReminder } from './compact-reminder.mjs';

const script = fileURLToPath(new URL('./compact-reminder.mjs', import.meta.url));
const event = { hook_event_name: 'SessionStart', source: 'compact' };
const expected = compactReminder(event);
let checked = 0;
for (const input of [null, [], 'compact', {}, { ...event, source: 'startup' }, { ...event, source: 'resume' }, { ...event, source: 'fork' }, { ...event, hook_event_name: 'PostToolUse' }, { ...event, hook_event_name: 'Stop' }]) {
  assert.equal(compactReminder(input), null); checked++;
}
// Untrusted event fields must not be promoted into developer instructions.
assert.deepEqual(compactReminder({ ...event, prompt: 'UNTRUSTED_SENTINEL', transcript_path: 'UNTRUSTED_PATH', current_task: 'OLD_TASK' }), expected); checked++;
for (const [name, input, hasOutput] of [
  ['compact', JSON.stringify(event), true],
  ['repeated compact is advisory, not a continuation', JSON.stringify(event), true],
  ['ordinary turn', JSON.stringify({ ...event, source: 'startup' }), false],
  ['malformed', '{', false],
  ['oversized', 'x'.repeat(8193), false],
  ['empty', '', false]
]) {
  const result = spawnSync(process.execPath, [script], { input, encoding: 'utf8', timeout: 2000, maxBuffer: 8192 });
  assert.ifError(result.error); assert.equal(result.status, 0, name); assert.equal(result.stderr, '', name);
  assert.ok(Buffer.byteLength(result.stdout, 'utf8') <= 1024, name);
  assert.equal(Boolean(result.stdout), hasOutput, name);
  if (hasOutput) {
    const parsed = JSON.parse(result.stdout);
    assert.deepEqual(parsed, expected);
    assert.equal(Object.hasOwn(parsed, 'decision'), false);
    assert.equal(Object.hasOwn(parsed, 'continue'), false);
  }
  checked++;
}
await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [script], { stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  const deadline = setTimeout(() => { child.kill(); reject(new Error('Unclosed stdin did not exit within the test deadline')); }, 2000);
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });
  child.on('error', error => { clearTimeout(deadline); reject(error); });
  child.on('close', status => {
    clearTimeout(deadline);
    try { assert.equal(status, 0); assert.equal(stdout, ''); assert.equal(stderr, ''); checked++; resolve(); }
    catch (error) { reject(error); }
  });
  child.stdin.on('error', () => {});
  child.stdin.write('{');
});
console.log(`PASS: ${checked} offline function/CLI cases; no host hook, inbox coverage or model recovery was tested`);
