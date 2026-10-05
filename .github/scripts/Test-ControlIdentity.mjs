import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { CONTROL_IDENTITY_SOURCES, verifyControlIdentity } from './HandoffSeal.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'control-identity-'));
const identity = { generation: 2, writer_id: 'COMMANDER-GEN-2', platform_task_id: '00000000-0000-4000-8000-000000000002' };
let count = 0;
const check = (name, run) => { run(); count++; console.log(`PASS: ${name}`); };
const put = (seal, name, text) => {
  const file = path.join(root, seal.sources[name].path_ref);
  fs.writeFileSync(file, text);
  seal.sources[name].digest = crypto.createHash('sha256').update(text).digest('hex');
};
const fixture = () => {
  const seal = { ...identity, sources: {} };
  for (const name of CONTROL_IDENTITY_SOURCES) {
    seal.sources[name] = { path_ref: `${name}.md`, root_ref: 'source_root' };
    const marker = name === 'status_index'
      ? `<!-- CONTROL_IDENTITY: ${JSON.stringify(identity)} -->`
      : `<!-- CONTROL_NAVIGATION: ${JSON.stringify({ status_index: 'status_index.md', root_ref: 'source_root', ...(name === 'workflow_enablement' ? { central_entry: 'central_entry.md', central_entry_root_ref: 'source_root' } : {}) })} -->`;
    put(seal, name, `<!-- CURRENT:BEGIN -->\n${marker}\n${name === 'workflow_enablement' ? '状态：enabled\n' : ''}<!-- CURRENT:END -->\n<!-- HISTORY:BEGIN -->\n唯一中央写者：COMMANDER-GEN-1\n`);
  }
  return seal;
};
const verify = seal => verifyControlIdentity(seal, { sourceRoot: root });
const addCurrent = (seal, name, text) => put(seal, name, fs.readFileSync(path.join(root, seal.sources[name].path_ref), 'utf8').replace('<!-- CURRENT:END -->', `${text}\n<!-- CURRENT:END -->`));
try {
  check('old marker gaps require migration; factual restoration preserves history', () => {
    const s = fixture();
    const originals = new Map(CONTROL_IDENTITY_SOURCES.map(name => [name, fs.readFileSync(path.join(root, s.sources[name].path_ref), 'utf8')]));
    for (const [name, text] of originals) put(s, name, text.replace(/<!-- CONTROL_(?:IDENTITY|NAVIGATION): .*? -->\n/g, ''));
    assert.notEqual(verify(s).status, 'PASS');
    for (const [name, text] of originals) put(s, name, text);
    assert.equal(verify(s).status, 'PASS');
    for (const [name, text] of originals) assert.equal(fs.readFileSync(path.join(root, s.sources[name].path_ref), 'utf8').split('<!-- HISTORY:BEGIN -->')[1], text.split('<!-- HISTORY:BEGIN -->')[1]);
  });
  check('duplicate unknown enablement state fails', () => { const s = fixture(); addCurrent(s, 'workflow_enablement', '状态：paused'); assert.equal(verify(s).status, 'FAIL'); });
  check('canonical mapping and historical identities coexist', () => assert.equal(verify(fixture()).status, 'PASS'));
  check('old seal missing navigation is unverified, not corrupt', () => { const s = fixture(); delete s.sources.central_entry; assert.equal(verify(s).status, 'NOT_CHECKED'); });
  for (const name of ['central_entry', 'workflow_enablement', 'current_view', 'central_work_items', 'status_index']) {
    check(`stale current writer in ${name} fails even when bytes are sealed`, () => { const s = fixture(); addCurrent(s, name, '唯一中央写者：COMMANDER-GEN-1'); assert.equal(verify(s).status, 'FAIL'); });
  }
  check('canonical identity differing from seal fails', () => { const s = fixture(); s.generation = 3; assert.equal(verify(s).status, 'FAIL'); });
  check('task title numbers do not substitute for platform mapping', () => { const s = fixture(); put(s, 'status_index', '<!-- CURRENT:BEGIN -->\n<!-- CONTROL_IDENTITY: {"generation":2,"writer_id":"COMMANDER-GEN-2","platform_task_id":"36"} -->\n<!-- CURRENT:END -->'); assert.equal(verify(s).status, 'FAIL'); });
  check('unexposed platform ID does not invalidate canonical identity', () => { const s = fixture(); put(s, 'status_index', '<!-- CURRENT:BEGIN -->\n<!-- CONTROL_IDENTITY: {"generation":2,"writer_id":"COMMANDER-GEN-2","platform_task_id":"UNKNOWN"} -->\n<!-- CURRENT:END -->'); const r = verify(s); assert.equal(r.status, 'PASS'); assert.equal(r.platform_mapping_status, 'UNKNOWN'); });
  for (const state of ['disabled', 'missing']) check(`enablement ${state} fails`, () => { const s = fixture(); const file = path.join(root, s.sources.workflow_enablement.path_ref); put(s, 'workflow_enablement', fs.readFileSync(file, 'utf8').replace('状态：enabled', state === 'missing' ? '' : '状态：disabled')); assert.equal(verify(s).status, 'FAIL'); });
  check('enablement pointing at the wrong central entry fails', () => { const s = fixture(); const file = path.join(root, s.sources.workflow_enablement.path_ref); put(s, 'workflow_enablement', fs.readFileSync(file, 'utf8').replace('"central_entry":"central_entry.md"', '"central_entry":"other.md"')); assert.equal(verify(s).status, 'FAIL'); });
  check('duplicate authoritative markers fail', () => { const s = fixture(); addCurrent(s, 'status_index', `<!-- CONTROL_IDENTITY: ${JSON.stringify(identity)} -->`); assert.equal(verify(s).status, 'FAIL'); });
  check('interrupted multi-file switch fails', () => { const s = fixture(); addCurrent(s, 'current_view', '当前总指挥世代：1'); assert.equal(verify(s).status, 'FAIL'); });
  check('wrong navigation root fails', () => { const s = fixture(); put(s, 'central_entry', '<!-- CURRENT:BEGIN -->\n<!-- CONTROL_NAVIGATION: {"status_index":"status_index.md","root_ref":"external_control_plane"} -->\n<!-- CURRENT:END -->'); assert.equal(verify(s).status, 'FAIL'); });
  check('missing external root is INPUT_REQUIRED', () => { const s = fixture(); for (const source of Object.values(s.sources)) source.root_ref = 'external_control_plane'; const r = verify(s); assert.equal(r.status, 'NOT_CHECKED'); assert.ok(r.errors.some(e => e.includes('INPUT_REQUIRED'))); });
  console.log(`Control identity: PASS (${count} cases)`);
} finally {
  if (path.dirname(root) === fs.realpathSync(os.tmpdir()) || path.dirname(root) === os.tmpdir()) fs.rmSync(root, { recursive: true, force: true });
}
