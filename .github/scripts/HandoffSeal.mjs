// Immutable handoff-seal chain helper. It does not stop processes that bypass it.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HEX = /^[0-9a-f]{64}$/;
const TOP_LEVEL_KEYS = new Set(['schema_version', 'record_type', 'generation', 'writer_id', 'old_writer_status', 'seal_sequence', 'previous_seal_digest', 'fact_cutoff', 'sealed_at', 'event_id', 'sources', 'source_digest_status', 'objective', 'prohibitions', 'communications', 'workspace', 'remote', 'control_handoff_confidence', 'candidate_verification_status', 'switch_status', 'handoff_phase', 'runtime_acceptance_status', 'professional_acceptance_status', 'transition', 'migration', 'invalidation_conditions', 'seal_digest']);
const exactKeys = (value, allowed) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(key => allowed.includes(key));
const relativeRef = value => typeof value === 'string' && value.length > 0 && !path.isAbsolute(value) && !path.win32.isAbsolute(value) && !value.split(/[\\/]+/).includes('..');
const iso = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && !Number.isNaN(Date.parse(value));
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const sorted = value => {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, sorted(value[key])]));
  return value;
};
export const canonicalJson = value => JSON.stringify(sorted(value));
export const sealDigest = seal => digest(canonicalJson(Object.fromEntries(Object.entries(seal).filter(([key]) => key !== 'seal_digest'))));
export const transitionDigest = intent => digest(canonicalJson(Object.fromEntries(Object.entries(intent).filter(([key]) => key !== 'transition_digest'))));

const fail = (errors, message) => errors.push(message);
function verifySourceFiles(seal, sourceRoot, externalControlPlaneRoot) {
  if (!sourceRoot) return ['HIGH control handoff requires sourceRoot verification'];
  let internalRoot;
  try { internalRoot = fs.realpathSync(path.resolve(sourceRoot)); } catch (error) { return [`source root verification failed: ${error.message}`]; }
  let externalRoot = null;
  if (externalControlPlaneRoot) {
    try { externalRoot = fs.realpathSync(path.resolve(externalControlPlaneRoot)); } catch (error) { return [`external control-plane root verification failed: ${error.message}`]; }
  }
  const errors = [];
  for (const [name, source] of Object.entries(seal.sources ?? {})) {
    try {
      const root = source.root_ref === 'external_control_plane' ? externalRoot : internalRoot;
      if (!root) throw new Error(`missing root for ${source.root_ref === 'external_control_plane' ? 'external_control_plane' : 'source_root'}`);
      const resolved = fs.realpathSync(path.resolve(root, source.path_ref));
      if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) throw new Error('source path escapes root');
      if (digest(fs.readFileSync(resolved)) !== source.digest) throw new Error('source digest mismatch');
      if (name === 'control_plane_registry') {
        const registry = JSON.parse(fs.readFileSync(resolved, 'utf8'));
        const statusSource = seal.sources?.status_index;
        const registryErrors = validateControlPlaneRegistry(registry, statusSource?.root_ref === 'external_control_plane' ? externalRoot : internalRoot, statusSource?.path_ref);
        if (registryErrors.length) throw new Error(registryErrors.join('; '));
      }
    } catch (error) { errors.push(`source verification failed: ${name}: ${error.message}`); }
  }
  return errors;
}

