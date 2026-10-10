// Synthetic journey regression: one receiving window, no return to the old writer.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { appendSeal, prepareTransition, verifyChain, verifyControlIdentity, validateSeal } from './HandoffSeal.mjs';
import { readGitWorkspaceBaseline } from './Prepare-Handoff.mjs';
import { takeoverHandoff, recoverTakeover, rollbackTakeover } from './Takeover-Handoff.mjs';
import { controlPaths, withControlLock, withControlTransaction } from './HandoffControl.mjs';
import { verifyHandoffCandidate } from './Verify-Handoff-Candidate.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const cache = path.join(root, '.codex-manual-cache');
assert.equal(spawnSync('git', ['-C', root, 'check-ignore', '--quiet', '--', '.codex-manual-cache/direct-probe']).status, 0, 'synthetic cache must be Git-ignored');
fs.mkdirSync(cache, { recursive: true });
const temp = fs.mkdtempSync(path.join(cache, 'direct-'));
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const workflowRoot = path.join(root, '总指挥工作流/第二代总指挥的工作模式');
const manifestPath = path.join(workflowRoot, '规则刷新manifest.json');
const recipient = { writerId: 'SYNTHETIC-NEW', platformTaskId: '11111111-1111-4111-8111-111111111111', projectKey: 'SYNTHETIC' };
let count = 0;
function fixture(external = false, overrides = {}, englishDeclarations = false, preparationFields = '', layout = '', scoped = false, existingChange = false) {
  const base = path.join(temp, String(++count)); fs.mkdirSync(base);
  const sourceRoot = path.join(base, 'source'); fs.mkdirSync(sourceRoot);
  const externalControlPlaneRoot = external ? path.join(base, 'external') : undefined;
  if (external) fs.mkdirSync(externalControlPlaneRoot);
  const git = args => { const r = spawnSync('git', ['-C', sourceRoot, ...args], { encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); return r.stdout.trim(); };
  git(['init', '--quiet', '--initial-branch=main']);
  fs.writeFileSync(path.join(sourceRoot, '.gitignore'), '.control/\n');
  fs.writeFileSync(path.join(sourceRoot, 'probe.txt'), 'base\n');
  git(['add', '--', '.gitignore', 'probe.txt']);
  git(['-c', 'user.name=Synthetic Test', '-c', 'user.email=test@example.invalid', 'commit', '--quiet', '-m', 'synthetic']);
  git(['remote', 'add', 'origin', sourceRoot]);
  const stamp = '2026-01-01T00:00:00.000Z', sources = {};
  for (const name of ['status_index', 'central_work_items', 'current_view', 'central_entry', 'workflow_enablement']) {
    const rootRef = external ? 'external_control_plane' : 'source_root';
    const metadata = name === 'status_index' ? { generation: 1, writer_id: 'SYNTHETIC-OLD', platform_task_id: 'UNKNOWN' }
      : { status_index: '.control/status_index.md', root_ref: rootRef, ...(name === 'workflow_enablement' ? { central_entry: '.control/central_entry.md', central_entry_root_ref: rootRef } : {}) };
    const body = `<!-- CURRENT:BEGIN -->\n<!-- ${name === 'status_index' ? 'CONTROL_IDENTITY' : 'CONTROL_NAVIGATION'}: ${JSON.stringify(metadata)} -->\n${name === 'status_index' ? '项目键：SYNTHETIC\n' : ''}${name === 'workflow_enablement' ? '状态：enabled\n' : ''}${englishDeclarations && (name !== 'workflow_enablement' || englishDeclarations === 'all') ? 'writer_id: SYNTHETIC-OLD\ngeneration=1\nplatform_task_id: UNKNOWN\n' : ''}<!-- CURRENT:END -->\n<!-- HISTORY:BEGIN -->\nPreserved synthetic history\n`;
    const pathRef = `.control/${name}.md`, file = path.join(externalControlPlaneRoot || sourceRoot, pathRef);
    const preparedBody = name === 'workflow_enablement' ? body : body.replace('<!-- CURRENT:END -->', `${preparationFields}<!-- CURRENT:END -->`);
    fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, preparedBody);
    sources[name] = { owner: 'synthetic', path_ref: pathRef, root_ref: rootRef, digest: hash(Buffer.from(preparedBody)), fact_cutoff: stamp };
  }
  if (layout === 'untracked-entry') fs.writeFileSync(path.join(sourceRoot, '.gitignore'), '.control/*\n!.control/central_entry.md\n');
  else if (layout) {
    git(['add', '-f', '--', `.control/${layout === 'index' ? 'status_index' : 'central_entry'}.md`]);
    git(['-c', 'user.name=Synthetic Test', '-c', 'user.email=test@example.invalid', 'commit', '--quiet', '-m', 'synthetic layout']);
  }
  const sealDirectory = path.join(base, 'seals');
  if (existingChange) fs.appendFileSync(path.join(sourceRoot, 'probe.txt'), 'original accepted change\n');
  let inflightScope = null;
  if (scoped) {
    fs.mkdirSync(path.join(sourceRoot, 'business'));
    fs.writeFileSync(path.join(sourceRoot, 'business/probe.txt'), 'independent activity');
    const ownershipRef = '.control/ownership.json', ownership = Buffer.from('{"owner":"synthetic-worker"}\n');
    fs.writeFileSync(path.join(sourceRoot, ownershipRef), ownership);
    sources.ownership = { owner: 'synthetic', path_ref: ownershipRef, digest: hash(ownership), fact_cutoff: stamp };
    inflightScope = { excluded_roots: [{ path_ref: 'business', owner: 'synthetic-worker', reason: 'independent activity', ownership_source_ref: ownershipRef }] };
  }
  const draft = { schema_version: 3, record_type: 'handoff-seal', generation: 1, writer_id: 'SYNTHETIC-OLD', old_writer_status: 'UNKNOWN', fact_cutoff: stamp, sealed_at: stamp, event_id: 'synthetic-material', sources, source_digest_status: 'PASS', rule_baseline: { rule_version: JSON.parse(fs.readFileSync(manifestPath)).rule_version, manifest_sha256: hash(fs.readFileSync(manifestPath)) }, objective: { summary: 'synthetic', breakpoint: 'read-only' }, prohibitions: ['remote-write'], communications: { status: 'NONE' }, workspace: { root_ref: '<PROJECT_ROOT>', ...readGitWorkspaceBaseline(sourceRoot), required_untracked: [] }, remote: { status: 'PASS', default_ref: 'refs/heads/main', head: git(['rev-parse', 'HEAD']), observed_at: stamp }, control_handoff_confidence: 'HIGH', candidate_verification_status: 'PASS', switch_status: 'READY', handoff_phase: 'MATERIAL_PREPARED', runtime_acceptance_status: 'NOT_RUN', professional_acceptance_status: 'NOT_APPLICABLE', transition: null, migration: null, invalidation_conditions: ['source drift'], seal_digest: '' };
  Object.assign(draft, overrides);
  if (scoped) draft.workspace = { root_ref: '<PROJECT_ROOT>', ...readGitWorkspaceBaseline(sourceRoot, [], inflightScope), required_untracked: [] };
  const material = appendSeal(sealDirectory, draft, { sourceRoot, externalControlPlaneRoot });
  const confirmation = { protocol_version: 1, origin: 'CURRENT_OPERATOR_MESSAGE', evidence_ref: 'synthetic-direct-confirmation', confirmed_at: new Date().toISOString(), project_key: 'SYNTHETIC', previous_seal_digest: material.seal_digest, old_generation: 1, old_writer_id: 'SYNTHETIC-OLD', old_writer_status: 'STOPPED_DISPATCH', recipient_writer_id: recipient.writerId, recipient_platform_id: recipient.platformTaskId, scope: 'HANDOFF_PREPARE_COMMIT_ONLY', transfer_confirmed: true };
  return { sourceRoot, externalControlPlaneRoot, sealDirectory, workflowRoot, manifestPath, recipient, confirmation, eventId: 'synthetic-takeover', material, git };
}
let passed = 0;
function check(name, fn) { fn(); passed++; console.log(`PASS: ${name}`); }

