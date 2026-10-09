// A shared cooperative lock and recoverable journal, anchored to the canonical index.
// This is not an OS access-control boundary or authentication service.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

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
export function assertControlReady(seal, options) {
  const paths = controlPaths(seal, options);
  if (fs.existsSync(paths.lock) && !held.has(paths.index)) throw new Error('CONTROL_LOCKED: authoritative control plane is being written');
  if (fs.existsSync(paths.journal) && !transactions.has(paths.index)) {
    const journal = JSON.parse(fs.readFileSync(paths.journal, 'utf8'));
    if (journal.protocol_version !== 1 || journal.status !== 'COMPLETED') throw new Error('TAKEOVER_INCOMPLETE: recover the canonical control-plane transaction before using ACTIVE');
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