export function validateControlPlaneRegistry(registry, sourceRoot, canonicalStatusIndexRef) {
  const errors = [];
  if (!registry || typeof registry !== 'object' || Array.isArray(registry)) return ['registry must be an object'];
  if (registry.schema_version !== 1) errors.push('registry schema_version must be 1');
  if (registry.canonical_index !== canonicalStatusIndexRef) errors.push('registry canonical index mismatch');
  if (!Array.isArray(registry.legacy_indexes)) errors.push('registry legacy_indexes must be an array');
  const seen = new Set([canonicalStatusIndexRef]);
  for (const item of registry.legacy_indexes ?? []) {
    if (!item || typeof item.path !== 'string' || item.status !== 'HISTORICAL_ONLY' || !HEX.test(item.sha256 || '') || typeof item.reason !== 'string' || !item.reason) { errors.push('invalid historical control-plane entry'); continue; }
    if (seen.has(item.path)) { errors.push(`duplicate control-plane path: ${item.path}`); continue; }
    seen.add(item.path);
    try {
      const resolved = fs.realpathSync(path.resolve(sourceRoot, item.path));
      if (resolved === sourceRoot || !resolved.startsWith(`${sourceRoot}${path.sep}`)) throw new Error('path escapes source root');
      if (digest(fs.readFileSync(resolved)) !== item.sha256) throw new Error('digest mismatch');
      const content = fs.readFileSync(resolved, 'utf8');
      if (!content.includes('<!-- CURRENT:BEGIN -->')) throw new Error('historical entry is not a CURRENT control-plane record');
    } catch (error) { errors.push(`historical control-plane verification failed: ${item.path}: ${error.message}`); }
  }
  return errors;
}
export function validateSeal(seal, { checkDigest = true } = {}) {
  const errors = [];
  if (!seal || typeof seal !== 'object' || Array.isArray(seal)) return ['seal must be an object'];
  for (const key of Object.keys(seal)) if (!TOP_LEVEL_KEYS.has(key)) fail(errors, `unknown top-level field: ${key}`);
  if (![1, 2, 3].includes(seal.schema_version)) fail(errors, 'schema_version must be 1, 2, or 3');
  if (seal.record_type !== 'handoff-seal') fail(errors, 'record_type must be handoff-seal');
  if (!Number.isInteger(seal.generation) || seal.generation < 1) fail(errors, 'generation must be a positive integer');
  if (!/^[A-Za-z0-9._-]+$/.test(seal.writer_id || '')) fail(errors, 'writer_id is not a portable logical id');
  if (!['IDLE', 'STOPPED_DISPATCH', 'ARCHIVED', 'UNKNOWN'].includes(seal.old_writer_status)) fail(errors, 'invalid old_writer_status');
  if (!Number.isInteger(seal.seal_sequence) || seal.seal_sequence < 1) fail(errors, 'seal_sequence must be positive');
  if (seal.previous_seal_digest !== null && !HEX.test(seal.previous_seal_digest || '')) fail(errors, 'invalid previous_seal_digest');
  for (const key of ['fact_cutoff', 'sealed_at']) if (!iso(seal[key])) fail(errors, `${key} must be an ISO timestamp`);
  if (seal.schema_version === 3 && iso(seal.fact_cutoff) && iso(seal.sealed_at) && Date.parse(seal.sealed_at) < Date.parse(seal.fact_cutoff)) fail(errors, 'sealed_at must not precede fact_cutoff');
  if (!/^[A-Za-z0-9._:-]+$/.test(seal.event_id || '')) fail(errors, 'event_id is not a portable logical id');
  if (!seal.sources || typeof seal.sources !== 'object' || Array.isArray(seal.sources) || !Object.keys(seal.sources).length) fail(errors, 'sources must be non-empty');
  else for (const [name, source] of Object.entries(seal.sources)) {
    const sourceKeys = seal.schema_version >= 3 ? ['owner', 'path_ref', 'digest', 'fact_cutoff', 'root_ref'] : ['owner', 'path_ref', 'digest', 'fact_cutoff'];
    if (!exactKeys(source, sourceKeys) || typeof source.owner !== 'string' || !source.owner || !relativeRef(source.path_ref) || !HEX.test(source.digest || '') || !iso(source.fact_cutoff)) fail(errors, `invalid source: ${name}`);
    if (!relativeRef(source.path_ref)) fail(errors, `unsafe source path: ${name}`);
    if (seal.schema_version >= 3 && source.root_ref !== undefined && !['source_root', 'external_control_plane'].includes(source.root_ref)) fail(errors, `invalid source root_ref: ${name}`);
    if (seal.schema_version >= 3 && source.root_ref === 'external_control_plane' && name !== 'control_plane_registry' && !['central_work_items', 'current_view', 'status_index'].includes(name)) fail(errors, `external root is only allowed for control-plane sources: ${name}`);
    if (source.fact_cutoff !== seal.fact_cutoff) fail(errors, `source fact_cutoff mismatch: ${name}`);
  }
  if (!['PASS', 'UNKNOWN', 'FAIL'].includes(seal.source_digest_status)) fail(errors, 'invalid source_digest_status');
  if (!exactKeys(seal.objective, ['summary', 'breakpoint']) || typeof seal.objective.summary !== 'string' || typeof seal.objective.breakpoint !== 'string') fail(errors, 'objective summary/breakpoint required');
  if (!Array.isArray(seal.prohibitions) || seal.prohibitions.some(value => typeof value !== 'string')) fail(errors, 'prohibitions must be an array of strings');
  if (!exactKeys(seal.communications, ['status']) || !['NONE', 'AUTHORIZED', 'PENDING_CONFIRMATION', 'BLOCKED'].includes(seal.communications.status)) fail(errors, 'invalid communications status');
  const w = seal.workspace;
  if (!exactKeys(w, ['root_ref', 'branch', 'head', 'tree', 'staged_count', 'tracked_modified_count', 'untracked_count', 'required_untracked']) || typeof w.root_ref !== 'string' || !w.root_ref || typeof w.branch !== 'string' || !w.branch || !/^[0-9a-f]{40,64}$/.test(w.head || '') || !/^[0-9a-f]{40,64}$/.test(w.tree || '') || !Number.isInteger(w.staged_count) || w.staged_count < 0 || !Number.isInteger(w.tracked_modified_count) || w.tracked_modified_count < 0 || !Number.isInteger(w.untracked_count) || w.untracked_count < 0 || !Array.isArray(w.required_untracked)) fail(errors, 'invalid workspace baseline');
  else for (const item of w.required_untracked) if (!exactKeys(item, ['path_ref', 'sha256', 'reason']) || !relativeRef(item.path_ref) || !HEX.test(item.sha256 || '') || typeof item.reason !== 'string' || !item.reason) fail(errors, 'invalid required_untracked item');
  const r = seal.remote;
  if (!exactKeys(r, ['status', 'default_ref', 'head', 'observed_at']) || !['PASS', 'UNKNOWN', 'FAIL', 'NOT_APPLICABLE'].includes(r.status) || typeof r.default_ref !== 'string' || !r.default_ref || (r.head !== null && !/^[0-9a-f]{40,64}$/.test(r.head || '')) || (r.observed_at !== null && !iso(r.observed_at))) fail(errors, 'invalid remote baseline');
  if (!['HIGH', 'MEDIUM', 'LOW'].includes(seal.control_handoff_confidence)) fail(errors, 'invalid control_handoff_confidence');
  if (!['READY', 'READY_WITH_RESTRICTIONS', 'BLOCKED', 'COMPLETED'].includes(seal.switch_status)) fail(errors, 'invalid switch_status');
  if (seal.schema_version >= 2) {
    if (!['NOT_RUN', 'PASS', 'PASS_WITH_RESTRICTIONS', 'FAIL'].includes(seal.candidate_verification_status)) fail(errors, 'invalid candidate_verification_status');
    if (!['MATERIAL_PREPARED', 'TAKEOVER_COMPLETED', 'CURRENT_MIGRATION', 'CURRENT_ATTESTATION'].includes(seal.handoff_phase)) fail(errors, 'invalid handoff_phase');
    if (seal.handoff_phase === 'MATERIAL_PREPARED' && seal.switch_status === 'COMPLETED') fail(errors, 'material preparation cannot be COMPLETED');
    if (seal.handoff_phase === 'TAKEOVER_COMPLETED' && seal.switch_status !== 'COMPLETED') fail(errors, 'takeover phase requires COMPLETED');
    if (seal.handoff_phase === 'CURRENT_MIGRATION') {
      if (seal.switch_status !== 'COMPLETED' || seal.seal_sequence !== 1 || seal.previous_seal_digest !== null || seal.transition !== null) fail(errors, 'current migration must be the first completed seal without a transition');
      if (!exactKeys(seal.migration, ['legacy_latest_seal_digest', 'legacy_generation', 'legacy_writer_id', 'migrated_at', 'basis']) || !HEX.test(seal.migration?.legacy_latest_seal_digest || '') || !Number.isInteger(seal.migration?.legacy_generation) || seal.migration?.legacy_generation < 1 || !/^[A-Za-z0-9._-]+$/.test(seal.migration?.legacy_writer_id || '') || !iso(seal.migration?.migrated_at) || seal.migration?.basis !== 'CURRENT_ONLY_NO_RETROACTIVE_TRANSITION') fail(errors, 'invalid current migration evidence');
    } else if (seal.migration !== null) fail(errors, 'non-migration seal must not contain migration evidence');
    if (seal.handoff_phase === 'CURRENT_ATTESTATION' && (!['BLOCKED', 'COMPLETED'].includes(seal.switch_status) || seal.transition !== null || seal.migration !== null)) fail(errors, 'current attestation must be blocked or completed without transition or migration evidence');
  }
  for (const key of ['runtime_acceptance_status', 'professional_acceptance_status']) if (!['PASS', 'FAIL', 'NOT_RUN', 'UNKNOWN', 'NOT_APPLICABLE'].includes(seal[key])) fail(errors, `invalid ${key}`);
  if (!Array.isArray(seal.invalidation_conditions) || seal.invalidation_conditions.length === 0 || seal.invalidation_conditions.some(value => typeof value !== 'string')) fail(errors, 'invalidation_conditions must be a non-empty string array');
  const requiresReadyEvidence = seal.control_handoff_confidence === 'HIGH' || ['READY', 'READY_WITH_RESTRICTIONS', 'COMPLETED'].includes(seal.switch_status);
  if (requiresReadyEvidence && !['central_work_items', 'current_view', 'status_index'].every(key => seal.sources?.[key])) fail(errors, 'control handoff requires all canonical sources');
  if (requiresReadyEvidence && r?.observed_at !== seal.fact_cutoff) fail(errors, 'remote observed_at must match fact_cutoff');
  if (seal.control_handoff_confidence === 'HIGH' && (r?.status !== 'PASS' || seal.source_digest_status !== 'PASS')) fail(errors, 'HIGH control handoff requires remote PASS and source digest PASS');
  if (['READY', 'READY_WITH_RESTRICTIONS', 'COMPLETED'].includes(seal.switch_status) && (r?.status !== 'PASS' || seal.source_digest_status !== 'PASS')) fail(errors, 'READY status requires remote PASS and source digest PASS');
  // READY describes candidate material readiness, not a transfer of authority.
  if (seal.switch_status === 'COMPLETED' && !['STOPPED_DISPATCH', 'ARCHIVED'].includes(seal.old_writer_status)) fail(errors, 'COMPLETED requires old writer stopped or archived');
  if (seal.switch_status === 'COMPLETED' && seal.control_handoff_confidence !== 'HIGH') fail(errors, 'COMPLETED requires control_handoff_confidence HIGH');
  if (seal.schema_version >= 2 && seal.switch_status === 'COMPLETED') {
    if (!['PASS', 'PASS_WITH_RESTRICTIONS'].includes(seal.candidate_verification_status)) fail(errors, 'COMPLETED requires candidate verification');
    if (!['CURRENT_MIGRATION', 'CURRENT_ATTESTATION'].includes(seal.handoff_phase) && (!exactKeys(seal.transition, ['intent_digest', 'previous_seal_digest', 'prepared_at']) || !HEX.test(seal.transition?.intent_digest || '') || !HEX.test(seal.transition?.previous_seal_digest || '') || !iso(seal.transition?.prepared_at))) fail(errors, 'COMPLETED requires a valid transition intent');
  }
  if (!HEX.test(seal.seal_digest || '')) fail(errors, 'invalid seal_digest');
  if (checkDigest && seal.seal_digest !== sealDigest(seal)) fail(errors, 'seal_digest mismatch');
  return errors;
}

