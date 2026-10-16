import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export function normalizeProjectPath(value) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('INPUT_REQUIRED: project path required');
  let candidate = value.replaceAll('\\', '/');
  if (candidate.startsWith('//?/UNC/')) candidate = '//' + candidate.slice(8);
  else if (candidate.startsWith('//?/')) candidate = candidate.slice(4);
  if (/^[A-Za-z]:\//.test(candidate) || candidate.startsWith('//')) {
    return path.win32.normalize(candidate).replaceAll('\\', '/').replace(/\/$/, '').toLowerCase();
  }
  if (!candidate.startsWith('/')) throw new Error('INPUT_REQUIRED: absolute project path required');
  return path.posix.normalize(candidate).replace(/\/$/, '') || '/';
}

// Local metadata provides candidates only. Verify each candidate through the host API.
export function findCodexThreads({ databasePath, projectRoot, name, python = 'python' }) {
  if (typeof name !== 'string' || !name.trim() || name !== name.trim()) throw new Error('INPUT_REQUIRED: exact display name required');
  const project = normalizeProjectPath(projectRoot);
  if (!fs.statSync(databasePath).isFile()) throw new Error('INPUT_REQUIRED: metadata database required');
  const helper = fileURLToPath(new URL('./Find-CodexThread.py', import.meta.url));
  const run = spawnSync(python, [helper], { input: JSON.stringify({ databasePath, projectRoot: project, name }), encoding: 'utf8', timeout: 10000, windowsHide: true });
  if (run.error) throw new Error(`INPUT_REQUIRED: Python metadata reader unavailable: ${run.error.code}`);
  let result;
  try { result = JSON.parse(run.stdout); }
  catch { throw new Error('INPUT_REQUIRED: metadata reader returned no valid result'); }
  if (run.status !== 0) throw new Error(`INPUT_REQUIRED: ${result.error || 'metadata checkpoint unavailable'}`);
  const rows = result.rows;
  if (rows.some(row => row.archived !== 0 && row.archived !== 1)) throw new Error('INPUT_REQUIRED: unknown archive state');
  const matches = rows.filter(row => row.archived === 0).map(row => ({ ...row, archived: false }));
  return { status: matches.length === 1 ? 'CANDIDATE' : matches.length ? 'AMBIGUOUS' : 'NOT_FOUND', matches,
    source: 'LOCAL_CHECKPOINT_READ_ONLY', freshness: 'UNATTESTED', wal_not_read: result.wal_not_read, platform_readback_required: true };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2), options = {};
    for (let i = 0; i < args.length; i += 2) {
      if (!['--project-root', '--name', '--state-db'].includes(args[i]) || !args[i + 1] || options[args[i]]) throw new Error('Usage: node Find-CodexThread.mjs --project-root PATH --name NAME [--state-db PATH]');
      options[args[i]] = args[i + 1];
    }
    const databasePath = options['--state-db'] || path.join(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'state_5.sqlite');
    console.log(JSON.stringify(findCodexThreads({ databasePath, projectRoot: options['--project-root'], name: options['--name'] }), null, 2));
  } catch (error) { console.error(JSON.stringify({ status: 'INPUT_REQUIRED', message: error.message })); process.exitCode = 1; }
}