const one = fixture();
check('preflight refuses a tracked private index before recommending stop', () => {
  const f = fixture(false, {}, false, '', 'index');
  const result = verifyHandoffCandidate(f);
  assert.equal(result.status, 'BLOCKED'); assert.equal(result.rotation.can_stop_old, false);
  assert.match(result.errors.join(';'), /CONTROL_STORAGE|ignored and untracked/);
  assert.match(result.actions.join(';'), /未停旧时不得建议停旧/);
  assert.match(result.actions.join(';'), /已停旧时不得恢复旧调度/);
  assert.equal(verifyChain(f.sealDirectory, f).records.length, 1);
});
check('tracked central entry completes without treating its own writes as drift', () => {
  const f = fixture(false, {}, false, '', 'entry');
  assert.equal(takeoverHandoff(f).status, 'COMPLETED');
  assert.equal(takeoverHandoff(f).status, 'COMPLETED');
  const live = verifyChain(f.sealDirectory, f);
  assert.equal(live.status, 'PASS', live.errors.join(';'));
  assert.deepEqual(live.latest.workspace.worktree_fingerprint, readGitWorkspaceBaseline(f.sourceRoot).worktree_fingerprint);
});
check('untracked central entry completes and records its new content baseline', () => {
  const f = fixture(false, {}, false, '', 'untracked-entry');
  assert.equal(takeoverHandoff(f).status, 'COMPLETED');
  assert.equal(verifyChain(f.sealDirectory, f).status, 'PASS');
  assert.equal(takeoverHandoff(f).status, 'COMPLETED');
});
for (const stage of ['after-journal', 'after-write-3', 'before-seal', 'after-seal']) {
  check(`tracked entry recovers interruption at ${stage}`, () => {
    const f = fixture(false, {}, false, '', 'entry');
    assert.throws(() => takeoverHandoff({ ...f, fault: point => { if (point === stage) throw new Error('tracked interruption'); } }), /tracked interruption/);
    assert.equal(recoverTakeover(f).status, 'COMPLETED');
    assert.equal(verifyChain(f.sealDirectory, f).status, 'PASS');
  });
}
check('tracked entry rollback preserves unrelated drift and exact originals', () => {
  const f = fixture(false, {}, false, '', 'entry');
  assert.throws(() => takeoverHandoff({ ...f, fault: point => { if (point === 'before-seal') throw new Error('tracked interruption'); } }));
  fs.appendFileSync(path.join(f.sourceRoot, 'probe.txt'), 'unrelated drift');
  assert.throws(() => recoverTakeover(f), /workspace changed/);
  assert.equal(rollbackTakeover(f).status, 'ROLLED_BACK_STOPPED');
  assert.equal(hash(fs.readFileSync(path.join(f.sourceRoot, '.control/central_entry.md'))), f.material.sources.central_entry.digest);
  assert.match(fs.readFileSync(path.join(f.sourceRoot, 'probe.txt'), 'utf8'), /unrelated drift/);
});
check('same-count staging OID changes cannot hide behind unchanged worktree', () => {
  const f = fixture(false, {}, false, '', 'entry');
  assert.throws(() => takeoverHandoff({ ...f, fault: point => { if (point === 'after-journal') throw new Error('index interruption'); } }));
  f.git(['add', '--', 'probe.txt']);
  const staged = spawnSync('git', ['-C', f.sourceRoot, 'hash-object', '-w', '--stdin'], { input: 'different index-only bytes\n', encoding: 'utf8' });
  assert.equal(staged.status, 0);
  f.git(['update-index', '--cacheinfo', `100644,${staged.stdout.trim()},probe.txt`]);
  assert.equal(fs.readFileSync(path.join(f.sourceRoot, 'probe.txt'), 'utf8'), 'base\n');
  assert.throws(() => recoverTakeover(f), /worktree or index changed/);
});
for (const field of ['controlDiffs', 'index', 'controlModes', 'remove']) check(`immutable intent rejects forged workspace ${field} before any writes`, () => {
  // Seal an existing unrelated change, then interrupt before the first central write.
  const f = fixture(false, {}, false, '', 'entry', false, true);
  assert.throws(() => takeoverHandoff({ ...f, fault: point => { if (point === 'after-journal') throw new Error('anchor interruption'); } }), /anchor interruption/);
  const journalPath = controlPaths(f.material, f).journal, journal = JSON.parse(fs.readFileSync(journalPath));
  if (field === 'controlDiffs') {
    const diff = spawnSync('git', ['-C', f.sourceRoot, 'diff', '--binary', 'HEAD', '--', 'probe.txt']);
    journal.workspace_projection.before.controlDiffs.push(diff.stdout.toString('base64'));
    fs.writeFileSync(path.join(f.sourceRoot, 'probe.txt'), 'base\n');
  } else if (field === 'index') {
    f.git(['add', '--', 'probe.txt']);
    journal.workspace_projection.before.index = spawnSync('git', ['-C', f.sourceRoot, 'ls-files', '--stage', '-z']).stdout.toString('base64');
  } else if (field === 'controlModes') journal.workspace_projection.before.controlModes[0] = 'FORGED';
  else delete journal.workspace_projection;
  fs.writeFileSync(journalPath, JSON.stringify(journal));
  assert.throws(() => recoverTakeover(f), /immutable anchor mismatch/);
  for (const item of journal.plan) assert.equal(hash(fs.readFileSync(path.join(f.sourceRoot, item.path_ref))), item.before_sha256);
});
check('scoped tracked control entry preserves the original independent activity boundary', () => {
  const f = fixture(false, {}, false, '', 'entry', true);
  assert.equal(takeoverHandoff({ ...f, fault: point => { if (point === 'after-write-1') fs.appendFileSync(path.join(f.sourceRoot, 'business/probe.txt'), 'continued'); } }).status, 'COMPLETED');
  const live = verifyChain(f.sealDirectory, f);
  assert.equal(live.status, 'PASS', live.errors.join(';'));
  assert.deepEqual(live.latest.workspace.inflight_scope, f.material.workspace.inflight_scope);
  assert.equal(takeoverHandoff(f).status, 'COMPLETED');
});
check('one receiving call completes without a separately delivered ticket', () => {
  const result = takeoverHandoff(one); assert.equal(result.status, 'COMPLETED');
  const live = verifyChain(one.sealDirectory, one); assert.equal(live.status, 'PASS', live.errors.join('; '));
  assert.equal(live.latest.generation, 2); assert.equal(live.latest.writer_id, recipient.writerId);
  assert.equal(live.latest.schema_version, 4); assert.equal(live.pending_intents.length, 0);
  assert.equal(live.records[0].seal_digest, one.material.seal_digest);
});
check('same event retry is idempotent', () => { assert.equal(takeoverHandoff(one).status, 'COMPLETED'); assert.equal(verifyChain(one.sealDirectory, one).records.length, 2); });
check('new CURRENT retires preparation fields without inheriting loading or business authority', () => {
  const f = fixture(false, {}, false, '# 当前交接准备\n状态：ACTIVE_FROZEN_NOT_STOPPED；MATERIAL_PREPARED\n候选事件：old-candidate\n加载记录：old-loading.json\n任务契约与工具限定放行：old-contract.md\n精确断点：preserve-business-breakpoint\n非终态：8\n禁止项：remote-write\n下一行动方：return-to-old-writer\n');
  const material = f.material;
  assert.equal(takeoverHandoff(f).status, 'COMPLETED');
  for (const source of Object.values(material.sources).filter(source => source !== material.sources.workflow_enablement)) {
    const body = fs.readFileSync(path.join(f.sourceRoot, source.path_ref), 'utf8');
    const current = body.split('<!-- CURRENT:BEGIN -->')[1].split('<!-- CURRENT:END -->')[0];
    assert.doesNotMatch(current, /ACTIVE_FROZEN_NOT_STOPPED|MATERIAL_PREPARED|候选事件：|return-to-old-writer|# 当前交接准备/);
    assert.match(current, /完成事件：synthetic-takeover/);
    assert.match(current, /来源加载记录：old-loading.json/);
    assert.match(current, /本任务加载记录：待接收方独立建立/);
    assert.match(current, /preserve-business-breakpoint/);
    assert.match(current, /非终态：8/); assert.match(current, /禁止项：remote-write/);
    assert.match(body.split('<!-- HISTORY:BEGIN -->')[1], /ACTIVE_FROZEN_NOT_STOPPED/);
  }
});
// Frozen pre-version fixture bytes, independent of the production renderer.
function legacyJournal(f) {
  prepareTransition(f.sealDirectory, { ...f, nextGeneration: 2, nextWriterId: recipient.writerId });
  assert.throws(() => takeoverHandoff({ ...f, fault: stage => { if (stage === 'after-journal') throw new Error('legacy-fixture'); } }), /legacy-fixture/);
  const journalPath = controlPaths(f.material, f).journal;
  const journal = JSON.parse(fs.readFileSync(journalPath));
  delete journal.current_render_version;
  delete journal.workspace_projection;
  for (const item of journal.plan) {
    const before = Buffer.from(item.before, 'base64').toString('utf8');
    const old = before.split('<!-- CURRENT:BEGIN -->')[1].split('<!-- CURRENT:END -->')[0];
    const current = old.replace(/<!-- CONTROL_IDENTITY: .*? -->/, `<!-- CONTROL_IDENTITY: ${JSON.stringify({ generation: 2, writer_id: recipient.writerId, platform_task_id: recipient.platformTaskId })} -->`)
      + '\n接管协议：DIRECT_OPERATOR_V1；TAKEOVER_COMPLETED（仅在规范事务日志COMPLETED且回读一致时生效）\n旧总指挥：世代1 STOPPED_DISPATCH；保留历史，不恢复旧授权\n';
    const historical = old.replaceAll('<!-- CONTROL_IDENTITY:', '<!-- ARCHIVED_CONTROL_IDENTITY:').replaceAll('<!-- CONTROL_NAVIGATION:', '<!-- ARCHIVED_CONTROL_NAVIGATION:');
    const after = before.replace(`<!-- CURRENT:BEGIN -->${old}<!-- CURRENT:END -->`, `<!-- CURRENT:BEGIN -->${current}<!-- CURRENT:END -->`)
      .replace('<!-- HISTORY:BEGIN -->', `<!-- HISTORY:BEGIN -->\n\n## Previous commander (HISTORICAL_ONLY)\n${historical}\n`);
    item.after = Buffer.from(after).toString('base64'); item.after_sha256 = hash(Buffer.from(after));
    for (const name of item.names) journal.draft.sources[name].digest = item.after_sha256;
  }
  fs.writeFileSync(journalPath, JSON.stringify(journal));
  return journal;
}
check('unversioned historical PREPARED journal recovers and COMPLETED retry stays idempotent', () => {
  const f = fixture(false, {}, false, '# 当前交接准备\n状态：ACTIVE_FROZEN_NOT_STOPPED；MATERIAL_PREPARED\n加载记录：old-loading.json\n');
  legacyJournal(f);
  assert.equal(recoverTakeover(f).status, 'COMPLETED');
  assert.equal(takeoverHandoff(f).status, 'COMPLETED');
  assert.equal(recoverTakeover(f).status, 'COMPLETED');
  assert.equal(verifyChain(f.sealDirectory, f).records.length, 2);
});
check('unversioned historical partial journal rolls back exact bytes and keeps stopped state', () => {
  const f = fixture(), journal = legacyJournal(f);
  fs.writeFileSync(path.join(f.sourceRoot, journal.plan[0].path_ref), Buffer.from(journal.plan[0].after, 'base64'));
  assert.equal(rollbackTakeover(f).status, 'ROLLED_BACK_STOPPED');
  for (const item of journal.plan) assert.equal(hash(fs.readFileSync(path.join(f.sourceRoot, item.path_ref))), item.before_sha256);
});
for (const version of [1, 0, 3, '2', null]) check(`changed CURRENT renderer version ${version} is rejected before writes`, () => {
  const f = fixture(); assert.throws(() => takeoverHandoff({ ...f, fault: stage => { if (stage === 'after-journal') throw new Error('interrupt'); } }));
  const journalPath = controlPaths(f.material, f).journal, journal = JSON.parse(fs.readFileSync(journalPath));
  assert.equal(journal.current_render_version, 2); journal.current_render_version = version;
  fs.writeFileSync(journalPath, JSON.stringify(journal));
  assert.throws(() => recoverTakeover(f), /render version|target bytes changed/);
  for (const item of journal.plan) assert.equal(hash(fs.readFileSync(path.join(f.sourceRoot, item.path_ref))), item.before_sha256);
});
check('supported English identity declarations follow the new canonical identity', () => {
  const f = fixture(false, {}, true); assert.equal(takeoverHandoff(f).status, 'COMPLETED');
  assert.equal(verifyControlIdentity(verifyChain(f.sealDirectory, f).latest, f).status, 'PASS');
});
check('redundant identity in static enablement is refused before any intent or central write', () => {
  const f = fixture(false, {}, 'all'); assert.throws(() => takeoverHandoff(f), /INPUT_REQUIRED.*static workflow_enablement/);
  assert.equal(verifyChain(f.sealDirectory, f).latest.generation, 1);
  assert.equal(verifyChain(f.sealDirectory, f).pending_intents.length, 0);
  assert.equal(fs.existsSync(controlPaths(f.material, f).journal), false);
});
check('v4 material permits a later distinct takeover and completed journal replacement', () => {
  const f = fixture(); takeoverHandoff(f);
  const latest = verifyChain(f.sealDirectory, f).latest;
  const material = appendSeal(f.sealDirectory, { ...latest, event_id: 'synthetic-next-material', handoff_phase: 'MATERIAL_PREPARED', switch_status: 'READY', old_writer_status: 'UNKNOWN', transition: null }, f);
  const next = { ...f, eventId: 'synthetic-next-takeover', recipient: { ...recipient, writerId: 'SYNTHETIC-NEXT', platformTaskId: '33333333-3333-4333-8333-333333333333' } };
  next.confirmation = { ...f.confirmation, previous_seal_digest: material.seal_digest, old_generation: 2, old_writer_id: recipient.writerId, recipient_writer_id: next.recipient.writerId, recipient_platform_id: next.recipient.platformTaskId };
  assert.equal(takeoverHandoff(next).generation, 3);
});
check('v4 restrictions and HIGH confidence reject misleading dependency claims', () => {
  const seal = verifyChain(one.sealDirectory, one).latest;
  assert.ok(validateSeal({ ...seal, restrictions: ['REMOTE_UNOBSERVED'] }, { checkDigest: false }).some(error => error.includes('restrictions')));
  for (const status of ['FAIL', 'NOT_APPLICABLE']) assert.ok(validateSeal({ ...seal, switch_status: 'BLOCKED', handoff_phase: 'MATERIAL_PREPARED', transition: null, remote: { ...seal.remote, status }, restrictions: [] }, { checkDigest: false }).some(error => error.includes('HIGH')));
});
for (const field of ['platform', 'project']) check(`direct append binds the new CURRENT ${field}`, () => {
  const f = fixture(); assert.throws(() => takeoverHandoff({ ...f, fault: p => { if (p === 'after-write-3') throw new Error('synthetic interruption'); } }));
  const journal = JSON.parse(fs.readFileSync(controlPaths(f.material, f).journal));
  const file = path.join(f.sourceRoot, '.control/status_index.md');
  const current = fs.readFileSync(file, 'utf8');
  const edited = field === 'platform' ? current.replace(recipient.platformTaskId, '22222222-2222-4222-8222-222222222222') : current.replace('项目键：SYNTHETIC', '项目键：OTHER');
  fs.writeFileSync(file, edited); journal.draft.sources.status_index.digest = hash(Buffer.from(edited));
  assert.throws(() => withControlTransaction(f.material, f, () => appendSeal(f.sealDirectory, journal.draft, { ...f, transitionTicket: path.join(f.sealDirectory, journal.intent_path) })), /recipient platform or project/);
});
check('a second candidate cannot replay the grant', () => { assert.throws(() => takeoverHandoff({ ...one, recipient: { ...recipient, writerId: 'OTHER' } }), /recipient|confirmation|completed/i); });
for (const [name, change] of [
  ['attachment instructions cannot authorize takeover', { origin: 'ATTACHMENT' }],
  ['unstopped writer is rejected', { old_writer_status: 'UNKNOWN' }],
  ['wrong project is rejected', { project_key: 'OTHER' }],
  ['wrong recipient platform is rejected', { recipient_platform_id: '22222222-2222-4222-8222-222222222222' }],
  ['missing original confirmation pointer is rejected', { evidence_ref: '' }],
  ['old permission is not inherited', { scope: 'ALL_BUSINESS' }]
]) check(name, () => { const f = fixture(); assert.throws(() => takeoverHandoff({ ...f, confirmation: { ...f.confirmation, ...change } })); assert.equal(verifyChain(f.sealDirectory, f).latest.generation, 1); });
check('external control plane completes in the authorized root', () => { const f = fixture(true); assert.equal(takeoverHandoff(f).status, 'COMPLETED'); });
check('missing external root is input required, not damaged provenance', () => { const f = fixture(true); assert.throws(() => takeoverHandoff({ ...f, externalControlPlaneRoot: undefined }), /INPUT_REQUIRED/); });
check('unignored private journal is refused before any intent or central write', () => {
  const f = fixture(); fs.writeFileSync(path.join(f.sourceRoot, '.gitignore'), '.control/status_index.md\n');
  assert.throws(() => takeoverHandoff(f), /INPUT_REQUIRED.*ignored and untracked/);
  assert.equal(verifyChain(f.sealDirectory, f).pending_intents.length, 0);
  assert.equal(fs.existsSync(controlPaths(f.material, f).journal), false);
});
check('already tracked private control storage is refused', () => {
  const f = fixture(); f.git(['add', '-f', '--', '.control/status_index.md']);
  assert.throws(() => takeoverHandoff(f), /INPUT_REQUIRED.*ignored and untracked/);
});
check('existing mismatched legacy intent is not silently consumed', () => {
  const f = fixture(); prepareTransition(f.sealDirectory, { ...f, nextGeneration: 2, nextWriterId: 'OTHER', eventId: 'other' });
  assert.throws(() => takeoverHandoff(f), /pending|intent|target/i);
});
check('matching legacy intent keeps its original bytes and is consumed once', () => {
  const f = fixture(); const old = prepareTransition(f.sealDirectory, { ...f, nextGeneration: 2, nextWriterId: recipient.writerId, eventId: f.eventId });
  const before = fs.readFileSync(old.path); assert.equal(takeoverHandoff(f).status, 'COMPLETED');
  assert.ok(fs.readFileSync(old.path).equals(before)); assert.equal(verifyChain(f.sealDirectory, f).pending_intents.length, 0);
});
check('new and legacy entry points share the authoritative control lock', () => {
  const f = fixture(); const p = controlPaths(f.material, f); fs.writeFileSync(p.lock, 'synthetic lock', { flag: 'wx' });
  try { assert.throws(() => prepareTransition(f.sealDirectory, { ...f, nextGeneration: 2, nextWriterId: 'OTHER', eventId: 'other' }), /lock|EEXIST/); assert.throws(() => takeoverHandoff(f), /lock|EEXIST/); } finally { fs.unlinkSync(p.lock); }
});
check('different seal directories targeting one CURRENT resolve one lock', () => {
  const f = fixture(); const other = path.join(path.dirname(f.sealDirectory), 'seals-other'); appendSeal(other, { ...f.material, event_id: 'other-material' }, f);
  assert.equal(controlPaths(f.material, f).lock, controlPaths(verifyChain(other, f).latest, f).lock);
});
for (const point of ['after-journal', 'after-write-0', 'after-write-1', 'after-write-2', 'after-write-3', 'before-seal', 'after-seal']) check(`interruption at ${point} is recoverable and never exposes ACTIVE`, () => {
  const f = fixture(); assert.throws(() => takeoverHandoff({ ...f, fault: p => { if (p === point) throw new Error('synthetic interruption'); } }), /synthetic interruption/);
  assert.notEqual(verifyControlIdentity(verifyChain(f.sealDirectory, { ...f, verifyLatestSources: false }).latest, f).status, 'PASS');
  assert.equal(recoverTakeover(f).status, 'COMPLETED'); assert.equal(verifyChain(f.sealDirectory, f).latest.generation, 2);
});
check('unfinished journal fences legacy prepare and append', () => {
  const f = fixture(); assert.throws(() => takeoverHandoff({ ...f, fault: p => { if (p === 'after-journal') throw new Error('synthetic interruption'); } }));
  assert.throws(() => prepareTransition(f.sealDirectory, { ...f, nextGeneration: 2, nextWriterId: recipient.writerId, eventId: f.eventId }), /TAKEOVER_INCOMPLETE/);
  assert.throws(() => appendSeal(f.sealDirectory, { ...f.material, event_id: 'other' }, f), /TAKEOVER_INCOMPLETE/);
});
check('changed recovery plan cannot change required preserved evidence', () => {
  const f = fixture(); assert.throws(() => takeoverHandoff({ ...f, fault: p => { if (p === 'after-journal') throw new Error('synthetic interruption'); } }));
  const file = controlPaths(f.material, f).journal, journal = JSON.parse(fs.readFileSync(file)); journal.draft.objective.breakpoint = 'unapproved'; fs.writeFileSync(file, JSON.stringify(journal));
  assert.throws(() => recoverTakeover(f), /protected objective/);
});
for (const field of ['intent_digest', 'intent_path']) check(`damaged ${field} is rejected before recovery changes central bytes`, () => {
  const f = fixture(); assert.throws(() => takeoverHandoff({ ...f, fault: p => { if (p === 'after-journal') throw new Error('synthetic interruption'); } }));
  const file = controlPaths(f.material, f).journal, journal = JSON.parse(fs.readFileSync(file));
  journal[field] = field === 'intent_digest' ? 'e'.repeat(64) : '../other-intent.json'; fs.writeFileSync(file, JSON.stringify(journal));
  assert.throws(() => recoverTakeover(f), /intent evidence/);
  assert.throws(() => rollbackTakeover(f), /intent evidence/);
  for (const item of journal.plan) assert.equal(hash(fs.readFileSync(path.join(f.sourceRoot, item.path_ref))), item.before_sha256);
});
check('rule drift cannot retain the old ready authorization', () => {
  const f = fixture(false, { rule_baseline: { rule_version: '2025-01-01.1', manifest_sha256: 'e'.repeat(64) } });
  assert.throws(() => takeoverHandoff(f), /RULE_REBASE_PENDING/); assert.equal(verifyChain(f.sealDirectory, f).latest.generation, 1);
});
check('optional remote outage completes v4 with an explicit restriction', () => {
  const f = fixture(); f.git(['remote', 'set-url', 'origin', path.join(temp, 'nonexistent-remote')]);
  const result = takeoverHandoff(f); assert.equal(result.status, 'COMPLETED'); assert.deepEqual(result.restrictions, ['REMOTE_UNOBSERVED']);
  assert.equal(verifyChain(f.sealDirectory, f).latest.remote.status, 'UNKNOWN');
});
check('required remote outage blocks only that dependent takeover', () => {
  const f = fixture(); f.git(['remote', 'set-url', 'origin', path.join(temp, 'nonexistent-remote')]);
  assert.throws(() => takeoverHandoff({ ...f, remoteRequired: true }), /REMOTE_REQUIRED/); assert.equal(verifyChain(f.sealDirectory, f).latest.generation, 1);
});
check('recovery rejects third-party bytes without overwriting them', () => {
  const f = fixture(); assert.throws(() => takeoverHandoff({ ...f, fault: p => { if (p === 'after-write-0') throw new Error('synthetic interruption'); } }));
  const file = path.join(f.sourceRoot, f.material.sources.status_index.path_ref); fs.appendFileSync(file, 'third-party'); const before = fs.readFileSync(file);
  assert.throws(() => recoverTakeover(f), /conflict|changed|bytes/i); assert.ok(fs.readFileSync(file).equals(before));
});
check('workspace drift after a partial write permits exact rollback without dispatch', () => {
  const f = fixture(); assert.throws(() => takeoverHandoff({ ...f, fault: p => { if (p === 'after-write-1') throw new Error('synthetic interruption'); } }));
  fs.appendFileSync(path.join(f.sourceRoot, 'probe.txt'), 'new evidence');
  assert.throws(() => recoverTakeover(f), /workspace changed/);
  assert.equal(rollbackTakeover(f).status, 'ROLLED_BACK_STOPPED');
  const journal = JSON.parse(fs.readFileSync(controlPaths(f.material, f).journal));
  for (const item of journal.plan) assert.equal(hash(fs.readFileSync(path.join(f.sourceRoot, item.path_ref))), item.before_sha256);
  assert.ok(fs.readFileSync(path.join(f.sourceRoot, 'probe.txt'), 'utf8').includes('new evidence'));
  assert.notEqual(verifyControlIdentity(f.material, f).status, 'PASS');
  assert.equal(rollbackTakeover(f).status, 'ROLLED_BACK_STOPPED');
  assert.throws(() => recoverTakeover(f), /withdrawn transaction/);
});
check('rollback preserves all files if any control target has third-party bytes', () => {
  const f = fixture(); assert.throws(() => takeoverHandoff({ ...f, fault: p => { if (p === 'after-write-1') throw new Error('synthetic interruption'); } }));
  const file = path.join(f.sourceRoot, '.control/current_view.md'); fs.appendFileSync(file, 'third party');
  const journal = JSON.parse(fs.readFileSync(controlPaths(f.material, f).journal));
  const before = journal.plan.map(item => fs.readFileSync(path.join(f.sourceRoot, item.path_ref)));
  assert.throws(() => rollbackTakeover(f), /control byte conflict/);
  journal.plan.forEach((item, i) => assert.ok(fs.readFileSync(path.join(f.sourceRoot, item.path_ref)).equals(before[i])));
});
check('completion seal forbids rollback', () => {
  const f = fixture(); assert.throws(() => takeoverHandoff({ ...f, fault: p => { if (p === 'after-seal') throw new Error('synthetic interruption'); } }));
  assert.throws(() => rollbackTakeover(f), /rollback forbidden/); assert.equal(recoverTakeover(f).status, 'COMPLETED');
});
check('source drift before prepare is rejected', () => { const f = fixture(); fs.appendFileSync(path.join(f.sourceRoot, '.control/current_view.md'), 'drift'); assert.throws(() => takeoverHandoff(f), /source|candidate/i); });
check('required workspace change is preserved and blocks takeover', () => { const f = fixture(); fs.appendFileSync(path.join(f.sourceRoot, 'probe.txt'), 'change'); assert.throws(() => takeoverHandoff(f), /workspace|candidate/i); assert.ok(fs.readFileSync(path.join(f.sourceRoot, 'probe.txt'), 'utf8').includes('change')); });
async function compete() {
  const f = fixture(), second = path.join(path.dirname(f.sealDirectory), 'second-chain'); appendSeal(second, { ...f.material }, f);
  const first = { ...f }, other = { ...f, sealDirectory: second, eventId: 'synthetic-other', recipient: { ...recipient, writerId: 'SYNTHETIC-OTHER', platformTaskId: '22222222-2222-4222-8222-222222222222' } };
  other.confirmation = { ...f.confirmation, recipient_writer_id: other.recipient.writerId, recipient_platform_id: other.recipient.platformTaskId };
  const launch = (options, suffix) => new Promise((resolve, reject) => {
    const config = path.join(temp, `competitor-${suffix}.json`);
    const serial = Object.fromEntries(Object.entries(options).filter(([key]) => !['material', 'git'].includes(key)));
    fs.writeFileSync(config, JSON.stringify(serial));
    const child = spawn(process.execPath, [path.join(root, '.github/scripts/Takeover-Handoff.mjs'), 'commit', config], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = ''; child.stderr.on('data', bytes => output += bytes); child.on('error', reject); child.on('close', code => resolve({ code, output }));
  });
  const results = await Promise.all([launch(first, 'one'), launch(other, 'two')]);
  assert.equal(results.filter(item => item.code === 0).length, 1, JSON.stringify(results));
  const body = fs.readFileSync(path.join(f.sourceRoot, '.control/status_index.md'), 'utf8').split('<!-- CURRENT:BEGIN -->')[1].split('<!-- CURRENT:END -->')[0];
  assert.equal(JSON.parse(body.match(/<!-- CONTROL_IDENTITY: (.*) -->/)[1]).generation, 2);
  passed++; console.log('PASS: two receiving processes and different chains have one CAS winner');
}
await compete();
console.log(`Direct handoff journey: ${passed} PASS. Synthetic fixtures retained under ignored cache.`);
