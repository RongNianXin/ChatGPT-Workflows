// A shared cooperative lock and recoverable journal, anchored to the canonical index.
// This is not an OS access-control boundary or authentication service.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const held = new Set();
const transactions = new Set();
export const byteDigest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
export function resolveSource(source, { sourceRoot, externalControlPlaneRoot } = {}) {
  const root = source?.root_ref === 'external_control_plane' ? externalControlPlaneRoot : sourceRoot;
  if (!root) throw new Error('INPUT_REQUIRED: missing source root or external control-plane root');
  if (!source?.path_ref || path.isAbsolute(source.path_ref) || path.win32.isAbsolute(source.path_ref) || source.path_ref.split(/[\\/]/).includes('..')) throw new Error('unsafe control source path');
  const realRoot = fs.realpathSync(root), file = fs.realpathSync(path.resolve(realRoot, source.path_ref));
  const relative = path.relative(realRoot, file);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error('control source escapes root');
  return file;
}
export function controlPaths(seal, options) {
  if (!seal?.sources?.status_index) throw new Error('INPUT_REQUIRED: canonical status_index source required');
  const index = resolveSource(seal.sources.status_index, options);
  return { index, lock: `${index}.handoff-control.lock`, journal: `${index}.handoff-transaction.json` };
}
export function assertControlReady(seal, options, authorityAnchor = seal?.schema_version === 5 ? seal : null) {
  const paths = controlPaths(seal, options);
  if (fs.existsSync(paths.lock) && !held.has(paths.index)) throw new Error('CONTROL_LOCKED: authoritative control plane is being written');
  if (!transactions.has(paths.index) && authorityAnchor && !fs.existsSync(paths.journal)) throw new Error('TAKEOVER_INCOMPLETE: authority completion journal missing; explicitly recover the immutable event');
  if (fs.existsSync(paths.journal) && !transactions.has(paths.index)) {
    const journal = JSON.parse(fs.readFileSync(paths.journal, 'utf8'));
    if (authorityAnchor && (journal.protocol_version !== 2 || journal.record_type !== 'handoff-authority-recovery-transaction')) throw new Error('TAKEOVER_INCOMPLETE: authority completion journal replaced');
    if (journal.protocol_version === 2 && journal.record_type === 'handoff-authority-recovery-transaction' && journal.status === 'COMPLETED') verifyAuthorityJournalCompletion(journal, seal, options, authorityAnchor);
    else if (journal.protocol_version !== 1 || journal.status !== 'COMPLETED') throw new Error('TAKEOVER_INCOMPLETE: recover the canonical control-plane transaction before using ACTIVE');
  }
}
export function verifyAuthorityJournalCompletion(journal, anchor, options, authorityAnchor = anchor?.schema_version === 5 ? anchor : null) {
  const sorted = value => Array.isArray(value) ? value.map(sorted) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, sorted(value[key])])) : value;
  const hash = (value, field) => byteDigest(Buffer.from(JSON.stringify(sorted(Object.fromEntries(Object.entries(value).filter(([key]) => key !== field))))));
  try {
    const intent = JSON.parse(fs.readFileSync(resolveSource(journal.intent_source, options), 'utf8'));
    const completed = JSON.parse(fs.readFileSync(resolveSource(journal.completion_source, options), 'utf8'));
    const tx = intent.transaction;
    if (completed.generation !== anchor.generation || completed.writer_id !== anchor.writer_id || (authorityAnchor && completed.seal_digest !== authorityAnchor.seal_digest)) throw new Error('completion does not certify the current authority');
    if (intent.record_type !== 'handoff-authority-recovery-intent' || hash(intent, 'recovery_digest') !== intent.recovery_digest || intent.recovery_digest !== journal.intent_digest || completed.schema_version !== 5 || completed.handoff_phase !== 'AUTHORITY_RECOVERY_COMPLETED' || completed.switch_status !== 'COMPLETED' || hash(completed, 'seal_digest') !== completed.seal_digest || completed.authority_recovery?.intent_digest !== intent.recovery_digest || completed.previous_seal_digest !== intent.previous_seal_digest || completed.seal_sequence !== intent.previous_sequence + 1 || completed.event_id !== journal.event_id || intent.event_id !== journal.event_id || completed.generation !== tx.observation.generation + 1 || tx.observation.generation !== intent.previous_generation + 1 || completed.writer_id !== tx.recipient.writerId || path.basename(journal.completion_source.path_ref) !== `handoff-state.${completed.seal_sequence}.${completed.seal_digest}.json` || path.basename(journal.intent_source.path_ref) !== `handoff-authority-recovery.${intent.previous_sequence}.${intent.recovery_digest}.json` || resolveSource(completed.sources.status_index, options) !== resolveSource(anchor.sources.status_index, options)) throw new Error('completion evidence mismatch');
  } catch (error) { throw new Error(`TAKEOVER_INCOMPLETE: authority completion evidence is not valid: ${error.message}`); }
}
// Read-only; stop recommendations and commits share this storage gate.
export function assertPrivateControlStorage(seal, options) {
  const root = fs.realpathSync(options.sourceRoot), paths = controlPaths(seal, options);
  for (const file of [paths.index, paths.lock, paths.journal, `${paths.index}.${process.pid}.tmp`, `${paths.journal}.${process.pid}.tmp`]) {
    const relative = path.relative(root, file);
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) continue;
    const ignored = spawnSync('git', ['-C', root, 'check-ignore', '--quiet', '--', relative], { encoding: 'utf8' });
    const tracked = spawnSync('git', ['-C', root, 'ls-files', '--', relative], { encoding: 'utf8' });
    if (ignored.status !== 0 || tracked.status !== 0 || tracked.stdout.trim()) throw new Error('INPUT_REQUIRED: CONTROL_STORAGE: canonical control index, lock and journal must be ignored and untracked inside the code root; preserve originals and prepare an authorized private-layout candidate before takeover');
  }
}
export function withControlLock(seal, options, run) {
  const paths = controlPaths(seal, options);
  // Reentrancy is private process state; callers cannot supply a skip-lock flag.
  if (held.has(paths.index)) return run(paths);
  const fd = fs.openSync(paths.lock, 'wx');
  fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, created_at: new Date().toISOString() }));
  held.add(paths.index);
  try {
    const value = run(paths);
    if (value?.then) throw new Error('control lock callbacks must be synchronous');
    return value;
  } finally { held.delete(paths.index); fs.closeSync(fd); fs.unlinkSync(paths.lock); }
}
export function withControlTransaction(seal, options, run) {
  return withControlLock(seal, options, paths => {
    if (transactions.has(paths.index)) throw new Error('nested control transaction');
    transactions.add(paths.index);
    try { return run(paths); } finally { transactions.delete(paths.index); }
  });
}
export function writeAtomic(file, bytes) {
  const tmp = `${file}.${process.pid}.tmp`;
  const fd = fs.openSync(tmp, 'wx');
  try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  try { fs.renameSync(tmp, file); } catch (error) { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); throw error; }
}
export function writeJournal(file, journal) { writeAtomic(file, `${JSON.stringify(journal, null, 2)}\n`); }
