// Current-authority recovery is not a retroactive signature by a stopped writer.
// The receiving agent must verify the actual current operator message first.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { canonicalJson, sealDigest, readChain, verifyChain, verifySourceFiles, observeControlIdentity, validateAuthorityConfirmation, validateAuthorityObservation, validateFreshAuthorityAttempt, validateAuthorityEventAvailability, prepareAuthorityRecovery, readAuthorityIntent, withdrawAuthorityRecovery, authorityWithdrawalTime, appendSeal } from './HandoffSeal.mjs';
import { byteDigest, resolveSource, controlPaths, assertPrivateControlStorage, withControlTransaction, writeAtomic, writeJournal, verifyAuthorityJournalCompletion } from './HandoffControl.mjs';
import { buildControlPlan, renderCurrent, assertRenderedCurrentIdentity, recheckDependencies, verifyCompletedTakeoverJournal } from './Takeover-Handoff.mjs';
import { verifyRuleManifest, verifyWorkspaceBaseline, readGitWorkspaceBaseline, readLiveRemoteBaseline, verifyHandoffInventory } from './Prepare-Handoff.mjs';
import { captureTransactionWorkspace, verifyTransactionWorkspace } from './HandoffTransactionWorkspace.mjs';
import { adoptReceiverState, deriveReceiverAdoption, readCommittedReceiverAdoption, preflightReceiverAdoption } from './Receiver-State-Adoption.mjs';
import { isControlOnly, isFaultTakeover, authorityRenderVersion, authorityRestrictions, authorityRequiredFiles, controlOnlyContinuityErrors, HISTORICAL_WORKSPACE_RESTRICTION, FAULT_PROJECTION_SOURCES } from './HandoffSeal.mjs';

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const equal = (a, b) => canonicalJson(a) === canonicalJson(b);
const defaultRules = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../总指挥工作流/第二代总指挥的工作模式');
const kind = 'handoff-authority-recovery-transaction';
function historyFor(options) {
  const history = readChain(options.sealDirectory);
  assert(!history.errors.length && history.records.length, `authority history invalid: ${history.errors.join('; ')}`);
  assert(!history.pending_intents.length, 'original transition is unresolved; authority recovery cannot discard it');
  assert(!history.recoveries.some(recovery => recovery.previous_seal_digest === history.records.at(-1)?.seal_digest), 'RULE_REBASE recovery awaits CURRENT_ATTESTATION');
  return history;
}
function attachReceiverAdoption(result, options) {
  try {
    options.fault?.('before-receiver-adoption');
    const history = readChain(options.sealDirectory);
    const latest = history.records.at(-1);
    const attested = latest?.handoff_phase === 'CURRENT_ATTESTATION' && latest.event_id === `${options.eventId}:receiver-adoption`;
    const completed = attested ? history.records.at(-2) : latest;
    const adoption = options.adoption || deriveReceiverAdoption(options, completed);
    const receiverOptions = { ...options, adoption };
    let adopted;
    try { adopted = attested ? readCommittedReceiverAdoption(receiverOptions) : adoptReceiverState(receiverOptions); }
    catch (error) {
      if (!attested || error.code !== 'ADOPTION_JOURNAL_PENDING') throw error;
      adopted = adoptReceiverState(receiverOptions);
    }
    return { ...result, control_handoff: 'COMPLETED', receiver_adoption: adopted };
  } catch (error) {
    return {
      ...result,
      control_handoff: 'COMPLETED',
      receiver_adoption: {
        status: 'BLOCKED',
        retryable: true,
        error: error.message,
        next: '保留已完成的中央控制权；修复接收方采用依赖后，用同一事件和配置重试采用，不重复提交控制权'
      }
    };
  }
}
function normalizedObservation(value, confirmation, preparedAt = new Date().toISOString()) {
  const observation = structuredClone(value);
  assert(observation && observation.schema_version === 4, 'INPUT_REQUIRED: independent current v4 observation required');
  observation.seal_sequence = 1; observation.previous_seal_digest = null;
  observation.seal_digest = sealDigest(observation);
  const errors = validateAuthorityObservation(observation, confirmation, preparedAt);
  assert(!errors.length, `observation invalid: ${errors.join('; ')}`);
  return observation;
}
function assertStorage(observation, options) {
  assertPrivateControlStorage(observation, options);
  const root = fs.realpathSync(options.sourceRoot), dir = fs.realpathSync(options.sealDirectory), relative = path.relative(root, dir);
  assert(relative && !relative.startsWith('..') && !path.isAbsolute(relative), 'authority chain must remain inside the source root');
  const ignored = spawnSync('git', ['-C', root, 'check-ignore', '--quiet', '--', relative]);
  const tracked = spawnSync('git', ['-C', root, 'ls-files', '--', relative], { encoding: 'utf8' });
  assert(ignored.status === 0 && tracked.status === 0 && !tracked.stdout.trim(), 'authority chain must be ignored and untracked');
}
function confirmationFor(options, observation, previous) {
  const errors = validateAuthorityConfirmation(options.confirmation, observation, options.recipient, previous);
  assert(!errors.length, errors.join('; '));
  assert(/^[A-Za-z0-9._:-]+$/.test(options.eventId || ''), 'authority recovery event required');
  assert(!options.workspaceAmendment, 'authority recovery cannot amend the observed protected workspace');
}
function settledAuthorityForFreshMaterial(journal, completed, history, options) {
  const material = history.records[0];
  if (options.confirmation?.protocol_version !== 2 || options.confirmation.scope !== 'CONTROL_ONLY_TAKEOVER' ||
      history.records.length !== 1 || material?.schema_version !== 4 ||
      material.handoff_phase !== 'MATERIAL_PREPARED' || material.seal_sequence !== 1 ||
      material.previous_seal_digest !== null) return false;
  const require = (condition, detail) => assert(condition, `material authority continuity invalid: ${detail}`);
  const completionFile = resolveSource(journal.completion_source, options);
  const intentFile = resolveSource(journal.intent_source, options);
  require(path.dirname(intentFile) === path.dirname(completionFile), 'intent and completion chain differ');
  // This checks immutable structure and settled events. Historical live source
  // hashes are not current observations and must not be certified here.
  const prior = historyFor({ ...options, sealDirectory: path.dirname(completionFile) });
  require(!prior.pending_authority_recoveries.length, 'previous authority event is unsettled');
  require(prior.records.at(-1).seal_digest === completed.seal_digest, 'previous completion is not the latest authority evidence');
  const intent = prior.authority_intents.find(item => item.recovery_digest === journal.intent_digest);
  require(intent && equal(intent, JSON.parse(fs.readFileSync(intentFile, 'utf8'))) &&
    prior.records.some(item => equal(item, completed)), 'completion and intent must belong to the verified prior chain');
  const freshErrors = validateFreshAuthorityAttempt(prior, {
    confirmation: options.confirmation, observation: options.observation
  });
  require(!freshErrors.length, freshErrors.join('; '));
  require(material.generation === completed.generation && material.writer_id === completed.writer_id,
    'material generation or writer differs');
  require(intent.transaction.recipient.projectKey === options.recipient.projectKey &&
    intent.transaction.recipient.projectKey === options.confirmation.project_key &&
    intent.transaction.recipient.platformTaskId === options.confirmation.observed_platform_id,
    'project or observed platform differs');
  require(Date.parse(material.fact_cutoff) >= Date.parse(completed.fact_cutoff) &&
    Date.parse(material.sealed_at) >= Date.parse(completed.sealed_at), 'material precedes authority completion');
  for (const name of ['status_index', 'central_work_items', 'current_view', 'central_entry', 'workflow_enablement']) {
    require(resolveSource(material.sources[name], options) === resolveSource(completed.sources[name], options),
      `canonical source moved: ${name}`);
  }
  const snapshots = new Set(['loading_record', 'handoff_inventory', 'workspace_preservation']);
  for (const [name, source] of Object.entries(completed.sources)) {
    if (snapshots.has(name)) {
      require(byteDigest(fs.readFileSync(resolveSource(source, options))) === source.digest,
        `archived snapshot evidence changed: ${name}`);
    } else {
      require(material.sources[name] &&
        resolveSource(material.sources[name], options) === resolveSource(source, options),
      `prior source binding lost: ${name}`);
    }
  }
  const required = new Set(material.workspace.required_untracked.map(item => item.path_ref));
  require(completed.workspace.required_untracked.every(item => required.has(item.path_ref)), 'prior required file lost');
  require(material.workspace.branch === completed.workspace.branch &&
    material.remote.default_ref === completed.remote.default_ref, 'workspace branch or remote target changed');
  require((completed.restrictions || []).filter(item => item.startsWith('HISTORICAL_'))
    .every(item => material.restrictions?.includes(item)), 'historical restriction was dropped');
  require(!validateAuthorityEventAvailability(prior, options.eventId).length,
    'previous event cannot be replayed in a fresh chain, including reserved withdrawal events');
  return true;
}
function priorJournal(paths, history, options) {
  if (!fs.existsSync(paths.journal)) return null;
  const bytes = fs.readFileSync(paths.journal), journal = JSON.parse(bytes);
  if (journal.protocol_version === 1 && journal.status === 'COMPLETED') {
    const completed = verifyCompletedTakeoverJournal(journal, { ...options, eventId: journal.event_id,
      confirmation: journal.confirmation, workspaceAmendment: journal.workspace_projection?.amendment,
      recipient: { writerId: journal.draft?.writer_id, platformTaskId: journal.confirmation?.recipient_platform_id, projectKey: journal.confirmation?.project_key }
    }, history);
    assert(completed.generation === history.records.at(-1).generation && completed.writer_id === history.records.at(-1).writer_id, 'old completed transaction is not the current authority');
  } else if (journal.protocol_version === 2 && journal.record_type === kind && journal.status === 'ROLLED_BACK_STOPPED') {
    const withdrawal = history.authority_withdrawals.find(item => item.intent_digest === journal.intent_digest);
    const intent = history.authority_intents.find(item => item.recovery_digest === journal.intent_digest);
    assert(withdrawal && intent && options.confirmation.evidence_ref !== intent.transaction.confirmation.evidence_ref && Date.parse(options.confirmation.confirmed_at) > Date.parse(withdrawal.withdrawn_at), 'withdrawn recovery requires a new current operator confirmation, not revival');
  } else if (journal.protocol_version === 2 && journal.record_type === kind && journal.status === 'COMPLETED') {
    verifyAuthorityJournalCompletion(journal, history.records.at(-1), options);
    const completed = JSON.parse(fs.readFileSync(resolveSource(journal.completion_source, options), 'utf8'));
    const migration = history.records[0];
    const inherited = migration?.handoff_phase === 'CURRENT_MIGRATION' && migration.seal_sequence === 1
      && migration.migration?.legacy_latest_seal_digest === completed.seal_digest
      && migration.migration?.legacy_generation === completed.generation && migration.migration?.legacy_writer_id === completed.writer_id
      && history.records.every(record => record.generation === completed.generation && record.writer_id === completed.writer_id)
      && migration.restrictions?.includes(HISTORICAL_WORKSPACE_RESTRICTION);
    const inCurrentHistory = history.records.some(record => record.event_id === journal.event_id &&
      record.authority_recovery?.intent_digest === journal.intent_digest);
    assert(inherited || inCurrentHistory || settledAuthorityForFreshMaterial(journal, completed, history, options),
      'previous authority completion is not in formal history');
  } else throw new Error('existing canonical transaction is not settled; preserve and recover it first');
  return bytes.toString('base64');
}

