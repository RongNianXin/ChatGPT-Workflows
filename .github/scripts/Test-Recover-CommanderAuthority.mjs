import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import crypto from 'node:crypto';
import { appendSeal, appendCurrentMigrationSeal, authorityRequiredFiles, canonicalJson, inspectHistoricalRestrictedRecovery, HISTORICAL_UNVERIFIED, HISTORICAL_WORKSPACE_RESTRICTION, readChain, verifyChain, sealDigest, prepareTransition, planSealAppend, verifyControlIdentity, prepareAuthorityRecovery, withdrawAuthorityRecovery, authorityWithdrawalTime, controlOnlyContinuityErrors } from './HandoffSeal.mjs';
import { byteDigest as hash, controlPaths, assertControlReady } from './HandoffControl.mjs';
import { SCOPED_WORKSPACE_ALGORITHM, validWorkspaceFingerprint } from './HandoffWorkspaceScope.mjs';
import { readGitWorkspaceBaseline } from './Prepare-Handoff.mjs';
import { rebaseHandoffDraft } from './Rebase-Handoff-Draft.mjs';
import { takeoverHandoff, buildControlPlan } from './Takeover-Handoff.mjs';
import { captureTransactionWorkspace } from './HandoffTransactionWorkspace.mjs';
import { planAuthorityRecovery, recoverCommanderAuthority, rollbackCommanderAuthority, readCompletedAuthority } from './Recover-CommanderAuthority.mjs';
import { verifyHandoffCandidate } from './Verify-Handoff-Candidate.mjs';
import { adoptReceiverState, deriveReceiverAdoption } from './Receiver-State-Adoption.mjs';
import { fixture as receiverFixture } from './Test-Receiver-State-Adoption.mjs';
import { enterSyntheticSuite } from './SyntheticTestRuntime.mjs';
const synthetic = await enterSyntheticSuite(import.meta.url, { timeoutMs: 1800000 });

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), cache = path.join(root, '.codex-manual-cache');
assert.equal(synthetic.runSync('git', ['-C', root, 'check-ignore', '--quiet', '--', '.codex-manual-cache/authority-test']).status, 0);
fs.mkdirSync(cache, { recursive: true });
const temp = fs.mkdtempSync(path.join(cache, 'authority-'));
const workflowRoot = path.join(root, '总指挥工作流/第二代总指挥的工作模式'), manifestPath = path.join(workflowRoot, '规则刷新manifest.json');
const platform = n => `${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`;
let sequence = 0, passed = 0;
function fixture({ external = false, trackedEntry = false, unknownRemote = false, reservedWithdrawal = false, controlOnly = false, historicalInventory = false, historicalRemoteUnknown = false, inventoryMismatch = null, continuityEvidence = false, adoptionProjections = false, projectionMode = null } = {}) {
  const base = path.join(temp, String(++sequence)), sourceRoot = path.join(base, 'source'), externalControlPlaneRoot = external ? path.join(base, 'external') : undefined;
  fs.mkdirSync(sourceRoot, { recursive: true }); if (external) fs.mkdirSync(externalControlPlaneRoot);
  const git = args => { const result = synthetic.runSync('git', ['-C', sourceRoot, ...args], { encoding: 'utf8' }); assert.equal(result.status, 0, result.stderr); return result.stdout.trim(); };
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
  if (continuityEvidence) for (const name of ['specialist_ownership', 'workspace_preservation']) {
    const ref = `.control/${name}.json`, bytes = Buffer.from(`{"synthetic":"${name}"}\n`);
    fs.writeFileSync(path.join(sourceRoot, ref), bytes);
    sources[name] = { owner: 'synthetic', path_ref: ref, root_ref: 'source_root', digest: hash(bytes), fact_cutoff: stamp };
  }
  const adoptionRequired = [];
  // Legacy authority cases stop at control completion; adoption-specific cases
  // opt in explicitly, so adding valid projections does not change old scenes.
  const authorityOnlyFault = !adoptionProjections && projectionMode !== 'json-plan'
    ? { fault: point => { if (point === 'before-receiver-adoption') throw Error('preserve authority-only fixture'); } } : {};
  {
    fs.writeFileSync(path.join(sourceRoot, 'task_plan.md'), '<a id="current-plan"></a>\n# Current plan\n');
    fs.writeFileSync(path.join(sourceRoot, 'progress.md'), '# Progress Log\n\nHistorical note: # Progress Log was the original heading.\n');
    sources.task_contract = { owner: 'synthetic', root_ref: 'source_root', path_ref: 'task_plan.md',
      digest: hash(fs.readFileSync(path.join(sourceRoot, 'task_plan.md'))), fact_cutoff: stamp };
    if (adoptionProjections) adoptionRequired.push({ path_ref: 'progress.md', sha256: hash(fs.readFileSync(path.join(sourceRoot, 'progress.md'))), reason: 'required receiver progress' });
    else sources.progress = { owner: 'synthetic', root_ref: 'source_root', path_ref: 'progress.md',
      digest: hash(fs.readFileSync(path.join(sourceRoot, 'progress.md'))), fact_cutoff: stamp };
  }
  if (projectionMode === 'missing-progress') delete sources.progress;
  if (projectionMode?.startsWith('json')) {
    const ref = '.control/task-contract.json', bytes = Buffer.from('{"goal":"preserve contract"}\n');
    fs.writeFileSync(path.join(sourceRoot, ref), bytes);
    if (projectionMode === 'json-plan') sources.task_plan = { ...sources.task_contract };
    sources.task_contract = { ...sources.task_contract, path_ref: ref, digest: hash(bytes) };
  }

  const draft = { schema_version: 4, record_type: 'handoff-seal', generation: 1, writer_id: 'SYNTHETIC-ONE', old_writer_status: 'UNKNOWN', fact_cutoff: stamp, sealed_at: stamp, event_id: 'synthetic-initial-material', sources, source_digest_status: 'PASS', rule_baseline: { rule_version: JSON.parse(fs.readFileSync(manifestPath)).rule_version, manifest_sha256: hash(fs.readFileSync(manifestPath)) }, objective: { summary: 'synthetic preserved objective', breakpoint: 'synthetic checkpoint' }, prohibitions: ['remote-write', 'business-resume'], communications: { status: 'NONE' }, workspace: { root_ref: '<PROJECT_ROOT>', ...readGitWorkspaceBaseline(sourceRoot), required_untracked: [] }, remote: { status: 'PASS', default_ref: 'refs/heads/main', head: git(['rev-parse', 'HEAD']), observed_at: stamp }, restrictions: [], control_handoff_confidence: 'HIGH', candidate_verification_status: 'PASS', switch_status: 'READY', handoff_phase: 'MATERIAL_PREPARED', runtime_acceptance_status: 'NOT_RUN', professional_acceptance_status: 'NOT_RUN', transition: null, migration: null, invalidation_conditions: ['source drift'], seal_digest: '' };
  if (reservedWithdrawal) draft.event_id = 'synthetic-reserved:withdrawal';
  if (controlOnly) {
    fs.writeFileSync(path.join(sourceRoot, 'result.txt'), 'old required result\n');
    const required = ['result.txt', ...(!external ? ['.control/central_entry.md'] : []), ...adoptionRequired.map(item => item.path_ref)].map(ref => ({ path_ref: ref, sha256: hash(fs.readFileSync(path.join(sourceRoot, ref))), reason: 'preserve current evidence' }));
    draft.workspace = { root_ref: '<PROJECT_ROOT>', ...readGitWorkspaceBaseline(sourceRoot, required.map(f => f.path_ref)), required_untracked: required };
  }
  if (historicalInventory) {
    draft.rule_baseline = { rule_version: '2026-01-01.1', manifest_sha256: '1'.repeat(64) };
    if (historicalRemoteUnknown) {
      draft.remote = { ...draft.remote, status: 'UNKNOWN', head: null, observed_at: null };
      draft.restrictions = ['REMOTE_UNOBSERVED']; draft.switch_status = 'READY_WITH_RESTRICTIONS'; draft.candidate_verification_status = 'PASS_WITH_RESTRICTIONS';
    }
    const record = { record_type: 'handoff_inventory', generation: draft.generation, writer_id: draft.writer_id, platform_task_id: platform(1), rule_baseline: draft.rule_baseline, objective: draft.objective, remote: draft.remote };
    if (inventoryMismatch === 'rule') record.rule_baseline = { ...record.rule_baseline, rule_version: 'WRONG' };
    if (inventoryMismatch === 'generation') record.generation++;
    if (inventoryMismatch === 'platform') record.platform_task_id = platform(9);
    if (inventoryMismatch === 'remote') record.remote = { ...record.remote, head: '0'.repeat(40) };
    const ref = '.control/historical-inventory.json', bytes = Buffer.from(JSON.stringify(record));
    fs.writeFileSync(path.join(sourceRoot, ref), bytes);
    draft.sources.handoff_inventory = { owner: 'synthetic', path_ref: ref, root_ref: 'source_root', digest: hash(bytes), fact_cutoff: stamp };
  }
  if (adoptionRequired.length && !controlOnly) draft.workspace = { root_ref: '<PROJECT_ROOT>',
    ...readGitWorkspaceBaseline(sourceRoot, adoptionRequired.map(item => item.path_ref)), required_untracked: adoptionRequired };
  const sealDirectory = path.join(sourceRoot, '.control/seals');
  const first = appendSeal(sealDirectory, draft, { sourceRoot, externalControlPlaneRoot });
  if (controlOnly) {
    fs.appendFileSync(path.join(sourceRoot, 'product.txt'), 'accepted uncommitted result\n');
    git(['add', '--', 'product.txt']); git(['-c', 'user.name=Synthetic Test', '-c', 'user.email=test@example.invalid', 'commit', '--quiet', '-m', 'specialist result']);
    fs.appendFileSync(path.join(sourceRoot, 'product.txt'), 'new dirty result\n');
    fs.writeFileSync(path.join(sourceRoot, 'result.txt'), 'current required result\n');
    const observation = structuredClone(first); observation.fact_cutoff = observation.sealed_at = new Date().toISOString();
    if (historicalInventory) observation.rule_baseline = { rule_version: JSON.parse(fs.readFileSync(manifestPath)).rule_version, manifest_sha256: hash(fs.readFileSync(manifestPath)) };
    const required = first.workspace.required_untracked.map(f => ({ ...f, sha256: hash(fs.readFileSync(path.join(sourceRoot, f.path_ref))) }));
    observation.workspace = { root_ref: '<PROJECT_ROOT>', ...readGitWorkspaceBaseline(sourceRoot, required.map(f => f.path_ref)), required_untracked: required };
    observation.remote = { ...observation.remote, status: 'PASS', head: git(['rev-parse', 'HEAD']), observed_at: observation.fact_cutoff };
    observation.restrictions = []; observation.switch_status = 'READY'; observation.candidate_verification_status = 'PASS';
    if (unknownRemote) { git(['remote', 'remove', 'origin']); observation.remote = { ...observation.remote, status: 'UNKNOWN', head: null, observed_at: null }; observation.restrictions = ['REMOTE_UNOBSERVED']; observation.switch_status = 'READY_WITH_RESTRICTIONS'; }
    const recipient = { writerId: 'SYNTHETIC-TWO', platformTaskId: platform(2), projectKey: 'SYNTHETIC' };
    const confirmation = { protocol_version: 2, origin: 'CURRENT_OPERATOR_MESSAGE', evidence_ref: 'synthetic-control-only-original-message', confirmed_at: new Date().toISOString(), project_key: 'SYNTHETIC', previous_seal_digest: first.seal_digest, observed_generation: 1, observed_writer_id: first.writer_id, observed_platform_id: platform(1), old_writer_status: 'STOPPED_DISPATCH', recipient_writer_id: recipient.writerId, recipient_platform_id: recipient.platformTaskId, scope: 'CONTROL_ONLY_TAKEOVER', transfer_confirmed: true, unique_writer_confirmed: true, historical_workspace: 'ACKNOWLEDGED_NOT_CERTIFIED' };
    return { sourceRoot, externalControlPlaneRoot, sealDirectory, workflowRoot, manifestPath, observation, recipient, confirmation, eventId: 'synthetic-control-only', previous: first, historyBytes: fs.readdirSync(sealDirectory).map(file => [file, hash(fs.readFileSync(path.join(sealDirectory, file)))]), git,
      receiverStateRoot: path.join(sourceRoot, '.control/adoption'), ...authorityOnlyFault };
  }
  const oldRecipient = { writerId: 'SYNTHETIC-TWO', platformTaskId: platform(2), projectKey: 'SYNTHETIC' };
  const oldConfirmation = { protocol_version: 1, origin: 'CURRENT_OPERATOR_MESSAGE', evidence_ref: 'synthetic-old-original-message', confirmed_at: new Date().toISOString(), project_key: 'SYNTHETIC', previous_seal_digest: first.seal_digest, old_generation: 1, old_writer_id: first.writer_id, old_writer_status: 'STOPPED_DISPATCH', recipient_writer_id: oldRecipient.writerId, recipient_platform_id: oldRecipient.platformTaskId, scope: 'HANDOFF_PREPARE_COMMIT_ONLY', transfer_confirmed: true };
  const baseOptions = { sourceRoot, externalControlPlaneRoot, sealDirectory, workflowRoot, manifestPath,
    receiverStateRoot: path.join(sourceRoot, '.control/adoption'), ...authorityOnlyFault };
  takeoverHandoff({ ...baseOptions, recipient: oldRecipient, confirmation: oldConfirmation, eventId: 'synthetic-original-takeover',
    fault: point => { if (point === 'before-receiver-adoption') throw Error('preserve historical control-only fixture'); } });
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
const resumeAt = process.argv.indexOf('--from-check');
const resumeName = resumeAt < 0 ? null : process.argv[resumeAt + 1];
assert.ok(resumeAt < 0 || resumeName, 'missing --from-check name');
let resumeReached = resumeAt < 0;
function check(name, run) { if (!resumeReached) { if (name !== resumeName) return; resumeReached = true; } if (process.argv.includes('--authority-only') && name.startsWith('receiver ')) return; if (process.argv.includes('--readiness') && !name.startsWith('receiver readiness')) return; if (process.argv.includes('--adoption-hardening') && !name.startsWith('receiver adoption hardening')) return; if (process.argv.includes('--adoption-continuity') && !name.startsWith('receiver adoption')) return; if (process.argv.includes('--journal-continuity') && !name.startsWith('new material')) return; if (process.argv.includes('--migration-only') && !name.startsWith('restricted schema-5')) return; if (process.argv.includes('--control-only') && !name.startsWith('control-only') && !name.startsWith('restricted schema-5')) return; if (process.argv.includes('--inventory') && !name.startsWith('control-only inventory')) return; run(); passed++; console.log(`PASS: ${name}`); }
function completedAdoptionFixture() {
  const f = fixture({ controlOnly: true, adoptionProjections: true });
  const result = recoverCommanderAuthority({ ...f, fault: point => { if (point === 'before-receiver-adoption') throw Error('defer adoption'); } });
  assert.equal(result.control_handoff, 'COMPLETED');
  assert.equal(result.receiver_adoption.status, 'BLOCKED');
  const completed = readChain(f.sealDirectory).records.at(-1);
  assert.equal(completed.handoff_phase, 'AUTHORITY_RECOVERY_COMPLETED');
  return { ...f, completed };
}
function isolatedRules(f) {
  const repository = path.join(path.dirname(f.sourceRoot), 'rules');
  const ruleRoot = path.join(repository, '总指挥工作流/第二代总指挥的工作模式');
  const manifest = JSON.parse(fs.readFileSync(manifestPath));
  for (const item of manifest.rules) {
    const repositoryPath = manifest.repository_root_prefixes.some(prefix => item.path_ref.startsWith(prefix));
    const relative = repositoryPath ? item.path_ref : path.join('总指挥工作流/第二代总指挥的工作模式', item.path_ref);
    const from = path.resolve(repositoryPath ? root : workflowRoot, item.path_ref);
    const to = path.join(repository, relative);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
  }
  const newManifest = path.join(ruleRoot, '规则刷新manifest.json');
  manifest.rule_version += '.synthetic-adoption';
  fs.writeFileSync(newManifest, JSON.stringify(manifest, null, 2) + '\n');
  for (const args of [['init', '--quiet'], ['add', '--', '.github/scripts/HandoffSeal.mjs', '.github/scripts/Prepare-Handoff.mjs']]) {
    const result = synthetic.runSync('git', ['-C', repository, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
  return { workflowRoot: ruleRoot, manifestPath: newManifest,
    rule_version: manifest.rule_version, manifest_sha256: hash(fs.readFileSync(newManifest)) };
}
function independentlyLoaded(f, rules) {
  return { status: 'INDEPENDENTLY_LOADED', project_key: f.recipient.projectKey,
    writer_id: f.recipient.writerId, platform_task_id: f.recipient.platformTaskId,
    event_id: f.completed.event_id, completed_seal_digest: f.completed.seal_digest,
    rule_version: rules.rule_version, manifest_sha256: rules.manifest_sha256,
    loaded_at: new Date().toISOString() };
}
check('receiver readiness checks control-only before authority intent or journal writes', () => {
  for (const projectionMode of ['missing-progress', 'json']) {
    const f = fixture({ controlOnly: true, projectionMode });
    const before = fs.readFileSync(path.join(f.sourceRoot, '.control/status_index.md'));
    const entries = fs.readdirSync(f.sealDirectory).sort();
    assert.throws(() => recoverCommanderAuthority(f), /receiver readiness/);
    assert.deepEqual(fs.readdirSync(f.sealDirectory).sort(), entries);
    assert.deepEqual(fs.readFileSync(path.join(f.sourceRoot, '.control/status_index.md')), before);
    assert.equal(fs.existsSync(controlPaths(f.previous, f).journal), false);
  }
  const f = fixture({ controlOnly: true, projectionMode: 'json-plan' });
  for (const adoption of [{ expected_event_id: 'wrong-event' }, { expected_completed_seal_digest: '0'.repeat(64) }, { rule_loading: { status: 'INVALID' } }]) {
    assert.throws(() => recoverCommanderAuthority({ ...f, adoption }), /new authority recovery requires automatic binding/);
    assert.equal(readChain(f.sealDirectory).authority_intents.length, 0);
    assert.equal(fs.existsSync(controlPaths(f.previous, f).journal), false);
  }
  const original = fs.readFileSync(path.join(f.sourceRoot, '.control/task-contract.json'));
  const result = recoverCommanderAuthority(f);
  assert.equal(result.receiver_adoption.status, 'COMPLETED', JSON.stringify(result));
  assert.equal(readCompletedAuthority(f).writes, 0);
  assert.equal(recoverCommanderAuthority(f).receiver_adoption.writes, 0);
  assert.deepEqual(fs.readFileSync(path.join(f.sourceRoot, '.control/task-contract.json')), original);
  assert.ok(readChain(f.sealDirectory).records.at(-1).restrictions.includes(HISTORICAL_WORKSPACE_RESTRICTION));
});
check('receiver adoption derives heading and protected required progress without resealing authority', () => {
  const f = fixture({ controlOnly: true, adoptionProjections: true });
  const result = recoverCommanderAuthority(f);
  assert.equal(result.receiver_adoption.status, 'COMPLETED', JSON.stringify(result.receiver_adoption));
  assert.equal(result.generation, 2);
  assert.equal(readCompletedAuthority(f).writes, 0);
  assert.equal(recoverCommanderAuthority(f).receiver_adoption.writes, 0);
  const history = readChain(f.sealDirectory);
  assert.equal(history.records.filter(item => item.handoff_phase === 'AUTHORITY_RECOVERY_COMPLETED').length, 1);
  assert.equal(history.records.at(-1).sources.progress, undefined);
  assert.ok(history.records.at(-1).restrictions.includes(HISTORICAL_WORKSPACE_RESTRICTION));
});
check('receiver adoption keeps frozen authority while independently adopting newer verified rules', () => {
  const f = completedAdoptionFixture(), rules = isolatedRules(f);
  const frozen = canonicalJson(f.observation), authority = readChain(f.sealDirectory);
  const immutable = fs.readdirSync(f.sealDirectory).map(name => [name, hash(fs.readFileSync(path.join(f.sealDirectory, name)))]);
  const journal = controlPaths(f.completed, f).journal, journalBefore = fs.readFileSync(journal);
  const adoption = deriveReceiverAdoption(f, f.completed);
  const upgraded = { ...f, ...rules, adoption };
  const missing = recoverCommanderAuthority(upgraded);
  assert.equal(missing.receiver_adoption.status, 'BLOCKED');
  assert.match(missing.receiver_adoption.error, /independent.*rule|rule.*loading/i);
  adoption.rule_loading = independentlyLoaded(f, rules);
  const accepted = recoverCommanderAuthority(upgraded);
  assert.equal(accepted.receiver_adoption.status, 'COMPLETED', JSON.stringify(accepted.receiver_adoption));
  assert.equal(accepted.generation, f.completed.generation);
  const latest = readChain(f.sealDirectory).records.at(-1);
  assert.equal(latest.rule_baseline.manifest_sha256, rules.manifest_sha256);
  const loaded = JSON.parse(fs.readFileSync(path.join(f.sourceRoot, adoption.loading_record.path_ref)));
  assert.equal(loaded.manifest_sha256, rules.manifest_sha256);
  assert.deepEqual(loaded.authority_rule_baseline, f.completed.rule_baseline);
  assert.equal(readCompletedAuthority(upgraded).status, 'POST_COMMIT_READBACK_READY');
  assert.equal(recoverCommanderAuthority(upgraded).receiver_adoption.writes, 0);
  assert.equal(canonicalJson(f.observation), frozen);
  assert.deepEqual(fs.readFileSync(journal), journalBefore);
  for (const [name, digest] of immutable) assert.equal(hash(fs.readFileSync(path.join(f.sealDirectory, name))), digest);
  assert.equal(readChain(f.sealDirectory).records.length, authority.records.length + 1);
  assert.equal(verifyChain(f.sealDirectory, upgraded).status, 'PASS');
});
check('receiver adoption rejects changed loading evidence, target binding, and unfinished rule drift', () => {
  const f = completedAdoptionFixture(), rules = isolatedRules(f);
  const adoption = deriveReceiverAdoption(f, f.completed);
  adoption.rule_loading = independentlyLoaded(f, rules);
  const upgraded = { ...f, ...rules, adoption };
  const variants = [
    value => { value.rule_loading.manifest_sha256 = '0'.repeat(64); },
    value => { value.rule_loading.writer_id = 'SYNTHETIC-WRONG'; },
    value => { value.rule_loading.platform_task_id = platform(99); },
    value => { value.rule_loading.project_key = 'SYNTHETIC-WRONG'; },
    value => { value.rule_loading.loaded_at = 'invalid'; },
    value => { value.targets.find(item => item.kind === 'progress').expected_sha256 = '0'.repeat(64); },
    value => { value.targets.find(item => item.kind === 'progress').path_ref = 'result.txt'; },
    value => { value.targets.find(item => item.kind === 'progress').root_ref = 'external_control_plane'; }
  ];
  for (const change of variants) {
    const value = structuredClone(adoption); change(value);
    const before = fs.readFileSync(path.join(f.sourceRoot, 'progress.md'));
    assert.equal(recoverCommanderAuthority({ ...upgraded, adoption: value }).receiver_adoption.status, 'BLOCKED');
    assert.deepEqual(fs.readFileSync(path.join(f.sourceRoot, 'progress.md')), before);
  }
  const interrupted = recoverCommanderAuthority({ ...upgraded, fault: point => {
    if (point === 'after-adoption-write-0') throw new Error('synthetic adoption interruption');
  } });
  assert.equal(interrupted.receiver_adoption.status, 'BLOCKED');
  const changedManifest = JSON.parse(fs.readFileSync(rules.manifestPath));
  changedManifest.rule_version += '.drift';
  fs.writeFileSync(rules.manifestPath, JSON.stringify(changedManifest, null, 2) + '\n');
  assert.equal(recoverCommanderAuthority(upgraded).receiver_adoption.status, 'BLOCKED');
  const restored = { ...changedManifest, rule_version: rules.rule_version };
  fs.writeFileSync(rules.manifestPath, JSON.stringify(restored, null, 2) + '\n');
  assert.equal(recoverCommanderAuthority(upgraded).receiver_adoption.status, 'COMPLETED');
  assert.equal(readCompletedAuthority(upgraded).writes, 0);
  assert.throws(() => readCompletedAuthority({ ...upgraded, adoption: { ...adoption, rule_loading: { ...adoption.rule_loading, writer_id: 'SYNTHETIC-WRONG' } } }), /loading|baseline|record/i);
  const required = fixture({ controlOnly: true, adoptionProjections: true });
  required.observation.workspace.required_untracked.push({ ...required.observation.workspace.required_untracked.find(item => item.path_ref === 'progress.md') });
  assert.throws(() => planAuthorityRecovery(required), /duplicate|required|fingerprint/i);
});
check('receiver adoption hardening preserves unrelated worktree and index changes after projection writes', () => {
  for (const staged of [false, true]) {
    const f = completedAdoptionFixture();
    const adoption = deriveReceiverAdoption(f, f.completed);
    const before = fs.readFileSync(path.join(f.sourceRoot, 'progress.md'));
    const result = recoverCommanderAuthority({ ...f, adoption, fault: point => {
      if (point !== 'after-adoption-write-4') return;
      fs.appendFileSync(path.join(f.sourceRoot, 'product.txt'), 'independent concurrent work\n');
      if (staged) f.git(['add', '--', 'product.txt']);
    } });
    assert.equal(result.receiver_adoption.status, 'BLOCKED', 'unrelated write must not be absorbed into adoption');
    assert.match(result.receiver_adoption.error, /workspace changed during transaction/);
    assert.equal(readChain(f.sealDirectory).records.at(-1).seal_digest, f.completed.seal_digest);
    assert.deepEqual(fs.readFileSync(path.join(f.sourceRoot, 'progress.md')), before);
    assert.match(fs.readFileSync(path.join(f.sourceRoot, 'product.txt'), 'utf8'), /independent concurrent work/);
    if (staged) assert.match(f.git(['diff', '--cached', '--', 'product.txt']), /independent concurrent work/);
  }
});
check('receiver adoption hardening binds loading to event and rejects unknown journal protocols', () => {
  const f = completedAdoptionFixture(), rules = isolatedRules(f);
  const adoption = deriveReceiverAdoption(f, f.completed);
  adoption.rule_loading = independentlyLoaded(f, rules);
  for (const field of ['event_id', 'completed_seal_digest']) {
    const wrong = structuredClone(adoption);
    wrong.rule_loading[field] = field === 'event_id' ? 'synthetic-wrong-event' : '0'.repeat(64);
    assert.equal(recoverCommanderAuthority({ ...f, ...rules, adoption: wrong }).receiver_adoption.status, 'BLOCKED');
  }
  const interrupted = recoverCommanderAuthority({ ...f, ...rules, adoption, fault: point => {
    if (point === 'after-adoption-write-0') throw new Error('synthetic prepared plan');
  } });
  assert.equal(interrupted.receiver_adoption.status, 'BLOCKED');
  const journalFile = path.join(f.sourceRoot, adoption.directory, 'receiver-state-adoption.json');
  const journal = JSON.parse(fs.readFileSync(journalFile));
  journal.protocol_version = 999;
  fs.writeFileSync(journalFile, JSON.stringify(journal, null, 2) + '\n');
  const rejected = recoverCommanderAuthority({ ...f, ...rules, adoption });
  assert.equal(rejected.receiver_adoption.status, 'BLOCKED');
  assert.match(rejected.receiver_adoption.error, /protocol/);
});
check('receiver adoption hardening compares the complete frozen draft before exception-time journal completion', () => {
  const f = completedAdoptionFixture(), adoption = deriveReceiverAdoption(f, f.completed);
  const result = recoverCommanderAuthority({ ...f, adoption, fault: point => {
    if (point !== 'after-adoption-attestation') return;
    const seal = readChain(f.sealDirectory).records.at(-1);
    const oldFile = path.join(f.sealDirectory, `handoff-state.${seal.seal_sequence}.${seal.seal_digest}.json`);
    seal.objective.summary = 'synthetic substituted attestation';
    seal.seal_digest = sealDigest(seal);
    fs.writeFileSync(path.join(f.sealDirectory, `handoff-state.${seal.seal_sequence}.${seal.seal_digest}.json`), JSON.stringify(seal, null, 2) + '\n');
    fs.unlinkSync(oldFile);
    throw new Error('synthetic substituted attestation interruption');
  } });
  assert.equal(result.receiver_adoption.status, 'BLOCKED');
  const journal = JSON.parse(fs.readFileSync(path.join(f.sourceRoot, adoption.directory, 'receiver-state-adoption.json')));
  assert.notEqual(journal.status, 'COMMITTED', 'matching event alone must not certify the substituted draft');
});
check('receiver adoption preserves protocol-2 automatic and explicit same-baseline readback', () => {
  const f = receiverFixture();
  assert.equal(takeoverHandoff({ ...f, fault: point => { if (point === 'before-receiver-adoption') throw Error('defer adoption'); } }).receiver_adoption.status, 'BLOCKED');
  const completed = readChain(f.sealDirectory).records.at(-1);
  const adoption = deriveReceiverAdoption(f, completed);
  for (const target of adoption.targets) delete target.anchor_mode;
  assert.equal(adoptReceiverState({ ...f, adoption }).status, 'COMPLETED');
  const file = path.join(f.sourceRoot, adoption.directory, 'receiver-state-adoption.json');
  const journal = JSON.parse(fs.readFileSync(file));
  journal.protocol_version = 2;
  fs.writeFileSync(file, JSON.stringify(journal, null, 2) + '\n');
  assert.equal(takeoverHandoff({ ...f, adoption }).receiver_adoption.writes, 0);
  assert.equal(takeoverHandoff(f).receiver_adoption.writes, 0);
  assert.equal(readCompletedAuthority({ ...f, adoption }).writes, 0);
});
check('receiver adoption resumes hard exits before and after a new-rule attestation without changing authority', () => {
  for (const point of [4, 5]) {
    const f = completedAdoptionFixture(), rules = isolatedRules(f);
    const adoption = deriveReceiverAdoption(f, f.completed);
    adoption.rule_loading = independentlyLoaded(f, rules);
    const upgraded = { ...f, ...rules, adoption };
    const configPath = path.join(f.sourceRoot, '.control/adoption-crash.json');
    fs.writeFileSync(configPath, JSON.stringify({ ...upgraded, crashPoint: point }));
    const child = synthetic.runSync(process.execPath,
      [path.join(root, '.github/scripts/Test-Receiver-State-Adoption.mjs'), '--crash-child', configPath],
      { encoding: 'utf8', timeout: 60000 });
    assert.equal(child.status, 81, child.stderr);
    for (const lock of [controlPaths(f.completed, f).lock,
      path.join(f.sourceRoot, adoption.directory, '.receiver-state-adoption.lock')]) {
      if (fs.existsSync(lock)) {
        assert.equal(JSON.parse(fs.readFileSync(lock)).pid, child.pid);
        fs.unlinkSync(lock);
      }
    }
    const before = canonicalJson(f.observation);
    const resumed = recoverCommanderAuthority(upgraded);
    assert.equal(resumed.receiver_adoption.status, 'COMPLETED', JSON.stringify(resumed.receiver_adoption));
    assert.equal(readCompletedAuthority(upgraded).writes, 0);
    assert.equal(recoverCommanderAuthority(upgraded).receiver_adoption.writes, 0);
    assert.equal(canonicalJson(f.observation), before);
    assert.equal(readChain(f.sealDirectory).records.filter(item => item.handoff_phase === 'AUTHORITY_RECOVERY_COMPLETED').length, 1);
  }
});
function freshMaterialAfterAuthority() {
  const f = fixture({ controlOnly: true, continuityEvidence: true });
  assert.equal(recoverCommanderAuthority({ ...f, fault: point => {
    if (point === 'before-receiver-adoption') throw Error('preserve historical authority fixture');
  } }).status, 'COMPLETED');
  const oldHistory = readChain(f.sealDirectory), completed = oldHistory.records.at(-1);
  const journalPath = controlPaths(completed, f).journal, journalBytes = fs.readFileSync(journalPath);
  const journal = JSON.parse(journalBytes), oldDirectory = f.sealDirectory;
  // Legitimate same-writer progress makes the old live sources stale. The old
  // immutable completion still certifies identity, not current source bytes.
  fs.appendFileSync(path.join(f.sourceRoot, completed.sources.current_view.path_ref), 'same writer progress\n');
  const material = structuredClone(completed), stamp = new Date().toISOString();
  delete material.authority_recovery;
  delete material.sources.workspace_preservation;
  Object.assign(material, { schema_version: 4, handoff_phase: 'MATERIAL_PREPARED',
    event_id: 'synthetic-fresh-material', switch_status: 'READY_WITH_RESTRICTIONS',
    candidate_verification_status: 'PASS_WITH_RESTRICTIONS', fact_cutoff: stamp, sealed_at: stamp,
    transition: null, migration: null, seal_digest: '' });
  for (const source of Object.values(material.sources)) {
    source.digest = hash(fs.readFileSync(path.join(f.sourceRoot, source.path_ref)));
    source.fact_cutoff = stamp;
  }
  material.workspace = { ...material.workspace, ...readGitWorkspaceBaseline(f.sourceRoot,
    material.workspace.required_untracked.map(item => item.path_ref)) };
  const sealDirectory = path.join(f.sourceRoot, '.control/fresh-material');
  const first = appendSeal(sealDirectory, material, f);
  const recipient = { writerId: 'SYNTHETIC-THREE', platformTaskId: platform(3), projectKey: 'SYNTHETIC' };
  const confirmation = { ...f.confirmation, evidence_ref: 'synthetic-next-current-operator',
    confirmed_at: new Date().toISOString(), previous_seal_digest: first.seal_digest,
    observed_generation: first.generation, observed_writer_id: first.writer_id,
    observed_platform_id: f.recipient.platformTaskId,
    recipient_writer_id: recipient.writerId, recipient_platform_id: recipient.platformTaskId };
  const options = { ...f, sealDirectory, previous: first, observation: first, recipient,
    confirmation, eventId: 'synthetic-next-control-only' };
  return { options, completed, oldDirectory, oldHistory, journalPath, journalBytes, journal };
}
check('new material continues a verified completed authority without replaying the old event', () => {
  const f = freshMaterialAfterAuthority(), { options } = f;
  assert.deepEqual(readChain(f.oldDirectory).errors, []);
  assert.equal(verifyChain(f.oldDirectory, options).latest_source_status, 'FAIL');
  const plan = planAuthorityRecovery(options);
  assert.equal(plan.transaction.prior_journal, f.journalBytes.toString('base64'));
  assert.deepEqual(fs.readFileSync(f.journalPath), f.journalBytes);
  const oldBytes = fs.readdirSync(f.oldDirectory).map(name => [name, hash(fs.readFileSync(path.join(f.oldDirectory, name)))]);
  const result = recoverCommanderAuthority(options);
  assert.equal(result.status, 'COMPLETED');
  assert.equal(result.generation, f.completed.generation + 1);
  assert.equal(result.business_resume_allowed, false);
  const after = readChain(options.sealDirectory);
  assert.equal(after.authority_intents.length, 1);
  assert.equal(after.authority_intents[0].transaction.prior_journal, f.journalBytes.toString('base64'));
  assert.equal(after.records.filter(item => item.event_id === options.eventId).length, 1);
  assert.equal(recoverCommanderAuthority(options).generation, result.generation);
  assert.equal(readChain(options.sealDirectory).records.length, after.records.length);
  assert.deepEqual(fs.readdirSync(f.oldDirectory).map(name => [name, hash(fs.readFileSync(path.join(f.oldDirectory, name)))]), oldBytes);
});
check('new material rejects wrong anchors, stale evidence and replay without control writes', () => {
  const f = freshMaterialAfterAuthority(), { options } = f;
  const originalFiles = fs.readdirSync(f.oldDirectory).map(name => [name, hash(fs.readFileSync(path.join(f.oldDirectory, name)))]);
  let rejected = 0;
  const reject = (label, value, pattern) => {
    assert.throws(() => planAuthorityRecovery(value), pattern);
    assert.deepEqual(fs.readFileSync(f.journalPath), f.journalBytes);
    assert.equal(readChain(options.sealDirectory).authority_intents.length, 0);
    rejected++;
    console.log(`PASS: new material rejection: ${label}`);
  };
  const temporarily = (file, bytes, run) => {
    const before = fs.readFileSync(file);
    try { fs.writeFileSync(file, bytes); run(); } finally { fs.writeFileSync(file, before); }
  };
  const withMaterial = (change, run) => {
    const original = options.previous, material = structuredClone(original);
    change(material); material.seal_digest = sealDigest(material);
    const oldFile = path.join(options.sealDirectory, `handoff-state.1.${original.seal_digest}.json`);
    const newFile = path.join(options.sealDirectory, `handoff-state.1.${material.seal_digest}.json`);
    const bytes = fs.readFileSync(oldFile);
    fs.unlinkSync(oldFile);
    try {
      fs.writeFileSync(newFile, JSON.stringify(material));
      run({ ...options, observation: material, confirmation: { ...options.confirmation,
        previous_seal_digest: material.seal_digest } });
    } finally { fs.unlinkSync(newFile); fs.writeFileSync(oldFile, bytes); }
  };
  reject('different project', { ...options, recipient: { ...options.recipient, projectKey: 'OTHER' },
    confirmation: { ...options.confirmation, project_key: 'OTHER' } }, /project mismatch/);
  reject('different observed platform', { ...options,
    confirmation: { ...options.confirmation, observed_platform_id: platform(9) } }, /current identity mismatch/);
  const oldCompletion = path.join(f.oldDirectory, `handoff-state.${f.completed.seal_sequence}.${f.completed.seal_digest}.json`);
  const oldIntent = path.join(options.sourceRoot, f.journal.intent_source.path_ref);
  temporarily(oldCompletion, JSON.stringify({ ...f.completed, event_id: 'tampered' }), () =>
    reject('tampered immutable completion', options, /completion evidence/));
  temporarily(oldIntent, JSON.stringify({ ...JSON.parse(fs.readFileSync(oldIntent)), event_id: 'tampered' }), () =>
    reject('tampered immutable intent', options, /completion evidence/));
  temporarily(f.journalPath, JSON.stringify({ ...f.journal, status: 'PREPARED' }), () => {
    assert.throws(() => planAuthorityRecovery(options), /not settled/); rejected++;
  });
  const predecessor = f.oldHistory.records[0];
  const oldPredecessor = path.join(f.oldDirectory, `handoff-state.${predecessor.seal_sequence}.${predecessor.seal_digest}.json`);
  temporarily(oldPredecessor, JSON.stringify({ ...predecessor, event_id: 'tampered' }), () =>
    reject('broken prior chain', options, /authority history invalid/));
  reject('previous completed event replay', { ...options, eventId: f.journal.event_id }, /previous event cannot be replayed/);
  const alias = '.control/alias-current-view.md';
  fs.copyFileSync(path.join(options.sourceRoot, options.previous.sources.current_view.path_ref), path.join(options.sourceRoot, alias));
  withMaterial(material => { material.sources.current_view.path_ref = alias; }, value =>
    reject('moved canonical source', value, /canonical source moved/));
  withMaterial(material => { material.restrictions = material.restrictions.filter(item => !item.startsWith('HISTORICAL_')); },
    value => reject('dropped historical restriction', value, /historical restriction was dropped/));
  withMaterial(material => { delete material.sources.specialist_ownership; },
    value => reject('dropped noncentral source', value, /prior source binding lost/));
  withMaterial(material => { material.workspace.required_untracked = material.workspace.required_untracked.filter(item => item.path_ref !== 'result.txt'); },
    value => reject('dropped necessary file', value, /prior required file lost/));
  const archivedSnapshot = path.join(options.sourceRoot, f.completed.sources.workspace_preservation.path_ref);
  temporarily(archivedSnapshot, '{"tampered":true}\n', () =>
    reject('changed archived snapshot evidence', options, /archived snapshot evidence changed/));
  withMaterial(material => {
    material.fact_cutoff = material.sealed_at = '2026-01-01T00:00:00.000Z';
    material.remote.observed_at = material.fact_cutoff;
    for (const source of Object.values(material.sources)) source.fact_cutoff = material.fact_cutoff;
  }, value => reject('material before prior completion', value, /material precedes authority completion/));
  const currentView = path.join(options.sourceRoot, options.previous.sources.current_view.path_ref);
  temporarily(currentView, fs.readFileSync(currentView, 'utf8') + 'unobserved source drift\n', () =>
    reject('current source drift', options, /digest mismatch/));
  const product = path.join(options.sourceRoot, 'product.txt');
  temporarily(product, fs.readFileSync(product, 'utf8') + 'unobserved workspace drift\n', () =>
    reject('current workspace drift', options, /workspace|fingerprint|diff/i));
  reject('remote HEAD drift', { ...options,
    observation: { ...options.observation, remote: { ...options.observation.remote, head: 'f'.repeat(40) } } },
  /remote observation changed/);
  const beforeAppend = new Set(fs.readdirSync(f.oldDirectory));
  try {
    const attestation = { ...structuredClone(options.previous), event_id: 'synthetic-old-chain-current',
      handoff_phase: 'CURRENT_ATTESTATION', switch_status: 'COMPLETED' };
    appendSeal(f.oldDirectory, attestation, options);
    reject('later prior-chain evidence', options, /not the latest authority evidence/);
    const next = appendSeal(f.oldDirectory, { ...structuredClone(options.previous), event_id: 'synthetic-old-chain-material' }, options);
    const priorOptions = { ...options, sealDirectory: f.oldDirectory, observation: next,
      confirmation: { ...options.confirmation, previous_seal_digest: next.seal_digest } };
    const plan = planAuthorityRecovery(priorOptions);
    prepareAuthorityRecovery(f.oldDirectory, plan.transaction, { ...priorOptions, expectedPreviousDigest: next.seal_digest });
    reject('unsettled prior authority intent', options, /previous authority event is unsettled/);
  } finally {
    for (const name of fs.readdirSync(f.oldDirectory)) if (!beforeAppend.has(name)) fs.unlinkSync(path.join(f.oldDirectory, name));
  }
  assert.deepEqual(fs.readdirSync(f.oldDirectory).map(name => [name, hash(fs.readFileSync(path.join(f.oldDirectory, name)))]), originalFiles);
  assert.deepEqual(fs.readFileSync(f.journalPath), f.journalBytes);
  console.log(`New material continuity rejected ${rejected} counterexamples; immutable originals and completed journal preserved.`);
});
check('new material retains old-chain withdrawal authorization and reserved event constraints', () => {
  const f = freshMaterialAfterAuthority(), { options } = f;
  const saved = Object.values(f.completed.sources).map(source => {
    const file = path.join(options.sourceRoot, source.path_ref);
    return { file, bytes: fs.readFileSync(file) };
  });
  const observation = structuredClone(options.observation), stamp = new Date().toISOString();
  Object.assign(observation, { generation: f.completed.generation + 1, writer_id: 'SYNTHETIC-UNPROVED',
    fact_cutoff: stamp, sealed_at: stamp });
  // Recreate an independently observed, subsequently withdrawn legacy attempt.
  // Restoring the earlier CURRENT and journal is an attack input, not recovery.
  for (const name of ['status_index', 'central_work_items', 'current_view', 'central_entry']) {
    const file = path.join(options.sourceRoot, observation.sources[name].path_ref);
    const text = fs.readFileSync(file, 'utf8').replaceAll(f.completed.writer_id, observation.writer_id)
      .replaceAll(platform(2), platform(9)).replaceAll('"generation":2', '"generation":3')
      .replaceAll('当前总指挥世代：2', '当前总指挥世代：3');
    fs.writeFileSync(file, text);
  }
  for (const source of Object.values(observation.sources)) {
    source.digest = hash(fs.readFileSync(path.join(options.sourceRoot, source.path_ref))); source.fact_cutoff = stamp;
  }
  for (const item of observation.workspace.required_untracked) item.sha256 = hash(fs.readFileSync(path.join(options.sourceRoot, item.path_ref)));
  observation.workspace = { ...observation.workspace, ...readGitWorkspaceBaseline(options.sourceRoot,
    observation.workspace.required_untracked.map(item => item.path_ref)) };
  observation.seal_digest = sealDigest(observation);
  const recipient = { writerId: 'SYNTHETIC-FOUR', platformTaskId: platform(4), projectKey: 'SYNTHETIC' };
  const confirmation = { ...options.confirmation, protocol_version: 1, scope: 'AUTHORITY_RECOVERY_ONLY',
    previous_seal_digest: f.completed.seal_digest, observed_generation: observation.generation,
    observed_writer_id: observation.writer_id, observed_platform_id: platform(9),
    recipient_writer_id: recipient.writerId, recipient_platform_id: recipient.platformTaskId,
    confirmed_at: stamp, unproved_transition: 'ACKNOWLEDGED_NOT_CERTIFIED' };
  delete confirmation.historical_workspace;
  const legacy = { ...options, observation, recipient, confirmation, sealDirectory: f.oldDirectory,
    eventId: 'synthetic-withdrawn-before-fresh-chain' };
  const plan = buildControlPlan(observation, legacy, 6);
  const transaction = { observation, recipient, confirmation, plan,
    workspace_projection: captureTransactionWorkspace(observation, plan, legacy),
    prior_journal: f.journalBytes.toString('base64') };
  const prepared = prepareAuthorityRecovery(f.oldDirectory, transaction, { ...legacy, expectedPreviousDigest: f.completed.seal_digest });
  withdrawAuthorityRecovery(f.oldDirectory, prepared.record, legacy);
  for (const item of saved) fs.writeFileSync(item.file, item.bytes);
  const oldHistory = readChain(f.oldDirectory);
  assert.deepEqual(oldHistory.errors, []);
  assert.equal(oldHistory.pending_authority_recoveries.length, 0);
  assert.equal(oldHistory.records.at(-1).seal_digest, f.completed.seal_digest);
  assert.equal(oldHistory.authority_withdrawals.length, 1);
  assert.throws(() => planAuthorityRecovery(options), /new current operator authorization and fresh observation/);
  const freshAt = new Date(Date.parse(oldHistory.authority_withdrawals[0].withdrawn_at) + 1).toISOString();
  const fresh = { ...options, preparedAt: freshAt,
    confirmation: { ...options.confirmation, evidence_ref: 'synthetic-new-confirmation-after-withdrawal', confirmed_at: freshAt },
    observation: { ...options.observation, fact_cutoff: freshAt, sealed_at: freshAt } };
  assert.ok(planAuthorityRecovery(fresh));
  for (const eventId of [legacy.eventId, `${legacy.eventId}:withdrawal`, `${f.journal.event_id}:withdrawal`]) {
    assert.throws(() => planAuthorityRecovery({ ...fresh, eventId }), /previous event cannot be replayed/);
  }
  assert.deepEqual(fs.readFileSync(f.journalPath), f.journalBytes);
  assert.equal(readChain(options.sealDirectory).authority_intents.length, 0);
});
const authorityDigest = value => crypto.createHash('sha256').update(canonicalJson(Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'recovery_digest')))).digest('hex');
check('control-only continuity rejects matching scoped observations before authority recovery', () => {
  const observation = {
    handoff_phase: 'MATERIAL_PREPARED', objective: 'SYNTHETIC', prohibitions: [], invalidation_conditions: [],
    sources: { ownership: { owner: 'synthetic', path_ref: 'evidence/ownership.md', root_ref: 'source_root', digest: '1'.repeat(64), fact_cutoff: '2026-01-01T00:00:00.000Z' } },
    remote: { default_ref: 'origin/main' },
    workspace: {
      root_ref: 'source_root', branch: 'main', required_untracked: [],
      inflight_scope: { excluded_roots: [{ path_ref: 'product/inflight', owner: 'synthetic', reason: 'ongoing specialist work', ownership_source_ref: 'evidence/ownership.md' }] },
      worktree_fingerprint: { algorithm: SCOPED_WORKSPACE_ALGORITHM, tracked_diff_sha256: '2'.repeat(64), untracked_digest: '3'.repeat(64), index_sha256: '4'.repeat(64) }
    }
  };
  assert.equal(validWorkspaceFingerprint(observation.workspace, observation.sources), true);
  // Exercise the real admission function; this does not certify a full transaction.
  assert.deepEqual(controlOnlyContinuityErrors(observation, structuredClone(observation)), ['control-only historical scoped workspace requires strict current re-observation']);
  const wrongPhase = { ...observation, handoff_phase: 'CURRENT_ATTESTATION' };
  assert(controlOnlyContinuityErrors(wrongPhase, observation).includes('control-only requires settled material and a full strict current workspace, without exclusions'));
  const wrongAlgorithm = structuredClone(observation); delete wrongAlgorithm.workspace.inflight_scope;
  assert(controlOnlyContinuityErrors({ ...wrongAlgorithm, handoff_phase: 'MATERIAL_PREPARED' }, wrongAlgorithm).includes('control-only requires settled material and a full strict current workspace, without exclusions'));
});
check('control-only admits a CURRENT_MIGRATION predecessor after a fresh strict material observation', () => {
  const strictWorkspace = {
    root_ref: 'source_root', branch: 'main', required_untracked: [],
    worktree_fingerprint: { algorithm: 'git-diff-index-untracked-sha256-v2', tracked_diff_sha256: '2'.repeat(64), untracked_digest: '3'.repeat(64), index_sha256: '4'.repeat(64) }
  };
  const previous = {
    handoff_phase: 'CURRENT_MIGRATION', switch_status: 'COMPLETED', objective: 'SYNTHETIC', prohibitions: [], invalidation_conditions: [],
    sources: { ownership: { owner: 'synthetic', path_ref: 'evidence/ownership.md', root_ref: 'source_root', digest: '1'.repeat(64), fact_cutoff: '2026-01-01T00:00:00.000Z' } },
    remote: { default_ref: 'origin/main' }, workspace: strictWorkspace, restrictions: ['HISTORICAL_WORKSPACE_PRESERVATION_UNVERIFIED']
  };
  const observation = structuredClone(previous); observation.handoff_phase = 'MATERIAL_PREPARED'; observation.switch_status = 'READY'; observation.migration = null;
  assert.deepEqual(controlOnlyContinuityErrors(previous, observation), []);
});
for (const historicalRemoteUnknown of [false, true]) check(`control-only inventory preserves historical rules and remote while observing current facts ${historicalRemoteUnknown}`, () => {
  const f = fixture({ controlOnly: true, historicalInventory: true, historicalRemoteUnknown });
  const file = path.join(f.sourceRoot, f.previous.sources.handoff_inventory.path_ref), before = fs.readFileSync(file);
  const result = recoverCommanderAuthority(f); assert.equal(result.status, 'COMPLETED');
  const live = verifyChain(f.sealDirectory, f); assert.equal(live.status, 'PASS', live.errors.join('; '));
  assert.notEqual(live.latest.rule_baseline.rule_version, f.previous.rule_baseline.rule_version);
  assert.equal(live.latest.remote.status, 'PASS'); assert.equal(live.latest.remote.head, f.git(['rev-parse', 'HEAD']));
  assert(!live.latest.restrictions.includes('REMOTE_UNOBSERVED')); assert.equal(result.business_resume_allowed, false);
  assert(fs.readFileSync(file).equals(before)); assert.equal(live.latest.sources.handoff_inventory.digest, f.previous.sources.handoff_inventory.digest);
});
for (const inventoryMismatch of ['rule', 'generation', 'platform', 'remote']) check(`control-only inventory still rejects inconsistent historical ${inventoryMismatch}`, () => {
  const f = fixture({ controlOnly: true, historicalInventory: true, inventoryMismatch });
  const file = path.join(f.sourceRoot, '.control/status_index.md'), before = fs.readFileSync(file);
  assert.throws(() => recoverCommanderAuthority(f), /HANDOFF_INVENTORY_MISMATCH/);
  assert(fs.readFileSync(file).equals(before)); assert.equal(readChain(f.sealDirectory).authority_intents.length, 0);
});
check('control-only transfers central authority without certifying old dirty preservation', () => {
  const f = fixture({ controlOnly: true });
  const product = fs.readFileSync(path.join(f.sourceRoot, 'product.txt')), required = fs.readFileSync(path.join(f.sourceRoot, 'result.txt'));
  assert.equal(verifyHandoffCandidate(f).status, 'BLOCKED');
  const result = recoverCommanderAuthority(f);
  assert.equal(result.status, 'COMPLETED'); assert.equal(result.generation, 2); assert.equal(result.protocol, 'CONTROL_ONLY_V1');
  assert.equal(result.historical_workspace, 'NOT_CERTIFIED'); assert.equal(result.business_resume_allowed, false);
  assert(result.restrictions.includes('HISTORICAL_WORKSPACE_PRESERVATION_UNVERIFIED'));
  assert(fs.readFileSync(path.join(f.sourceRoot, 'product.txt')).equals(product)); assert(fs.readFileSync(path.join(f.sourceRoot, 'result.txt')).equals(required));
  for (const [file, h] of f.historyBytes) assert.equal(hash(fs.readFileSync(path.join(f.sealDirectory, file))), h);
  const live = verifyChain(f.sealDirectory, f); assert.equal(live.status, 'PASS');
  const entry = fs.readFileSync(path.join(f.sourceRoot, '.control/central_entry.md'), 'utf8');
  assert.match(entry, /CONTROL_ONLY_V1/); assert.match(entry, /HISTORICAL_WORKSPACE_PRESERVATION_UNVERIFIED/); assert.match(entry, /Queue: A WAIT; B BLOCKED/); assert.match(entry, /Budget: ENDED; remaining=0/);
  const ref = live.latest.workspace.required_untracked.find(f => f.path_ref === '.control/central_entry.md');
  assert.equal(ref.sha256, hash(Buffer.from(entry)));
  assert.equal(recoverCommanderAuthority(f).generation, 2);
});
for (const external of [false, true]) check(`restricted schema-5 history migrates through real receiver observation with external=${external}`, () => {
  const f = fixture({ controlOnly: true, external }); recoverCommanderAuthority(f);
  const oldFiles = fs.readdirSync(f.sealDirectory).map(file => [file, hash(fs.readFileSync(path.join(f.sealDirectory, file)))]);
  const historical = inspectHistoricalRestrictedRecovery(f.sealDirectory);
  assert.equal(historical.status, HISTORICAL_UNVERIFIED);
  assert.equal(historical.current_ready, false);
  assert.equal(historical.historical_chain_status, 'PASS');
  const latest = readChain(f.sealDirectory).records.at(-1), stamp = new Date().toISOString();
  const migrated = structuredClone(latest);
  delete migrated.authority_recovery;
  Object.assign(migrated, {
    schema_version: 4, event_id: 'synthetic-current-migration', handoff_phase: 'CURRENT_MIGRATION',
    switch_status: 'COMPLETED', old_writer_status: 'STOPPED_DISPATCH', transition: null,
    restrictions: [], runtime_acceptance_status: 'PASS', professional_acceptance_status: 'PASS', fact_cutoff: stamp, sealed_at: stamp, seal_sequence: 1, previous_seal_digest: null, seal_digest: ''
  });
  migrated.workspace = { root_ref: '<PROJECT_ROOT>', ...readGitWorkspaceBaseline(f.sourceRoot), required_untracked: [] };
  for (const source of Object.values(migrated.sources)) {
    source.digest = hash(fs.readFileSync(path.join(source.root_ref === 'external_control_plane' ? f.externalControlPlaneRoot : f.sourceRoot, source.path_ref)));
    source.fact_cutoff = stamp;
  }
  migrated.migration = { legacy_latest_seal_digest: latest.seal_digest, legacy_generation: latest.generation, legacy_writer_id: latest.writer_id, migrated_at: stamp, basis: 'CURRENT_ONLY_NO_RETROACTIVE_TRANSITION' };
  const target = path.join(f.sourceRoot, '.control/migrated-seals');
  const inputBeforeMigration = canonicalJson(migrated);
  const result = appendCurrentMigrationSeal(target, migrated, { legacySealDirectory: f.sealDirectory, sourceRoot: f.sourceRoot, externalControlPlaneRoot: f.externalControlPlaneRoot });
  assert.equal(canonicalJson(migrated), inputBeforeMigration);
  const live = verifyChain(target, { sourceRoot: f.sourceRoot, externalControlPlaneRoot: f.externalControlPlaneRoot });
  assert.equal(live.status, 'PASS', live.errors.join('; '));
  assert.equal(live.handoff_ready, true);
  assert.equal(live.latest.handoff_phase, 'CURRENT_MIGRATION');
  assert.equal(live.latest.seal_sequence, 1);
  assert.equal(live.latest.previous_seal_digest, null);
  assert.equal(result.historical.latest.seal_digest, latest.seal_digest);
  assert(live.latest.restrictions.includes('HISTORICAL_WORKSPACE_PRESERVATION_UNVERIFIED'));
  assert.equal(live.latest.runtime_acceptance_status, 'NOT_RUN');
  assert.equal(live.latest.professional_acceptance_status, 'NOT_RUN');
  const cleared = structuredClone(live.latest);
  cleared.restrictions = []; cleared.event_id = 'synthetic-cleared-history';
  assert.throws(() => appendSeal(target, cleared, { sourceRoot: f.sourceRoot, externalControlPlaneRoot: f.externalControlPlaneRoot }), /historical workspace restriction cannot be cleared/);
  const evidence = path.join(f.sourceRoot, '.control/rebase-migration');
  fs.mkdirSync(evidence);
  const draftPath = path.join(evidence, 'draft.json'), configPath = path.join(evidence, 'config.json'), outputPath = path.join(evidence, 'observation.json');
  fs.writeFileSync(draftPath, JSON.stringify(live.latest));
  fs.writeFileSync(configPath, JSON.stringify({ source_root: f.sourceRoot, external_control_plane_root: f.externalControlPlaneRoot, draft_path: draftPath, rule_manifest_path: manifestPath }));
  rebaseHandoffDraft(configPath, outputPath);
  const observation = JSON.parse(fs.readFileSync(outputPath));
  assert.equal(observation.workspace.root_ref, live.latest.workspace.root_ref);
  assert.equal(observation.handoff_phase, 'MATERIAL_PREPARED');
  assert(observation.restrictions.includes('HISTORICAL_WORKSPACE_PRESERVATION_UNVERIFIED'));
  const recipient = { writerId: 'SYNTHETIC-THREE', platformTaskId: platform(3), projectKey: 'SYNTHETIC' };
  const confirmation = { ...f.confirmation, evidence_ref: 'synthetic-migration-current-operator', confirmed_at: new Date().toISOString(), previous_seal_digest: live.latest.seal_digest, observed_generation: live.latest.generation, observed_writer_id: live.latest.writer_id, observed_platform_id: platform(2), recipient_writer_id: recipient.writerId, recipient_platform_id: recipient.platformTaskId };
  const options = { ...f, sealDirectory: target, observation, recipient, confirmation, eventId: 'synthetic-post-migration-takeover' };
  const journalPath = controlPaths(observation, options).journal, journalBytes = fs.readFileSync(journalPath);
  for (const field of ['intent_digest', 'event_id', 'completion_source']) {
    const changed = JSON.parse(journalBytes);
    if (field === 'completion_source') changed[field] = { root_ref: 'source_root', path_ref: '.control/no-such-completion.json' };
    else changed[field] = 'tampered';
    fs.writeFileSync(journalPath, JSON.stringify(changed));
    assert.throws(() => planAuthorityRecovery(options), /TAKEOVER_INCOMPLETE/);
    assert.equal(readChain(target).authority_intents.length, 0);
    fs.writeFileSync(journalPath, journalBytes);
  }
  const migrationFile = fs.readdirSync(target).find(file => file.startsWith('handoff-state.'));
  const migrationBytes = fs.readFileSync(path.join(target, migrationFile));
  const mismatch = JSON.parse(migrationBytes); mismatch.migration.legacy_latest_seal_digest = 'f'.repeat(64); mismatch.seal_digest = sealDigest(mismatch);
  const mismatchFile = path.join(target, `handoff-state.1.${mismatch.seal_digest}.json`);
  fs.writeFileSync(mismatchFile, JSON.stringify(mismatch)); fs.unlinkSync(path.join(target, migrationFile));
  const mismatchOptions = { ...options, confirmation: { ...confirmation, previous_seal_digest: mismatch.seal_digest } };
  assert.throws(() => planAuthorityRecovery(mismatchOptions), /previous authority completion is not in formal history/);
  assert.equal(readChain(target).authority_intents.length, 0);
  fs.unlinkSync(mismatchFile); fs.writeFileSync(path.join(target, migrationFile), migrationBytes);
  const frozen = fs.readdirSync(target).map(file => [file, hash(fs.readFileSync(path.join(target, file)))]);
  assert.equal(planAuthorityRecovery(options).previous.seal_digest, live.latest.seal_digest);
  for (const [file, digest] of frozen) assert.equal(hash(fs.readFileSync(path.join(target, file))), digest);
  assert.equal(fs.readdirSync(target).length, frozen.length);
  const completed = recoverCommanderAuthority(options);
  assert.equal(completed.status, 'COMPLETED');
  assert.equal(completed.generation, 3);
  assert.equal(completed.business_resume_allowed, false);
  const final = verifyChain(target, options);
  assert.equal(final.status, 'PASS', final.errors.join('; '));
  assert(final.latest.restrictions.includes('HISTORICAL_WORKSPACE_PRESERVATION_UNVERIFIED'));
  for (const [file, before] of oldFiles) assert.equal(hash(fs.readFileSync(path.join(f.sealDirectory, file))), before);
  const forged = structuredClone(migrated); forged.event_id = 'synthetic-forged-migration'; forged.migration.legacy_writer_id = 'FORGED';
  assert.throws(() => appendCurrentMigrationSeal(path.join(f.sourceRoot, '.control/forged-migration'), forged, { legacySealDirectory: f.sealDirectory, sourceRoot: f.sourceRoot }), /does not bind the inspected historical seal/);
  assert.throws(() => appendCurrentMigrationSeal(path.join(f.sourceRoot, 'not-ignored-migration'), migrated, { legacySealDirectory: f.sealDirectory, sourceRoot: f.sourceRoot }), /must be excluded by the source repository .gitignore/);
  assert.throws(() => appendCurrentMigrationSeal(f.sealDirectory, migrated, { legacySealDirectory: f.sealDirectory, sourceRoot: f.sourceRoot }), /separate/);
  assert.throws(() => appendCurrentMigrationSeal(path.join(f.sealDirectory, 'nested-target'), migrated, { legacySealDirectory: f.sealDirectory, sourceRoot: f.sourceRoot }), /non-nested/);
});
// Preserve the product's outside-workflow output rule without writing outside this repository.
// This exact, manifest-bound copy is a separate workflow root inside the ignored fixture.
const formalWorkflowRoot = path.join(synthetic.artifacts, 'formal-workflow-copy');
const formalRuleRoot = path.join(formalWorkflowRoot, '总指挥工作流/第二代总指挥的工作模式');
const manifestBytes = fs.readFileSync(manifestPath);
const copiedManifest = JSON.parse(manifestBytes);
for (const entry of copiedManifest.rules) {
  const relative = copiedManifest.repository_root_prefixes.some(prefix => entry.path_ref.startsWith(prefix))
    ? entry.path_ref : path.posix.join('总指挥工作流/第二代总指挥的工作模式', entry.path_ref);
  const original = path.resolve(root, relative), destination = path.resolve(formalWorkflowRoot, relative);
  assert.ok(original.startsWith(root + path.sep));
  assert.ok(destination.startsWith(formalWorkflowRoot + path.sep));
  assert.ok(fs.lstatSync(original).isFile() && !fs.lstatSync(original).isSymbolicLink());
  const bytes = fs.readFileSync(original);
  assert.equal(hash(bytes).toLowerCase(), entry.sha256.toLowerCase());
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, bytes, { flag: 'wx' });
}
const formalManifestPath = path.join(formalRuleRoot, '规则刷新manifest.json');
fs.writeFileSync(formalManifestPath, manifestBytes, { flag: 'wx' });
for (const args of [
  ['init', '--quiet', '--initial-branch=main'],
  ['add', '--', '.github/scripts/HandoffSeal.mjs', '.github/scripts/Prepare-Handoff.mjs']
]) {
  const git = synthetic.runSync('git', ['-C', formalWorkflowRoot, ...args], { encoding: 'utf8' });
  assert.equal(git.error, undefined, git.error?.message);
  assert.equal(git.status, 0, git.stderr);
}

const { prepareFormalHandoff: prepareIsolatedFormalHandoff } = await import(
  pathToFileURL(path.join(formalWorkflowRoot, '.github/scripts/Prepare-Handoff.mjs')).href);
check('restricted schema-5 migration uses the same preservation policy through formal Prepare preflight and commit', () => {
  const f = fixture({ controlOnly: true }); recoverCommanderAuthority(f);
  const latest = readChain(f.sealDirectory).records.at(-1);
  const statusFile = path.join(f.sourceRoot, latest.sources.status_index.path_ref);
  fs.writeFileSync(statusFile, fs.readFileSync(statusFile, 'utf8').replace('<!-- CURRENT:END -->', `远端目标：refs/heads/main\nHEAD=${f.git(['rev-parse', 'HEAD'])}\n规则清单摘要：${hash(fs.readFileSync(manifestPath))}\n<!-- CURRENT:END -->`));
  const stamp = new Date().toISOString(), draft = structuredClone(latest);
  delete draft.authority_recovery;
  Object.assign(draft, { schema_version: 3, handoff_phase: 'CURRENT_MIGRATION', event_id: 'synthetic-formal-migration', seal_sequence: 1, previous_seal_digest: null, seal_digest: '', restrictions: [], runtime_acceptance_status: 'PASS', professional_acceptance_status: 'PASS', sealed_at: stamp, fact_cutoff: stamp, transition: null });
  draft.workspace = { root_ref: '.', ...readGitWorkspaceBaseline(f.sourceRoot), required_untracked: [] };
  for (const source of Object.values(draft.sources)) { source.digest = hash(fs.readFileSync(path.join(f.sourceRoot, source.path_ref))); source.fact_cutoff = stamp; }
  draft.migration = { legacy_latest_seal_digest: latest.seal_digest, legacy_generation: latest.generation, legacy_writer_id: latest.writer_id, migrated_at: stamp, basis: 'CURRENT_ONLY_NO_RETROACTIVE_TRANSITION' };
  const work = path.join(f.sourceRoot, '.control/formal-prepare'); fs.mkdirSync(work);
  const draftPath = path.join(work, 'draft.json'), template = path.join(work, 'template.md'), configPath = path.join(work, 'config.json');
  const target = path.join(f.sourceRoot, '.control/formal-migration-seals');
  const outputs = fs.mkdtempSync(path.join(synthetic.artifacts, 'synthetic-formal-migration-'));
  let outputsVerified = false;
  fs.writeFileSync(draftPath, JSON.stringify(draft));
  fs.writeFileSync(template, '# {{SNAPSHOT_ID}}\n{{SEAL_DIGEST}}\n{{FACT_CUTOFF}}\n{{EVENT_ID}}\n{{VERIFICATION_COMMAND}}\n');
  const config = { source_root: f.sourceRoot, seal_directory: target, legacy_seal_directory: f.sealDirectory, draft_path: draftPath, snapshot_template_path: template, final_output_path: path.join(outputs, 'synthetic-commander-handoff-20261101-final-1.md'), receipt_output_path: path.join(outputs, 'receipt.json'), rule_manifest_path: formalManifestPath, project_key: 'SYNTHETIC', preflight_only: true };
  const original = fs.readFileSync(draftPath), old = fs.readdirSync(f.sealDirectory).map(file => [file, hash(fs.readFileSync(path.join(f.sealDirectory, file)))]);
  try {
    fs.writeFileSync(configPath, JSON.stringify(config));
    assert.equal(prepareIsolatedFormalHandoff(configPath).mode, 'PREFLIGHT_ONLY');
    assert(!fs.existsSync(target));
    config.preflight_only = false; fs.writeFileSync(configPath, JSON.stringify(config));
    assert.equal(prepareIsolatedFormalHandoff(configPath).chain_status, 'PASS');
    const seal = readChain(target).records.at(-1);
    assert.equal(seal.schema_version, 4);
    assert(seal.restrictions.includes('HISTORICAL_WORKSPACE_PRESERVATION_UNVERIFIED'));
    assert.equal(seal.runtime_acceptance_status, 'NOT_RUN'); assert.equal(seal.professional_acceptance_status, 'NOT_RUN');
    assert(fs.readFileSync(draftPath).equals(original));
    for (const [file, digest] of old) assert.equal(hash(fs.readFileSync(path.join(f.sealDirectory, file))), digest);
    outputsVerified = true;
  } finally {
    if (outputsVerified) fs.rmSync(outputs, { recursive: true, force: true });
    else console.error('Failure evidence retained: ' + outputs);
  }
});
check('expected historical scoped-workspace restriction remains migratable while other history errors block', () => {
  const f = fixture({ controlOnly: true }); recoverCommanderAuthority(f);
  const historicalDir = path.join(f.sourceRoot, '.control/historical-restricted-seals'); fs.cpSync(f.sealDirectory, historicalDir, { recursive: true });
  const original = readChain(historicalDir), originalIntent = original.authority_intents[0], originalLatest = original.records.at(-1);
  fs.mkdirSync(path.join(f.sourceRoot, 'product/inflight'), { recursive: true });
  const scope = { excluded_roots: [{ path_ref: 'product/inflight', owner: 'synthetic', reason: 'ongoing specialist work', ownership_source_ref: originalIntent.transaction.observation.sources.central_work_items.path_ref }] };
  const required = originalIntent.transaction.observation.workspace.required_untracked.map(item => item.path_ref);
  const scopedWorkspace = { root_ref: '<PROJECT_ROOT>', ...readGitWorkspaceBaseline(f.sourceRoot, required, scope), required_untracked: originalIntent.transaction.observation.workspace.required_untracked };
  const intentPath = path.join(historicalDir, `handoff-authority-recovery.${originalIntent.previous_sequence}.${originalIntent.recovery_digest}.json`);
  const changedIntent = structuredClone(originalIntent); changedIntent.transaction.observation.workspace = scopedWorkspace; changedIntent.transaction.observation.workspace.required_untracked = authorityRequiredFiles(changedIntent.transaction); changedIntent.recovery_digest = authorityDigest(changedIntent);
  changedIntent.transaction.observation.seal_digest = sealDigest(changedIntent.transaction.observation);
  changedIntent.recovery_digest = authorityDigest(changedIntent);
  fs.writeFileSync(path.join(historicalDir, `handoff-authority-recovery.${changedIntent.previous_sequence}.${changedIntent.recovery_digest}.json`), `${JSON.stringify(changedIntent, null, 2)}\n`); fs.unlinkSync(intentPath);
  const latestPath = path.join(historicalDir, `handoff-state.${originalLatest.seal_sequence}.${originalLatest.seal_digest}.json`);
  const changedLatest = structuredClone(originalLatest); changedLatest.workspace = scopedWorkspace; changedLatest.authority_recovery.intent_digest = changedIntent.recovery_digest; changedLatest.seal_digest = sealDigest(changedLatest);
  fs.writeFileSync(path.join(historicalDir, `handoff-state.${changedLatest.seal_sequence}.${changedLatest.seal_digest}.json`), `${JSON.stringify(changedLatest, null, 2)}\n`); fs.unlinkSync(latestPath);
  const inspected = inspectHistoricalRestrictedRecovery(historicalDir);
  assert.equal(inspected.status, HISTORICAL_UNVERIFIED); assert.equal(inspected.historical_chain_status, 'PASS'); assert.equal(inspected.expected_historical_restrictions.length, 1); assert.equal(inspected.latest.seal_digest, changedLatest.seal_digest);
  const migrated = structuredClone(changedLatest); delete migrated.authority_recovery;
  const stamp = new Date(Date.now() + 1000).toISOString(); Object.assign(migrated, { schema_version: 4, event_id: 'synthetic-scoped-current-migration', handoff_phase: 'CURRENT_MIGRATION', switch_status: 'COMPLETED', old_writer_status: 'STOPPED_DISPATCH', transition: null, restrictions: [], fact_cutoff: stamp, sealed_at: stamp, seal_sequence: 1, previous_seal_digest: null, seal_digest: '' });
  migrated.workspace = { root_ref: '<PROJECT_ROOT>', ...readGitWorkspaceBaseline(f.sourceRoot), required_untracked: [] }; for (const source of Object.values(migrated.sources)) { source.digest = hash(fs.readFileSync(path.join(f.sourceRoot, source.path_ref))); source.fact_cutoff = stamp; }
  migrated.migration = { legacy_latest_seal_digest: changedLatest.seal_digest, legacy_generation: changedLatest.generation, legacy_writer_id: changedLatest.writer_id, migrated_at: stamp, basis: 'CURRENT_ONLY_NO_RETROACTIVE_TRANSITION' };
  const target = path.join(f.sourceRoot, '.control/scoped-migrated-seals'), before = fs.readdirSync(historicalDir).map(file => [file, hash(fs.readFileSync(path.join(historicalDir, file)))]);
  appendCurrentMigrationSeal(target, migrated, { legacySealDirectory: historicalDir, sourceRoot: f.sourceRoot }); assert.equal(verifyChain(target, { sourceRoot: f.sourceRoot }).status, 'PASS');
  for (const [file, bytes] of before) assert.equal(hash(fs.readFileSync(path.join(historicalDir, file))), bytes);
  const badDir = path.join(f.sourceRoot, '.control/bad-historical-seals'); fs.cpSync(historicalDir, badDir, { recursive: true }); const badFile = fs.readdirSync(badDir).find(file => file.startsWith('handoff-state.'));
  const badRecord = JSON.parse(fs.readFileSync(path.join(badDir, badFile), 'utf8')); badRecord.event_id = 'tampered-history'; fs.writeFileSync(path.join(badDir, badFile), `${JSON.stringify(badRecord, null, 2)}\n`);
  const badInspection = inspectHistoricalRestrictedRecovery(badDir); assert.equal(badInspection.status, HISTORICAL_UNVERIFIED); assert.equal(badInspection.historical_chain_status, 'BLOCKED'); assert.throws(() => appendCurrentMigrationSeal(path.join(f.sourceRoot, '.control/bad-target'), migrated, { legacySealDirectory: badDir, sourceRoot: f.sourceRoot }), /historical restricted chain is not migratable/);
});
for (const variant of ['scope', 'version', 'acknowledgment', 'writer', 'platform', 'generation', 'not-stopped', 'central', 'source-owner', 'objective', 'required-scope', 'required-hash', 'branch', 'remote-target', 'excluded-scope']) check(`control-only rejects invalid ${variant} before central writes`, () => {
  const f = fixture({ controlOnly: true });
  const file = path.join(f.sourceRoot, '.control/status_index.md'), before = fs.readFileSync(file);
  if (variant === 'scope') f.confirmation.scope = 'HANDOFF_PREPARE_COMMIT_ONLY';
  if (variant === 'version') f.confirmation.protocol_version = 1;
  if (variant === 'acknowledgment') f.confirmation.historical_workspace = 'PASS';
  if (variant === 'writer') f.confirmation.recipient_writer_id = 'OTHER';
  if (variant === 'platform') f.confirmation.recipient_platform_id = platform(9);
  if (variant === 'generation') { f.observation.generation++; f.confirmation.observed_generation++; }
  if (variant === 'not-stopped') f.confirmation.old_writer_status = 'UNKNOWN';
  if (variant === 'central') { fs.appendFileSync(file, 'unauthorized drift'); f.observation.sources.status_index.digest = hash(fs.readFileSync(file)); }
  if (variant === 'source-owner') f.observation.sources.status_index.owner = 'OTHER';
  if (variant === 'objective') f.observation.objective.breakpoint = 'pretend product done';
  if (variant === 'required-scope') f.observation.workspace.required_untracked.pop();
  if (variant === 'required-hash') f.observation.workspace.required_untracked[0].sha256 = '0'.repeat(64);
  if (variant === 'branch') f.observation.workspace.branch = 'other';
  if (variant === 'remote-target') f.observation.remote.default_ref = 'refs/heads/other';
  if (variant === 'excluded-scope') f.observation.workspace.inflight_scope = { excluded_roots: [] };
  const actualBefore = fs.readFileSync(file);
  assert.throws(() => recoverCommanderAuthority(f));
  assert(fs.readFileSync(file).equals(actualBefore)); assert.equal(readChain(f.sealDirectory).authority_intents.length, 0);
  if (variant !== 'central') assert(actualBefore.equals(before));
});
for (const stage of ['after-intent', 'after-journal', 'after-write-1', 'after-seal']) check(`control-only recovers ${stage} without another generation`, () => {
  const f = fixture({ controlOnly: true }); const product = fs.readFileSync(path.join(f.sourceRoot, 'product.txt'));
  assert.throws(() => recoverCommanderAuthority({ ...f, fault: point => { if (point === stage) throw new Error('control-only interruption'); } }), /control-only interruption/);
  assert.equal(recoverCommanderAuthority(f).generation, 2); assert.equal(recoverCommanderAuthority(f).generation, 2);
  assert(fs.readFileSync(path.join(f.sourceRoot, 'product.txt')).equals(product)); assert.equal(verifyChain(f.sealDirectory, f).status, 'PASS');
});
for (const change of ['product', 'index', 'required', 'confirmation']) check(`control-only rejects frozen ${change} drift and rollback preserves it`, () => {
  const f = fixture({ controlOnly: true });
  assert.throws(() => recoverCommanderAuthority({ ...f, fault: point => { if (point === 'after-write-1') throw new Error('control-only interruption'); } }));
  if (change === 'product' || change === 'index') fs.appendFileSync(path.join(f.sourceRoot, 'product.txt'), 'concurrent update\n');
  if (change === 'index') f.git(['add', '--', 'product.txt']);
  if (change === 'required') fs.appendFileSync(path.join(f.sourceRoot, 'result.txt'), 'concurrent required update\n');
  const changedConfirmation = { ...f.confirmation, evidence_ref: 'another-message' };
  assert.throws(() => recoverCommanderAuthority(change === 'confirmation' ? { ...f, confirmation: changedConfirmation } : f));
  const product = fs.readFileSync(path.join(f.sourceRoot, 'product.txt')), required = fs.readFileSync(path.join(f.sourceRoot, 'result.txt'));
  assert.equal(rollbackCommanderAuthority(f).status, 'ROLLED_BACK_STOPPED');
  assert(fs.readFileSync(path.join(f.sourceRoot, 'product.txt')).equals(product)); assert(fs.readFileSync(path.join(f.sourceRoot, 'result.txt')).equals(required));
  assert.throws(() => recoverCommanderAuthority(f), /withdrawn/);
});
check('control-only immutable intent tampering and third control bytes never overwrite evidence', () => {
  const f = fixture({ controlOnly: true });
  assert.throws(() => recoverCommanderAuthority({ ...f, fault: point => { if (point === 'after-journal') throw new Error('control-only interruption'); } }));
  const intent = readChain(f.sealDirectory).authority_intents[0], file = path.join(f.sourceRoot, '.control/current_view.md');
  fs.appendFileSync(file, 'third bytes'); const before = fs.readFileSync(file);
  assert.throws(() => recoverCommanderAuthority(f), /control byte conflict/); assert.throws(() => rollbackCommanderAuthority(f), /control byte conflict/); assert(fs.readFileSync(file).equals(before));
  const intentFile = path.join(f.sealDirectory, `handoff-authority-recovery.${intent.previous_sequence}.${intent.recovery_digest}.json`);
  intent.transaction.confirmation.historical_workspace = 'PASS'; fs.writeFileSync(intentFile, JSON.stringify(intent));
  assert.throws(() => recoverCommanderAuthority(f), /history invalid/);
});
check('control-only external authority and unknown remote keep independent restrictions', () => {
  const f = fixture({ controlOnly: true, external: true, unknownRemote: true });
  const result = recoverCommanderAuthority(f); assert.equal(result.generation, 2);
  assert.deepEqual(result.restrictions, ['REMOTE_UNOBSERVED', 'HISTORICAL_WORKSPACE_PRESERVATION_UNVERIFIED']);
  assert.equal(verifyChain(f.sealDirectory, f).status, 'PASS');
});
check('control-only completion forbids rollback and ordinary erasure of the historical restriction', () => {
  const f = fixture({ controlOnly: true }); recoverCommanderAuthority(f); assert.throws(() => rollbackCommanderAuthority(f), /completion/);
  const latest = readChain(f.sealDirectory).records.at(-1);
  for (const action of ['drop', 'accept']) {
    const draft = { ...structuredClone(latest), schema_version: 4, handoff_phase: 'MATERIAL_PREPARED', switch_status: 'READY_WITH_RESTRICTIONS', event_id: `synthetic-launder-${action}`, seal_digest: '' };
    delete draft.authority_recovery;
    if (action === 'drop') draft.restrictions = []; else draft.runtime_acceptance_status = 'PASS';
    assert.throws(() => appendSeal(f.sealDirectory, draft, f), /restriction cannot be cleared/);
  }
});
check('control-only CLI inspect is read-only and commit keeps its limited result', () => {
  const f = fixture({ controlOnly: true }), config = path.join(path.dirname(f.sourceRoot), 'receiver.json');
  fs.writeFileSync(config, JSON.stringify(Object.fromEntries(Object.entries(f).filter(([key]) => !['git', 'historyBytes', 'previous'].includes(key)))));
  const files = fs.readdirSync(f.sealDirectory);
  const cli = mode => synthetic.runSync(process.execPath, [path.join(root, '.github/scripts/Recover-CommanderAuthority.mjs'), mode, config], { encoding: 'utf8' });
  const inspect = cli('inspect'); assert.equal(inspect.status, 0, inspect.stderr); assert.deepEqual(fs.readdirSync(f.sealDirectory), files);
  assert.equal(JSON.parse(inspect.stdout).protocol, 'CONTROL_ONLY_V1'); assert.equal(JSON.parse(inspect.stdout).business_resume_allowed, false); assert.equal(JSON.parse(inspect.stdout).writes, 0);
  const commit = cli('commit'); assert.equal(commit.status, 0, commit.stderr);
  const committed = JSON.parse(commit.stdout);
  assert.equal(committed.status, 'COMPLETED');
  assert.equal(committed.control_handoff, 'COMPLETED');
  assert.equal(committed.business_resume_allowed, false);
  assert.equal(committed.receiver_adoption.status, 'COMPLETED');
});
check('control-only cannot discard a pending ordinary transition or replace a pending authority event', () => {
  const f = fixture({ controlOnly: true });
  prepareTransition(f.sealDirectory, { ...f, nextGeneration: 2, nextWriterId: 'OTHER', eventId: 'synthetic-pending-normal' });
  assert.throws(() => recoverCommanderAuthority(f), /unresolved/); assert.equal(readChain(f.sealDirectory).authority_intents.length, 0);
  const g = fixture({ controlOnly: true });
  assert.throws(() => recoverCommanderAuthority({ ...g, fault: point => { if (point === 'after-intent') throw new Error('synthetic stop'); } }), /synthetic stop/);
  assert.throws(() => recoverCommanderAuthority({ ...g, eventId: 'synthetic-replacement' }), /pending/);
  assert.equal(readChain(g.sealDirectory).authority_intents.length, 1);
});
check('control-only frozen rule fingerprint drift rejects recovery without further central writes', () => {
  const f = fixture({ controlOnly: true }), manifest = path.join(path.dirname(f.sourceRoot), 'manifest.json');
  fs.copyFileSync(manifestPath, manifest); f.manifestPath = manifest;
  assert.throws(() => recoverCommanderAuthority({ ...f, fault: point => { if (point === 'after-write-1') throw new Error('synthetic stop'); } }), /synthetic stop/);
  const tx = readChain(f.sealDirectory).authority_intents[0].transaction;
  const before = tx.plan.map(item => hash(fs.readFileSync(path.join(f.sourceRoot, item.path_ref))));
  fs.appendFileSync(manifest, '\n');
  assert.throws(() => recoverCommanderAuthority(f), /manifest|rule/i);
  assert.deepEqual(tx.plan.map(item => hash(fs.readFileSync(path.join(f.sourceRoot, item.path_ref)))), before);
});
check('control-only rejects source path substitution even with valid current bytes', () => {
  const f = fixture({ controlOnly: true }), source = f.observation.sources.current_view;
  fs.copyFileSync(path.join(f.sourceRoot, source.path_ref), path.join(f.sourceRoot, '.control/alias.md'));
  source.path_ref = '.control/alias.md';
  assert.throws(() => recoverCommanderAuthority(f), /sealed source changed/);
  assert.equal(readChain(f.sealDirectory).authority_intents.length, 0);
});
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
check('post-commit readback is a separate read-only receiver checkpoint', () => {
  const f = fixture();
  assert.throws(() => readCompletedAuthority(f), /POST_COMMIT_READBACK_BLOCKED/);
  const completed = recoverCommanderAuthority(f);
  const before = fs.readdirSync(f.sealDirectory).map(name => [name, hash(fs.readFileSync(path.join(f.sealDirectory, name)))]).sort();
  const result = readCompletedAuthority(f);
  assert.equal(result.status, 'POST_COMMIT_READBACK_READY');
  assert.equal(result.generation, completed.generation);
  assert.equal(result.writer_id, f.recipient.writerId);
  assert.equal(result.platform_task_id, f.recipient.platformTaskId);
  assert.equal(result.receiver_loading_record, 'REQUIRED_BY_RECEIVER');
  assert.equal(result.task_plan_alignment, 'RECEIVER_MUST_ALIGN_OWN_RECORD');
  assert.equal(result.writes, 0);
  const after = fs.readdirSync(f.sealDirectory).map(name => [name, hash(fs.readFileSync(path.join(f.sealDirectory, name)))]).sort();
  assert.deepEqual(after, before);
});
check('post-commit readback keeps control-only restrictions and rejects stale receiver identity', () => {
  const f = fixture({ controlOnly: true, unknownRemote: true });
  const result = recoverCommanderAuthority(f);
  const readback = readCompletedAuthority(f);
  assert.equal(readback.status, 'POST_COMMIT_READBACK_READY');
  assert.equal(readback.control_only, true);
  assert.equal(readback.business_resume_allowed, false);
  assert(readback.restrictions.includes(HISTORICAL_WORKSPACE_RESTRICTION));
  assert(readback.restrictions.includes('REMOTE_UNOBSERVED'));
  const stale = { ...f, recipient: { ...f.recipient, writerId: 'SYNTHETIC-STALE' } };
  assert.throws(() => readCompletedAuthority(stale), /completed writer does not match/);
  assert.equal(result.business_resume_allowed, false);
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
check('control-only historical V1 authority chain remains read-only while new V1 recovery is rejected', () => {
  const f = fixture({ controlOnly: true });
  const legacyObservation = structuredClone(f.observation);
  legacyObservation.workspace = {
    ...legacyObservation.workspace,
    ...readGitWorkspaceBaseline(f.sourceRoot, legacyObservation.workspace.required_untracked.map(item => item.path_ref), null,
      { algorithm: 'git-diff-binary+untracked-content-sha256-v1' })
  };
  assert.throws(() => planAuthorityRecovery({ ...f, observation: legacyObservation }), /full strict current workspace/);
  const beforeCount = readChain(f.sealDirectory).records.length;
  assert.equal(recoverCommanderAuthority(f).generation, 2);
  const history = readChain(f.sealDirectory);
  assert.equal(history.records.length, beforeCount + 1);
  const previous = structuredClone(history.records[0]), completed = structuredClone(history.records[1]);
  const intent = structuredClone(history.authority_intents[0]);
  const legacy = workspace => {
    workspace.worktree_fingerprint.algorithm = 'git-diff-binary+untracked-content-sha256-v1';
    delete workspace.worktree_fingerprint.index_sha256;
  };
  legacy(previous.workspace);
  previous.seal_digest = sealDigest(previous);
  legacy(intent.transaction.observation.workspace);
  intent.transaction.observation.previous_seal_digest = previous.previous_seal_digest;
  intent.transaction.observation.seal_digest = sealDigest(intent.transaction.observation);
  intent.previous_seal_digest = previous.seal_digest;
  intent.transaction.confirmation.previous_seal_digest = previous.seal_digest;
  intent.recovery_digest = authorityDigest(intent);
  legacy(completed.workspace);
  completed.previous_seal_digest = previous.seal_digest;
  completed.authority_recovery.previous_seal_digest = previous.seal_digest;
  completed.authority_recovery.intent_digest = intent.recovery_digest;
  completed.seal_digest = sealDigest(completed);
  const legacyDir = path.join(path.dirname(f.sealDirectory), 'legacy-history');
  fs.mkdirSync(legacyDir);
  const files = [
    [`handoff-state.${previous.seal_sequence}.${previous.seal_digest}.json`, previous],
    [`handoff-authority-recovery.${intent.previous_sequence}.${intent.recovery_digest}.json`, intent],
    [`handoff-state.${completed.seal_sequence}.${completed.seal_digest}.json`, completed]
  ];
  for (const [name, value] of files) fs.writeFileSync(path.join(legacyDir, name), `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
  const frozen = files.map(([name]) => [name, hash(fs.readFileSync(path.join(legacyDir, name)))]);
  const legacyHistory = readChain(legacyDir);
  assert.deepEqual(legacyHistory.errors, []);
  assert.equal(legacyHistory.records.length, 2);
  assert.deepEqual(files.map(([name]) => [name, hash(fs.readFileSync(path.join(legacyDir, name)))]), frozen);
});
assert.ok(resumeReached, 'unknown --from-check name');
console.log(`Authority recovery tests passed: ${passed}`);
