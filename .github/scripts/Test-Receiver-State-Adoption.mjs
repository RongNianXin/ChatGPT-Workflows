// Regression coverage for automatic receiver state adoption after 1D.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { appendSeal, readChain, verifyChain, prepareDirectTransition } from './HandoffSeal.mjs';
import { readGitWorkspaceBaseline } from './Prepare-Handoff.mjs';
import { takeoverHandoff, recoverTakeover, verifyCompletedTakeoverJournal, buildControlPlan } from './Takeover-Handoff.mjs';
import { adoptReceiverState, deriveReceiverAdoption } from './Receiver-State-Adoption.mjs';
import { controlPaths } from './HandoffControl.mjs';
import { verifyHandoffCandidate } from './Verify-Handoff-Candidate.mjs';
import { readReceiverProjection, verifyReceiverReadiness } from './Receiver-Readiness.mjs';
import { captureTransactionWorkspace } from './HandoffTransactionWorkspace.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const workflowRoot = path.join(root, '总指挥工作流/第二代总指挥的工作模式');
const manifestPath = path.join(workflowRoot, '规则刷新manifest.json');
const cache = path.join(root, '.codex-manual-cache');
fs.mkdirSync(cache, { recursive: true });
const temp = fs.mkdtempSync(path.join(cache, 'receiver-adoption-'));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const recipient = { writerId: 'SYNTHETIC-RECEIVER', platformTaskId: '33333333-3333-4333-8333-333333333333', projectKey: 'SYNTHETIC' };
let serial = 0;

