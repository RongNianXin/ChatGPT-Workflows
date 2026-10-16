import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { findCodexThreads, normalizeProjectPath } from './Find-CodexThread.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.codex-manual-cache/thread-locator-tests');
fs.mkdirSync(root, { recursive: true });
const directory = fs.mkdtempSync(path.join(root, 'case-'));
const databasePath = path.join(directory, 'state # &.sqlite');
const db = new DatabaseSync(databasePath);
db.exec('CREATE TABLE threads(id TEXT, name TEXT, title TEXT, cwd TEXT, archived INTEGER)');
const insert = db.prepare('INSERT INTO threads VALUES(?,?,?,?,?)');
insert.run('one', 'Paper specialist', 'Long initial prompt\nDo not use as name', '\\\\?\\C:\\<PROJECT_ROOT>\\project', 0);
insert.run('archived', 'Paper specialist', 'Archived', 'C:\\<PROJECT_ROOT>\\project', 1);
insert.run('other', 'Paper specialist', 'Other', 'C:\\<PROJECT_ROOT>\\other', 0);
insert.run('legacy', null, 'Legacy name', 'C:\\<PROJECT_ROOT>\\project', 0);
insert.run('rename', 'New name', 'Old name', 'C:\\<PROJECT_ROOT>\\project', 0);
insert.run('unicode', '\u4e13\u9879\u4efb\u52a1A', 'Prompt', 'C:\\<PROJECT_ROOT>\\project', 0);
db.close();
const hashes = () => Object.fromEntries(fs.readdirSync(directory).map(name => [name, crypto.createHash('sha256').update(fs.readFileSync(path.join(directory, name))).digest('hex')]));
try {
  const before = hashes();
  const lookup = name => findCodexThreads({ databasePath, projectRoot: 'c:/<PROJECT_ROOT>/project/', name });
  assert.equal(lookup('Paper specialist').matches[0].id, 'one');
  assert.equal(lookup('Paper specialist').status, 'CANDIDATE');
  assert.equal(lookup('Legacy name').matches[0].id, 'legacy');
  assert.equal(lookup('Old name').status, 'NOT_FOUND');
  assert.equal(lookup('Missing').status, 'NOT_FOUND');
  assert.equal(lookup('\u4e13\u9879\u4efb\u52a1A').matches[0].id, 'unicode');
  assert.deepEqual(hashes(), before);
  assert.equal(normalizeProjectPath('\\\\?\\UNC\\server\\share\\project'), normalizeProjectPath('\\\\server\\share\\project'));
  assert.throws(() => normalizeProjectPath('relative/project'));
  const update = new DatabaseSync(databasePath);
  update.prepare('INSERT INTO threads VALUES(?,?,?,?,?)').run('duplicate', 'Paper specialist', 'Short', 'C:/<PROJECT_ROOT>/project', 0);
  update.close();
  assert.equal(lookup('Paper specialist').status, 'AMBIGUOUS');
  const invalid = new DatabaseSync(databasePath);
  invalid.prepare('UPDATE threads SET archived=NULL WHERE id=?').run('duplicate');
  invalid.close();
  assert.throws(() => lookup('Paper specialist'), /unknown archive state/);
  const wal = new DatabaseSync(databasePath);
  try {
    wal.prepare('DELETE FROM threads WHERE id=?').run('duplicate');
    wal.exec('PRAGMA journal_mode=WAL; PRAGMA wal_checkpoint(TRUNCATE)');
    wal.prepare('UPDATE threads SET name=? WHERE id=?').run('New WAL name', 'one');
    const walBefore = hashes();
    const stale = lookup('Paper specialist');
    assert.equal(stale.status, 'CANDIDATE');
    assert.equal(stale.freshness, 'UNATTESTED');
    assert.equal(stale.wal_not_read, true);
    assert.equal(lookup('New WAL name').status, 'NOT_FOUND');
    assert.deepEqual(hashes(), walBefore);
  } finally { wal.close(); }
  console.log('Thread locator: PASS (16 assertions; readonly checkpoint candidates, not host identity attestation)');
} finally { fs.rmSync(directory, { recursive: true, force: true }); }
