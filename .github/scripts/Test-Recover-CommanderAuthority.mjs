import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { appendSeal, readChain, verifyChain, sealDigest, prepareTransition, planSealAppend, verifyControlIdentity, prepareAuthorityRecovery, authorityWithdrawalTime } from './HandoffSeal.mjs';
import { byteDigest as hash, controlPaths, assertControlReady } from './HandoffControl.mjs';
import { readGitWorkspaceBaseline } from './Prepare-Handoff.mjs';
import { takeoverHandoff } from './Takeover-Handoff.mjs';
import { planAuthorityRecovery, recoverCommanderAuthority, rollbackCommanderAuthority } from './Recover-CommanderAuthority.mjs';
import { verifyHandoffCandidate } from './Verify-Handoff-Candidate.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), cache = path.join(root, '.codex-manual-cache');
assert.equal(spawnSync('git', ['-C', root, 'check-ignore', '--quiet', '--', '.codex-manual-cache/authority-test']).status, 0);
fs.mkdirSync(cache, { recursive: true });
const temp = fs.mkdtempSync(path.join(cache, 'authority-'));
const workflowRoot = path.join(root, '总指挥工作流/第二代总指挥的工作模式'), manifestPath = path.join(workflowRoot, '规则刷新manifest.json');
const platform = n => `${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`;
let sequence = 0, passed = 0;
function fixture({ external = false, trackedEntry = false, unknownRemote = false, reservedWithdrawal = false } = {}) {
  const base = path.join(temp, String(++sequence)), sourceRoot = path.join(base, 'source'), externalControlPlaneRoot = external ? path.join(base, 'external') : undefined;
  fs.mkdirSync(sourceRoot, { recursive: true }); if (external) fs.mkdirSync(externalControlPlaneRoot);
  const git = args => { const result = spawnSync('git', ['-C', sourceRoot, ...args], { encoding: 'utf8' }); assert.equal(result.status, 0, result.stderr); return result.stdout.trim(); };
  git(['init', '--quiet', '--initial-branch=main']); fs.writeFileSync(path.join(sourceRoot, '.gitignore'), '.control/\n'); fs.writeFileSync(path.join(sourceRoot, 'product.txt'), 'accepted product\n');
  git(['add', '--', '.gitignore', 'product.txt']); git(['-c', 'user.name=Synthetic Test', '-c', 'user.email=test@example.invalid', 'commit', '--quiet', '-m', 'synthetic']); git(['remote', 'add', 'origin', sourceRoot]);
  const stamp = '2026-01-01T00:00:00.000Z', sources = {}, rootRef = external ? 'external_control_plane' : 'source_root';
  for (const name of ['status_index', 'central_work_items', 'current_view', 'central_entry', 'workflow_enablement']) {
    const mapping = name === 'status_index' ? { generation: 1, writer_id: 'SYNTHETIC-ONE', platform_task_id: platform(1) } : { status_index: '.control/status_index.md', root_ref: rootRef, ...(name === 'workflow_enablement' ? { central_entry: '.control/central_entry.md', central_entry_root_ref: rootRef } : {}) };
    const body = `<!-- CURRENT:BEGIN -->\n<!-- ${name === 'status_index' ? 'CONTROL_IDENTITY' : 'CONTROL_NAVIGATION'}: ${JSON.stringify(mapping)} -->\n${name === 'status_index' ? '项目键：SYNTHETIC\n' : ''}${name === 'workflow_enablement' ? '状态：enabled\n' : 'Queue: A WAIT; B BLOCKED\nBudget: ENDED; remaining=0\n'}<!-- CURRENT:END -->\n<!-- HISTORY:BEGIN -->\nPreserve original history\n`;
    const ref = `.control/${name}.md`, file = path.join(externalControlPlaneRoot || sourceRoot, ref); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, body);
    sources[name] = { owner: 'synthetic', path_ref: ref, root_ref: rootRef, digest: hash(Buffer.from(body)), fact_cutoff: stamp };
  }
  if (trackedEntry && !external) { git(['add', '-f', '--', '.control/central_entry.md']); git(['-c', 'user.name=Synthetic Test', '-c', 'user.email=test@example.invalid', 'commit', '--quiet', '-m', 'synthetic control layout']); }
  const draft = { schema_version: 4, record_type: 'handoff-seal', generation: 1, writer_id: 'SYNTHETIC-ONE', old_writer_status: 'UNKNOWN', fact_cutoff: stamp, sealed_at: stamp, event_id: 'synthetic-initial-material', sources, source_digest_status: 'PASS', rule_baseline: { rule_version: JSON.parse(fs.readFileSync(manifestPath)).rule_version, manifest_sha256: hash(fs.readFileSync(manifestPath)) }, objective: { summary: 'synthetic preserved objective', breakpoint: 'synthetic checkpoint' }, prohibitions: ['remote-write', 'business-resume'], communications: { status: 'NONE' }, workspace: { root_ref: '<PROJECT_ROOT>', ...readGitWorkspaceBaseline(sourceRoot), required_untracked: [] }, remote: { status: 'PASS', default_ref: 'refs/heads/main', head: git(['rev-parse', 'HEAD']), observed_at: stamp }, restrictions: [], control_handoff_confidence: 'HIGH', candidate_verification_status: 'PASS', switch_status: 'READY', handoff_phase: 'MATERIAL_PREPARED', runtime_acceptance_status: 'NOT_RUN', professional_acceptance_status: 'NOT_RUN', transition: null, migration: null, invalidation_conditions: ['source drift'], seal_digest: '' };
  if (reservedWithdrawal) draft.event_id = 'synthetic-reserved:withdrawal';
  const sealDirectory = path.join(sourceRoot, '.control/seals');
  const first = appendSeal(sealDirectory, draft, { sourceRoot, externalControlPlaneRoot });
  const oldRecipient = { writerId: 'SYNTHETIC-TWO', platformTaskId: platform(2), projectKey: 'SYNTHETIC' };
  const oldConfirmation = { protocol_version: 1, origin: 'CURRENT_OPERATOR_MESSAGE', evidence_ref: 'synthetic-old-original-message', confirmed_at: new Date().toISOString(), project_key: 'SYNTHETIC', previous_seal_digest: first.seal_digest, old_generation: 1, old_writer_id: first.writer_id, old_writer_status: 'STOPPED_DISPATCH', recipient_writer_id: oldRecipient.writerId, recipient_platform_id: oldRecipient.platformTaskId, scope: 'HANDOFF_PREPARE_COMMIT_ONLY', transfer_confirmed: true };
  const baseOptions = { sourceRoot, externalControlPlaneRoot, sealDirectory, workflowRoot, manifestPath };
  takeoverHandoff({ ...baseOptions, recipient: oldRecipient, confirmation: oldConfirmation, eventId: 'synthetic-original-takeover' });
  const previous = readChain(sealDirectory).records.at(-1), historyBytes = fs.readdirSync(sealDirectory).map(file => [file, hash(fs.readFileSync(path.join(sealDirectory, file)))]);
  for (const name of ['status_index', 'central_work_items', 'current_view', 'central_entry']) {
    const file = path.join(externalControlPlaneRoot || sourceRoot, previous.sources[name].path_ref);
    const text = fs.readFileSync(file, 'utf8').replace(/(<!-- CURRENT:BEGIN -->)([\s\S]*?)(<!-- CURRENT:END -->)/, (_, begin, current, end) => `${begin}${current.replaceAll('SYNTHETIC-TWO', 'SYNTHETIC-THREE').replaceAll(platform(2), platform(3)).replaceAll('"generation":2', '"generation":3').replaceAll('当前总指挥世代：2', '当前总指挥世代：3')}${end}`);
    fs.writeFileSync(file, text);
  }
  fs.appendFileSync(path.join(sourceRoot, 'product.txt'), 'accepted uncommitted result\n'); fs.writeFileSync(path.join(sourceRoot, 'result.txt'), 'accepted untracked result\n');
  const observation = structuredClone(previous); observation.generation = 3; observation.writer_id = 'SYNTHETIC-THREE'; observation.handoff_phase = 'MATERIAL_PREPARED'; observation.switch_status = 'READY'; observation.transition = null; observation.old_writer_status = 'UNKNOWN'; observation.fact_cutoff = observation.sealed_at = new Date().toISOString();
  for (const source of Object.values(observation.sources)) { source.digest = hash(fs.readFileSync(path.join(source.root_ref === 'external_control_plane' ? externalControlPlaneRoot : sourceRoot, source.path_ref))); source.fact_cutoff = observation.fact_cutoff; }
  observation.workspace = { root_ref: '<PROJECT_ROOT>', ...readGitWorkspaceBaseline(sourceRoot, ['result.txt']), required_untracked: [{ path_ref: 'result.txt', sha256: hash(fs.readFileSync(path.join(sourceRoot, 'result.txt'))), reason: 'preserve synthetic result' }] };
  if (unknownRemote) { git(['remote', 'remove', 'origin']); observation.remote = { ...observation.remote, status: 'UNKNOWN', head: null, observed_at: null }; observation.restrictions = ['REMOTE_UNOBSERVED']; observation.switch_status = 'READY_WITH_RESTRICTIONS'; }
  const recipient = { writerId: 'SYNTHETIC-FOUR', platformTaskId: platform(4), projectKey: 'SYNTHETIC' };
  const confirmation = { protocol_version: 1, origin: 'CURRENT_OPERATOR_MESSAGE', evidence_ref: 'synthetic-current-original-message', confirmed_at: new Date().toISOString(), project_key: 'SYNTHETIC', previous_seal_digest: previous.seal_digest, observed_generation: 3, observed_writer_id: observation.writer_id, observed_platform_id: platform(3), old_writer_status: 'STOPPED_DISPATCH', recipient_writer_id: recipient.writerId, recipient_platform_id: recipient.platformTaskId, scope: 'AUTHORITY_RECOVERY_ONLY', transfer_confirmed: true, unique_writer_confirmed: true, unproved_transition: 'ACKNOWLEDGED_NOT_CERTIFIED' };
  return { ...baseOptions, observation, recipient, confirmation, eventId: 'synthetic-authority-recovery', previous, historyBytes, git };
}
function check(name, run) { run(); passed++; console.log(`PASS: ${name}`); }
function preserved(f) { for (const [file, digest] of f.historyBytes) assert.equal(hash(fs.readFileSync(path.join(f.sealDirectory, file))), digest, 'old history changed'); assert.match(fs.readFileSync(path.join(f.sourceRoot, 'product.txt'), 'utf8'), /accepted uncommitted result/); assert.equal(fs.readFileSync(path.join(f.sourceRoot, 'result.txt'), 'utf8'), 'accepted untracked result\n'); }
for (const variant of ['blocked', 'non-material', 'before-observation', 'before-confirmation', 'null-prepared-at', 'empty-prepared-at']) check(`plan and commit reject invalid authority baseline ${variant}`, () => {
  const f = fixture({ external: true });
  if (variant === 'blocked') f.observation.switch_status = 'BLOCKED';
  if (variant === 'non-material') f.observation.handoff_phase = 'CURRENT_ATTESTATION';
  if (variant === 'before-observation') { f.preparedAt = f.observation.sealed_at; f.observation.sealed_at = new Date(Date.parse(f.preparedAt) + 1000).toISOString(); }
  if (variant === 'before-confirmation') { f.preparedAt = f.observation.sealed_at; f.confirmation.confirmed_at = new Date(Date.parse(f.preparedAt) + 1000).toISOString(); }
  if (variant === 'null-prepared-at') f.preparedAt = null;
  if (variant === 'empty-prepared-at') f.preparedAt = '';
  const snapshot = () => [f.sourceRoot, f.externalControlPlaneRoot].map(base => fs.readdirSync(path.join(base, '.control'), { recursive: true })
    .filter(ref => fs.statSync(path.join(base, '.control', ref)).isFile()).sort()
    .map(ref => [ref, hash(fs.readFileSync(path.join(base, '.control', ref)))]));
  const before = snapshot(), reason = /fresh v4 material baseline|preparation time rollback/;
  assert.throws(() => planAuthorityRecovery(f), reason); assert.throws(() => recoverCommanderAuthority(f), reason);
  assert.deepEqual(snapshot(), before); assert.equal(readChain(f.sealDirectory).authority_intents.length, 0); preserved(f);
});
check('read-only recovery plan and normal pre-update protection', () => {
  const f = fixture(), files = fs.readdirSync(f.sealDirectory), before = fs.readFileSync(controlPaths(f.previous, f).journal);
  assert.throws(() => planSealAppend(f.sealDirectory, f.observation, f), /AUTHORITY_RECOVERY_REQUIRED/);
  assert.equal(planAuthorityRecovery(f).transaction.observation.generation, 3);
  assert.deepEqual(fs.readdirSync(f.sealDirectory), files); assert.deepEqual(fs.readFileSync(controlPaths(f.previous, f).journal), before); preserved(f);
});
for (const options of [{}, { external: true }, { trackedEntry: true }, { unknownRemote: true }]) check(`authority lifecycle ${JSON.stringify(options)}`, () => {
  const f = fixture(options), result = recoverCommanderAuthority(f);
  assert.equal(result.status, 'COMPLETED'); assert.equal(result.generation, 4); assert.equal(result.historical_transition, 'NOT_CERTIFIED');
  assert.equal(recoverCommanderAuthority(f).generation, 4);
  const completedJournal = fs.readFileSync(controlPaths(f.previous, f).journal);
  recoverCommanderAuthority(f); assert.deepEqual(fs.readFileSync(controlPaths(f.previous, f).journal), completedJournal);
  const live = verifyChain(f.sealDirectory, f); assert.equal(live.status, 'PASS', live.errors.join('; ')); assert.equal(live.control_status, 'READY'); assert.equal(live.latest.schema_version, 5); assert.equal(live.records.length, 3); assert.equal(verifyControlIdentity(live.latest, f).identity.platform_task_id, platform(4));
  assertControlReady(live.latest, f); preserved(f);
  for (const item of readChain(f.sealDirectory).authority_intents[0].transaction.plan) assert.match(fs.readFileSync(path.join(item.root_ref === 'external_control_plane' ? f.externalControlPlaneRoot : f.sourceRoot, item.path_ref), 'utf8'), /Queue: A WAIT; B BLOCKED\nBudget: ENDED; remaining=0/);
});
for (const stage of ['after-intent', 'after-journal', 'after-write-0', 'after-write-1', 'after-write-2', 'after-write-3', 'before-seal', 'after-seal']) check(`interruption and idempotency at ${stage}`, () => {
  const f = fixture({ trackedEntry: true }); assert.throws(() => recoverCommanderAuthority({ ...f, fault: point => { if (point === stage) throw new Error('synthetic interruption'); } }), /synthetic interruption/);
  assert.equal(recoverCommanderAuthority(f).generation, 4); assert.equal(recoverCommanderAuthority(f).generation, 4); assert.equal(readChain(f.sealDirectory).records.length, 3); preserved(f);
});
for (const field of ['origin', 'scope', 'transfer_confirmed', 'unique_writer_confirmed', 'observed_generation', 'observed_writer_id', 'observed_platform_id', 'recipient_writer_id', 'recipient_platform_id', 'project_key', 'previous_seal_digest', 'unproved_transition']) check(`reject wrong confirmation ${field}`, () => {
  const f = fixture(); f.confirmation[field] = typeof f.confirmation[field] === 'boolean' ? false : 'WRONG';
  assert.throws(() => recoverCommanderAuthority(f)); assert.equal(readChain(f.sealDirectory).authority_intents.length, 0); preserved(f);
});
check('no arbitrary generation jump or stopped-writer impersonation', () => {
  const f = fixture(); f.observation.generation = 5; f.confirmation.observed_generation = 5; assert.throws(() => recoverCommanderAuthority(f), /observed unsealed generation/);
  const g = fixture(); g.recipient.writerId = g.observation.writer_id; g.confirmation.recipient_writer_id = g.recipient.writerId; assert.throws(() => recoverCommanderAuthority(g), /recipient/);
});
check('third bytes block all writes in recovery and rollback', () => {
  const f = fixture(); assert.throws(() => recoverCommanderAuthority({ ...f, fault: point => { if (point === 'after-write-0') throw new Error('stop'); } }));
  const tx = readChain(f.sealDirectory).authority_intents[0].transaction, target = tx.plan[2], file = path.join(f.sourceRoot, target.path_ref); fs.appendFileSync(file, 'third bytes');
  const before = tx.plan.map(item => hash(fs.readFileSync(path.join(f.sourceRoot, item.path_ref))));
  assert.throws(() => recoverCommanderAuthority(f), /byte conflict/); assert.throws(() => rollbackCommanderAuthority(f), /byte conflict/);
  assert.deepEqual(tx.plan.map(item => hash(fs.readFileSync(path.join(f.sourceRoot, item.path_ref)))), before);
});
check('forged COMPLETED without immutable seal does not unlock control', () => {
  const f = fixture(); assert.throws(() => recoverCommanderAuthority({ ...f, fault: point => { if (point === 'after-journal') throw new Error('stop'); } }));
  const file = controlPaths(f.previous, f).journal, journal = JSON.parse(fs.readFileSync(file)); journal.status = 'COMPLETED'; fs.writeFileSync(file, JSON.stringify(journal));
  assert.throws(() => assertControlReady(f.previous, f), /completion evidence/);
});
check('handwritten completion and new prose cannot override old machine identity', () => {
  const f = fixture({ external: true }), controlRoot = f.externalControlPlaneRoot;
  for (const name of ['status_index', 'central_work_items', 'current_view', 'central_entry']) {
    const file = path.join(controlRoot, f.observation.sources[name].path_ref);
    let text = fs.readFileSync(file, 'utf8').replaceAll(platform(3), platform(2));
    if (name === 'status_index') text = text.replace('"generation":3', '"generation":2').replace('"writer_id":"SYNTHETIC-THREE"', '"writer_id":"SYNTHETIC-TWO"');
    fs.writeFileSync(file, text);
    f.observation.sources[name].digest = hash(Buffer.from(text));
  }
  fs.writeFileSync(path.join(controlRoot, '.control/completion-readback.json'), JSON.stringify({
    status: 'TAKEOVER_COMPLETED', protocol: 'DIRECT_OPERATOR_V1', generation: 3,
    receiver_writer_id: 'SYNTHETIC-THREE', platform_task_id: platform(2), blocking: 'none'
  }));
  const snapshot = () => [f.sourceRoot, controlRoot].map(base => fs.readdirSync(path.join(base, '.control'), { recursive: true })
    .filter(ref => fs.statSync(path.join(base, '.control', ref)).isFile()).sort()
    .map(ref => [ref, hash(fs.readFileSync(path.join(base, '.control', ref)))]));
  const before = snapshot(), candidate = verifyHandoffCandidate(f);
  assert.equal(candidate.status, 'BLOCKED'); assert.equal(candidate.rotation.can_stop_old, false);
  assert(!candidate.actions.some(action => action.includes('AUTHORITY_RECOVERY_REQUIRED')));
  assert.throws(() => planAuthorityRecovery(f), /observed current identity mismatch/);
  assert.throws(() => recoverCommanderAuthority(f), /observed current identity mismatch/);
  assert.deepEqual(snapshot(), before); assert.equal(readChain(f.sealDirectory).authority_intents.length, 0); preserved(f);
});
for (const stage of ['after-journal', 'after-write-2', 'before-seal']) check(`withdrawal settles intent and keeps both writers stopped ${stage}`, () => {
  const f = fixture(); assert.throws(() => recoverCommanderAuthority({ ...f, fault: point => { if (point === stage) throw new Error('stop'); } }));
  assert.equal(rollbackCommanderAuthority(f).status, 'ROLLED_BACK_STOPPED');
  const history = readChain(f.sealDirectory); assert.equal(history.pending_authority_recoveries.length, 0); assert.equal(history.authority_withdrawals.length, 1); assert.equal(history.records.length, 2);
  assert.throws(() => recoverCommanderAuthority(f), /withdrawn/); assert.throws(() => assertControlReady(f.previous, f), /TAKEOVER_INCOMPLETE/); preserved(f);
});
check('immutable completion forbids rollback before mutable closeout', () => {
  const f = fixture(); assert.throws(() => recoverCommanderAuthority({ ...f, fault: point => { if (point === 'after-seal') throw new Error('stop'); } }));
  assert.throws(() => rollbackCommanderAuthority(f), /forbidden after immutable completion/); assert.equal(recoverCommanderAuthority(f).status, 'COMPLETED');
});
check('authority preparation cannot precede predecessor sealing even with a later fact cutoff', () => {
  const f = fixture(), plan = planAuthorityRecovery(f), previous = structuredClone(f.previous);
  const oldFile = path.join(f.sealDirectory, `handoff-state.${previous.seal_sequence}.${previous.seal_digest}.json`);
  previous.sealed_at = new Date(Date.now() + 60000).toISOString(); previous.seal_digest = sealDigest(previous);
  fs.unlinkSync(oldFile); fs.writeFileSync(path.join(f.sealDirectory, `handoff-state.${previous.seal_sequence}.${previous.seal_digest}.json`), JSON.stringify(previous));
  f.confirmation.previous_seal_digest = previous.seal_digest; plan.transaction.confirmation = f.confirmation;
  const files = fs.readdirSync(f.sealDirectory), journal = fs.readFileSync(controlPaths(previous, f).journal);
  assert.equal(readChain(f.sealDirectory).errors.length, 0);
  assert.throws(() => planAuthorityRecovery(f), /precedes predecessor/);
  assert.throws(() => recoverCommanderAuthority(f), /precedes predecessor/);
  assert.throws(() => prepareAuthorityRecovery(f.sealDirectory, plan.transaction, { ...f, expectedPreviousDigest: previous.seal_digest }), /precedes predecessor/);
  assert.deepEqual(fs.readdirSync(f.sealDirectory), files); assert.deepEqual(fs.readFileSync(controlPaths(previous, f).journal), journal);
  for (const source of Object.values(f.observation.sources)) assert.equal(hash(fs.readFileSync(path.join(f.sourceRoot, source.path_ref))), source.digest);
});
check('clock rollback cannot write an invalid withdrawal or change the stopped transaction', () => {
  const f = fixture(); assert.throws(() => recoverCommanderAuthority({ ...f, fault: point => { if (point === 'after-write-1') throw new Error('stop'); } }));
  const history = readChain(f.sealDirectory), intent = history.authority_intents[0], file = controlPaths(f.previous, f).journal;
  const journal = fs.readFileSync(file), control = intent.transaction.plan.map(item => hash(fs.readFileSync(path.join(f.sourceRoot, item.path_ref))));
  const RealDate = Date, before = Date.parse(intent.prepared_at) - 1000;
  globalThis.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : [before])); } static now() { return before; } };
  try {
    assert.throws(() => authorityWithdrawalTime(history, intent), /withdrawal clock/);
    assert.throws(() => rollbackCommanderAuthority(f), /withdrawal clock/);
  } finally { globalThis.Date = RealDate; }
  assert.deepEqual(fs.readFileSync(file), journal); assert.deepEqual(intent.transaction.plan.map(item => hash(fs.readFileSync(path.join(f.sourceRoot, item.path_ref)))), control);
  assert.equal(readChain(f.sealDirectory).authority_withdrawals.length, 0); assert.equal(readChain(f.sealDirectory).errors.length, 0);
  assert.equal(rollbackCommanderAuthority(f).status, 'ROLLED_BACK_STOPPED');
  const settled = readChain(f.sealDirectory);
  globalThis.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : [before])); } static now() { return before; } };
  try { assert.equal(authorityWithdrawalTime(settled, intent), settled.authority_withdrawals[0].withdrawn_at); assert.equal(rollbackCommanderAuthority(f).status, 'ROLLED_BACK_STOPPED'); }
  finally { globalThis.Date = RealDate; }
});
check('derived withdrawal event is reserved before recovery starts', () => {
  const f = fixture({ reservedWithdrawal: true }), plan = planAuthorityRecovery(f), files = fs.readdirSync(f.sealDirectory), journal = fs.readFileSync(controlPaths(f.previous, f).journal);
  const colliding = { ...f, eventId: 'synthetic-reserved' };
  assert.throws(() => planAuthorityRecovery(colliding), /reserved withdrawal event/);
  assert.throws(() => recoverCommanderAuthority(colliding), /reserved withdrawal event/);
  assert.throws(() => prepareAuthorityRecovery(f.sealDirectory, plan.transaction, { ...colliding, expectedPreviousDigest: f.previous.seal_digest }), /reserved withdrawal event/);
  assert.deepEqual(fs.readdirSync(f.sealDirectory), files); assert.deepEqual(fs.readFileSync(controlPaths(f.previous, f).journal), journal); preserved(f);
});
for (const journalState of ['missing', 'old-backup']) check(`withdrawal authorization survives ${journalState} mutable journal`, () => {
  const f = fixture(), file = controlPaths(f.previous, f).journal, original = fs.readFileSync(file);
  const plan = planAuthorityRecovery(f);
  assert.throws(() => recoverCommanderAuthority({ ...f, fault: point => { if (point === 'after-journal') throw new Error('stop'); } }));
  rollbackCommanderAuthority(f);
  if (journalState === 'missing') fs.unlinkSync(file); else fs.writeFileSync(file, original);
  const retry = { ...f, eventId: 'synthetic-fresh-attempt' };
  assert.throws(() => planAuthorityRecovery(retry), /new current operator authorization/);
  assert.throws(() => recoverCommanderAuthority(retry), /new current operator authorization/);
  assert.throws(() => prepareAuthorityRecovery(f.sealDirectory, plan.transaction, { ...retry, expectedPreviousDigest: f.previous.seal_digest }), /new current operator authorization/);
  const now = new Date().toISOString();
  retry.confirmation = { ...f.confirmation, evidence_ref: 'synthetic-new-operator-message', confirmed_at: now };
  assert.throws(() => planAuthorityRecovery(retry), /fresh observation/);
  retry.observation = { ...f.observation, fact_cutoff: now, sealed_at: now };
  assert.equal(planAuthorityRecovery(retry).transaction.observation.generation, 3);
  assert.throws(() => prepareAuthorityRecovery(f.sealDirectory, planAuthorityRecovery(retry).transaction, { ...retry, eventId: `${f.eventId}:withdrawal`, expectedPreviousDigest: f.previous.seal_digest }), /event already exists/);
  assert.equal(recoverCommanderAuthority(retry).status, 'COMPLETED');
  assert.equal(readChain(f.sealDirectory).errors.length, 0); preserved(f);
});
check('forged settled protocol2 cannot impersonate an ordinary completed seal', () => {
  const f = fixture(), file = controlPaths(f.previous, f).journal;
  fs.writeFileSync(file, JSON.stringify({ protocol_version: 2, record_type: 'handoff-authority-recovery-transaction', status: 'COMPLETED', event_id: f.previous.event_id }));
  assert.throws(() => planAuthorityRecovery(f), /completion evidence/);
});
check('missing mutable journal recovers only from immutable plan, preserving old journal backup', () => {
  const f = fixture(), original = fs.readFileSync(controlPaths(f.previous, f).journal);
  assert.throws(() => recoverCommanderAuthority({ ...f, fault: point => { if (point === 'after-write-1') throw new Error('stop'); } }));
  assert.equal(readChain(f.sealDirectory).authority_intents[0].transaction.prior_journal, original.toString('base64'));
  fs.unlinkSync(controlPaths(f.previous, f).journal); assert.equal(recoverCommanderAuthority(f).status, 'COMPLETED');
});
check('missing journal after immutable seal stays blocked until explicit recovery', () => {
  const f = fixture();
  assert.throws(() => recoverCommanderAuthority({ ...f, fault: point => { if (point === 'after-seal') throw new Error('stop'); } }));
  const latest = readChain(f.sealDirectory).records.at(-1); fs.unlinkSync(controlPaths(latest, f).journal);
  assert.throws(() => assertControlReady(latest, f), /completion journal missing/);
  assert.equal(verifyChain(f.sealDirectory, f).control_status, 'BLOCKED');
  const draft = structuredClone(latest); delete draft.authority_recovery;
  Object.assign(draft, { schema_version: 4, event_id: 'synthetic-blocked-material', handoff_phase: 'MATERIAL_PREPARED', switch_status: 'READY', sealed_at: new Date().toISOString(), fact_cutoff: new Date().toISOString() });
  assert.throws(() => appendSeal(f.sealDirectory, draft, f), /completion journal missing/);
  assert.equal(recoverCommanderAuthority(f).status, 'COMPLETED');
  assert.equal(verifyChain(f.sealDirectory, f).control_status, 'READY');
  appendSeal(f.sealDirectory, draft, f); fs.unlinkSync(controlPaths(latest, f).journal);
  assert.equal(verifyChain(f.sealDirectory, f).control_status, 'BLOCKED');
  assert.throws(() => appendSeal(f.sealDirectory, { ...draft, event_id: 'synthetic-blocked-successor' }, f), /completion journal missing/);
  const before = readChain(f.sealDirectory).authority_intents[0].transaction.plan.map(item => hash(fs.readFileSync(path.join(f.sourceRoot, item.path_ref))));
  assert.equal(recoverCommanderAuthority(f).action, 'JOURNAL_REPAIRED_ONLY');
  assert.equal(verifyChain(f.sealDirectory, f).control_status, 'READY');
  assert.deepEqual(readChain(f.sealDirectory).authority_intents[0].transaction.plan.map(item => hash(fs.readFileSync(path.join(f.sourceRoot, item.path_ref)))), before);
  const completed = fs.readFileSync(controlPaths(latest, f).journal);
  for (const status of ['PREPARED', 'ROLLING_BACK_STOPPED']) {
    fs.writeFileSync(controlPaths(latest, f).journal, JSON.stringify({ protocol_version: 2, record_type: 'handoff-authority-recovery-transaction', intent_digest: '0'.repeat(64), event_id: 'another-event', status }));
    const bytes = fs.readFileSync(controlPaths(latest, f).journal);
    assert.throws(() => recoverCommanderAuthority(f), /journal replaced/); assert.deepEqual(fs.readFileSync(controlPaths(latest, f).journal), bytes);
  }
  fs.writeFileSync(controlPaths(latest, f).journal, completed);
  appendSeal(f.sealDirectory, { ...draft, event_id: 'synthetic-blocked-latest', switch_status: 'BLOCKED' }, f);
  fs.unlinkSync(controlPaths(latest, f).journal);
  const repaired = recoverCommanderAuthority(f);
  assert.equal(repaired.status, 'COMPLETED'); assert.equal(repaired.control_status, 'BLOCKED');
  assert.equal(readChain(f.sealDirectory).records.at(-1).switch_status, 'BLOCKED');
});
check('unrelated drift blocks forward but exact rollback still works', () => {
  const f = fixture(); assert.throws(() => recoverCommanderAuthority({ ...f, fault: point => { if (point === 'after-write-1') throw new Error('stop'); } }));
  fs.appendFileSync(path.join(f.sourceRoot, 'product.txt'), 'unrelated drift\n'); assert.throws(() => recoverCommanderAuthority(f), /workspace changed/);
  assert.equal(rollbackCommanderAuthority(f).status, 'ROLLED_BACK_STOPPED'); assert.match(fs.readFileSync(path.join(f.sourceRoot, 'product.txt'), 'utf8'), /unrelated drift/);
});
check('next normal material and takeover work after authority recovery', () => {
  const f = fixture(); recoverCommanderAuthority(f); const historicalJournal = fs.readFileSync(controlPaths(f.previous, f).journal), latest = readChain(f.sealDirectory).records.at(-1), draft = structuredClone(latest); delete draft.authority_recovery;
  Object.assign(draft, { schema_version: 4, event_id: 'synthetic-next-material', handoff_phase: 'MATERIAL_PREPARED', switch_status: 'READY', transition: null, migration: null, fact_cutoff: new Date().toISOString(), sealed_at: new Date().toISOString() });
  const material = appendSeal(f.sealDirectory, draft, f), recipient = { writerId: 'SYNTHETIC-FIVE', platformTaskId: platform(5), projectKey: 'SYNTHETIC' };
  const confirmation = { protocol_version: 1, origin: 'CURRENT_OPERATOR_MESSAGE', evidence_ref: 'synthetic-next-original-message', confirmed_at: new Date().toISOString(), project_key: 'SYNTHETIC', previous_seal_digest: material.seal_digest, old_generation: 4, old_writer_id: latest.writer_id, old_writer_status: 'STOPPED_DISPATCH', recipient_writer_id: recipient.writerId, recipient_platform_id: recipient.platformTaskId, scope: 'HANDOFF_PREPARE_COMMIT_ONLY', transfer_confirmed: true };
  assert.equal(takeoverHandoff({ ...f, recipient, confirmation, eventId: 'synthetic-next-takeover' }).generation, 5); assert.equal(verifyChain(f.sealDirectory, f).status, 'PASS'); preserved(f);
  const journal = controlPaths(material, f).journal, before = fs.readFileSync(journal);
  assert.throws(() => recoverCommanderAuthority(f), /later generation/); assert.deepEqual(fs.readFileSync(journal), before);
  fs.unlinkSync(journal); assert.throws(() => recoverCommanderAuthority(f), /later generation/); assert.equal(fs.existsSync(journal), false);
  fs.writeFileSync(journal, before);
  const previous = readChain(f.sealDirectory).records.at(-1), observation = structuredClone(previous);
  Object.assign(observation, { schema_version: 4, generation: 6, writer_id: 'SYNTHETIC-SIX', handoff_phase: 'MATERIAL_PREPARED', switch_status: 'READY', transition: null, migration: null, fact_cutoff: new Date().toISOString(), sealed_at: new Date().toISOString() });
  for (const name of ['status_index', 'central_work_items', 'current_view', 'central_entry']) {
    const file = path.join(f.sourceRoot, observation.sources[name].path_ref);
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replaceAll('SYNTHETIC-FIVE', 'SYNTHETIC-SIX').replaceAll(platform(5), platform(6)).replaceAll('"generation":5', '"generation":6').replaceAll('当前总指挥世代：5', '当前总指挥世代：6'));
  }
  for (const source of Object.values(observation.sources)) { source.digest = hash(fs.readFileSync(path.join(f.sourceRoot, source.path_ref))); source.fact_cutoff = observation.fact_cutoff; }
  observation.workspace = { ...observation.workspace, ...readGitWorkspaceBaseline(f.sourceRoot, ['result.txt']) };
  const diagnosis = verifyHandoffCandidate(f);
  assert.equal(diagnosis.status, 'BLOCKED'); assert(diagnosis.actions.some(action => action.includes('AUTHORITY_RECOVERY_REQUIRED')));
  const second = { ...f, observation, recipient: { writerId: 'SYNTHETIC-SEVEN', platformTaskId: platform(7), projectKey: 'SYNTHETIC' }, eventId: 'synthetic-second-authority', confirmation: { ...f.confirmation, evidence_ref: 'synthetic-second-operator-message', confirmed_at: new Date().toISOString(), previous_seal_digest: previous.seal_digest, observed_generation: 6, observed_writer_id: 'SYNTHETIC-SIX', observed_platform_id: platform(6), recipient_writer_id: 'SYNTHETIC-SEVEN', recipient_platform_id: platform(7) } };
  assert.throws(() => recoverCommanderAuthority({ ...second, fault: point => { if (point === 'after-seal') throw new Error('stop'); } }));
  const pending = fs.readFileSync(journal); fs.writeFileSync(journal, historicalJournal);
  assert.equal(verifyChain(f.sealDirectory, f).control_status, 'BLOCKED');
  assert.throws(() => assertControlReady(readChain(f.sealDirectory).records.at(-1), f), /current authority/);
  fs.writeFileSync(journal, pending); assert.equal(recoverCommanderAuthority(second).generation, 7);
});
console.log(`Authority recovery tests passed: ${passed}`);
