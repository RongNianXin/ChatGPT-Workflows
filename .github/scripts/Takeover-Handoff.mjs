// The receiving agent verifies the actual operator message before constructing
// confirmation. This tool validates bindings and persistence, not human identity.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readChain, verifyChain, validateDirectConfirmation, prepareDirectTransition, appendSeal } from './HandoffSeal.mjs';
import { verifyHandoffCandidate } from './Verify-Handoff-Candidate.mjs';
import { byteDigest, resolveSource, controlPaths, withControlLock, withControlTransaction, assertControlReady, writeAtomic, writeJournal } from './HandoffControl.mjs';
import { verifyRuleManifest, verifyWorkspaceBaseline, readLiveRemoteBaseline } from './Prepare-Handoff.mjs';

const assert = (condition, message) => { if (!condition) throw new Error(message); };
function privateControlStorage(previous, options) {
  const root = fs.realpathSync(options.sourceRoot), paths = controlPaths(previous, options);
  for (const file of [paths.index, paths.lock, paths.journal, `${paths.index}.${process.pid}.tmp`, `${paths.journal}.${process.pid}.tmp`]) {
    const relative = path.relative(root, file);
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) continue;
    const ignored = spawnSync('git', ['-C', root, 'check-ignore', '--quiet', '--', relative], { encoding: 'utf8' });
    const tracked = spawnSync('git', ['-C', root, 'ls-files', '--', relative], { encoding: 'utf8' });
    assert(ignored.status === 0 && tracked.status === 0 && !tracked.stdout.trim(), 'INPUT_REQUIRED: canonical control index, lock and journal must be ignored and untracked inside the code root; do not publish private transaction bytes');
  }
}
function confirmed(options, previous) {
  const errors = validateDirectConfirmation(options.confirmation, options.recipient, previous);
  assert(!errors.length, errors.join('; '));
  assert(/^[A-Za-z0-9._:-]+$/.test(options.eventId || ''), 'takeover event required');
  const index = fs.readFileSync(resolveSource(previous.sources.status_index, options), 'utf8');
  const current = index.split('<!-- CURRENT:BEGIN -->')[1]?.split('<!-- CURRENT:END -->')[0];
  assert(current?.match(/^项目键：([^\r\n]+)$/m)?.[1]?.trim() === options.recipient.projectKey, 'confirmation project does not match canonical CURRENT');
}
function replaceCurrent(bytes, previous, recipient) {
  const text = bytes.toString('utf8'), start = text.indexOf('<!-- CURRENT:BEGIN -->') + '<!-- CURRENT:BEGIN -->'.length, end = text.indexOf('<!-- CURRENT:END -->');
  assert(start >= '<!-- CURRENT:BEGIN -->'.length && end > start, 'canonical CURRENT boundaries required');
  const old = text.slice(start, end);
  let current = old.replace(/<!-- CONTROL_IDENTITY: ([\s\S]*?) -->/g, (_, json) => {
    const id = JSON.parse(json);
    assert(id.generation === previous.generation && id.writer_id === previous.writer_id, 'identity changed before plan');
    return `<!-- CONTROL_IDENTITY: ${JSON.stringify({ generation: previous.generation + 1, writer_id: recipient.writerId, platform_task_id: recipient.platformTaskId })} -->`;
  });
  current = current.replace(/((?:当前唯一中央写者|唯一当前写者绑定|中央登记唯一写者|唯一中央写者|当前写者|writer_id)\s*[:：=]\s*)`?[A-Za-z0-9._-]+`?/g, `$1${recipient.writerId}`)
    .replace(/((?:当前总指挥世代|generation)\s*[:：=]\s*)`?\d+`?/g, `$1${previous.generation + 1}`)
    .replace(/((?:当前任务\s*ID|平台任务\s*ID|platform_task_id)\s*[:：=]\s*)`?[A-Za-z0-9-]+`?/g, `$1${recipient.platformTaskId}`)
    .replace(/^本轮权限：[^\r\n]*/gm, '本轮权限：仅本次交接准备、提交与完成回读；旧授权不继承，业务、远端和通信另核当前有效授权')
    .replace(/^旧授权继承：[^\r\n]*/gm, '旧授权继承：NONE');
  current += `\n接管协议：DIRECT_OPERATOR_V1；TAKEOVER_COMPLETED（仅在规范事务日志COMPLETED且回读一致时生效）\n旧总指挥：世代${previous.generation} STOPPED_DISPATCH；保留历史，不恢复旧授权\n`;
  const historical = old.replaceAll('<!-- CONTROL_IDENTITY:', '<!-- ARCHIVED_CONTROL_IDENTITY:').replaceAll('<!-- CONTROL_NAVIGATION:', '<!-- ARCHIVED_CONTROL_NAVIGATION:');
  let after = text.slice(0, start) + current + text.slice(end);
  if (after.includes('<!-- HISTORY:BEGIN -->')) after = after.replace('<!-- HISTORY:BEGIN -->', `<!-- HISTORY:BEGIN -->\n\n## Previous commander (HISTORICAL_ONLY)\n${historical}\n`);
  else after += `\n<!-- HISTORY:BEGIN -->\n## Previous commander (HISTORICAL_ONLY)\n${historical}\n`;
  return Buffer.from(after);
}
function buildPlan(previous, options) {
  // Enablement is a navigation source, outside the four central write targets.
  // Older accepted documents may redundantly state the writer here. Detect that
  // compatibility limit before preparing an intent or touching central bytes.
  const enablement = fs.readFileSync(resolveSource(previous.sources.workflow_enablement, options), 'utf8').split('<!-- CURRENT:BEGIN -->')[1]?.split('<!-- CURRENT:END -->')[0] || '';
  assert(!/(?:当前唯一中央写者|唯一当前写者绑定|中央登记唯一写者|唯一中央写者|当前写者|writer_id|当前总指挥世代|generation|当前任务\s*ID|平台任务\s*ID|platform_task_id)\s*[:：=]\s*`?[A-Za-z0-9._-]+/.test(enablement), 'INPUT_REQUIRED: static workflow_enablement contains writer identity outside the authorized central plan; keep canonical identity in status_index and navigation in enablement');
  const files = new Map();
  for (const name of ['status_index', 'central_work_items', 'current_view', 'central_entry']) {
    const source = previous.sources[name], file = resolveSource(source, options);
    if (files.has(file)) { files.get(file).names.push(name); continue; }
    const before = fs.readFileSync(file);
    assert(byteDigest(before) === source.digest, 'source changed before transaction plan');
    const after = replaceCurrent(before, previous, options.recipient);
    files.set(file, { names: [name], root_ref: source.root_ref || 'source_root', path_ref: source.path_ref, before: before.toString('base64'), after: after.toString('base64'), before_sha256: byteDigest(before), after_sha256: byteDigest(after) });
  }
  return [...files.values()];
}
function checkJournal(journal, options, history) {
  assert(journal.protocol_version === 1 && journal.event_id === options.eventId && Array.isArray(journal.plan) && journal.plan.length > 0 && journal.plan.length <= 4, 'transaction journal mismatch');
  const previous = history.records.find(item => item.seal_digest === journal.previous_seal_digest);
  assert(previous, 'journal predecessor absent from immutable history');
  confirmed(options, previous);
  assert(JSON.stringify(journal.confirmation) === JSON.stringify(options.confirmation), 'journal confirmation changed');
  const intent = history.intents.find(item => item.transition_digest === journal.intent_digest);
  assert(intent && journal.intent_path === `handoff-transition.${intent.previous_sequence}.${intent.transition_digest}.json`, 'journal immutable intent evidence missing or changed');
  assert(intent.previous_seal_digest === previous.seal_digest && intent.previous_sequence === previous.seal_sequence && intent.previous_generation === previous.generation && intent.previous_writer_id === previous.writer_id && intent.next_generation === previous.generation + 1 && intent.next_writer_id === options.recipient.writerId && intent.event_id === options.eventId, 'journal intent target mismatch');
  if (intent.record_type === 'handoff-direct-transition-intent') assert(JSON.stringify(intent.authorization) === JSON.stringify(options.confirmation), 'journal direct intent confirmation mismatch');
  const names = journal.plan.flatMap(item => item.names);
  assert(names.length === 4 && ['status_index', 'central_work_items', 'current_view', 'central_entry'].every(name => names.includes(name)), 'journal control write scope mismatch');
  for (const item of journal.plan) {
    const original = previous.sources[item.names[0]];
    assert(item.path_ref === original.path_ref && item.root_ref === (original.root_ref || 'source_root'), 'journal path does not match sealed source');
    assert(byteDigest(Buffer.from(item.before, 'base64')) === original.digest && item.before_sha256 === original.digest, 'journal old byte evidence mismatch');
    assert(byteDigest(Buffer.from(item.after, 'base64')) === item.after_sha256, 'journal new byte evidence mismatch');
    assert(Buffer.from(item.after, 'base64').equals(replaceCurrent(Buffer.from(item.before, 'base64'), previous, options.recipient)), 'journal target bytes changed');
    for (const name of item.names) assert(resolveSource(previous.sources[name], options) === resolveSource(original, options), 'journal alias mismatch');
  }
  const draft = journal.draft;
  for (const key of ['objective', 'prohibitions', 'workspace', 'rule_baseline', 'invalidation_conditions', 'runtime_acceptance_status', 'professional_acceptance_status']) assert(JSON.stringify(draft?.[key]) === JSON.stringify(previous[key]), `journal changed protected ${key}`);
  assert(draft?.schema_version === 4 && draft.generation === previous.generation + 1 && draft.writer_id === options.recipient.writerId && draft.event_id === options.eventId && draft.handoff_phase === 'TAKEOVER_COMPLETED' && draft.switch_status === 'COMPLETED' && draft.communications?.status === 'NONE', 'journal completion target mismatch');
  assert(Object.keys(draft.sources).sort().join(',') === Object.keys(previous.sources).sort().join(','), 'journal source set mismatch');
  for (const [name, source] of Object.entries(previous.sources)) {
    const target = draft.sources[name], change = journal.plan.find(item => item.names.includes(name));
    assert(target.path_ref === source.path_ref && target.root_ref === source.root_ref && target.owner === source.owner && target.digest === (change ? change.after_sha256 : source.digest), 'journal source evidence mismatch');
  }
  return previous;
}
function recheckDependencies(journal, options) {
  const workflowRoot = options.workflowRoot || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../总指挥工作流/第二代总指挥的工作模式');
  const manifestPath = options.manifestPath || path.join(workflowRoot, '规则刷新manifest.json');
  const manifest = verifyRuleManifest(workflowRoot, manifestPath);
  assert(manifest.rule_version === journal.draft.rule_baseline.rule_version && byteDigest(fs.readFileSync(manifestPath)) === journal.draft.rule_baseline.manifest_sha256, 'RULE_REBASE_PENDING: rules changed during transaction');
  const errors = verifyWorkspaceBaseline(options.sourceRoot, journal.draft.workspace, journal.draft.sources, { externalControlPlaneRoot: options.externalControlPlaneRoot, ruleBaseline: journal.draft.rule_baseline, workflowRepositoryRoot: path.resolve(workflowRoot, '../..') });
  assert(!errors.length, `workspace changed during transaction: ${errors.join('; ')}`);
  if (options.remoteRequired || journal.draft.remote.status === 'PASS') {
    let remote;
    try { remote = readLiveRemoteBaseline(options.sourceRoot, journal.draft.remote.default_ref); }
    catch (error) { throw new Error(`REMOTE_RECHECK_REQUIRED: ${error.message}`); }
    assert(remote.head === journal.draft.remote.head, 'remote changed during transaction');
  }
}
function commitJournal(journal, paths, options) {
  assert(['PREPARED', 'COMPLETED'].includes(journal.status), 'withdrawn transaction cannot resume dispatch or forward recovery');
  const history = readChain(options.sealDirectory), previous = checkJournal(journal, options, history);
  assert(!history.errors.length, `seal history invalid: ${history.errors.join('; ')}`);
  // First inspect ALL files. Recovery never overwrites a third kind of bytes.
  for (const item of journal.plan) {
    const actual = byteDigest(fs.readFileSync(resolveSource(item, options)));
    assert([item.before_sha256, item.after_sha256].includes(actual), 'control byte conflict during recovery');
  }
  recheckDependencies(journal, options);
  const committed = history.records.find(record => record.event_id === journal.event_id);
  if (committed) assert(committed.generation === previous.generation + 1 && committed.writer_id === options.recipient.writerId && committed.previous_seal_digest === previous.seal_digest && committed.transition?.intent_digest === journal.intent_digest, 'completed event conflicts with journal');
  else assert(history.latest === undefined || history.records.at(-1)?.seal_digest === previous.seal_digest, 'predecessor changed during transaction');
  for (let index = 0; index < journal.plan.length; index++) {
    const item = journal.plan[index], file = resolveSource(item, options);
    const actual = byteDigest(fs.readFileSync(file));
    assert([item.before_sha256, item.after_sha256].includes(actual), 'control bytes changed before write');
    if (actual === item.before_sha256) writeAtomic(file, Buffer.from(item.after, 'base64'));
    options.fault?.(`after-write-${index}`);
  }
  recheckDependencies(journal, options);
  options.fault?.('before-seal');
  if (!committed) appendSeal(options.sealDirectory, journal.draft, { ...options, expectedPreviousDigest: previous.seal_digest, transitionTicket: journal.intent_path ? path.join(options.sealDirectory, journal.intent_path) : undefined });
  options.fault?.('after-seal');
  const live = verifyChain(options.sealDirectory, options);
  assert(live.status === 'PASS' && live.control_status === 'READY' && live.latest.event_id === journal.event_id, `completed readback failed: ${live.errors.join('; ')}`);
  journal.status = 'COMPLETED'; journal.completed_at = new Date().toISOString(); writeJournal(paths.journal, journal);
  return { status: 'COMPLETED', generation: live.latest.generation, writer_id: live.latest.writer_id, restrictions: live.latest.restrictions || [], old_authorization_inherited: false };
}
export function takeoverHandoff(options) {
  const history = readChain(options.sealDirectory);
  assert(!history.errors.length, `candidate history invalid: ${history.errors.join('; ')}`);
  const latest = history.records.at(-1); assert(latest, 'candidate material missing');
  privateControlStorage(latest, options);
  if (latest.event_id === options.eventId && latest.handoff_phase === 'TAKEOVER_COMPLETED') {
    const previous = history.records.at(-2); confirmed(options, previous);
    return withControlLock(latest, options, paths => {
      assertControlReady(latest, options);
      const journal = JSON.parse(fs.readFileSync(paths.journal, 'utf8')); checkJournal(journal, options, history);
      const live = verifyChain(options.sealDirectory, options);
      assert(journal.status === 'COMPLETED' && live.status === 'PASS' && live.control_status === 'READY' && latest.writer_id === options.recipient.writerId && latest.previous_seal_digest === previous.seal_digest && latest.transition?.intent_digest === journal.intent_digest, 'completed takeover needs recovery or revalidation');
      return { status: 'COMPLETED', generation: latest.generation, writer_id: latest.writer_id, restrictions: latest.restrictions || [], old_authorization_inherited: false };
    });
  }
  confirmed(options, latest);
  return withControlLock(latest, options, paths => {
    assertControlReady(latest, options);
    const result = verifyHandoffCandidate({ ...options, nextGeneration: latest.generation + 1, nextWriterId: options.recipient.writerId, eventId: options.eventId });
    assert(['READY', 'READY_WITH_RESTRICTIONS'].includes(result.status) && !result.errors.length, `candidate verification failed: ${result.errors.join('; ')}`);
    const plan = buildPlan(latest, options);
    let intent;
    if (history.pending_intents.length) {
      assert(history.pending_intents.length === 1 && result.rotation.status === 'MATCHED', 'existing pending intent target mismatch');
      intent = history.pending_intents[0];
      if (intent.record_type === 'handoff-direct-transition-intent') assert(JSON.stringify(intent.authorization) === JSON.stringify(options.confirmation), 'pending direct confirmation mismatch');
    } else intent = prepareDirectTransition(options.sealDirectory, { ...options, expectedPreviousDigest: latest.seal_digest }).intent;
    const stamp = new Date().toISOString();
    const draft = structuredClone(latest);
    Object.assign(draft, { schema_version: 4, generation: latest.generation + 1, writer_id: options.recipient.writerId, old_writer_status: options.confirmation.old_writer_status, event_id: options.eventId, fact_cutoff: stamp, sealed_at: stamp, switch_status: 'COMPLETED', handoff_phase: 'TAKEOVER_COMPLETED', candidate_verification_status: result.status === 'READY' ? 'PASS' : 'PASS_WITH_RESTRICTIONS', control_handoff_confidence: 'HIGH', communications: { status: 'NONE' }, restrictions: result.remote.status === 'UNKNOWN' ? ['REMOTE_UNOBSERVED'] : [], remote: { ...draft.remote, status: result.remote.status, head: result.remote.head || null, observed_at: result.remote.observed_at || null }, transition: null, migration: null, seal_digest: '' });
    for (const item of plan) for (const name of item.names) { draft.sources[name].digest = item.after_sha256; draft.sources[name].fact_cutoff = stamp; }
    const journal = { protocol_version: 1, status: 'PREPARED', event_id: options.eventId, previous_seal_digest: latest.seal_digest, confirmation: structuredClone(options.confirmation), intent_digest: intent.transition_digest, intent_path: `handoff-transition.${intent.previous_sequence}.${intent.transition_digest}.json`, plan, draft, prepared_at: stamp };
    // Durable evidence precedes the first central file mutation.
    writeJournal(paths.journal, journal); options.fault?.('after-journal');
    return withControlTransaction(latest, options, () => commitJournal(journal, paths, options));
  });
}
export function recoverTakeover(options) {
  const history = readChain(options.sealDirectory), latest = history.records.at(-1); assert(latest, 'recovery material missing');
  privateControlStorage(latest, options);
  return withControlTransaction(latest, options, paths => {
    const journal = JSON.parse(fs.readFileSync(paths.journal, 'utf8'));
    return commitJournal(journal, paths, options);
  });
}

// A failed transaction may be safely withdrawn before its immutable completion
// seal exists. Withdrawal preserves the stopped state; it never revives dispatch.
export function rollbackTakeover(options) {
  const history = readChain(options.sealDirectory), latest = history.records.at(-1);
  assert(latest && !history.errors.length, 'rollback history invalid or missing');
  privateControlStorage(latest, options);
  return withControlTransaction(latest, options, paths => {
    const journal = JSON.parse(fs.readFileSync(paths.journal, 'utf8'));
    const previous = checkJournal(journal, options, history);
    assert(history.records.at(-1).seal_digest === previous.seal_digest && !history.records.some(record => record.event_id === journal.event_id), 'rollback forbidden after completion seal or another chain event');
    for (const item of journal.plan) {
      const actual = byteDigest(fs.readFileSync(resolveSource(item, options)));
      assert([item.before_sha256, item.after_sha256].includes(actual), 'control byte conflict during rollback');
    }
    // New rule/workspace evidence may invalidate forward recovery; it does not
    // authorize altering any bytes beyond this exact, previously recorded plan.
    journal.status = 'ROLLING_BACK_STOPPED'; writeJournal(paths.journal, journal);
    for (const item of journal.plan) {
      const file = resolveSource(item, options), actual = byteDigest(fs.readFileSync(file));
      assert([item.before_sha256, item.after_sha256].includes(actual), 'control bytes changed before rollback');
      if (actual === item.after_sha256) writeAtomic(file, Buffer.from(item.before, 'base64'));
    }
    assert(journal.plan.every(item => byteDigest(fs.readFileSync(resolveSource(item, options))) === item.before_sha256), 'rollback readback failed');
    journal.status = 'ROLLED_BACK_STOPPED'; journal.rolled_back_at = new Date().toISOString(); writeJournal(paths.journal, journal);
    return { status: 'ROLLED_BACK_STOPPED', dispatch_allowed: false, next: 'Recheck current authority and regenerate affected material; preserve journal and immutable intent.' };
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [mode, configPath] = process.argv.slice(2);
  try {
    assert(['commit', 'recover', 'rollback'].includes(mode) && configPath, 'usage: node Takeover-Handoff.mjs commit|recover|rollback <receiving-agent-config.json>');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8')), base = path.dirname(path.resolve(configPath));
    for (const name of ['sourceRoot', 'externalControlPlaneRoot', 'sealDirectory', 'workflowRoot', 'manifestPath']) if (config[name]) config[name] = path.resolve(base, config[name]);
    const action = mode === 'recover' ? recoverTakeover : mode === 'rollback' ? rollbackTakeover : takeoverHandoff;
    console.log(JSON.stringify(action(config), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