function git(rootPath, args) {
  const result = spawnSync('git', ['-C', rootPath, ...args], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function sourceRecord(pathRef, bytes, stamp) {
  return { owner: 'synthetic', path_ref: pathRef, root_ref: 'source_root', digest: hash(bytes), fact_cutoff: stamp };
}

export function fixture({ external = false, alias = false, historicalLoading = false, faultPredecessor = false, jsonContract = false, independentPlan = false, missingProgress = false, contractPointerOnly = false } = {}) {
  const base = path.join(temp, String(++serial));
  const sourceRoot = path.join(base, 'source');
  const sealDirectory = faultPredecessor ? path.join(sourceRoot, '.control/seals') : path.join(base, 'seals');
  fs.mkdirSync(sourceRoot, { recursive: true });
  const externalControlPlaneRoot = external ? path.join(base, 'external') : undefined;
  if (external) fs.mkdirSync(externalControlPlaneRoot);
  fs.writeFileSync(path.join(sourceRoot, '.gitignore'), '.control/\n.receiver-state-adoption/\n');
  const files = {
    status_index: ['.control/status_index.md', '<!-- CURRENT:BEGIN -->\n<!-- CONTROL_IDENTITY: {"generation":1,"writer_id":"SYNTHETIC-OLD","platform_task_id":"00000000-0000-4000-8000-000000000001"} -->\n项目键：SYNTHETIC\n<!-- CURRENT:END -->\n<!-- HISTORY:BEGIN -->\n'],
    central_work_items: ['.control/central_work_items.md', '<!-- CURRENT:BEGIN -->\n<!-- CONTROL_NAVIGATION: {"status_index":".control/status_index.md","root_ref":"source_root"} -->\n当前平台任务：00000000-0000-4000-8000-000000000001\n<!-- CURRENT:END -->\n<!-- HISTORY:BEGIN -->\n'],
    current_view: ['.control/current_view.md', '<!-- CURRENT:BEGIN -->\n<!-- CONTROL_NAVIGATION: {"status_index":".control/status_index.md","root_ref":"source_root"} -->\n当前平台任务：00000000-0000-4000-8000-000000000001\n<!-- CURRENT:END -->\n<!-- HISTORY:BEGIN -->\n'],
    central_entry: ['.control/central_entry.md', '<!-- CURRENT:BEGIN -->\n<!-- CONTROL_NAVIGATION: {"status_index":".control/status_index.md","root_ref":"source_root"} -->\n<!-- CURRENT:END -->\n<!-- HISTORY:BEGIN -->\n'],
    workflow_enablement: ['.control/workflow_enablement.md', '<!-- CURRENT:BEGIN -->\n<!-- CONTROL_NAVIGATION: {"status_index":".control/status_index.md","root_ref":"source_root","central_entry":".control/central_entry.md","central_entry_root_ref":"source_root"} -->\n状态：enabled\n<!-- CURRENT:END -->\n'],
    task_contract: ['task_plan.md', '<a id="current-plan"></a>\n# 总指挥研发计划与续接入口\n'],
    progress: ['progress.md', '# Progress Log\n']
  };
  if (alias) files.central_entry = [...files[alias === 'work-items' ? 'central_work_items' : 'current_view']];
  if (jsonContract) files.task_contract = ['task-contract.json', '{"goal":"preserve JSON contract"}\n'];
  if (independentPlan) files.task_plan = ['receiver-plan.md', '<a id="current-plan"></a>\n# Receiver plan\n'];
  if (missingProgress) delete files.progress;
  if (historicalLoading) files.loading_record = ['.control/historical-loading.json', '{"generation":0,"status":"HISTORICAL"}\n'];
  if (faultPredecessor) {
    files.loading_record = ['.control/historical-loading.json', '{"status":"HISTORICAL"}\n'];
    files.handoff_inventory = ['.control/historical-inventory.json', '{"note":"historical pointer"}\n'];
    files.auxiliary = ['.control/context.json', '{"note":"preserved context"}\n'];
  }
  if (external || alias) for (const [name, item] of Object.entries(files)) {
    item[1] = item[1].replace(/<!-- CONTROL_NAVIGATION: (.*?) -->/g, (_match, json) => {
      const nav = JSON.parse(json);
      if (external) nav.root_ref = 'external_control_plane';
      if (nav.central_entry) {
        nav.central_entry = files.central_entry[0];
        nav.central_entry_root_ref = external ? 'external_control_plane' : 'source_root';
      }
      return `<!-- CONTROL_NAVIGATION: ${JSON.stringify(nav)} -->`;
    });
  }
  const rootFor = name => external && ['status_index', 'central_work_items', 'current_view', 'central_entry'].includes(name) ? externalControlPlaneRoot : sourceRoot;
  for (const [name, [ref, text]] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(rootFor(name), ref)), { recursive: true });
    fs.writeFileSync(path.join(rootFor(name), ref), text);
  }
  git(sourceRoot, ['init', '--quiet', '--initial-branch=main']);
  git(sourceRoot, ['add', '--', '.gitignore', ...Object.entries(files).filter(([name]) => ['task_contract', 'task_plan', 'progress'].includes(name)).map(([, item]) => item[0])]);
  git(sourceRoot, ['-c', 'user.name=Synthetic Test', '-c', 'user.email=test@example.invalid', 'commit', '--quiet', '-m', 'synthetic adoption']);
  git(sourceRoot, ['remote', 'add', 'origin', sourceRoot]);
  const stamp = '2026-01-01T00:00:00.000Z';
  const sources = Object.fromEntries(Object.entries(files).filter(([name]) => !contractPointerOnly || name !== 'task_contract').map(([name, [ref, text]]) => [name, {
    ...sourceRecord(ref, Buffer.from(text), stamp),
    root_ref: rootFor(name) === sourceRoot ? 'source_root' : 'external_control_plane'
  }]));
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const draft = {
    schema_version: 3, record_type: 'handoff-seal', generation: 1, writer_id: 'SYNTHETIC-OLD', old_writer_status: 'STOPPED_DISPATCH',
    fact_cutoff: stamp, sealed_at: stamp, event_id: 'synthetic-material', sources, source_digest_status: 'PASS',
    rule_baseline: { rule_version: manifest.rule_version, manifest_sha256: hash(fs.readFileSync(manifestPath)) },
    objective: { summary: 'synthetic automatic adoption', breakpoint: 'read-only' }, prohibitions: ['remote-write'], communications: { status: 'NONE' },
    workspace: { root_ref: '<PROJECT_ROOT>', ...readGitWorkspaceBaseline(sourceRoot), required_untracked: [] },
    remote: { status: 'PASS', default_ref: 'refs/heads/main', head: git(sourceRoot, ['rev-parse', 'HEAD']), observed_at: stamp },
    control_handoff_confidence: 'HIGH', candidate_verification_status: 'PASS', switch_status: 'READY', handoff_phase: 'MATERIAL_PREPARED',
    runtime_acceptance_status: 'NOT_RUN', professional_acceptance_status: 'NOT_APPLICABLE', transition: null, migration: null,
    invalidation_conditions: ['source drift'], seal_digest: ''
  };
  const material = appendSeal(sealDirectory, draft, { sourceRoot, externalControlPlaneRoot, workflowRoot, manifestPath });
  const confirmation = {
    protocol_version: 1, origin: 'CURRENT_OPERATOR_MESSAGE', evidence_ref: 'synthetic-direct-confirmation', confirmed_at: new Date().toISOString(),
    project_key: 'SYNTHETIC', previous_seal_digest: material.seal_digest, old_generation: 1, old_writer_id: 'SYNTHETIC-OLD',
    old_writer_status: 'STOPPED_DISPATCH', recipient_writer_id: recipient.writerId, recipient_platform_id: recipient.platformTaskId,
    scope: 'HANDOFF_PREPARE_COMMIT_ONLY', transfer_confirmed: true
  };
  return { sourceRoot, externalControlPlaneRoot, sealDirectory, workflowRoot, manifestPath, receiverStateRoot: path.join(sourceRoot, '.receiver-state-adoption'), recipient, confirmation, eventId: 'synthetic-takeover', material };
}

