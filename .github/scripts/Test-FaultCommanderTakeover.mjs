// Fault takeover uses a receiver snapshot, never a new signature by the stopped writer.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { fixture } from './Test-Receiver-State-Adoption.mjs';
import { readChain, verifyChain, validateAuthorityConfirmation } from './HandoffSeal.mjs';
import { byteDigest, controlPaths } from './HandoffControl.mjs';
import { takeoverHandoff } from './Takeover-Handoff.mjs';
import { readGitWorkspaceBaseline } from './Prepare-Handoff.mjs';
import { planAuthorityRecovery, recoverCommanderAuthority, readCompletedAuthority } from './Recover-CommanderAuthority.mjs';

function faultFixture() {
  const f = fixture({ faultPredecessor: true, alias: true });
  assert.equal(takeoverHandoff(f).control_handoff, 'COMPLETED');
  const previous = readChain(f.sealDirectory).records.at(-1);
  assert.equal(Object.keys(previous.sources).length, 10);
  assert.ok(previous.sources.task_contract);
  const inventoryPath = path.join(f.sourceRoot, previous.sources.handoff_inventory.path_ref);
  fs.writeFileSync(inventoryPath, '{"generation":0,"status":"HISTORICAL"}\n');
  const stamp = new Date().toISOString(), observation = structuredClone(previous);
  Object.assign(observation, {
    schema_version: 4, event_id: 'synthetic-fault-observation',
    handoff_phase: 'MATERIAL_PREPARED', switch_status: 'READY', transition: null, migration: null,
    fact_cutoff: stamp, sealed_at: stamp, seal_digest: ''
  });
  for (const source of Object.values(observation.sources)) {
    source.digest = byteDigest(fs.readFileSync(path.join(f.sourceRoot, source.path_ref)));
    source.fact_cutoff = stamp;
  }
  for (const [name, ref] of [['task_contract', 'task_plan.md'], ['progress', 'progress.md']]) {
    observation.sources[name] = { owner: 'synthetic', root_ref: 'source_root', path_ref: ref,
      digest: byteDigest(fs.readFileSync(path.join(f.sourceRoot, ref))), fact_cutoff: stamp };
  }
  const required = previous.workspace.required_untracked.map(item => ({ ...item,
    sha256: byteDigest(fs.readFileSync(path.join(f.sourceRoot, item.path_ref))) }));
  observation.workspace = { root_ref: previous.workspace.root_ref, ...readGitWorkspaceBaseline(f.sourceRoot, required.map(item => item.path_ref)), required_untracked: required };
  const recipient = { writerId: 'SYNTHETIC-FAULT-RECEIVER', platformTaskId: '55555555-5555-4555-8555-555555555555', projectKey: 'SYNTHETIC' };
  const confirmation = {
    protocol_version: 3, origin: 'CURRENT_OPERATOR_MESSAGE', evidence_ref: 'synthetic-direct-fault-confirmation',
    confirmed_at: stamp, project_key: 'SYNTHETIC', previous_seal_digest: previous.seal_digest,
    observed_generation: previous.generation, observed_writer_id: previous.writer_id,
    observed_platform_id: f.recipient.platformTaskId, old_writer_status: 'STOPPED_DISPATCH',
    recipient_writer_id: recipient.writerId, recipient_platform_id: recipient.platformTaskId,
    scope: 'FAULT_CONTROL_ONLY_TAKEOVER', transfer_confirmed: true, unique_writer_confirmed: true,
    historical_workspace: 'ACKNOWLEDGED_NOT_CERTIFIED'
  };
  return { ...f, previous, recipient, confirmation, observation, eventId: 'synthetic-fault-takeover' };
}