function sealFiles(dir) {
  return fs.readdirSync(dir).filter(name => /^handoff-state\.\d+\.[0-9a-f]{64}\.json$/.test(name)).sort((a, b) => Number(a.split('.')[1]) - Number(b.split('.')[1]));
}
export function readChain(dir, { ignoreOwnLock = false } = {}) {
  const errors = [];
  if (!fs.existsSync(dir)) return { records: [], errors: ['seal directory missing'] };
  const leftovers = fs.readdirSync(dir).filter(name => (name === '.handoff.lock' && !ignoreOwnLock) || name.includes('.tmp') || (!/^handoff-state\.\d+\.[0-9a-f]{64}\.json$/.test(name) && !/^handoff-transition\.\d+\.[0-9a-f]{64}\.json$/.test(name) && name !== '.handoff.lock'));
  leftovers.forEach(name => fail(errors, `recovery artifact present: ${name}`));
  const records = [];
  for (const file of sealFiles(dir)) {
    try {
      const seal = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
      const match = /^handoff-state\.(\d+)\.([0-9a-f]{64})\.json$/.exec(file);
      if (match && (Number(match[1]) !== seal.seal_sequence || match[2] !== seal.seal_digest)) fail(errors, `${file}: filename does not match seal fields`);
      const itemErrors = validateSeal(seal); itemErrors.forEach(e => fail(errors, `${file}: ${e}`)); records.push(seal);
    }
    catch (error) { fail(errors, `${file}: ${error.message}`); }
  }
  const transitionPredecessors = new Set();
  const intents = new Map();
  for (const file of fs.readdirSync(dir).filter(name => /^handoff-transition\.\d+\.[0-9a-f]{64}\.json$/.test(name))) {
    try {
      const intent = readTransitionIntent(path.join(dir, file));
      if (transitionPredecessors.has(intent.previous_seal_digest)) fail(errors, `duplicate transition intent for ${intent.previous_seal_digest}`);
      transitionPredecessors.add(intent.previous_seal_digest);
      intents.set(intent.transition_digest, intent);
    } catch (error) { fail(errors, `${file}: ${error.message}`); }
  }
  const seen = new Set();
  const seenEventIds = new Set();
  let hasLegacyRecords = false;
  let seenStrictV3 = false;
  records.sort((a, b) => a.seal_sequence - b.seal_sequence);
  records.forEach((seal, index) => {
    if (seal.schema_version < 3) hasLegacyRecords = true;
    if (seal.schema_version < 3 && seenStrictV3) fail(errors, `legacy schema record appears after v3 at sequence ${seal.seal_sequence}`);
    if (seal.schema_version === 3) seenStrictV3 = true;
    if (seen.has(seal.seal_sequence)) fail(errors, `duplicate seal_sequence: ${seal.seal_sequence}`); seen.add(seal.seal_sequence);
    const previous = records[index - 1];
    if (!previous && seal.seal_sequence !== 1) fail(errors, 'first seal must have sequence 1');
    if (!previous && seal.previous_seal_digest !== null) fail(errors, 'first seal must have null previous_seal_digest');
    if (previous && (seal.seal_sequence !== previous.seal_sequence + 1 || seal.previous_seal_digest !== previous.seal_digest)) fail(errors, `chain break at sequence ${seal.seal_sequence}`);
    if (previous && seal.generation < previous.generation) fail(errors, `generation rollback at sequence ${seal.seal_sequence}`);
    if (previous && seal.generation === previous.generation && seal.writer_id !== previous.writer_id) fail(errors, `writer change without generation transition at sequence ${seal.seal_sequence}`);
    if (previous && seal.generation > previous.generation && (seal.generation !== previous.generation + 1 || seal.writer_id === previous.writer_id || !['STOPPED_DISPATCH', 'ARCHIVED'].includes(seal.old_writer_status))) fail(errors, `unsafe generation transition at sequence ${seal.seal_sequence}`);
    if (seal.schema_version === 3 && seenEventIds.has(seal.event_id)) fail(errors, `duplicate event_id at sequence ${seal.seal_sequence}: ${seal.event_id}`);
    if (seal.schema_version === 3 && previous && Date.parse(seal.fact_cutoff) < Date.parse(previous.fact_cutoff)) fail(errors, `fact_cutoff rollback at sequence ${seal.seal_sequence}`);
    if (seal.schema_version === 3 && previous && Date.parse(seal.sealed_at) < Date.parse(previous.sealed_at)) fail(errors, `sealed_at rollback at sequence ${seal.seal_sequence}`);
    if (seal.handoff_phase === 'CURRENT_ATTESTATION' && (!previous || seal.generation !== previous.generation || seal.writer_id !== previous.writer_id || seal.transition !== null || seal.migration !== null)) fail(errors, `invalid current attestation at sequence ${seal.seal_sequence}`);
    if (seal.schema_version === 3 && seal.handoff_phase === 'CURRENT_ATTESTATION' && previous) {
      const names = new Set([...Object.keys(previous.sources ?? {}), ...Object.keys(seal.sources ?? {})]);
      if (![...names].some(name => previous.sources?.[name]?.digest !== seal.sources?.[name]?.digest)) fail(errors, `current attestation has no source change at sequence ${seal.seal_sequence}`);
    }
    if (seal.transition !== null && seal.transition !== undefined) {
      const intent = intents.get(seal.transition.intent_digest);
      if (!intent) fail(errors, `missing transition intent at sequence ${seal.seal_sequence}`);
      else if (!previous || intent.previous_seal_digest !== previous.seal_digest || intent.previous_sequence !== previous.seal_sequence || intent.previous_generation !== previous.generation || intent.previous_writer_id !== previous.writer_id || intent.next_generation !== seal.generation || intent.next_writer_id !== seal.writer_id || intent.event_id !== seal.event_id || seal.transition.previous_seal_digest !== intent.previous_seal_digest || seal.transition.prepared_at !== intent.prepared_at) fail(errors, `transition intent mismatch at sequence ${seal.seal_sequence}`);
      if (seal.schema_version === 3 && previous && Date.parse(seal.transition.prepared_at) < Date.parse(previous.sealed_at)) fail(errors, `transition prepared_at precedes predecessor seal at sequence ${seal.seal_sequence}`);
      if (seal.schema_version === 3 && Date.parse(seal.transition.prepared_at) > Date.parse(seal.sealed_at)) fail(errors, `transition prepared_at follows takeover seal at sequence ${seal.seal_sequence}`);
    }
    seenEventIds.add(seal.event_id);
  });
  const consumed = new Map();
  for (const seal of records) if (seal.transition?.intent_digest) consumed.set(seal.transition.intent_digest, (consumed.get(seal.transition.intent_digest) ?? 0) + 1);
  for (const [intentDigest, count] of consumed) if (count > 1) fail(errors, `transition intent consumed more than once: ${intentDigest}`);
  const pendingIntents = [...intents.values()].filter(intent => !consumed.has(intent.transition_digest));
  const latest = records.at(-1);
  for (const intent of pendingIntents) if (!latest || intent.previous_seal_digest !== latest.seal_digest || intent.previous_sequence !== latest.seal_sequence || intent.previous_generation !== latest.generation || intent.previous_writer_id !== latest.writer_id) fail(errors, `stale unconsumed transition intent: ${intent.transition_digest}`);
  return { records, intents: [...intents.values()], pending_intents: pendingIntents, historical_assurance: hasLegacyRecords ? 'LEGACY_UNVERIFIED' : 'STRICT_V3', errors };
}