function run() {
  const f = fixture();
  const first = takeoverHandoff(f);
  assert.equal(first.status, 'COMPLETED');
  assert.equal(first.control_handoff, 'COMPLETED');
  assert.equal(first.receiver_adoption.status, 'COMPLETED');
  assert.equal(first.receiver_adoption.coordination_status, 'ACTIVE');
  assert.equal(first.receiver_adoption.coordination_scope, 'FULL_CENTRAL_COORDINATION');
  assert.equal(first.receiver_adoption.target_count, 5);
  assert.equal(first.receiver_adoption.writes, 6);
  const firstHistory = readChain(f.sealDirectory);
  assert.equal(firstHistory.records.at(-1).handoff_phase, 'CURRENT_ATTESTATION');
  const firstConfig = deriveReceiverAdoption(f, firstHistory.records.at(-2));
  assert.equal(fs.existsSync(path.join(f.sourceRoot, firstConfig.loading_record.path_ref)), true);
  for (const [ref, marker] of [['task_plan.md', 'RECEIVER_ADOPTION_TASK_PLAN'], ['progress.md', 'RECEIVER_ADOPTION_PROGRESS'], ['.control/central_work_items.md', 'RECEIVER_ADOPTION_CENTRAL_WORK_ITEMS'], ['.control/current_view.md', 'RECEIVER_ADOPTION_CURRENT_VIEW']]) {
    assert.match(fs.readFileSync(path.join(f.sourceRoot, ref), 'utf8'), new RegExp(`${marker}:BEGIN`));
  }
  const second = takeoverHandoff(f);
  assert.equal(second.status, 'COMPLETED');
  assert.equal(second.receiver_adoption.status, 'COMPLETED');
  assert.equal(second.receiver_adoption.writes, 0);
  assert.equal(readChain(f.sealDirectory).records.length, firstHistory.records.length);
  assert.equal(verifyChain(f.sealDirectory, f).status, 'PASS');

  const retry = fixture();
  const failed = takeoverHandoff({ ...retry, fault: point => { if (point === 'after-adoption-write-0') throw new Error('adoption interruption'); } });
  assert.equal(failed.control_handoff, 'COMPLETED');
  assert.equal(failed.receiver_adoption.status, 'BLOCKED');
  assert.equal(readChain(retry.sealDirectory).records.at(-1).handoff_phase, 'TAKEOVER_COMPLETED');
  const recovered = takeoverHandoff(retry);
  assert.equal(recovered.receiver_adoption.status, 'COMPLETED');

  const interrupted = fixture();
  assert.throws(() => takeoverHandoff({ ...interrupted, fault: point => { if (point === 'after-journal') throw new Error('control interruption'); } }), /control interruption/);
  const resumed = recoverTakeover(interrupted);
  assert.equal(resumed.control_handoff, 'COMPLETED');
  assert.equal(resumed.receiver_adoption.status, 'COMPLETED');
  assert.equal(verifyChain(interrupted.sealDirectory, interrupted).status, 'PASS');

  for (const flags of [{ external: true }, { alias: true }, { historicalLoading: true }, { external: true, alias: true, historicalLoading: true }]) {
    const sample = fixture(flags);
    const result = takeoverHandoff(sample);
    assert.equal(result.receiver_adoption.status, 'COMPLETED', JSON.stringify(result.receiver_adoption));
    const history = readChain(sample.sealDirectory);
    assert.equal(verifyChain(sample.sealDirectory, sample).status, 'PASS');
    for (const [name, source] of Object.entries(sample.material.sources)) {
      const after = history.records.at(-1).sources[name];
      assert.equal(after.path_ref, source.path_ref);
      assert.equal(after.root_ref, source.root_ref);
      assert.equal(after.owner, source.owner);
    }
    if (flags.alias) assert.equal(history.records.at(-1).sources.current_view.digest, history.records.at(-1).sources.central_entry.digest);
    if (flags.historicalLoading) assert.equal(history.records.at(-1).sources.loading_record.digest, sample.material.sources.loading_record.digest);
    if (flags.external) assert.ok(!history.records.at(-1).workspace.required_untracked.some(item => item.path_ref.startsWith('../')));
    assert.equal(takeoverHandoff(sample).receiver_adoption.writes, 0);
  }

  const settled = readChain(f.sealDirectory);
  const material2 = structuredClone(settled.records.at(-1));
  Object.assign(material2, { handoff_phase: 'MATERIAL_PREPARED', switch_status: 'READY', event_id: 'synthetic-material-2', seal_digest: '' });
  const nextMaterial = appendSeal(f.sealDirectory, material2, f);
  const next = { ...f, eventId: 'synthetic-takeover-2',
    recipient: { ...recipient, writerId: 'SYNTHETIC-RECEIVER-2', platformTaskId: '44444444-4444-4444-8444-444444444444' },
    confirmation: { ...f.confirmation, previous_seal_digest: nextMaterial.seal_digest, old_generation: 2,
      old_writer_id: recipient.writerId, recipient_writer_id: 'SYNTHETIC-RECEIVER-2',
      recipient_platform_id: '44444444-4444-4444-8444-444444444444', confirmed_at: new Date().toISOString() }
  };
  const result2 = takeoverHandoff(next);
  assert.equal(result2.receiver_adoption.status, 'COMPLETED', JSON.stringify(result2.receiver_adoption));
  const secondConfig = deriveReceiverAdoption(next, readChain(f.sealDirectory).records.at(-2));
  assert.notEqual(firstConfig.directory, secondConfig.directory);
  assert.ok(fs.existsSync(path.join(f.sourceRoot, firstConfig.directory, 'receiver-state-adoption.json')));
  assert.equal(takeoverHandoff(next).receiver_adoption.writes, 0);
  assert.equal(verifyChain(f.sealDirectory, f).status, 'PASS');

  const logCase = fixture();
  const completion = takeoverHandoff({ ...logCase, fault: p => { if (p === 'after-adoption-write-0') throw Error('defer adoption'); } });
  assert.equal(completion.receiver_adoption.status, 'BLOCKED');
  const history = readChain(logCase.sealDirectory);
  const journalFile = controlPaths(history.records.at(-1), logCase).journal;
  const journal = JSON.parse(fs.readFileSync(journalFile));
  assert.equal(verifyCompletedTakeoverJournal(journal, logCase, history).seal_digest, history.records.at(-1).seal_digest);
  const altered = structuredClone(journal);
  altered.draft.objective.summary = 'tampered';
  assert.throws(() => verifyCompletedTakeoverJournal(altered, logCase, history));

  // A hard exit leaves durable half-writes. Only release locks of this exact
  // synthetic child after spawnSync has confirmed its exit, then resume.
  for (let point = 0; point <= 5; point++) {
    const crash = fixture();
    const defer = takeoverHandoff({ ...crash, fault: p => { if (p === 'after-adoption-write-0') throw Error('defer'); } });
    assert.equal(defer.receiver_adoption.status, 'BLOCKED');
    const completed = readChain(crash.sealDirectory).records.at(-1);
    const adoption = deriveReceiverAdoption(crash, completed);
    const config = { ...crash, adoption, crashPoint: point };
    const configPath = path.join(crash.sourceRoot, '.control/crash-config.json');
    fs.writeFileSync(configPath, JSON.stringify(config));
    const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--crash-child', configPath], { encoding: 'utf8', timeout: 60000 });
    assert.equal(child.status, 81, child.stderr);
    for (const lock of [controlPaths(completed, crash).lock, path.join(crash.sourceRoot, adoption.directory, '.receiver-state-adoption.lock')]) {
      if (fs.existsSync(lock)) {
        const owned = JSON.parse(fs.readFileSync(lock));
        assert.equal(owned.pid, child.pid);
        fs.unlinkSync(lock);
      }
    }
    const resumed = takeoverHandoff(crash);
    assert.equal(resumed.receiver_adoption.status, 'COMPLETED', JSON.stringify(resumed.receiver_adoption));
    assert.equal(takeoverHandoff(crash).receiver_adoption.writes, 0);
    assert.equal(verifyChain(crash.sealDirectory, crash).status, 'PASS');
  }
  console.log('Receiver state adoption: 16 PASS. Events, roots, aliases, historical loading, completed journals, and six durable crash points verified.');
}

