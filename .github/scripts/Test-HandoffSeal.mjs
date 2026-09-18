// Deterministic contract tests for the private immutable handoff-seal chain.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { appendSeal, sealDigest, validateSeal, verifyChain } from './HandoffSeal.mjs';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-seal-'));
const sealDir = path.join(temp, 'seals');
const sourceRoot = path.join(temp, 'sources');
fs.mkdirSync(sealDir); fs.mkdirSync(sourceRoot);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const runAppendWorker = (targetDir, sourceRootPath, sealDraft) => new Promise((resolve, reject) => {
  const workerCode = `import { appendSeal } from './HandoffSeal.mjs';
try {
  appendSeal(process.env.HANDOFF_SEAL_DIR, JSON.parse(process.env.HANDOFF_DRAFT), { expectedPreviousDigest: null, sourceRoot: process.env.HANDOFF_SOURCE_ROOT });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}`;
  const child = spawn(process.execPath, ['--input-type=module', '-e', workerCode], {
    cwd: scriptDir,
    env: { ...process.env, HANDOFF_SEAL_DIR: targetDir, HANDOFF_SOURCE_ROOT: sourceRootPath, HANDOFF_DRAFT: JSON.stringify(sealDraft) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let stderr = '';
  child.stderr.on('data', chunk => { stderr += chunk; });
  child.on('error', reject);
  child.on('close', status => resolve({ status, stderr }));
});
const stamp = '2026-09-18T00:00:00.000Z';
const source = owner => { const relative = `state/${owner}.json`; const content = Buffer.from(`synthetic-${owner}`); const absolute = path.join(sourceRoot, relative); fs.mkdirSync(path.dirname(absolute), { recursive: true }); fs.writeFileSync(absolute, content); return { owner, path_ref: relative, digest: crypto.createHash('sha256').update(content).digest('hex'), fact_cutoff: stamp }; };
const draft = (generation = 1, writer_id = 'COMMANDER-GEN-1') => ({
  schema_version: 1, record_type: 'handoff-seal', generation, writer_id, old_writer_status: 'STOPPED_DISPATCH',
  fact_cutoff: stamp, sealed_at: stamp, event_id: `evt-${generation}`,
  sources: { central_work_items: source('central'), current_view: source('view'), status_index: source('index') }, source_digest_status: 'PASS',
  objective: { summary: 'synthetic handoff', breakpoint: 'read-only verification' }, prohibitions: ['remote-write'],
  communications: { status: 'NONE' },
  workspace: { root_ref: '<PROJECT_ROOT>', branch: 'main', head: 'b'.repeat(40), tree: 'c'.repeat(40), staged_count: 0, tracked_modified_count: 0, untracked_count: 0, required_untracked: [] },
  remote: { status: 'PASS', default_ref: 'refs/heads/main', head: 'd'.repeat(40), observed_at: stamp },
  control_handoff_confidence: 'HIGH', switch_status: 'READY', runtime_acceptance_status: 'UNKNOWN', professional_acceptance_status: 'NOT_RUN',
  invalidation_conditions: ['source digest drift', 'post-seal writer event'], seal_digest: ''
});
let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log(`PASS: ${name}`); };
try {
  check('Windows-safe CLI entry reports usage on missing command', () => { const result = spawnSync(process.execPath, ['./HandoffSeal.mjs'], { cwd: path.dirname(fileURLToPath(import.meta.url)), encoding: 'utf8' }); assert.equal(result.status, 2); assert.match(result.stderr, /usage:/); });
  const concurrentDir = path.join(temp, 'concurrent-seals'); fs.mkdirSync(concurrentDir);
  const concurrentResults = await Promise.all([runAppendWorker(concurrentDir, sourceRoot, draft()), runAppendWorker(concurrentDir, sourceRoot, draft())]);
  check('cross-process append permits one CAS winner', () => { assert.equal(concurrentResults.filter(result => result.status === 0).length, 1); assert.equal(concurrentResults.filter(result => result.status !== 0).length, 1); assert.equal(verifyChain(concurrentDir, { sourceRoot }).status, 'PASS'); });
  const gapDir = path.join(temp, 'gap-seals'); fs.mkdirSync(gapDir); const gap = draft(); gap.seal_sequence = 2; gap.previous_seal_digest = null; gap.seal_digest = sealDigest(gap); fs.writeFileSync(path.join(gapDir, `handoff-state.2.${gap.seal_digest}.json`), JSON.stringify(gap));
  check('chain cannot start from a non-one sequence', () => assert.equal(verifyChain(gapDir, { sourceRoot }).status, 'BLOCKED'));
  const first = appendSeal(sealDir, draft(), { sourceRoot });
  check('valid chain accepts runtime UNKNOWN with control HIGH', () => { const result = verifyChain(sealDir, { sourceRoot }); assert.equal(result.status, 'PASS'); assert.equal(result.latest.runtime_acceptance_status, 'UNKNOWN'); });
  check('filename sequence and digest are bound to record fields', () => { const original = fs.readdirSync(sealDir).find(name => name.startsWith('handoff-state.')); const wrong = original.replace('handoff-state.1.', 'handoff-state.9.'); fs.renameSync(path.join(sealDir, original), path.join(sealDir, wrong)); assert.equal(verifyChain(sealDir, { sourceRoot }).status, 'BLOCKED'); fs.renameSync(path.join(sealDir, wrong), path.join(sealDir, original)); });
  check('digest tampering blocks the chain', () => { const file = fs.readdirSync(sealDir).find(name => name.startsWith('handoff-state.')); const value = JSON.parse(fs.readFileSync(path.join(sealDir, file))); value.objective.summary = 'tampered'; fs.writeFileSync(path.join(sealDir, file), JSON.stringify(value)); assert.equal(verifyChain(sealDir, { sourceRoot }).status, 'BLOCKED'); });
  fs.rmSync(sealDir, { recursive: true, force: true }); fs.mkdirSync(sealDir);
  appendSeal(sealDir, draft(), { sourceRoot });
  check('sequence and previous digest are chained', () => { const next = appendSeal(sealDir, draft(1, 'COMMANDER-GEN-1'), { sourceRoot }); assert.equal(next.seal_sequence, 2); assert.equal(next.previous_seal_digest.length, 64); assert.equal(verifyChain(sealDir, { sourceRoot }).status, 'PASS'); });
  check('expected previous digest is compare-and-swap guarded', () => { const latest = verifyChain(sealDir, { sourceRoot }).latest; assert.throws(() => appendSeal(sealDir, draft(), { expectedPreviousDigest: 'b'.repeat(64), sourceRoot }), /expected previous digest mismatch/); const next = appendSeal(sealDir, draft(), { expectedPreviousDigest: latest.seal_digest, sourceRoot }); assert.equal(next.seal_sequence, 3); });
  check('writer fencing rejects same-generation writer changes', () => assert.throws(() => appendSeal(sealDir, draft(1, 'COMMANDER-GEN-2'), { sourceRoot }), /writer change without generation transition/));
  check('writer fencing rejects same-writer generation reuse', () => assert.throws(() => appendSeal(sealDir, draft(2, 'COMMANDER-GEN-1'), { sourceRoot }), /unsafe generation transition/));
  check('new generation requires the replaced writer to be stopped', () => { const next = draft(2, 'COMMANDER-GEN-2'); next.old_writer_status = 'UNKNOWN'; next.switch_status = 'BLOCKED'; assert.throws(() => appendSeal(sealDir, next, { sourceRoot }), /unsafe generation transition/); });
  check('unsafe generation transition is blocked', () => { const next = draft(3, 'COMMANDER-GEN-3'); next.seal_sequence = 4; next.previous_seal_digest = verifyChain(sealDir, { sourceRoot }).latest.seal_digest; next.seal_digest = sealDigest(next); const file = path.join(sealDir, `handoff-state.4.${next.seal_digest}.json`); fs.writeFileSync(file, JSON.stringify(next)); assert.equal(verifyChain(sealDir, { sourceRoot }).status, 'BLOCKED'); });
  fs.rmSync(sealDir, { recursive: true, force: true }); fs.mkdirSync(sealDir);
  const invalid = draft(); invalid.sources.central_work_items.path_ref = 'C:/secret.json'; invalid.seal_digest = sealDigest(invalid);
  check('unsafe source paths are rejected', () => assert.ok(validateSeal(invalid).some(error => error.includes('unsafe source path'))));
  const cutoffMismatch = draft(); cutoffMismatch.sources.current_view.fact_cutoff = '2026-09-18T00:00:01.000Z'; cutoffMismatch.seal_digest = sealDigest(cutoffMismatch);
  check('source cutoff drift is rejected', () => assert.ok(validateSeal(cutoffMismatch).some(error => error.includes('source fact_cutoff mismatch'))));
  const remoteFail = draft(); remoteFail.remote.status = 'FAIL'; remoteFail.seal_digest = sealDigest(remoteFail);
  check('remote failure cannot be hidden by HIGH', () => assert.ok(validateSeal(remoteFail).some(error => error.includes('remote PASS'))));
  const missingSource = draft(); delete missingSource.sources.status_index; missingSource.seal_digest = sealDigest(missingSource);
  check('canonical control sources are required', () => assert.ok(validateSeal(missingSource).some(error => error.includes('canonical sources'))));
  const staleRemote = draft(); staleRemote.remote.observed_at = '2026-09-18T00:00:01.000Z'; staleRemote.seal_digest = sealDigest(staleRemote);
  check('remote observation must share the fact cutoff', () => assert.ok(validateSeal(staleRemote).some(error => error.includes('fact_cutoff'))));
  const sourceUnknownReady = draft(); sourceUnknownReady.control_handoff_confidence = 'LOW'; sourceUnknownReady.source_digest_status = 'UNKNOWN'; sourceUnknownReady.switch_status = 'READY'; sourceUnknownReady.seal_digest = sealDigest(sourceUnknownReady);
  check('unverified sources cannot be READY', () => assert.ok(validateSeal(sourceUnknownReady).some(error => error.includes('READY status'))));
  const restrictedUnknownWriter = draft(); restrictedUnknownWriter.control_handoff_confidence = 'MEDIUM'; restrictedUnknownWriter.switch_status = 'READY_WITH_RESTRICTIONS'; restrictedUnknownWriter.old_writer_status = 'UNKNOWN'; restrictedUnknownWriter.seal_digest = sealDigest(restrictedUnknownWriter);
  check('READY_WITH_RESTRICTIONS still requires a stopped old writer', () => assert.ok(validateSeal(restrictedUnknownWriter).some(error => error.includes('old writer stopped'))));
  const oldWriterUnknown = draft(); oldWriterUnknown.old_writer_status = 'UNKNOWN'; oldWriterUnknown.seal_digest = sealDigest(oldWriterUnknown);
  check('unknown old writer cannot be READY', () => assert.ok(validateSeal(oldWriterUnknown).some(error => error.includes('old writer stopped'))));
  appendSeal(sealDir, draft(), { sourceRoot });
  const viewPath = path.join(sourceRoot, 'state', 'view.json'); const viewContent = fs.readFileSync(viewPath); const mutationDraft = draft();
  fs.writeFileSync(viewPath, 'source-changed-after-seal');
  check('source mutation after sealing blocks recovery', () => { assert.equal(verifyChain(sealDir, { sourceRoot }).status, 'BLOCKED'); assert.throws(() => appendSeal(sealDir, mutationDraft, { sourceRoot }), /source verification failed|existing chain invalid/); });
  fs.writeFileSync(viewPath, viewContent);
  check('restored source returns the chain to PASS', () => { const restored = verifyChain(sealDir, { sourceRoot }); assert.equal(restored.status, 'PASS', restored.errors.join('; ')); });
  const partialName = 'handoff-state.99.' + '0'.repeat(64) + '.json'; fs.writeFileSync(path.join(sealDir, partialName), '{"schema_version":1');
  check('partial JSON final artifact blocks recovery', () => assert.equal(verifyChain(sealDir, { sourceRoot }).status, 'BLOCKED'));
  fs.unlinkSync(path.join(sealDir, partialName));
  const tmpName = 'handoff-state.99.' + '1'.repeat(64) + '.json.123.tmp'; fs.writeFileSync(path.join(sealDir, tmpName), 'partial');
  check('leftover temporary artifact blocks recovery', () => assert.equal(verifyChain(sealDir, { sourceRoot }).status, 'BLOCKED'));
  fs.unlinkSync(path.join(sealDir, tmpName));
  fs.writeFileSync(path.join(sealDir, '.handoff.lock'), 'active');
  check('stale lock is a recovery block, not auto-removed', () => assert.equal(verifyChain(sealDir).status, 'BLOCKED'));
  console.log(`Handoff seal: PASS (${passed} cases)`);
} finally { fs.rmSync(temp, { recursive: true, force: true }); }