const f = faultFixture();
for (const change of [
  value => { value.protocol_version = 2; },
  value => { value.scope = 'CONTROL_ONLY_TAKEOVER'; },
  value => { value.unique_writer_confirmed = false; },
  value => { value.old_writer_status = 'UNKNOWN'; }
]) {
  const confirmation = structuredClone(f.confirmation); change(confirmation);
  assert.ok(validateAuthorityConfirmation(confirmation, f.observation, f.recipient, f.previous).length);
}
const extra = structuredClone(f.observation);
extra.sources.unapproved = { ...extra.sources.progress };
assert.throws(() => planAuthorityRecovery({ ...f, observation: extra }), /only add/);
const missing = structuredClone(f.observation); delete missing.sources.progress;
assert.throws(() => planAuthorityRecovery({ ...f, observation: missing }), /only add/);
const before = readChain(f.sealDirectory).records.length;
function independentFaultFixture() {
  const independent = faultFixture(), planRef = '.control/receiver-plan.md';
  fs.writeFileSync(path.join(independent.sourceRoot, planRef), '<a id="current-plan"></a>\n# Independent receiver plan\n');
  independent.observation.sources.task_plan = { ...independent.observation.sources.task_contract,
    path_ref: planRef, digest: byteDigest(fs.readFileSync(path.join(independent.sourceRoot, planRef))) };
  const required = [...independent.observation.workspace.required_untracked,
    { path_ref: planRef, sha256: independent.observation.sources.task_plan.digest, reason: 'explicit receiver plan' }];
  independent.observation.workspace = { root_ref: independent.observation.workspace.root_ref,
    ...readGitWorkspaceBaseline(independent.sourceRoot, required.map(item => item.path_ref)), required_untracked: required };
  return independent;
}
const independent = independentFaultFixture();
const independentResult = recoverCommanderAuthority(independent);
assert.equal(independentResult.receiver_adoption.status, 'COMPLETED', JSON.stringify(independentResult));
assert.equal(readCompletedAuthority(independent).writes, 0);
assert.equal(recoverCommanderAuthority(independent).receiver_adoption.writes, 0);
const interruptedPlan = independentFaultFixture();
assert.throws(() => recoverCommanderAuthority({ ...interruptedPlan, fault: point => {
  if (point === 'after-write-1') throw Error('synthetic independent plan interruption');
} }), /independent plan interruption/);
assert.equal(recoverCommanderAuthority(interruptedPlan).receiver_adoption.status, 'COMPLETED');
assert.equal(readCompletedAuthority(interruptedPlan).writes, 0);
assert.equal(recoverCommanderAuthority(interruptedPlan).receiver_adoption.writes, 0);
const result = recoverCommanderAuthority(f);
assert.equal(result.generation, f.previous.generation + 1);
assert.equal(result.business_resume_allowed, false);
assert.equal(result.historical_inventory, 'NOT_CERTIFIED');
assert.equal(result.receiver_adoption.status, 'COMPLETED', JSON.stringify(result.receiver_adoption));
const history = readChain(f.sealDirectory), latest = history.records.at(-1);
assert.equal(history.records.length, before + 2);
assert.equal(Object.keys(latest.sources).length, 10);
for (const [name, old] of Object.entries(f.previous.sources)) {
  for (const field of ['path_ref', 'root_ref', 'owner']) assert.equal(latest.sources[name][field], old[field]);
}
assert.equal(latest.sources.current_view.digest, latest.sources.central_entry.digest);
assert.ok(latest.restrictions.includes('HISTORICAL_SOURCE_PRESERVATION_UNVERIFIED'));
assert.ok(latest.restrictions.includes('HISTORICAL_WORKSPACE_PRESERVATION_UNVERIFIED'));
assert.equal(recoverCommanderAuthority(f).receiver_adoption.writes, 0);
assert.equal(readCompletedAuthority(f).writes, 0);
assert.equal(verifyChain(f.sealDirectory, f).status, 'PASS');