function centralAliasTests() {
  let count = 0;
  for (const external of [false, true]) {
    const sample = fixture({ external });
    for (const kind of ['central_work_items', 'current_view']) {
      const seal = structuredClone(sample.material);
      seal.sources = { [kind]: seal.sources[kind], central_entry: structuredClone(seal.sources[kind]) };
      const target = { kind, source_name: kind, path_ref: seal.sources[kind].path_ref,
        root_ref: seal.sources[kind].root_ref };
      assert.ok(readReceiverProjection(target, seal, sample).bytes.length);
      count++;
      const changes = [
        value => { value.sources.central_entry.digest = '0'.repeat(64); },
        value => { value.sources.central_entry.path_ref = `./${target.path_ref}`; },
        value => { value.sources.central_entry.root_ref = external ? 'source_root' : 'external_control_plane'; },
        ...['status_index', 'task_contract', 'progress', 'workflow_enablement'].map(name =>
          value => { value.sources[name] = structuredClone(value.sources[kind]); })
      ];
      for (const change of changes) {
        const bad = structuredClone(seal); change(bad);
        const samePhysicalRoots = { ...sample, sourceRoot: external ? sample.externalControlPlaneRoot : sample.sourceRoot,
          externalControlPlaneRoot: external ? sample.externalControlPlaneRoot : sample.sourceRoot };
        assert.throws(() => readReceiverProjection(target, bad, samePhysicalRoots), /projection aliases protected source/);
        count++;
      }
    }
  }
  console.log(`Central projection aliases: PASS (${count} exact-binding and protected-source cases)`);
}