export function verifyChain(dir, options = {}) {
  const result = readChain(dir, options);
  const latest = result.records.at(-1) ?? null;
  if (!latest) result.errors.push('no immutable seal record');
  const requiresLiveSources = options.verifyLatestSources !== false && latest && latest.source_digest_status === 'PASS' && latest.sources;
  if (requiresLiveSources) verifySourceFiles(latest, options.sourceRoot, options.externalControlPlaneRoot).forEach(error => result.errors.push(error));
  if (latest && latest.switch_status === 'COMPLETED' && latest.control_handoff_confidence !== 'HIGH') result.errors.push('COMPLETED requires control_handoff_confidence HIGH');
  if (latest && latest.control_handoff_confidence === 'HIGH' && latest.remote.status === 'UNKNOWN') result.errors.push('HIGH control handoff cannot hide unknown remote baseline');
  const latestSourceStatus = requiresLiveSources ? (result.errors.some(error => error.startsWith('source verification failed:')) ? 'FAIL' : 'PASS') : 'NOT_CHECKED';
  const controlStatus = result.errors.length || latest?.switch_status === 'BLOCKED' || latestSourceStatus !== 'PASS' ? 'BLOCKED' : 'READY';
  const handoffReady = controlStatus === 'READY' && latest && ['READY', 'READY_WITH_RESTRICTIONS', 'COMPLETED'].includes(latest.switch_status);
  return { ...result, latest, latest_source_status: latestSourceStatus, control_status: controlStatus, handoff_ready: Boolean(handoffReady), transition_status: result.pending_intents?.length ? 'PENDING' : 'SETTLED', status: result.errors.length ? 'BLOCKED' : 'PASS' };
}