const interrupted = faultFixture();
assert.throws(() => recoverCommanderAuthority({ ...interrupted, fault: point => {
  if (point === 'after-write-1') throw new Error('synthetic fault interruption');
} }), /synthetic fault interruption/);
const resumed = recoverCommanderAuthority(interrupted);
assert.equal(resumed.receiver_adoption.status, 'COMPLETED', JSON.stringify(resumed.receiver_adoption));
assert.equal(resumed.business_resume_allowed, false);
assert.equal(verifyChain(interrupted.sealDirectory, interrupted).status, 'PASS');
const journal = controlPaths(readChain(interrupted.sealDirectory).records.at(-1), interrupted).journal;
assert.equal(JSON.parse(fs.readFileSync(journal)).status, 'COMPLETED');
for (const missingJournal of [false, true]) {
  const crash = faultFixture();
  assert.throws(() => recoverCommanderAuthority({ ...crash, fault: point => {
    if (point === 'after-seal') throw new Error('synthetic authority seal interruption');
  } }), /synthetic authority seal interruption/);
  const sealed = readChain(crash.sealDirectory);
  const completedCount = sealed.records.filter(record => record.handoff_phase === 'AUTHORITY_RECOVERY_COMPLETED').length;
  const crashJournal = controlPaths(sealed.records.at(-1), crash).journal;
  assert.equal(JSON.parse(fs.readFileSync(crashJournal)).status, 'PREPARED');
  const journalBefore = fs.readFileSync(crashJournal);
  const originalIndex = controlPaths(sealed.records.at(-1), crash).index;
  const originalBytes = fs.readFileSync(originalIndex);
  assert.throws(() => recoverCommanderAuthority({ ...crash, recipient: { ...crash.recipient, writerId: 'SYNTHETIC-WRONG' } }), /frozen.*authorization|recipient/);
  fs.writeFileSync(originalIndex, 'synthetic third bytes');
  assert.throws(() => recoverCommanderAuthority(crash), /conflict/);
  assert.equal(fs.readFileSync(originalIndex, 'utf8'), 'synthetic third bytes');
  fs.writeFileSync(originalIndex, originalBytes);
  fs.writeFileSync(crashJournal, JSON.stringify({ ...JSON.parse(journalBefore), event_id: 'synthetic-wrong-event' }));
  assert.throws(() => recoverCommanderAuthority(crash), /binding changed/);
  fs.writeFileSync(crashJournal, journalBefore);
  if (missingJournal) fs.unlinkSync(crashJournal);
  const recovered = recoverCommanderAuthority(crash);
  assert.equal(recovered.generation, crash.previous.generation + 1);
  assert.equal(recovered.receiver_adoption.status, 'COMPLETED', JSON.stringify(recovered.receiver_adoption));
  assert.equal(readChain(crash.sealDirectory).records.filter(record => record.handoff_phase === 'AUTHORITY_RECOVERY_COMPLETED').length, completedCount);
  assert.equal(recoverCommanderAuthority(crash).receiver_adoption.writes, 0);
  assert.equal(readCompletedAuthority(crash).writes, 0);
  assert.equal(verifyChain(crash.sealDirectory, crash).status, 'PASS');
  if (missingJournal) {
    const countAfterAdoption = readChain(crash.sealDirectory).records.length;
    fs.unlinkSync(crashJournal);
    assert.throws(() => readCompletedAuthority(crash), /journal|ENOENT/);
    assert.equal(recoverCommanderAuthority(crash).receiver_adoption.writes, 0);
    assert.equal(readChain(crash.sealDirectory).records.length, countAfterAdoption);
  }
}
// Exercise the actual authority planner with local fixtures and simulated
// transports. Restore builtin bindings before any subsequent fixture runs.
const remoteFixture = faultFixture();
const configured = childProcess.spawnSync('git', ['-C', remoteFixture.sourceRoot, 'remote', 'set-url', 'origin',
  'https://github.com/synthetic/example.git'], { encoding: 'utf8', windowsHide: true });