function readinessTests() {
  let count = 0;
  for (const flags of [{ missingProgress: true }, { jsonContract: true }]) {
    const f = fixture(flags), before = fs.readFileSync(path.join(f.sourceRoot, '.control/status_index.md'));
    const candidate = verifyHandoffCandidate(f);
    assert.equal(candidate.status, 'BLOCKED');
    assert.match(candidate.errors.join('; '), /receiver readiness/);
    assert.equal(candidate.rotation.can_stop_old, false);
    assert.throws(() => takeoverHandoff(f), /receiver readiness/);
    assert.equal(readChain(f.sealDirectory).pending_intents.length, 0);
    assert.equal(fs.existsSync(controlPaths(f.material, f).journal), false);
    assert.deepEqual(fs.readFileSync(path.join(f.sourceRoot, '.control/status_index.md')), before);
    count++;
  }
  for (const flags of [{}, { jsonContract: true, independentPlan: true }, { independentPlan: true, contractPointerOnly: true }, { jsonContract: true, independentPlan: true, external: true, alias: true }, { alias: 'work-items' }, { external: true, alias: 'work-items' }]) {
    const f = fixture(flags);
    const original = fs.readFileSync(path.join(f.sourceRoot, f.material.sources.task_contract?.path_ref ?? 'task_plan.md'));
    const result = takeoverHandoff(f);
    assert.equal(result.receiver_adoption.status, 'COMPLETED', JSON.stringify(result));
    assert.equal(takeoverHandoff(f).receiver_adoption.writes, 0);
    assert.equal(verifyChain(f.sealDirectory, f).status, 'PASS');
    if (flags.jsonContract) assert.deepEqual(fs.readFileSync(path.join(f.sourceRoot, 'task-contract.json')), original);
    count++;
  }
  for (const change of [
    seal => { seal.sources.progress.digest = '0'.repeat(64); },
    seal => { seal.sources.task_plan = { ...seal.sources.task_contract, path_ref: seal.sources.status_index.path_ref }; },
    seal => { seal.sources.progress.root_ref = 'external_control_plane'; },
    seal => { delete seal.sources.progress; seal.workspace.required_untracked = [{ path_ref: 'progress.md', sha256: '0'.repeat(64) }]; },
    (seal, sample) => { delete seal.sources.progress; seal.workspace.required_untracked = [1, 2].map(() => ({ path_ref: 'progress.md', sha256: hash(fs.readFileSync(path.join(sample.sourceRoot, 'progress.md'))) })); },
    (seal, sample) => {
      const file = path.join(sample.sourceRoot, '.git/config');
      fs.appendFileSync(file, '\n# Progress Log\n');
      seal.sources.progress = { ...seal.sources.progress, path_ref: '.GiT/config', digest: hash(fs.readFileSync(file)) };
    },
    (seal, sample) => {
      const file = path.join(sample.sourceRoot, '.git/config');
      fs.appendFileSync(file, '\n# Progress Log\n');
      fs.symlinkSync(path.join(sample.sourceRoot, '.git'), path.join(sample.sourceRoot, 'metadata-alias'), process.platform === 'win32' ? 'junction' : 'dir');
      seal.sources.progress = { ...seal.sources.progress, path_ref: 'metadata-alias/config', digest: hash(fs.readFileSync(file)) };
    }
  ]) {
    const sample = fixture();
    const seal = structuredClone(sample.material); change(seal, sample);
    assert.throws(() => verifyReceiverReadiness(seal, sample), /receiver readiness/);
    count++;
  }
  const explicit = fixture(), completed = takeoverHandoff(explicit);
  assert.equal(completed.receiver_adoption.status, 'COMPLETED');
  // A new intent cannot bind an explicit configuration to an unknown future seal.
  const bad = fixture();
  const plan = buildControlPlan(bad.material, bad), preview = structuredClone(bad.material);
  Object.assign(preview, { generation: 2, writer_id: bad.recipient.writerId, event_id: bad.eventId });
  for (const item of plan) for (const name of item.names) preview.sources[name].digest = item.after_sha256;
  const adoption = deriveReceiverAdoption(bad, preview, plan);
  for (const mutate of [
    value => { value.expected_event_id = 'wrong-event'; },
    value => { value.expected_completed_seal_digest = '0'.repeat(64); },
    value => { value.rule_loading = { status: 'INVALID' }; }
  ]) {
    const changed = structuredClone(adoption); mutate(changed);
    assert.throws(() => takeoverHandoff({ ...bad, adoption: changed }), /new takeover requires automatic binding/);
    assert.equal(readChain(bad.sealDirectory).pending_intents.length, 0);
    assert.equal(fs.existsSync(controlPaths(bad.material, bad).journal), false);
  }
  console.log(`Receiver readiness: ${count + 3} PASS; candidate/write-before gates, JSON preservation, aliases, protected evidence and idempotence.`);
}

