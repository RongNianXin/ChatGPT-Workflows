// Current-authority recovery is not a retroactive signature by a stopped writer.
// The receiving agent must verify the actual current operator message first.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { canonicalJson, sealDigest, readChain, verifyChain, verifySourceFiles, observeControlIdentity, validateAuthorityConfirmation, validateAuthorityObservation, validateFreshAuthorityAttempt, validateAuthorityEventAvailability, prepareAuthorityRecovery, readAuthorityIntent, withdrawAuthorityRecovery, authorityWithdrawalTime, appendSeal } from './HandoffSeal.mjs';
import { byteDigest, resolveSource, controlPaths, assertPrivateControlStorage, withControlTransaction, writeAtomic, writeJournal, verifyAuthorityJournalCompletion } from './HandoffControl.mjs';
import { buildControlPlan, renderCurrent, assertRenderedCurrentIdentity, recheckDependencies } from './Takeover-Handoff.mjs';
import { verifyRuleManifest, verifyWorkspaceBaseline, readGitWorkspaceBaseline, readLiveRemoteBaseline, verifyHandoffInventory } from './Prepare-Handoff.mjs';
import { captureTransactionWorkspace, verifyTransactionWorkspace } from './HandoffTransactionWorkspace.mjs';
import { isControlOnly, authorityRenderVersion, authorityRestrictions, authorityRequiredFiles, controlOnlyContinuityErrors, HISTORICAL_WORKSPACE_RESTRICTION } from './HandoffSeal.mjs';

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const equal = (a, b) => canonicalJson(a) === canonicalJson(b);
const defaultRules = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../总指挥工作流/第二代总指挥的工作模式');
const kind = 'handoff-authority-recovery-transaction';
function historyFor(options) {
  const history = readChain(options.sealDirectory);
  assert(!history.errors.length && history.records.length, `authority history invalid: ${history.errors.join('; ')}`);
  assert(!history.pending_intents.length, 'original transition is unresolved; authority recovery cannot discard it');
  return history;
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
function priorJournal(paths, history, options) {
  if (!fs.existsSync(paths.journal)) return null;
  const bytes = fs.readFileSync(paths.journal), journal = JSON.parse(bytes);
  if (journal.protocol_version === 1 && journal.status === 'COMPLETED') {
    assert(history.records.some(record => record.event_id === journal.event_id && record.previous_seal_digest === journal.previous_seal_digest && record.transition?.intent_digest === journal.intent_digest), 'old completed journal does not match formal history');
  } else if (journal.protocol_version === 2 && journal.record_type === kind && journal.status === 'ROLLED_BACK_STOPPED') {
    const withdrawal = history.authority_withdrawals.find(item => item.intent_digest === journal.intent_digest);
    const intent = history.authority_intents.find(item => item.recovery_digest === journal.intent_digest);
    assert(withdrawal && intent && options.confirmation.evidence_ref !== intent.transaction.confirmation.evidence_ref && Date.parse(options.confirmation.confirmed_at) > Date.parse(withdrawal.withdrawn_at), 'withdrawn recovery requires a new current operator confirmation, not revival');
  } else if (journal.protocol_version === 2 && journal.record_type === kind && journal.status === 'COMPLETED') {
    verifyAuthorityJournalCompletion(journal, history.records.at(-1), options);
    assert(history.records.some(record => record.event_id === journal.event_id && record.authority_recovery?.intent_digest === journal.intent_digest), 'previous authority completion is not in formal history');
  } else throw new Error('existing canonical transaction is not settled; preserve and recover it first');
  return bytes.toString('base64');
}

// Read-only preflight. Its observation is explicitly a receiver's snapshot,
// never MATERIAL_PREPARED signed or appended on behalf of the observed writer.
export function planAuthorityRecovery(options) {
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
    const errors = controlOnlyContinuityErrors(previous, observation);
    assert(!errors.length, errors.join('; '));
    for (const file of observation.workspace.required_untracked) assert(byteDigest(fs.readFileSync(resolveSource({ root_ref: 'source_root', path_ref: file.path_ref }, options))) === file.sha256, 'control-only required current bytes mismatch');
  } else assert(!previous.restrictions?.includes(HISTORICAL_WORKSPACE_RESTRICTION), 'historical workspace limitation requires control-only handling');
  assert(Object.keys(observation.sources).sort().join(',') === Object.keys(previous.sources).sort().join(','), 'recovery cannot add or drop source evidence');
  for (const [name, source] of Object.entries(previous.sources)) {
    const observed = observation.sources[name];
    assert(source.path_ref === observed.path_ref && (source.root_ref || 'source_root') === (observed.root_ref || 'source_root'), `canonical source migration is outside recovery: ${name}`);
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
  verifyHandoffInventory(isControlOnly(options.confirmation) ? previous : observation, options);
  let remote;
  try { remote = readLiveRemoteBaseline(options.sourceRoot, observation.remote.default_ref); }
  catch (error) { assert(!options.remoteRequired && observation.remote.status === 'UNKNOWN' && observation.restrictions.includes('REMOTE_UNOBSERVED'), `REMOTE_RECHECK_REQUIRED: ${error.message}`); }
  if (remote) assert(observation.remote.status === 'PASS' && remote.head === observation.remote.head, 'remote observation changed; collect a fresh baseline');
  const plan = buildControlPlan(observation, options, authorityRenderVersion(options.confirmation)), workspace_projection = captureTransactionWorkspace(observation, plan, options);
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
  const history = historyFor(options), existing = history.authority_intents.find(item => item.event_id === options.eventId);
  const anchor = existing?.transaction.observation || normalizedObservation(options.observation, options.confirmation, options.preparedAt);
  assertStorage(anchor, options);
  return withControlTransaction(anchor, options, paths => {
    if (existing) return forward(selectedIntent(historyFor(options), options), options, paths);
    const { previous, transaction } = planAuthorityRecovery(options);
    const prepared = prepareAuthorityRecovery(options.sealDirectory, transaction, { ...options, expectedPreviousDigest: previous.seal_digest });
    options.fault?.('after-intent');
    writeJournal(paths.journal, journalFor(prepared.record, options)); options.fault?.('after-journal');
    return forward(prepared.record, options, paths);
  });
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
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    const [mode, configPath] = process.argv.slice(2);
    assert(['inspect', 'commit', 'recover', 'rollback'].includes(mode) && configPath, 'usage: node Recover-CommanderAuthority.mjs inspect|commit|recover|rollback <receiver-config.json>');
    const options = JSON.parse(fs.readFileSync(configPath, 'utf8')), base = path.dirname(path.resolve(configPath));
    for (const name of ['sourceRoot', 'externalControlPlaneRoot', 'sealDirectory', 'workflowRoot', 'manifestPath']) if (options[name]) options[name] = path.resolve(base, options[name]);
    if (mode === 'inspect') { const plan = planAuthorityRecovery(options); console.log(JSON.stringify({ status: 'RECOVERY_PLAN_READY', generation: plan.transaction.observation.generation + 1, ...completionScope({ transaction: plan.transaction }), writes: 0 })); }
    else console.log(JSON.stringify((mode === 'rollback' ? rollbackCommanderAuthority : recoverCommanderAuthority)(options), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