assert.equal(configured.status, 0);
const expectedHead = remoteFixture.observation.remote.head;
const originalSpawn = childProcess.spawnSync;
const queryTools = path.join(path.dirname(remoteFixture.sourceRoot), 'synthetic-query-tools');
fs.mkdirSync(queryTools);
for (const name of ['gh', 'curl']) fs.writeFileSync(path.join(queryTools, process.platform === 'win32' ? `${name}.exe` : name), '');
function remotePlan({ required = false, known = false, gitTimeout = false, curl = 'unavailable',
  credential = 'missing', observedHead = expectedHead } = {}) {
  const calls = [];
  const observation = structuredClone(remoteFixture.observation);
  if (known) observation.remote.head = observedHead;
  else {
    observation.remote = { status: 'UNKNOWN', default_ref: 'refs/heads/main', head: null, observed_at: null };
    observation.restrictions = [...new Set([...observation.restrictions, 'REMOTE_UNOBSERVED'])];
    observation.switch_status = 'READY_WITH_RESTRICTIONS';
    observation.candidate_verification_status = 'PASS_WITH_RESTRICTIONS';
    observation.control_handoff_confidence = 'MEDIUM';
  }
  const savedPath = process.env.PATH;
  process.env.PATH = `${queryTools}${path.delimiter}${savedPath ?? ''}`;
  childProcess.spawnSync = (exe, args, options) => {
    if (exe === 'git' && args.includes('ls-remote')) {
      calls.push('advertisement');
      return gitTimeout ? { status: null, error: { code: 'ETIMEDOUT' } } : { status: 1, stdout: '' };
    }
    if (/^curl(?:\.exe)?$/i.test(path.basename(exe))) {
      const authenticated = args.includes('--config');
      calls.push(authenticated ? 'authenticated' : 'anonymous');
      if (authenticated || curl === 'success') return { status: 0, stdout: JSON.stringify({
        ref: 'refs/heads/main', url: 'https://api.github.com/repos/synthetic/example/git/refs/heads/main',
        object: { type: 'commit', sha: expectedHead }
      }) + (authenticated ? '\n200' : '') };
      if (curl === 'timeout') return { status: 28, stdout: '' };
      if (curl === 'aborted') return { status: null, error: { code: 'ENOBUFS' } };
      return { status: 22, stdout: '' };
    }
    if (/^gh(?:\.exe)?$/i.test(path.basename(exe))) {
      calls.push('credential');
      assert.deepEqual(args, ['auth', 'token', '--hostname', 'github.com']);
      if (credential === 'success') return { status: 0, stdout: 'ghp_SYNTHETIC_ONLY_123\n' };
      return { status: null, error: { code: credential === 'timeout' ? 'ETIMEDOUT' :
        credential === 'aborted' ? 'ENOBUFS' : 'ENOENT' } };
    }
    return originalSpawn(exe, args, options);
  };
  syncBuiltinESMExports();
  try {
    const plan = planAuthorityRecovery({ ...remoteFixture, observation, remoteRequired: required });
    return { plan, calls };
  } catch (error) {
    return { error, calls };
  } finally {
    childProcess.spawnSync = originalSpawn;
    syncBuiltinESMExports();
    if (savedPath === undefined) delete process.env.PATH; else process.env.PATH = savedPath;
    assert.equal(childProcess.spawnSync, originalSpawn);
  }
}
const beforeRemotePlan = readChain(remoteFixture.sealDirectory).records.length;
const optionalMissing = remotePlan();
assert.ok(optionalMissing.plan, optionalMissing.error?.message);
assert.deepEqual(optionalMissing.calls, ['advertisement', 'anonymous', 'credential']);
for (const options of [{ required: true }, { gitTimeout: true }, { curl: 'timeout' }, { curl: 'aborted' }]) {
  const rejected = remotePlan(options);
  assert.match(rejected.error?.message ?? '', /REMOTE_RECHECK_REQUIRED/);
  assert.deepEqual(rejected.calls, options.curl === 'aborted' ? ['advertisement', 'anonymous'] :
    ['advertisement', 'anonymous', 'credential']);
}
const anonymous = remotePlan({ known: true, required: true, curl: 'success' });
assert.ok(anonymous.plan, anonymous.error?.message);
assert.deepEqual(anonymous.calls, ['advertisement', 'anonymous']);
const drifted = remotePlan({ known: true, curl: 'success', observedHead: 'f'.repeat(40) });
assert.match(drifted.error?.message ?? '', /remote observation changed/);
assert.deepEqual(drifted.calls, ['advertisement', 'anonymous']);
for (const credential of ['timeout', 'aborted']) {
  const rejected = remotePlan({ credential });
  assert.match(rejected.error?.message ?? '', /REMOTE_RECHECK_REQUIRED/);
  assert.deepEqual(rejected.calls, ['advertisement', 'anonymous', 'credential']);
}
for (const curl of ['unavailable', 'timeout']) {
  const authenticated = remotePlan({ required: true, known: true, curl, credential: 'success' });
  assert.ok(authenticated.plan, authenticated.error?.message);
  assert.deepEqual(authenticated.calls, ['advertisement', 'anonymous', 'credential', 'authenticated']);
}
assert.equal(readChain(remoteFixture.sealDirectory).records.length, beforeRemotePlan);
console.log('Fault takeover: 14 groups PASS (including independent task_plan, interrupted recovery and 11 real authority-planner remote combinations; synthetic credentials, no external network or authority commit by those combinations).');