function legacyJsonTest() {
  const f = fixture({ jsonContract: true });
  // Reconstruct a legitimately frozen old transaction, not a new takeover
  // through today's readiness gate. Recovery must preserve that old intent.
  const plan = buildControlPlan(f.material, f);
  const projection = captureTransactionWorkspace(f.material, plan, f);
  const intent = prepareDirectTransition(f.sealDirectory, { ...f,
    expectedPreviousDigest: f.material.seal_digest,
    workspace_projection_sha256: hash(Buffer.from(JSON.stringify(projection))) }).intent;
  const stamp = new Date().toISOString(), draft = structuredClone(f.material);
  Object.assign(draft, { schema_version: 4, generation: 2, writer_id: f.recipient.writerId,
    event_id: f.eventId, fact_cutoff: stamp, sealed_at: stamp, switch_status: 'COMPLETED',
    handoff_phase: 'TAKEOVER_COMPLETED', communications: { status: 'NONE' }, restrictions: [], seal_digest: '' });
  for (const item of plan) for (const name of item.names) {
    draft.sources[name].digest = item.after_sha256; draft.sources[name].fact_cutoff = stamp;
  }
  fs.writeFileSync(controlPaths(f.material, f).journal, JSON.stringify({
    protocol_version: 1, current_render_version: 9, workspace_projection: projection, status: 'PREPARED',
    event_id: f.eventId, previous_seal_digest: f.material.seal_digest, confirmation: f.confirmation,
    intent_digest: intent.transition_digest,
    intent_path: `handoff-transition.${intent.previous_sequence}.${intent.transition_digest}.json`,
    plan, draft, prepared_at: stamp
  }));
  const result = recoverTakeover({ ...f, fault: point => { if (point === 'before-receiver-adoption') throw Error('defer adoption'); } });
  assert.equal(result.control_handoff, 'COMPLETED');
  const completed = readChain(f.sealDirectory).records.at(-1);
  const directory = '.receiver-state-adoption/explicit-legacy';
  const adoption = { directory, expected_event_id: f.eventId, expected_completed_seal_digest: completed.seal_digest,
    loading_record: { path_ref: `${directory}/loading-record.json`, create_if_missing: true },
    targets: [['task_plan', 'task_contract', 'preserve JSON contract'], ['progress', 'progress', '# Progress Log'],
      ['central_work_items', 'central_work_items', `当前平台任务：${f.recipient.platformTaskId}`],
      ['current_view', 'current_view', `当前平台任务：${f.recipient.platformTaskId}`]].map(([kind, source_name, anchor]) => ({
      kind, source_name, path_ref: completed.sources[source_name].path_ref,
      expected_sha256: completed.sources[source_name].digest, mode: 'insert_after', anchor,
      marker: `RECEIVER_ADOPTION_${kind.toUpperCase()}`, allow_tracked: true
    })) };
  const before = fs.readFileSync(path.join(f.sourceRoot, 'task-contract.json'));
  assert.throws(() => adoptReceiverState({ ...f, adoption }), /must be Markdown/);
  assert.deepEqual(fs.readFileSync(path.join(f.sourceRoot, 'task-contract.json')), before);
  assert.equal(fs.existsSync(path.join(f.sourceRoot, directory, 'receiver-state-adoption.json')), false);
  assert.equal(verifyChain(f.sealDirectory, f).status, 'PASS');
  console.log('Legacy explicit JSON protection: PASS; old frozen control recovery retained, no adoption plan or JSON mutation.');
}

if (process.argv[2] === '--crash-child' && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const config = JSON.parse(fs.readFileSync(process.argv[3]));
  adoptReceiverState({ ...config, fault: p => {
    if (p === (config.crashPoint === 5 ? 'after-adoption-attestation' : `after-adoption-write-${config.crashPoint}`)) process.exit(81);
  } });
} else if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--central-alias')) centralAliasTests();
  else if (process.argv.includes('--legacy-json')) legacyJsonTest();
  else if (process.argv.includes('--readiness')) readinessTests();
  else {
    centralAliasTests();
    readinessTests();
    legacyJsonTest();
    run();
  }
}