function validateTransitionIntent(intent) {
  const errors = [];
  if (!exactKeys(intent, ['record_type', 'previous_seal_digest', 'previous_sequence', 'previous_generation', 'previous_writer_id', 'next_generation', 'next_writer_id', 'event_id', 'prepared_at', 'previous_source_status', 'transition_digest'])) return ['invalid transition intent fields'];
  if (intent.record_type !== 'handoff-transition-intent') fail(errors, 'invalid transition record_type');
  if (!HEX.test(intent.previous_seal_digest || '') || !Number.isInteger(intent.previous_sequence) || intent.previous_sequence < 1) fail(errors, 'invalid transition predecessor');
  if (!Number.isInteger(intent.previous_generation) || !Number.isInteger(intent.next_generation) || intent.previous_generation < 1 || intent.next_generation < 1) fail(errors, 'invalid transition generation');
  if (!/^[A-Za-z0-9._-]+$/.test(intent.previous_writer_id || '') || !/^[A-Za-z0-9._-]+$/.test(intent.next_writer_id || '')) fail(errors, 'invalid transition writer');
  if (!/^[A-Za-z0-9._:-]+$/.test(intent.event_id || '') || !iso(intent.prepared_at) || intent.previous_source_status !== 'PASS') fail(errors, 'invalid transition evidence');
  if (!HEX.test(intent.transition_digest || '') || intent.transition_digest !== transitionDigest(intent)) fail(errors, 'transition digest mismatch');
  return errors;
}