// Read-only preflight. Its observation is explicitly a receiver's snapshot,
// never MATERIAL_PREPARED signed or appended on behalf of the observed writer.
export function planAuthorityRecovery(options) {
  assert(options.adoption === undefined, 'receiver readiness: explicit adoption is only supported for a frozen or completed event; new authority recovery requires automatic binding');
  const preparedAt = options.preparedAt === undefined ? new Date().toISOString() : options.preparedAt;
  const history = historyFor(options), previous = history.records.at(-1), observation = normalizedObservation(options.observation, options.confirmation, preparedAt);
  confirmationFor(options, observation, previous); assertStorage(observation, options);
  const eventErrors = validateAuthorityEventAvailability(history, options.eventId);
  assert(!eventErrors.length, eventErrors.join('; '));
  assert(Date.parse(preparedAt) >= Date.parse(previous.sealed_at), 'authority prepared_at precedes predecessor seal');
  const freshErrors = validateFreshAuthorityAttempt(history, { confirmation: options.confirmation, observation });
  assert(!freshErrors.length, freshErrors.join('; '));
  assert(!history.pending_authority_recoveries.length, 'authority recovery pending; continue that exact event');
  assert(observation.generation === previous.generation + (isControlOnly(options.confirmation) ? 0 : 1) && Date.parse(observation.fact_cutoff) >= Date.parse(previous.fact_cutoff), 'observation generation or fact cutoff mismatch');
  if (isControlOnly(options.confirmation)) {
    const errors = controlOnlyContinuityErrors(previous, observation, options.confirmation);
    assert(!errors.length, errors.join('; '));
    for (const file of observation.workspace.required_untracked) assert(byteDigest(fs.readFileSync(resolveSource({ root_ref: 'source_root', path_ref: file.path_ref }, options))) === file.sha256, 'control-only required current bytes mismatch');
  } else assert(!previous.restrictions?.includes(HISTORICAL_WORKSPACE_RESTRICTION), 'historical workspace limitation requires control-only handling');
  if (!isFaultTakeover(options.confirmation)) assert(Object.keys(observation.sources).sort().join(',') === Object.keys(previous.sources).sort().join(','), 'recovery cannot add or drop source evidence');
  for (const [name, source] of Object.entries(previous.sources)) {
    const observed = observation.sources[name];
    assert(source.path_ref === observed.path_ref && (source.root_ref || 'source_root') === (observed.root_ref || 'source_root'), `canonical source migration is outside recovery: ${name}`);
  }
  if (isFaultTakeover(options.confirmation)) {
    const paths = controlPaths(observation, options);
    assert(fs.existsSync(paths.journal), 'FAULT_PREDECESSOR_UNSETTLED: canonical completion journal is required');
    priorJournal(paths, history, options);
    const protectedFiles = new Set(Object.values(previous.sources).map(source => resolveSource(source, options)));
    const projectionNames = FAULT_PROJECTION_SOURCES.filter(name => observation.sources[name]);
    const added = projectionNames.map(name => resolveSource(observation.sources[name], options));
    assert(new Set(added).size === added.length && added.every(file => !protectedFiles.has(file) ||
      Object.entries(previous.sources).some(([name, source]) => projectionNames.includes(name) && resolveSource(source, options) === file)),
    'fault task/progress projections alias historical or control evidence');
    assert(added.every(file => !file.startsWith(`${fs.realpathSync(options.sealDirectory)}${path.sep}`)), 'fault task/progress cannot be inside immutable seal storage');
  }
  const errors = verifySourceFiles(observation, options.sourceRoot, options.externalControlPlaneRoot);
  assert(!errors.length, errors.join('; '));
  const identity = observeControlIdentity(observation, options);
  assert(identity.status === 'PASS' && identity.identity.platform_task_id === options.confirmation.observed_platform_id, `observed current identity mismatch: ${identity.errors.join('; ')}`);
  const body = fs.readFileSync(resolveSource(observation.sources.status_index, options), 'utf8').split('<!-- CURRENT:BEGIN -->')[1]?.split('<!-- CURRENT:END -->')[0];
  assert(body?.match(/^项目键：([^\r\n]+)$/m)?.[1]?.trim() === options.recipient.projectKey, 'observed project mismatch');
  const workflowRoot = options.workflowRoot || defaultRules, manifestPath = options.manifestPath || path.join(workflowRoot, '规则刷新manifest.json');
  const manifest = verifyRuleManifest(workflowRoot, manifestPath);
  assert(manifest.rule_version === observation.rule_baseline.rule_version && byteDigest(fs.readFileSync(manifestPath)) === observation.rule_baseline.manifest_sha256, 'RULE_REBASE_PENDING: observation must use verified current rules');
  const workspaceErrors = verifyWorkspaceBaseline(options.sourceRoot, observation.workspace, observation.sources, { externalControlPlaneRoot: options.externalControlPlaneRoot, ruleBaseline: observation.rule_baseline, workflowRepositoryRoot: path.resolve(workflowRoot, '../..') });
  assert(!workspaceErrors.length, workspaceErrors.join('; '));
  // The unchanged inventory certifies historical material, not the receiver's
  // independently refreshed rule and remote observations.
  if (!isFaultTakeover(options.confirmation)) verifyHandoffInventory(isControlOnly(options.confirmation) ? previous : observation, options);
  let remote;
  try { remote = readLiveRemoteBaseline(options.sourceRoot, observation.remote.default_ref); }
  catch (error) { assert(!['REMOTE_PROBE_TIMEOUT', 'REMOTE_PROBE_ABORTED'].includes(error.code) && !options.remoteRequired && observation.remote.status === 'UNKNOWN' && observation.restrictions.includes('REMOTE_UNOBSERVED'), `REMOTE_RECHECK_REQUIRED: ${error.message}`); }
  if (remote) assert(observation.remote.status === 'PASS' && remote.head === observation.remote.head, 'remote observation changed; collect a fresh baseline');
  const plan = buildControlPlan(observation, options, authorityRenderVersion(options.confirmation)), workspace_projection = captureTransactionWorkspace(observation, plan, options);
  const preview = structuredClone(observation);
  Object.assign(preview, { generation: observation.generation + 1, writer_id: options.recipient.writerId, event_id: options.eventId });
  for (const item of plan) for (const name of item.names) preview.sources[name].digest = item.after_sha256;
  preflightReceiverAdoption(options, preview, plan);
  if (isControlOnly(options.confirmation)) for (const item of plan.filter(item => item.root_ref !== 'source_root')) {
    const relative = path.relative(fs.realpathSync(options.sourceRoot), resolveSource(item, options)).replaceAll('\\', '/');
    assert(!observation.workspace.required_untracked.some(file => file.path_ref === relative), 'control-only external control alias in required files needs explicit source-root binding');
  }
  const transaction = { observation, recipient: structuredClone(options.recipient), confirmation: structuredClone(options.confirmation), plan, workspace_projection, prior_journal: priorJournal(controlPaths(observation, options), history, options) };
  return { previous, transaction };
}
function journalFor(intent, options) {
  const relative = path.relative(fs.realpathSync(options.sourceRoot), path.join(fs.realpathSync(options.sealDirectory), `handoff-authority-recovery.${intent.previous_sequence}.${intent.recovery_digest}.json`)).replaceAll('\\', '/');
  return { protocol_version: 2, record_type: kind, status: 'PREPARED', event_id: intent.event_id, intent_digest: intent.recovery_digest, intent_source: { root_ref: 'source_root', path_ref: relative } };
}
function validateFrozen(intent, options, history) {
  const tx = intent.transaction, previous = history.records.find(record => record.seal_digest === intent.previous_seal_digest);
  assert(previous, 'authority predecessor missing');
  confirmationFor(options, tx.observation, previous);
  assert(intent.event_id === options.eventId && equal(tx.confirmation, options.confirmation) && equal(tx.recipient, options.recipient), 'frozen authority authorization changed');
  if (options.observation) assert(equal(normalizedObservation(options.observation, tx.confirmation, intent.prepared_at), tx.observation), 'frozen authority observation changed');
  assertStorage(tx.observation, options);
  for (const item of tx.plan) {
    const before = Buffer.from(item.before, 'base64'), after = Buffer.from(item.after, 'base64');
    assert(after.equals(renderCurrent(before, tx.observation, tx.recipient, authorityRenderVersion(tx.confirmation), intent.event_id)), 'immutable authority render mismatch');
    assertRenderedCurrentIdentity(after, tx.recipient, tx.observation.generation + 1, item.names.includes('status_index'));
  }
  const source = tx.plan.find(item => item.names.includes('status_index'));
  const body = Buffer.from(source.before, 'base64').toString('utf8').split('<!-- CURRENT:BEGIN -->')[1]?.split('<!-- CURRENT:END -->')[0];
  const id = JSON.parse(body?.match(/<!-- CONTROL_IDENTITY: (.*?) -->/)?.[1] || 'null');
  assert(id?.platform_task_id === tx.confirmation.observed_platform_id && body?.match(/^项目键：([^\r\n]+)$/m)?.[1]?.trim() === tx.recipient.projectKey, 'frozen observed platform or project changed');
  return previous;
}
function checkControlBytes(tx, options) {
  for (const item of tx.plan) assert([item.before_sha256, item.after_sha256].includes(byteDigest(fs.readFileSync(resolveSource(item, options)))), 'authority control byte conflict; preserve third bytes');
}
function readOrRestoreJournal(intent, options, paths) {
  const expected = journalFor(intent, options);
  if (fs.existsSync(paths.journal)) {
    const bytes = fs.readFileSync(paths.journal), current = JSON.parse(bytes);
    if (current.protocol_version === 2 && current.record_type === kind && current.intent_digest === intent.recovery_digest) {
      for (const key of ['event_id', 'intent_source']) assert(equal(current[key], expected[key]), 'authority journal binding changed');
      return current;
    }
    assert(bytes.toString('base64') === intent.transaction.prior_journal, 'another canonical transaction replaced the frozen journal');
  }
  // The immutable intent contains all durable before/after and workspace proof.
  // A missing mutable journal is recoverable, not proof that no writes occurred.
  checkControlBytes(intent.transaction, options);
  writeJournal(paths.journal, expected);
  return expected;
}
function completionDraft(intent, workspace) {
  const tx = intent.transaction, draft = structuredClone(tx.observation);
  Object.assign(draft, { schema_version: 5, generation: tx.observation.generation + 1, writer_id: tx.recipient.writerId, old_writer_status: tx.confirmation.old_writer_status, event_id: intent.event_id, fact_cutoff: intent.prepared_at, sealed_at: intent.prepared_at, switch_status: 'COMPLETED', handoff_phase: 'AUTHORITY_RECOVERY_COMPLETED', candidate_verification_status: draft.remote.status === 'PASS' ? 'PASS' : 'PASS_WITH_RESTRICTIONS', control_handoff_confidence: 'HIGH', communications: { status: 'NONE' }, runtime_acceptance_status: 'NOT_RUN', professional_acceptance_status: 'NOT_RUN', transition: null, migration: null, authority_recovery: { intent_digest: intent.recovery_digest, previous_seal_digest: intent.previous_seal_digest, prepared_at: intent.prepared_at }, workspace, seal_digest: '' });
  if (isControlOnly(tx.confirmation)) {
    draft.restrictions = authorityRestrictions(tx);
    draft.candidate_verification_status = 'PASS_WITH_RESTRICTIONS';
    draft.workspace.required_untracked = authorityRequiredFiles(tx);
  }
  for (const item of tx.plan) for (const name of item.names) { draft.sources[name].digest = item.after_sha256; draft.sources[name].fact_cutoff = intent.prepared_at; }
  return draft;
}
function dependencies(intent, options) {
  const tx = intent.transaction, observation = tx.observation;
  recheckDependencies({ draft: observation, workspace_projection: tx.workspace_projection, plan: tx.plan }, options, observation);
  const live = structuredClone(observation);
  for (const item of tx.plan) for (const name of item.names) live.sources[name].digest = byteDigest(fs.readFileSync(resolveSource(item, options)));
  const errors = verifySourceFiles(live, options.sourceRoot, options.externalControlPlaneRoot);
  assert(!errors.length, `frozen authority source changed: ${errors.join('; ')}`);
}
function readCompletedJournal(file, expected, anchor, options) {
  const actual = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert(equal(actual, expected) && actual.status === 'COMPLETED', 'authority completed journal readback mismatch');
  verifyAuthorityJournalCompletion(actual, anchor, options);
}
function completionScope(intent) {
  if (isFaultTakeover(intent.transaction.confirmation)) return { protocol: 'FAULT_CONTROL_ONLY_V1', historical_workspace: 'NOT_CERTIFIED', historical_sources: 'NOT_CERTIFIED', historical_inventory: 'NOT_CERTIFIED', business_resume_allowed: false };
  return isControlOnly(intent.transaction.confirmation) ? { protocol: 'CONTROL_ONLY_V1', historical_workspace: 'NOT_CERTIFIED', business_resume_allowed: false } : { protocol: 'AUTHORITY_RECOVERY_V1', historical_transition: 'NOT_CERTIFIED' };
}
function forward(intent, options, paths) {
  const history = historyFor(options); validateFrozen(intent, options, history);
  assert(!history.authority_withdrawals.some(item => item.intent_digest === intent.recovery_digest), 'withdrawn authority event cannot be revived');
  const committed = history.records.find(record => record.authority_recovery?.intent_digest === intent.recovery_digest);
  const latest = history.records.at(-1);
  // A later same-generation material/attestation may only need journal repair.
  // Never replay the old control plan over independently sealed newer facts.
  if (committed && latest.seal_digest !== committed.seal_digest) {
    assert(!history.pending_authority_recoveries.length && history.records.filter(record => record.seal_sequence > committed.seal_sequence).every(record => record.generation === committed.generation && record.writer_id === committed.writer_id), 'historical recovery cannot replace a later generation transaction');
    let journal = journalFor(intent, options), alreadyCompleted = false;
    if (fs.existsSync(paths.journal)) {
      const current = JSON.parse(fs.readFileSync(paths.journal));
      assert(current.protocol_version === 2 && current.record_type === kind && current.intent_digest === intent.recovery_digest && ['PREPARED', 'COMPLETED'].includes(current.status) && equal(current.intent_source, journal.intent_source) && current.event_id === journal.event_id, 'historical recovery journal replaced; preserve current transaction');
      if (current.status === 'COMPLETED') { verifyAuthorityJournalCompletion(current, latest, options, committed); journal = current; alreadyCompleted = true; }
    }
    const errors = verifySourceFiles(latest, options.sourceRoot, options.externalControlPlaneRoot), identity = observeControlIdentity(latest, options);
    assert(!errors.length && identity.status === 'PASS', `latest evidence invalid; do not reconstruct historical journal: ${[...errors, ...identity.errors].join('; ')}`);
    journal.completion_source = { root_ref: 'source_root', path_ref: path.relative(fs.realpathSync(options.sourceRoot), path.join(fs.realpathSync(options.sealDirectory), `handoff-state.${committed.seal_sequence}.${committed.seal_digest}.json`)).replaceAll('\\', '/') };
    journal.status = 'COMPLETED'; verifyAuthorityJournalCompletion(journal, latest, options);
    if (!alreadyCompleted) writeJournal(paths.journal, journal);
    readCompletedJournal(paths.journal, journal, latest, options);
    const live = verifyChain(options.sealDirectory, options);
    assert(live.status === 'PASS', `journal completion readback failed: ${live.errors.join('; ')}`);
    return { status: 'COMPLETED', control_status: live.control_status, ...completionScope(intent), action: 'JOURNAL_REPAIRED_ONLY', generation: latest.generation, writer_id: latest.writer_id, old_authorization_inherited: false, restrictions: latest.restrictions };
  }
  assert(committed || latest.seal_digest === intent.previous_seal_digest, 'authority predecessor changed');
  const tx = intent.transaction, journal = readOrRestoreJournal(intent, options, paths);
  assert(['PREPARED', 'COMPLETED'].includes(journal.status), 'authority transaction is stopped; finish withdrawal, not forward recovery');
  checkControlBytes(tx, options); dependencies(intent, options);
  for (let index = 0; index < tx.plan.length; index++) {
    const item = tx.plan[index], file = resolveSource(item, options), actual = byteDigest(fs.readFileSync(file));
    assert([item.before_sha256, item.after_sha256].includes(actual), 'authority control bytes changed before write');
    if (actual === item.before_sha256) writeAtomic(file, Buffer.from(item.after, 'base64'));
    options.fault?.(`after-write-${index}`);
  }
  dependencies(intent, options);
  const workspace = { ...tx.observation.workspace, ...readGitWorkspaceBaseline(options.sourceRoot, tx.observation.workspace.required_untracked.map(item => item.path_ref), tx.observation.workspace.inflight_scope ?? null) };
  const draft = completionDraft(intent, workspace);
  if (committed) assert(equal(committed, { ...draft, seal_sequence: committed.seal_sequence, previous_seal_digest: committed.previous_seal_digest, seal_digest: sealDigest({ ...draft, seal_sequence: committed.seal_sequence, previous_seal_digest: committed.previous_seal_digest }) }), 'committed recovery differs from frozen transaction');
  options.fault?.('before-seal');
  const seal = committed || appendSeal(options.sealDirectory, draft, { ...options, expectedPreviousDigest: intent.previous_seal_digest, authorityTicket: resolveSource(journal.intent_source, options) });
  options.fault?.('after-seal');
  const live = verifyChain(options.sealDirectory, options);
  assert(live.status === 'PASS' && live.control_status === 'READY' && live.latest.seal_digest === seal.seal_digest, `authority completed readback failed: ${live.errors.join('; ')}`);
  journal.completion_source = { root_ref: 'source_root', path_ref: path.relative(fs.realpathSync(options.sourceRoot), path.join(fs.realpathSync(options.sealDirectory), `handoff-state.${seal.seal_sequence}.${seal.seal_digest}.json`)).replaceAll('\\', '/') };
  if (journal.status !== 'COMPLETED') { journal.status = 'COMPLETED'; journal.completed_at = new Date().toISOString(); writeJournal(paths.journal, journal); }
  readCompletedJournal(paths.journal, journal, seal, options);
  return { status: 'COMPLETED', ...completionScope(intent), generation: seal.generation, writer_id: seal.writer_id, old_authorization_inherited: false, restrictions: seal.restrictions };
}
function selectedIntent(history, options) {
  const matches = history.authority_intents.filter(intent => intent.event_id === options.eventId);
  assert(matches.length === 1, 'exact authority recovery event missing');
  const intent = matches[0];
  readAuthorityIntent(path.join(options.sealDirectory, `handoff-authority-recovery.${intent.previous_sequence}.${intent.recovery_digest}.json`));
  return intent;
}
export function recoverCommanderAuthority(options) {
  const history = historyFor(options), latest = history.records.at(-1);
  const completedEvent = latest?.handoff_phase === 'AUTHORITY_RECOVERY_COMPLETED' && latest.event_id === options.eventId;
  const adoptedEvent = latest?.handoff_phase === 'CURRENT_ATTESTATION' && latest.event_id === `${options.eventId}:receiver-adoption`;
  if (completedEvent || adoptedEvent) {
    const intent = selectedIntent(history, options);
    validateFrozen(intent, options, history);
    const journalPath = controlPaths(latest, options).journal;
    const journal = fs.existsSync(journalPath) ? JSON.parse(fs.readFileSync(journalPath, 'utf8')) : null;
    // Only a verified completion is a read-only shortcut. Missing or unfinished
    // journals must reach the locked recovery using the original immutable intent.
    if (journal?.status === 'COMPLETED') {
      const committed = history.records.find(record => record.authority_recovery?.intent_digest === intent.recovery_digest);
      assert(committed, 'authority completion seal missing');
      verifyAuthorityJournalCompletion(journal, latest, options, committed);
      const identity = observeControlIdentity(latest, options);
      assert(identity.status === 'PASS' && identity.identity.platform_task_id === options.recipient.platformTaskId, 'completed authority receiver identity changed');
      return attachReceiverAdoption({ status: 'COMPLETED', ...completionScope(intent), generation: latest.generation,
        writer_id: latest.writer_id, restrictions: latest.restrictions || [], old_authorization_inherited: false }, options);
    }
  }
  const existing = history.authority_intents.find(item => item.event_id === options.eventId);
  const anchor = existing?.transaction.observation || normalizedObservation(options.observation, options.confirmation, options.preparedAt);
  assertStorage(anchor, options);
  const result = withControlTransaction(anchor, options, paths => {
    if (existing) return forward(selectedIntent(historyFor(options), options), options, paths);
    const { previous, transaction } = planAuthorityRecovery(options);
    const prepared = prepareAuthorityRecovery(options.sealDirectory, transaction, { ...options, expectedPreviousDigest: previous.seal_digest });
    options.fault?.('after-intent');
    writeJournal(paths.journal, journalFor(prepared.record, options)); options.fault?.('after-journal');
    return forward(prepared.record, options, paths);
  });
  return attachReceiverAdoption(result, options);
}
export function rollbackCommanderAuthority(options) {
  const history = historyFor(options), intent = selectedIntent(history, options);
  assertStorage(intent.transaction.observation, options);
  return withControlTransaction(intent.transaction.observation, options, paths => {
    const current = historyFor(options); validateFrozen(intent, options, current);
    assert(current.records.at(-1).seal_digest === intent.previous_seal_digest && !current.records.some(record => record.authority_recovery?.intent_digest === intent.recovery_digest), 'authority rollback forbidden after immutable completion');
    authorityWithdrawalTime(current, intent);
    checkControlBytes(intent.transaction, options);
    const journal = readOrRestoreJournal(intent, options, paths);
    journal.status = 'ROLLING_BACK_STOPPED'; writeJournal(paths.journal, journal);
    for (let index = 0; index < intent.transaction.plan.length; index++) {
      const item = intent.transaction.plan[index], file = resolveSource(item, options), actual = byteDigest(fs.readFileSync(file));
      assert([item.before_sha256, item.after_sha256].includes(actual), 'authority control bytes changed before rollback');
      if (actual === item.after_sha256) writeAtomic(file, Buffer.from(item.before, 'base64'));
      options.fault?.(`after-rollback-write-${index}`);
    }
    withdrawAuthorityRecovery(options.sealDirectory, intent, options); options.fault?.('after-withdrawal');
    journal.status = 'ROLLED_BACK_STOPPED'; writeJournal(paths.journal, journal);
    return { status: 'ROLLED_BACK_STOPPED', dispatch_allowed: false, historical_transition: 'NOT_CERTIFIED', next: 'Both windows remain stopped. A new event requires fresh direct operator authorization and current evidence; never restore the old completed journal.' };
  });
}
// Read back a completed authority transaction without replaying its old
// observation or writing any control-plane bytes. The receiver uses this
// after commit to establish its own loading record and align its local plan.
export function readCompletedAuthority(options) {
  const history = historyFor(options);
  const latest = history.records.at(-1);
  const attested = latest?.handoff_phase === 'CURRENT_ATTESTATION' && latest.switch_status === 'COMPLETED';
  const completed = attested ? history.records.at(-2) : latest;
  assert(completed?.handoff_phase === 'AUTHORITY_RECOVERY_COMPLETED' || completed?.handoff_phase === 'TAKEOVER_COMPLETED',
    'POST_COMMIT_READBACK_REQUIRED: no completed authority recovery is available');
  assert(options.recipient?.writerId && options.recipient?.platformTaskId && options.recipient?.projectKey,
    'INPUT_REQUIRED: recipient identity is required for post-commit readback');
  assert(completed.writer_id === options.recipient.writerId,
    'POST_COMMIT_READBACK_BLOCKED: completed writer does not match the receiver');
  const identity = observeControlIdentity(latest, options);
  assert(identity.status === 'PASS', `POST_COMMIT_READBACK_BLOCKED: current identity is not valid: ${identity.errors.join('; ')}`);
  assert(identity.identity.writer_id === options.recipient.writerId &&
    identity.identity.platform_task_id === options.recipient.platformTaskId,
  'POST_COMMIT_READBACK_BLOCKED: CURRENT identity does not match the receiver');
  const paths = controlPaths(latest, options);
  assert(fs.existsSync(paths.journal), 'POST_COMMIT_READBACK_BLOCKED: authority completion journal is missing');
  const journal = JSON.parse(fs.readFileSync(paths.journal, 'utf8'));
  if (completed.handoff_phase === 'AUTHORITY_RECOVERY_COMPLETED') {
    assert(completed.schema_version === 5, 'POST_COMMIT_READBACK_BLOCKED: authority recovery schema is unsupported');
    verifyAuthorityJournalCompletion(journal, completed, options, completed);
  } else {
    verifyCompletedTakeoverJournal(journal, options, history);
  }
  const chain = verifyChain(options.sealDirectory, options);
  assert(chain.status === 'PASS' && chain.control_status === 'READY',
    `POST_COMMIT_READBACK_BLOCKED: authority chain is not ready: ${chain.errors.join('; ')}`);
  const sourceErrors = verifySourceFiles(latest, options.sourceRoot, options.externalControlPlaneRoot);
  assert(!sourceErrors.length, `POST_COMMIT_READBACK_BLOCKED: current source drift: ${sourceErrors.join('; ')}`);
  const workflowRoot = options.workflowRoot || defaultRules;
  const manifestPath = options.manifestPath || path.join(workflowRoot, '规则刷新manifest.json');
  const manifest = verifyRuleManifest(workflowRoot, manifestPath);
  assert(manifest.rule_version === latest.rule_baseline.rule_version &&
    byteDigest(fs.readFileSync(manifestPath)) === latest.rule_baseline.manifest_sha256,
  'POST_COMMIT_READBACK_BLOCKED: current rule manifest does not match the completed authority');
  const workspaceErrors = verifyWorkspaceBaseline(options.sourceRoot, latest.workspace, latest.sources, {
    externalControlPlaneRoot: options.externalControlPlaneRoot,
    ruleBaseline: latest.rule_baseline,
    workflowRepositoryRoot: path.resolve(workflowRoot, '../..')
  });
  assert(!workspaceErrors.length, `POST_COMMIT_READBACK_BLOCKED: current workspace drift: ${workspaceErrors.join('; ')}`);
  if (attested) {
    const adoption = options.adoption || deriveReceiverAdoption(options, completed);
    assert(latest.event_id === `${adoption.expected_event_id}:receiver-adoption`,
      'POST_COMMIT_READBACK_BLOCKED: adoption attestation event does not match the receiver configuration');
    const adoptionResult = readCommittedReceiverAdoption({ ...options, adoption });
    return {
      ...adoptionResult,
      status: 'POST_COMMIT_READBACK_READY',
      generation: latest.generation,
      writer_id: latest.writer_id,
      platform_task_id: identity.identity.platform_task_id,
      project_key: options.recipient.projectKey,
      control_only: latest.restrictions?.includes(HISTORICAL_WORKSPACE_RESTRICTION) === true,
      business_resume_allowed: false,
      old_authorization_inherited: false,
      writes: 0
    };
  }
  return {
    status: 'POST_COMMIT_READBACK_READY',
    generation: latest.generation,
    writer_id: latest.writer_id,
    platform_task_id: identity.identity.platform_task_id,
    project_key: options.recipient.projectKey,
    control_only: latest.restrictions?.includes(HISTORICAL_WORKSPACE_RESTRICTION) === true,
    business_resume_allowed: false,
    receiver_loading_record: 'REQUIRED_BY_RECEIVER',
    task_plan_alignment: 'RECEIVER_MUST_ALIGN_OWN_RECORD',
    old_authorization_inherited: false,
    restrictions: latest.restrictions || [],
    writes: 0
  };
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    const [mode, configPath] = process.argv.slice(2);
    assert(['inspect', 'commit', 'recover', 'rollback', 'post-commit'].includes(mode) && configPath, 'usage: node Recover-CommanderAuthority.mjs inspect|commit|recover|rollback|post-commit <receiver-config.json>');
    const options = JSON.parse(fs.readFileSync(configPath, 'utf8')), base = path.dirname(path.resolve(configPath));
    for (const name of ['sourceRoot', 'externalControlPlaneRoot', 'sealDirectory', 'workflowRoot', 'manifestPath']) if (options[name]) options[name] = path.resolve(base, options[name]);
    if (mode === 'inspect') { const plan = planAuthorityRecovery(options); console.log(JSON.stringify({ status: 'RECOVERY_PLAN_READY', generation: plan.transaction.observation.generation + 1, ...completionScope({ transaction: plan.transaction }), writes: 0 })); }
    else if (mode === 'post-commit') console.log(JSON.stringify(readCompletedAuthority(options), null, 2));
    else {
      const result = (mode === 'rollback' ? rollbackCommanderAuthority : recoverCommanderAuthority)(options);
      console.log(JSON.stringify(result, null, 2));
      if (result.receiver_adoption?.status === 'BLOCKED') process.exitCode = 1;
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
