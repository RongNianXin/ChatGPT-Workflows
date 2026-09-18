// Immutable handoff-seal chain helper. It does not stop processes that bypass it.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HEX = /^[0-9a-f]{64}$/;
const TOP_LEVEL_KEYS = new Set(['schema_version', 'record_type', 'generation', 'writer_id', 'old_writer_status', 'seal_sequence', 'previous_seal_digest', 'fact_cutoff', 'sealed_at', 'event_id', 'sources', 'source_digest_status', 'objective', 'prohibitions', 'communications', 'workspace', 'remote', 'control_handoff_confidence', 'switch_status', 'runtime_acceptance_status', 'professional_acceptance_status', 'invalidation_conditions', 'seal_digest']);
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

const fail = (errors, message) => errors.push(message);
function verifySourceFiles(seal, sourceRoot) {
  if (!sourceRoot) return ['HIGH control handoff requires sourceRoot verification'];
  let root;
  try { root = fs.realpathSync(path.resolve(sourceRoot)); } catch (error) { return [`source root verification failed: ${error.message}`]; }
  const errors = [];
  for (const [name, source] of Object.entries(seal.sources ?? {})) {
    try {
      const resolved = fs.realpathSync(path.resolve(root, source.path_ref));
      if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) throw new Error('source path escapes root');
      if (digest(fs.readFileSync(resolved)) !== source.digest) throw new Error('source digest mismatch');
    } catch (error) { errors.push(`source verification failed: ${name}: ${error.message}`); }
  }
  return errors;
}
export function validateSeal(seal, { checkDigest = true } = {}) {
  const errors = [];
  if (!seal || typeof seal !== 'object' || Array.isArray(seal)) return ['seal must be an object'];
  for (const key of Object.keys(seal)) if (!TOP_LEVEL_KEYS.has(key)) fail(errors, `unknown top-level field: ${key}`);
  if (seal.schema_version !== 1) fail(errors, 'schema_version must be 1');
  if (seal.record_type !== 'handoff-seal') fail(errors, 'record_type must be handoff-seal');
  if (!Number.isInteger(seal.generation) || seal.generation < 1) fail(errors, 'generation must be a positive integer');
  if (!/^[A-Za-z0-9._-]+$/.test(seal.writer_id || '')) fail(errors, 'writer_id is not a portable logical id');
  if (!['IDLE', 'STOPPED_DISPATCH', 'ARCHIVED', 'UNKNOWN'].includes(seal.old_writer_status)) fail(errors, 'invalid old_writer_status');
  if (!Number.isInteger(seal.seal_sequence) || seal.seal_sequence < 1) fail(errors, 'seal_sequence must be positive');
  if (seal.previous_seal_digest !== null && !HEX.test(seal.previous_seal_digest || '')) fail(errors, 'invalid previous_seal_digest');
  for (const key of ['fact_cutoff', 'sealed_at']) if (!iso(seal[key])) fail(errors, `${key} must be an ISO timestamp`);
  if (!/^[A-Za-z0-9._:-]+$/.test(seal.event_id || '')) fail(errors, 'event_id is not a portable logical id');
  if (!seal.sources || typeof seal.sources !== 'object' || Array.isArray(seal.sources) || !Object.keys(seal.sources).length) fail(errors, 'sources must be non-empty');
  else for (const [name, source] of Object.entries(seal.sources)) {
    if (!exactKeys(source, ['owner', 'path_ref', 'digest', 'fact_cutoff']) || typeof source.owner !== 'string' || !source.owner || !relativeRef(source.path_ref) || !HEX.test(source.digest || '') || !iso(source.fact_cutoff)) fail(errors, `invalid source: ${name}`);
    if (!relativeRef(source.path_ref)) fail(errors, `unsafe source path: ${name}`);
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
  for (const key of ['runtime_acceptance_status', 'professional_acceptance_status']) if (!['PASS', 'FAIL', 'NOT_RUN', 'UNKNOWN', 'NOT_APPLICABLE'].includes(seal[key])) fail(errors, `invalid ${key}`);
  if (!Array.isArray(seal.invalidation_conditions) || seal.invalidation_conditions.length === 0 || seal.invalidation_conditions.some(value => typeof value !== 'string')) fail(errors, 'invalidation_conditions must be a non-empty string array');
  const requiresReadyEvidence = seal.control_handoff_confidence === 'HIGH' || ['READY', 'READY_WITH_RESTRICTIONS', 'COMPLETED'].includes(seal.switch_status);
  if (requiresReadyEvidence && !['central_work_items', 'current_view', 'status_index'].every(key => seal.sources?.[key])) fail(errors, 'control handoff requires all canonical sources');
  if (requiresReadyEvidence && r?.observed_at !== seal.fact_cutoff) fail(errors, 'remote observed_at must match fact_cutoff');
  if (seal.control_handoff_confidence === 'HIGH' && (r?.status !== 'PASS' || seal.source_digest_status !== 'PASS')) fail(errors, 'HIGH control handoff requires remote PASS and source digest PASS');
  if (['READY', 'READY_WITH_RESTRICTIONS', 'COMPLETED'].includes(seal.switch_status) && (r?.status !== 'PASS' || seal.source_digest_status !== 'PASS')) fail(errors, 'READY status requires remote PASS and source digest PASS');
  if (['READY', 'READY_WITH_RESTRICTIONS', 'COMPLETED'].includes(seal.switch_status) && !['STOPPED_DISPATCH', 'ARCHIVED'].includes(seal.old_writer_status)) fail(errors, 'READY status requires old writer stopped or archived');
  if (seal.switch_status === 'COMPLETED' && seal.control_handoff_confidence !== 'HIGH') fail(errors, 'COMPLETED requires control_handoff_confidence HIGH');
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
  const leftovers = fs.readdirSync(dir).filter(name => (name === '.handoff.lock' && !ignoreOwnLock) || name.includes('.tmp') || (!/^handoff-state\.\d+\.[0-9a-f]{64}\.json$/.test(name) && name !== '.handoff.lock'));
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
  const seen = new Set();
  records.sort((a, b) => a.seal_sequence - b.seal_sequence);
  records.forEach((seal, index) => {
    if (seen.has(seal.seal_sequence)) fail(errors, `duplicate seal_sequence: ${seal.seal_sequence}`); seen.add(seal.seal_sequence);
    const previous = records[index - 1];
    if (!previous && seal.seal_sequence !== 1) fail(errors, 'first seal must have sequence 1');
    if (!previous && seal.previous_seal_digest !== null) fail(errors, 'first seal must have null previous_seal_digest');
    if (previous && (seal.seal_sequence !== previous.seal_sequence + 1 || seal.previous_seal_digest !== previous.seal_digest)) fail(errors, `chain break at sequence ${seal.seal_sequence}`);
    if (previous && seal.generation < previous.generation) fail(errors, `generation rollback at sequence ${seal.seal_sequence}`);
    if (previous && seal.generation === previous.generation && seal.writer_id !== previous.writer_id) fail(errors, `writer change without generation transition at sequence ${seal.seal_sequence}`);
    if (previous && seal.generation > previous.generation && (seal.generation !== previous.generation + 1 || seal.writer_id === previous.writer_id || !['STOPPED_DISPATCH', 'ARCHIVED'].includes(seal.old_writer_status))) fail(errors, `unsafe generation transition at sequence ${seal.seal_sequence}`);
  });
  return { records, errors };
}

export function verifyChain(dir, options = {}) {
  const result = readChain(dir, options);
  const latest = result.records.at(-1) ?? null;
  if (!latest) result.errors.push('no immutable seal record');
  if (latest && (latest.control_handoff_confidence === 'HIGH' || ['READY', 'READY_WITH_RESTRICTIONS', 'COMPLETED'].includes(latest.switch_status))) verifySourceFiles(latest, options.sourceRoot).forEach(error => result.errors.push(error));
  if (latest && latest.switch_status === 'COMPLETED' && latest.control_handoff_confidence !== 'HIGH') result.errors.push('COMPLETED requires control_handoff_confidence HIGH');
  if (latest && latest.control_handoff_confidence === 'HIGH' && latest.remote.status === 'UNKNOWN') result.errors.push('HIGH control handoff cannot hide unknown remote baseline');
  return { ...result, latest, status: result.errors.length ? 'BLOCKED' : 'PASS' };
}

export function appendSeal(dir, draft, { expectedPreviousDigest, sourceRoot } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const lock = path.join(dir, '.handoff.lock');
  const fd = fs.openSync(lock, 'wx');
  try {
    const current = verifyChain(dir, { ignoreOwnLock: true, sourceRoot });
    const emptyChainErrors = current.records.length === 0 && current.errors.every(error => error === 'no immutable seal record');
    if (current.errors.length && !emptyChainErrors) throw new Error(`existing chain invalid: ${current.errors.join('; ')}`);
    const previous = current.latest;
    const actualPreviousDigest = previous?.seal_digest ?? null;
    if (expectedPreviousDigest !== undefined && expectedPreviousDigest !== actualPreviousDigest) throw new Error('expected previous digest mismatch');
    const seal = structuredClone(draft);
    if (previous && seal.generation < previous.generation) throw new Error('generation rollback');
    if (previous && seal.generation === previous.generation && seal.writer_id !== previous.writer_id) throw new Error('writer change without generation transition');
    if (previous && seal.generation > previous.generation && (seal.generation !== previous.generation + 1 || seal.writer_id === previous.writer_id || !['STOPPED_DISPATCH', 'ARCHIVED'].includes(seal.old_writer_status))) throw new Error('unsafe generation transition');
    seal.seal_sequence = (previous?.seal_sequence ?? 0) + 1;
    seal.previous_seal_digest = previous?.seal_digest ?? null;
    seal.seal_digest = sealDigest(seal);
    const errors = validateSeal(seal);
    if (errors.length) throw new Error(`draft invalid: ${errors.join('; ')}`);
    if (seal.control_handoff_confidence === 'HIGH' || ['READY', 'READY_WITH_RESTRICTIONS', 'COMPLETED'].includes(seal.switch_status)) {
      const sourceErrors = verifySourceFiles(seal, sourceRoot);
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
  const [command, target, sourceRoot] = process.argv.slice(2);
  if (command === 'verify' && target) { const result = verifyChain(path.resolve(target), { sourceRoot }); console.log(JSON.stringify(result, null, 2)); process.exitCode = result.status === 'PASS' ? 0 : 1; }
  else { console.error('usage: node HandoffSeal.mjs verify <private-seal-directory> [source-root]'); process.exitCode = 2; }
}