function readTransitionIntent(ticketPath) {
  const intent = JSON.parse(fs.readFileSync(ticketPath, 'utf8'));
  const errors = validateTransitionIntent(intent);
  if (errors.length) throw new Error(errors.join('; '));
  const filename = path.basename(ticketPath);
  const match = /^handoff-transition\.(\d+)\.([0-9a-f]{64})\.json$/.exec(filename);
  if (!match || Number(match[1]) !== intent.previous_sequence || match[2] !== intent.transition_digest) throw new Error('transition filename does not match intent');
  return intent;
}

export function prepareTransition(dir, { sourceRoot, externalControlPlaneRoot, expectedPreviousDigest, nextGeneration, nextWriterId, eventId, preparedAt = new Date().toISOString() } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const lock = path.join(dir, '.handoff.lock');
  const fd = fs.openSync(lock, 'wx');
  try {
    const current = verifyChain(dir, { ignoreOwnLock: true, sourceRoot, externalControlPlaneRoot });
    if (current.status !== 'PASS') throw new Error(`current seal is not live-valid: ${current.errors.join('; ')}`);
    const previous = current.latest;
    if (expectedPreviousDigest !== undefined && expectedPreviousDigest !== previous.seal_digest) throw new Error('expected previous digest mismatch');
    const generationTransition = nextGeneration === previous.generation + 1 && nextWriterId !== previous.writer_id;
    if (!generationTransition) throw new Error('transition intent requires the next generation and a different writer');
    if (current.pending_intents.length) throw new Error('an unconsumed transition intent already exists');
    if (current.records.some(record => record.event_id === eventId) || current.intents.some(intent => intent.event_id === eventId)) throw new Error('event_id already exists in the handoff chain');
    if (Date.parse(preparedAt) < Date.parse(previous.sealed_at)) throw new Error('transition prepared_at precedes predecessor seal');
    const intent = {
      record_type: 'handoff-transition-intent', previous_seal_digest: previous.seal_digest, previous_sequence: previous.seal_sequence,
      previous_generation: previous.generation, previous_writer_id: previous.writer_id, next_generation: nextGeneration,
      next_writer_id: nextWriterId, event_id: eventId, prepared_at: preparedAt, previous_source_status: 'PASS', transition_digest: ''
    };
    intent.transition_digest = transitionDigest(intent);
    const intentErrors = validateTransitionIntent(intent);
    if (intentErrors.length) throw new Error(`transition intent invalid: ${intentErrors.join('; ')}`);
    const finalPath = path.join(dir, `handoff-transition.${intent.previous_sequence}.${intent.transition_digest}.json`);
    const tempPath = `${finalPath}.${process.pid}.tmp`;
    const out = fs.openSync(tempPath, 'wx');
    try { fs.writeFileSync(out, `${JSON.stringify(intent, null, 2)}\n`, 'utf8'); fs.fsyncSync(out); } finally { fs.closeSync(out); }
    fs.renameSync(tempPath, finalPath);
    return { intent, path: finalPath };
  } finally { fs.closeSync(fd); fs.unlinkSync(lock); }
}

