// Deterministic contract tests for the private immutable handoff-seal chain.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { appendSeal, prepareTransition, sealDigest, validateSeal, verifyChain } from './HandoffSeal.mjs';

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
const source = (owner, revision = 'base') => { const relative = `state/${owner}.json`; const content = Buffer.from(`synthetic-${owner}-${revision}`); const absolute = path.join(sourceRoot, relative); fs.mkdirSync(path.dirname(absolute), { recursive: true }); fs.writeFileSync(absolute, content); return { owner, path_ref: relative, digest: crypto.createHash('sha256').update(content).digest('hex'), fact_cutoff: stamp }; };
let draftEventSequence = 0;
const draft = (generation = 1, writer_id = 'COMMANDER-GEN-1', revision = 'base') => ({
  schema_version: 3, record_type: 'handoff-seal', generation, writer_id, old_writer_status: 'STOPPED_DISPATCH',
  fact_cutoff: stamp, sealed_at: stamp, event_id: `evt-${generation}-${revision}-${++draftEventSequence}`,
  sources: { central_work_items: source('central', revision), current_view: source('view', revision), status_index: source('index', revision) }, source_digest_status: 'PASS',
  objective: { summary: 'synthetic handoff', breakpoint: 'read-only verification' }, prohibitions: ['remote-write'],
  communications: { status: 'NONE' },
  workspace: { root_ref: '<PROJECT_ROOT>', branch: 'main', head: 'b'.repeat(40), tree: 'c'.repeat(40), staged_count: 0, tracked_modified_count: 0, untracked_count: 0, required_untracked: [] },
  remote: { status: 'PASS', default_ref: 'refs/heads/main', head: 'd'.repeat(40), observed_at: stamp },
  control_handoff_confidence: 'HIGH', candidate_verification_status: 'PASS', switch_status: 'READY', handoff_phase: 'MATERIAL_PREPARED', runtime_acceptance_status: 'UNKNOWN', professional_acceptance_status: 'NOT_RUN', transition: null, migration: null,
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
  const invalid = draft(); invalid.sources.central_work_items.path_ref = String.fromCharCode(67) + ':/secret.json'; invalid.seal_digest = sealDigest(invalid);
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
  check('candidate readiness does not assert old writer stopped', () => assert.ok(!validateSeal(restrictedUnknownWriter).some(error => error.includes('old writer stopped'))));
  const oldWriterUnknown = draft(); oldWriterUnknown.old_writer_status = 'UNKNOWN'; oldWriterUnknown.seal_digest = sealDigest(oldWriterUnknown);
  check('READY is distinct from completed takeover', () => assert.ok(!validateSeal(oldWriterUnknown).some(error => error.includes('old writer stopped'))));
  const premature = draft(); premature.old_writer_status = 'UNKNOWN'; premature.switch_status = 'COMPLETED'; premature.seal_digest = sealDigest(premature);
  check('completion still requires stopped predecessor', () => assert.ok(validateSeal(premature).some(error => error.includes('old writer stopped'))));
  const pointerDir = path.join(temp, 'pointer-seals');
  const pointerDraft = draft(); pointerDraft.old_writer_status = 'UNKNOWN';
  const pointerPath = path.join(sourceRoot, pointerDraft.sources.status_index.path_ref);
  fs.writeFileSync(pointerPath, 'seal_directory_ref=pointer-seals; event_id=evt-1');
  pointerDraft.sources.status_index.digest = crypto.createHash('sha256').update(fs.readFileSync(pointerPath)).digest('hex');
  const pointerBefore = fs.readFileSync(pointerPath);
  appendSeal(pointerDir, pointerDraft, { expectedPreviousDigest: null, sourceRoot });
  check('directory pointer avoids self-reference without excluding source bytes', () => {
    assert.deepEqual(fs.readFileSync(pointerPath), pointerBefore);
    assert.equal(verifyChain(pointerDir, { sourceRoot }).status, 'PASS');
    fs.appendFileSync(pointerPath, '; writer=unexpected');
    assert.equal(verifyChain(pointerDir, { sourceRoot }).status, 'BLOCKED');
    fs.writeFileSync(pointerPath, pointerBefore);
  });
  appendSeal(sealDir, draft(), { sourceRoot });
  const viewPath = path.join(sourceRoot, 'state', 'view.json'); const viewContent = fs.readFileSync(viewPath); const mutationDraft = draft();
  fs.writeFileSync(viewPath, 'source-changed-after-seal');
  check('source mutation after sealing blocks recovery', () => { assert.equal(verifyChain(sealDir, { sourceRoot }).status, 'BLOCKED'); assert.throws(() => appendSeal(sealDir, mutationDraft, { sourceRoot }), /source verification failed|existing chain invalid/); });
  fs.writeFileSync(viewPath, viewContent);
  check('restored source returns the chain to PASS', () => { const restored = verifyChain(sealDir, { sourceRoot }); assert.equal(restored.status, 'PASS', restored.errors.join('; ')); });
  check('schema v3 rejects event id reuse', () => { const latest = verifyChain(sealDir, { sourceRoot }).latest; const reused = draft(); reused.event_id = latest.event_id; assert.throws(() => appendSeal(sealDir, reused, { sourceRoot }), /event_id already exists/); });
  check('schema v3 rejects time rollback', () => { const rolled = draft(); rolled.fact_cutoff = '2026-09-17T23:59:59.000Z'; assert.throws(() => appendSeal(sealDir, rolled, { sourceRoot }), /fact_cutoff rollback/); });
  const inverted = draft(); inverted.sealed_at = '2026-09-17T23:59:59.000Z'; inverted.seal_digest = sealDigest(inverted);
  check('schema v3 rejects sealing before its fact cutoff', () => assert.ok(validateSeal(inverted).some(error => error.includes('sealed_at must not precede'))));
  const legacyDir = path.join(temp, 'legacy-seals'); fs.mkdirSync(legacyDir); const legacy = draft(); legacy.schema_version = 2; legacy.seal_sequence = 1; legacy.previous_seal_digest = null; legacy.seal_digest = sealDigest(legacy); fs.writeFileSync(path.join(legacyDir, `handoff-state.1.${legacy.seal_digest}.json`), JSON.stringify(legacy));
  check('schema v2 remains readable but is explicitly legacy-unverified', () => { const result = verifyChain(legacyDir, { sourceRoot }); assert.equal(result.status, 'PASS', result.errors.join('; ')); assert.equal(result.historical_assurance, 'LEGACY_UNVERIFIED'); });
  check('new writes cannot continue using schema v2', () => assert.throws(() => appendSeal(path.join(temp, 'legacy-write'), legacy, { sourceRoot }), /read-only legacy history/));
  const schemaOrderDir = path.join(temp, 'schema-order-seals'); fs.mkdirSync(schemaOrderDir); const strictFirst = appendSeal(schemaOrderDir, draft(), { sourceRoot }); const lateLegacy = draft(); lateLegacy.schema_version = 2; lateLegacy.seal_sequence = 2; lateLegacy.previous_seal_digest = strictFirst.seal_digest; lateLegacy.seal_digest = sealDigest(lateLegacy); fs.writeFileSync(path.join(schemaOrderDir, `handoff-state.2.${lateLegacy.seal_digest}.json`), JSON.stringify(lateLegacy));
  check('legacy schema records cannot appear after strict v3 begins', () => assert.equal(verifyChain(schemaOrderDir, { sourceRoot }).status, 'BLOCKED'));
  const transitionDir = path.join(temp, 'transition-seals'); fs.mkdirSync(transitionDir);
  const candidate = draft(1, 'COMMANDER-GEN-1', 'candidate'); candidate.old_writer_status = 'UNKNOWN';
  const candidateSeal = appendSeal(transitionDir, candidate, { sourceRoot });
  check('transition intent cannot predate its predecessor seal', () => assert.throws(() => prepareTransition(transitionDir, { sourceRoot, expectedPreviousDigest: candidateSeal.seal_digest, nextGeneration: 2, nextWriterId: 'COMMANDER-GEN-2', eventId: 'evt-too-early', preparedAt: '2026-09-17T23:59:59.000Z' }), /precedes predecessor/));
  const prepared = prepareTransition(transitionDir, { sourceRoot, expectedPreviousDigest: candidateSeal.seal_digest, nextGeneration: 2, nextWriterId: 'COMMANDER-GEN-2', eventId: 'evt-2-takeover', preparedAt: stamp });
  check('prepared transition is visible and blocks unrelated append', () => { const result = verifyChain(transitionDir, { sourceRoot }); assert.equal(result.status, 'PASS'); assert.equal(result.transition_status, 'PENDING'); assert.equal(result.pending_intents.length, 1); const unrelated = structuredClone(candidate); unrelated.event_id = 'evt-unrelated'; assert.throws(() => appendSeal(transitionDir, unrelated, { sourceRoot }), /unconsumed transition intent/); assert.throws(() => prepareTransition(transitionDir, { sourceRoot, nextGeneration: 2, nextWriterId: 'COMMANDER-GEN-X', eventId: 'evt-x' }), /unconsumed transition intent/); });
  const completed = draft(2, 'COMMANDER-GEN-2', 'takeover'); completed.switch_status = 'COMPLETED'; completed.handoff_phase = 'TAKEOVER_COMPLETED'; completed.old_writer_status = 'STOPPED_DISPATCH';
  completed.event_id = 'evt-2-takeover';
  const takeoverSeal = appendSeal(transitionDir, completed, { sourceRoot, expectedPreviousDigest: candidateSeal.seal_digest, transitionTicket: prepared.path });
  check('four-stage takeover rotates live sources without invalidating history', () => { const result = verifyChain(transitionDir, { sourceRoot }); assert.equal(result.status, 'PASS', result.errors.join('; ')); assert.equal(result.transition_status, 'SETTLED'); assert.equal(result.records.length, 2); assert.equal(result.latest.seal_digest, takeoverSeal.seal_digest); assert.equal(result.latest.transition.previous_seal_digest, candidateSeal.seal_digest); });
  check('missing consumed transition intent blocks the chain', () => { const ticketBytes = fs.readFileSync(prepared.path); fs.unlinkSync(prepared.path); assert.equal(verifyChain(transitionDir, { sourceRoot }).status, 'BLOCKED'); fs.writeFileSync(prepared.path, ticketBytes); });
  check('tampered transition intent blocks the chain', () => { const ticketBytes = fs.readFileSync(prepared.path); const value = JSON.parse(ticketBytes); value.next_writer_id = 'COMMANDER-GEN-X'; fs.writeFileSync(prepared.path, JSON.stringify(value)); assert.equal(verifyChain(transitionDir, { sourceRoot }).status, 'BLOCKED'); fs.writeFileSync(prepared.path, ticketBytes); });
  check('historical verification does not pretend old sources are still current', () => { const result = verifyChain(transitionDir, { sourceRoot, verifyLatestSources: false }); assert.equal(result.status, 'PASS'); assert.equal(result.latest_source_status, 'NOT_CHECKED'); });
  check('blocked seal still verifies live sources and exposes control status', () => {
    const blockedDir = path.join(temp, 'blocked-live'); fs.mkdirSync(blockedDir);
    const blocked = draft(); blocked.switch_status = 'BLOCKED'; blocked.control_handoff_confidence = 'LOW'; blocked.candidate_verification_status = 'NOT_RUN'; blocked.seal_digest = sealDigest(blocked);
    appendSeal(blockedDir, blocked, { sourceRoot });
    const result = verifyChain(blockedDir, { sourceRoot });
    assert.equal(result.status, 'PASS'); assert.equal(result.latest_source_status, 'PASS'); assert.equal(result.control_status, 'BLOCKED'); assert.equal(result.handoff_ready, false);
  });
  check('blocked current attestation is valid for same-writer source refresh', () => {
    const attested = draft(); attested.seal_sequence = 2; attested.previous_seal_digest = 'a'.repeat(64); attested.handoff_phase = 'CURRENT_ATTESTATION'; attested.switch_status = 'BLOCKED'; attested.control_handoff_confidence = 'LOW'; attested.candidate_verification_status = 'NOT_RUN'; attested.seal_digest = sealDigest(attested);
    assert.deepEqual(validateSeal(attested), []);
  });
  const lateIntentDir = path.join(temp, 'late-intent-seals'); fs.mkdirSync(lateIntentDir); const lateCandidate = draft(1, 'COMMANDER-GEN-1', 'late-candidate'); const lateCandidateSeal = appendSeal(lateIntentDir, lateCandidate, { sourceRoot }); const latePrepared = prepareTransition(lateIntentDir, { sourceRoot, expectedPreviousDigest: lateCandidateSeal.seal_digest, nextGeneration: 2, nextWriterId: 'COMMANDER-GEN-2', eventId: 'evt-late-takeover', preparedAt: '2026-09-18T00:00:02.000Z' }); const earlyTakeover = draft(2, 'COMMANDER-GEN-2', 'late-takeover'); earlyTakeover.event_id = 'evt-late-takeover'; earlyTakeover.sealed_at = '2026-09-18T00:00:01.000Z'; earlyTakeover.switch_status = 'COMPLETED'; earlyTakeover.handoff_phase = 'TAKEOVER_COMPLETED';
  check('takeover seal cannot predate its transition intent', () => assert.throws(() => appendSeal(lateIntentDir, earlyTakeover, { sourceRoot, expectedPreviousDigest: lateCandidateSeal.seal_digest, transitionTicket: latePrepared.path }), /follows takeover seal/));
  const migrationDir = path.join(temp, 'migration-seals'); fs.mkdirSync(migrationDir); const migrated = draft(11, 'COMMANDER-GEN-11', 'migration'); migrated.switch_status = 'COMPLETED'; migrated.handoff_phase = 'CURRENT_MIGRATION'; migrated.old_writer_status = 'STOPPED_DISPATCH'; migrated.migration = { legacy_latest_seal_digest: 'a'.repeat(64), legacy_generation: 10, legacy_writer_id: 'COMMANDER-GEN-10', migrated_at: stamp, basis: 'CURRENT_ONLY_NO_RETROACTIVE_TRANSITION' };
  check('first v2 seal can attest current-only migration without fabricating a transition', () => { const seal = appendSeal(migrationDir, migrated, { sourceRoot, expectedPreviousDigest: null }); const result = verifyChain(migrationDir, { sourceRoot }); assert.equal(result.status, 'PASS', result.errors.join('; ')); assert.equal(seal.handoff_phase, 'CURRENT_MIGRATION'); assert.equal(seal.previous_seal_digest, null); });
  const migrationLatest = verifyChain(migrationDir, { sourceRoot }).latest;
  const attestation = draft(11, 'COMMANDER-GEN-11', 'attestation'); attestation.switch_status = 'COMPLETED'; attestation.handoff_phase = 'CURRENT_ATTESTATION'; attestation.old_writer_status = 'STOPPED_DISPATCH';
  check('same commander can attest updated current sources without a takeover transition', () => { const seal = appendSeal(migrationDir, attestation, { sourceRoot, expectedPreviousDigest: migrationLatest.seal_digest }); const result = verifyChain(migrationDir, { sourceRoot }); assert.equal(result.status, 'PASS', result.errors.join('; ')); assert.equal(seal.handoff_phase, 'CURRENT_ATTESTATION'); assert.equal(seal.generation, migrationLatest.generation); assert.equal(seal.writer_id, migrationLatest.writer_id); });
  const unchangedAttestation = draft(11, 'COMMANDER-GEN-11', 'attestation'); unchangedAttestation.switch_status = 'COMPLETED'; unchangedAttestation.handoff_phase = 'CURRENT_ATTESTATION'; unchangedAttestation.old_writer_status = 'STOPPED_DISPATCH';
  check('current attestation rejects a no-change duplicate proof', () => assert.throws(() => appendSeal(migrationDir, unchangedAttestation, { sourceRoot }), /at least one changed source digest/));
  const firstAttestationDir = path.join(temp, 'first-attestation-seals'); fs.mkdirSync(firstAttestationDir); const firstAttestation = structuredClone(attestation);
  check('current attestation cannot start an empty chain', () => assert.throws(() => appendSeal(firstAttestationDir, firstAttestation, { sourceRoot }), /existing seal/));
  const wrongWriterAttestation = draft(11, 'COMMANDER-GEN-X', 'wrong-writer-attestation'); wrongWriterAttestation.switch_status = 'COMPLETED'; wrongWriterAttestation.handoff_phase = 'CURRENT_ATTESTATION';
  check('current attestation cannot change writer', () => assert.throws(() => appendSeal(migrationDir, wrongWriterAttestation, { sourceRoot }), /writer change|same generation and writer/));
  const wrongGenerationAttestation = draft(12, 'COMMANDER-GEN-12', 'wrong-generation-attestation'); wrongGenerationAttestation.switch_status = 'COMPLETED'; wrongGenerationAttestation.handoff_phase = 'CURRENT_ATTESTATION';
  check('current attestation cannot change generation', () => assert.throws(() => appendSeal(migrationDir, wrongGenerationAttestation, { sourceRoot }), /generation transition|same generation and writer/));
  const evidenceAttestation = structuredClone(attestation); evidenceAttestation.transition = { intent_digest: 'a'.repeat(64), previous_seal_digest: 'b'.repeat(64), prepared_at: stamp }; evidenceAttestation.migration = migrated.migration; evidenceAttestation.seal_digest = sealDigest(evidenceAttestation);
  check('current attestation rejects transition and migration evidence', () => assert.ok(validateSeal(evidenceAttestation).some(error => error.includes('without transition or migration'))));
  const fakeMigration = draft(2, 'COMMANDER-GEN-2', 'fake-migration'); fakeMigration.switch_status = 'COMPLETED'; fakeMigration.handoff_phase = 'CURRENT_MIGRATION'; fakeMigration.migration = migrated.migration; fakeMigration.seal_sequence = 2; fakeMigration.previous_seal_digest = 'b'.repeat(64); fakeMigration.seal_digest = sealDigest(fakeMigration);
  check('migration cannot fabricate a later chain link', () => assert.ok(validateSeal(fakeMigration).some(error => error.includes('first completed seal'))));
  const noIntentDir = path.join(temp, 'no-intent-seals'); fs.mkdirSync(noIntentDir); const noIntentFirst = appendSeal(noIntentDir, draft(1, 'COMMANDER-GEN-1', 'no-intent-old'), { sourceRoot }); const noIntentNext = draft(2, 'COMMANDER-GEN-2', 'no-intent-new'); noIntentNext.switch_status = 'COMPLETED'; noIntentNext.handoff_phase = 'TAKEOVER_COMPLETED';
  check('generation transition cannot bypass pre-update verification', () => assert.throws(() => appendSeal(noIntentDir, noIntentNext, { sourceRoot, expectedPreviousDigest: noIntentFirst.seal_digest }), /source verification failed|pre-update intent/));
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