export function appendSeal(dir, draft, { expectedPreviousDigest, sourceRoot, externalControlPlaneRoot, transitionTicket } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const lock = path.join(dir, '.handoff.lock');
  const fd = fs.openSync(lock, 'wx');
  try {
    const current = verifyChain(dir, { ignoreOwnLock: true, sourceRoot, externalControlPlaneRoot, verifyLatestSources: false });
    const emptyChainErrors = current.records.length === 0 && current.errors.every(error => error === 'no immutable seal record');
    if (current.errors.length && !emptyChainErrors) throw new Error(`existing chain invalid: ${current.errors.join('; ')}`);
    const previous = current.latest;
    const actualPreviousDigest = previous?.seal_digest ?? null;
    if (expectedPreviousDigest !== undefined && expectedPreviousDigest !== actualPreviousDigest) throw new Error('expected previous digest mismatch');
    if (current.pending_intents.length && !transitionTicket) throw new Error('an unconsumed transition intent must be consumed or explicitly recovered before appending');
    const seal = structuredClone(draft);
    if (seal.schema_version !== 3) throw new Error('new seal writes require schema_version 3; schema 1/2 records are read-only legacy history');
    if (previous && seal.generation < previous.generation) throw new Error('generation rollback');
    if (previous && seal.generation === previous.generation && seal.writer_id !== previous.writer_id) throw new Error('writer change without generation transition');
    if (previous && seal.generation > previous.generation && (seal.generation !== previous.generation + 1 || seal.writer_id === previous.writer_id || !['STOPPED_DISPATCH', 'ARCHIVED'].includes(seal.old_writer_status))) throw new Error('unsafe generation transition');
    const previousSourceErrors = previous ? verifySourceFiles(previous, sourceRoot, externalControlPlaneRoot) : [];
    let intent = null;
    if (transitionTicket) {
      const resolvedTicket = fs.realpathSync(path.resolve(transitionTicket));
      const resolvedDir = fs.realpathSync(path.resolve(dir));
      if (path.dirname(resolvedTicket) !== resolvedDir) throw new Error('transition ticket must be stored in the seal directory');
      intent = readTransitionIntent(transitionTicket);
      if (!previous || intent.previous_seal_digest !== previous.seal_digest || intent.previous_sequence !== previous.seal_sequence || intent.previous_generation !== previous.generation || intent.previous_writer_id !== previous.writer_id || intent.next_generation !== seal.generation || intent.next_writer_id !== seal.writer_id || intent.event_id !== seal.event_id) throw new Error('transition intent does not match append');
      seal.transition = { intent_digest: intent.transition_digest, previous_seal_digest: intent.previous_seal_digest, prepared_at: intent.prepared_at };
    } else if (previousSourceErrors.length && seal.handoff_phase !== 'CURRENT_ATTESTATION') throw new Error(previousSourceErrors.join('; '));
    if (previous && seal.generation > previous.generation && !intent) throw new Error('generation transition requires a pre-update intent');
    if (intent && (!previous || seal.generation === previous.generation)) throw new Error('transition intent may only be consumed by a generation transition');
    if (previous && seal.generation > previous.generation && seal.switch_status !== 'COMPLETED') throw new Error('generation transition requires a completed seal');
    if (seal.handoff_phase === 'CURRENT_ATTESTATION' && (!previous || seal.generation !== previous.generation || seal.writer_id !== previous.writer_id || transitionTicket)) throw new Error('current attestation requires an existing seal with the same generation and writer');
    seal.seal_sequence = (previous?.seal_sequence ?? 0) + 1;
    seal.previous_seal_digest = previous?.seal_digest ?? null;
    if (current.records.some(record => record.event_id === seal.event_id)) throw new Error('event_id already exists in the handoff chain');
    if (previous && Date.parse(seal.fact_cutoff) < Date.parse(previous.fact_cutoff)) throw new Error('fact_cutoff rollback');
    if (previous && Date.parse(seal.sealed_at) < Date.parse(previous.sealed_at)) throw new Error('sealed_at rollback');
    if (intent && Date.parse(intent.prepared_at) > Date.parse(seal.sealed_at)) throw new Error('transition prepared_at follows takeover seal');
    if (seal.handoff_phase === 'CURRENT_ATTESTATION' && previous) {
      const names = new Set([...Object.keys(previous.sources ?? {}), ...Object.keys(seal.sources ?? {})]);
      if (![...names].some(name => previous.sources?.[name]?.digest !== seal.sources?.[name]?.digest)) throw new Error('current attestation requires at least one changed source digest');
    }
    seal.seal_digest = sealDigest(seal);
    const errors = validateSeal(seal);
    if (errors.length) throw new Error(`draft invalid: ${errors.join('; ')}`);
    if (seal.control_handoff_confidence === 'HIGH' || ['READY', 'READY_WITH_RESTRICTIONS', 'COMPLETED'].includes(seal.switch_status)) {
      const sourceErrors = verifySourceFiles(seal, sourceRoot, externalControlPlaneRoot);
      if (sourceErrors.length) throw new Error(sourceErrors.join('; '));
    }
    const finalName = `handoff-state.${seal.seal_sequence}.${seal.seal_digest}.json`;
    const tempName = `${finalName}.${process.pid}.tmp`;
    const tempPath = path.join(dir, tempName);
    const finalPath = path.join(dir, finalName);
    const out = fs.openSync(tempPath, 'wx');
    try { fs.writeFileSync(out, `${JSON.stringify(seal, null, 2)}\n`, 'utf8'); fs.fsyncSync(out); } finally { fs.closeSync(out); }
    fs.renameSync(tempPath, finalPath);
    return seal;
  } finally { fs.closeSync(fd); fs.unlinkSync(lock); }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [command, target, sourceRoot, ...rest] = process.argv.slice(2);
  if (command === 'verify' && target) { const historicalOnly = rest.includes('--history-only'); const externalControlPlaneRoot = rest.find(value => value.startsWith('--external-control-plane-root='))?.slice('--external-control-plane-root='.length); const result = verifyChain(path.resolve(target), { sourceRoot, externalControlPlaneRoot, verifyLatestSources: !historicalOnly }); console.log(JSON.stringify(result, null, 2)); process.exitCode = result.status === 'PASS' ? 0 : 1; }
  else if (command === 'prepare' && target && sourceRoot && rest.length >= 3) { const [nextGeneration, nextWriterId, eventId] = rest; const externalControlPlaneRoot = rest.find(value => value.startsWith('--external-control-plane-root='))?.slice('--external-control-plane-root='.length); const result = prepareTransition(path.resolve(target), { sourceRoot, externalControlPlaneRoot, nextGeneration: Number(nextGeneration), nextWriterId, eventId }); console.log(JSON.stringify(result, null, 2)); }
  else if (command === 'append' && target && sourceRoot && rest.length >= 1) { const [draftPath, transitionTicket] = rest; const externalControlPlaneRoot = rest.find(value => value.startsWith('--external-control-plane-root='))?.slice('--external-control-plane-root='.length); const draft = JSON.parse(fs.readFileSync(draftPath, 'utf8')); const result = appendSeal(path.resolve(target), draft, { sourceRoot, externalControlPlaneRoot, transitionTicket }); console.log(JSON.stringify(result, null, 2)); }
  else { console.error('usage: node HandoffSeal.mjs verify <seal-directory> [source-root] [--history-only] | prepare <seal-directory> <source-root> <next-generation> <next-writer-id> <event-id> | append <seal-directory> <source-root> <draft-json> [transition-ticket]'); process.exitCode = 2; }
}
