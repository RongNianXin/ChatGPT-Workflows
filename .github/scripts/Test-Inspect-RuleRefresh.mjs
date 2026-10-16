import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { captureRuleRefresh } from './Inspect-RuleRefresh.mjs';
import * as refresh from './Inspect-RuleRefresh.mjs';
import { spawnSync } from 'node:child_process';

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const fixtureParent = path.join(workspace, '.codex-manual-cache', 'rule-refresh-tests');
fs.mkdirSync(fixtureParent, { recursive: true });
assert.equal(fs.realpathSync(fixtureParent), fixtureParent);
const root = fs.mkdtempSync(path.join(fixtureParent, 'case-'));
const ruleRoot = path.join(root, 'rules', 'core');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const names = [
  ...Array.from({ length: 12 }, (_, index) => `${String(index).padStart(2, '0')}-rule.md`),
  ...['HandoffSeal', 'Prepare-Handoff', 'HandoffWorkspaceScope', 'HandoffTransactionWorkspace', 'Inspect-WorkspaceTracking', 'Inspect-RuleRefresh', 'Mark-Handoff-Delivered', 'Inspect-QuotaProtection'].map(name => `.github/scripts/${name}.mjs`),
  '总指挥轻量交接启动配置.md', '规则刷新广播包.md', '规则刷新接收回执模板.md', 'templates/HANDOFF_STATE.schema.json',
  '引用的外部工具/外部工具目录.md', '引用的外部工具/外部工具自动对接规范.md'
];
const resolve = name => path.join(name.startsWith('.github/') || name.startsWith('引用的外部工具/') ? root : ruleRoot, name);
const manifestPath = path.join(ruleRoot, '规则刷新manifest.json');
const content = '版本：fixture.1\nSynthetic rule text\n';
const original = {
  schema_version: 1, rule_version: 'fixture.1', scope: 'core_workflow_full', path_base: 'rule_root',
  repository_root_ref: '../..', repository_root_prefixes: ['.github/', '引用的外部工具/'],
  rules: names.map(path_ref => ({ path_ref, sha256: hash(content) }))
};
let passed = 0;
const writeManifest = value => fs.writeFileSync(manifestPath, JSON.stringify(value));
const test = (name, run) => { run(); passed += 1; console.log(`PASS: ${name}`); };
try {
  for (const name of names) { fs.mkdirSync(path.dirname(resolve(name)), { recursive: true }); fs.writeFileSync(resolve(name), content); }
  writeManifest(original);
  const before = captureRuleRefresh(ruleRoot);
  const catalog = '引用的外部工具/外部工具目录.md';
  test('local capture is read-only and does not attest model reading or editor buffers', () => {
    assert.equal(before.report.manifest_synchronized, true);
    assert.equal(before.report.text_reading, 'NOT_ATTESTED');
    assert.equal(before.report.editor_buffers, 'NOT_OBSERVED');
    assert.equal(fs.readFileSync(manifestPath, 'utf8'), JSON.stringify(original));
  });
  fs.writeFileSync(resolve(catalog), 'Saved new catalog\n');
  test('saved new text passes local refresh despite an old manifest digest', () => {
    const current = captureRuleRefresh(ruleRoot);
    assert.equal(current.report.result, 'PASS');
    assert.equal(current.report.manifest_synchronized, false);
    assert.equal(hash(current.texts[catalog]), current.report.rules.find(item => item.path_ref === catalog).sha256);
  });
  test('same stale digest fails pinned verification without a fallback', () => {
    assert.throws(() => captureRuleRefresh(ruleRoot, { mode: 'pinned' }), { code: 'MANIFEST_MISMATCH' });
  });
  test('different receiving snapshots cannot be claimed as one fixed batch', () => {
    assert.notEqual(captureRuleRefresh(ruleRoot).report.snapshot_sha256, before.report.snapshot_sha256);
    assert.throws(() => captureRuleRefresh(ruleRoot, { expected: before.report.snapshot_sha256 }), { code: 'SOURCE_CHANGED' });
  });
  test('text altered during capture is rejected even if the saved file is restored', () => {
    let intercepted = false;
    assert.throws(() => captureRuleRefresh(ruleRoot, { readFile: file => {
      if (!intercepted && file === resolve(catalog)) { intercepted = true; return Buffer.from('Transient text, restored before recheck\n'); }
      return fs.readFileSync(file);
    } }), { code: 'SOURCE_CHANGED' });
  });
  test('repeated drifting attempts remain failures', () => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      let calls = 0;
      assert.throws(() => captureRuleRefresh(ruleRoot, { readFile: file => file === resolve(catalog)
        ? Buffer.from(`Changing ${calls++}`) : fs.readFileSync(file) }), { code: 'SOURCE_CHANGED' });
    }
  });
  fs.writeFileSync(resolve(catalog), content);
  test('stable synchronized snapshot passes pinned verification', () => assert.equal(captureRuleRefresh(ruleRoot, { mode: 'pinned' }).report.result, 'PASS'));
  test('saved version label drift is diagnostic locally and fails pinned', () => {
    fs.writeFileSync(resolve('00-rule.md'), content.replace('fixture.1', 'fixture.2'));
    assert.equal(captureRuleRefresh(ruleRoot).report.manifest_synchronized, false);
    assert.throws(() => captureRuleRefresh(ruleRoot, { mode: 'pinned' }), { code: 'MANIFEST_MISMATCH' });
    fs.writeFileSync(resolve('00-rule.md'), content);
  });
  for (const [name, mutate] of [
    ['empty manifest', value => { value.rules = []; }],
    ['missing required entry', value => { value.rules.shift(); }],
    ['duplicate path', value => { value.rules.push(value.rules[0]); }],
    ['wrong type', value => { value.rules[0].sha256 = 42; }],
    ['unknown repository prefix', value => { value.repository_root_prefixes.push('private/'); }],
    ['path traversal', value => { value.rules.push({ path_ref: '../outside.md', sha256: hash(content) }); }],
    ['absolute path', value => { value.rules.push({ path_ref: resolve(catalog), sha256: hash(content) }); }]
  ]) test(`rejects ${name} even in local mode`, () => {
    const value = structuredClone(original); mutate(value); writeManifest(value);
    assert.throws(() => captureRuleRefresh(ruleRoot)); writeManifest(original);
  });
  test('missing file and malformed manifest fail rather than adopt a partial batch', () => {
    fs.unlinkSync(resolve(catalog)); assert.throws(() => captureRuleRefresh(ruleRoot)); fs.writeFileSync(resolve(catalog), content);
    fs.writeFileSync(manifestPath, '{'); assert.throws(() => captureRuleRefresh(ruleRoot)); writeManifest(original);
  });
  test('junction escape is rejected before reading its content', () => {
    const outside = path.join(root, 'outside'); fs.mkdirSync(outside); fs.writeFileSync(path.join(outside, 'rule.md'), 'Private sentinel');
    const link = path.join(ruleRoot, 'linked'); fs.symlinkSync(outside, link, 'junction');
    const value = structuredClone(original); value.rules.push({ path_ref: 'linked/rule.md', sha256: hash('Private sentinel') }); writeManifest(value);
    assert.throws(() => captureRuleRefresh(ruleRoot), { code: 'INVALID_PATH' }); writeManifest(original);
  });
  test('invalid modes and expected digests fail closed', () => {
    assert.throws(() => captureRuleRefresh(ruleRoot, { mode: 'automatic-fallback' }), { code: 'INVALID_INPUT' });
    assert.throws(() => captureRuleRefresh(ruleRoot, { expected: 'old' }), { code: 'INVALID_INPUT' });
  });
  const unicode = `${content}中文🙂e\u0301\r\n末尾`;
  fs.writeFileSync(resolve(catalog), unicode);
  const captured = captureRuleRefresh(ruleRoot);
  test('bounded segments reconstruct exact Unicode text without attesting reading', () => {
    let offset = 0, joined = '';
    do {
      const segment = refresh.readRuleSegment(captured, catalog, { offset, length: 3 });
      assert.equal(segment.text_reading, 'NOT_ATTESTED');
      assert.equal(segment.snapshot_sha256, captured.report.snapshot_sha256);
      assert.equal(segment.file_sha256, hash(unicode));
      assert.equal(segment.offset_unit, 'unicode_code_point');
      assert.equal(segment.start, offset);
      assert.ok(segment.end > offset);
      assert.ok(Array.from(segment.text).length <= 3);
      joined += segment.text; offset = segment.next_offset;
    } while (offset < Array.from(unicode).length);
    assert.equal(joined, unicode);
    assert.equal(refresh.readRuleSegment(captured, catalog, { offset, length: 3 }).text, '');
    assert.throws(() => refresh.readRuleSegment(captured, catalog, { offset: offset + 1, length: 3 }), { code: 'INVALID_INPUT' });
  });
  test('segment inputs reject unknown files and invalid, fractional or unsafe ranges', () => {
    assert.throws(() => refresh.readRuleSegment(captured, '../private', { offset: 0, length: 2 }), { code: 'INVALID_INPUT' });
    for (const offset of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      assert.throws(() => refresh.readRuleSegment(captured, catalog, { offset, length: 2 }), { code: 'INVALID_INPUT' });
    }
    for (const length of [0, -1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      assert.throws(() => refresh.readRuleSegment(captured, catalog, { offset: 0, length }), { code: 'INVALID_INPUT' });
    }
  });
  const cli = (...args) => spawnSync(process.execPath, [path.join(workspace, '.github/scripts/Inspect-RuleRefresh.mjs'), '--rule-root', ruleRoot, ...args], { cwd: root, encoding: 'utf8' });
  const activity = () => ({ schema_version: 1,
    current: { request_ref: 'request-B', event_ref: 'event-B', turn_ref: 'turn-B' },
    refresh: { request_ref: 'request-B', event_ref: 'event-B', turn_ref: 'turn-B',
      kind: 'RULE_REFRESH', status: 'ACTIVE', delivery: 'PENDING', snapshot_sha256: captured.report.snapshot_sha256 }
  });
  const activityPath = path.join(root, 'loading-record.json');
  const saveActivity = value => fs.writeFileSync(activityPath, JSON.stringify({ rule_refresh_activity: value }));
  test('Markdown carrier preserves surrounding text and uses the same activity guard', () => {
    const markdownPath = path.join(root, 'progress.md');
    const text = `# Existing progress\nKeep this text\n<!-- RULE_REFRESH_ACTIVITY:BEGIN -->\n${JSON.stringify({ rule_refresh_activity: activity() })}\n<!-- RULE_REFRESH_ACTIVITY:END -->\nExisting tail\n`;
    fs.writeFileSync(markdownPath, text);
    const run = cli('--activity-record', markdownPath, '--expected', captured.report.snapshot_sha256, '--file', catalog);
    assert.equal(run.status, 0, run.stderr);
    assert.equal(JSON.parse(run.stdout.split('\n')[0]).activity_guard.action, 'READ');
    assert.equal(fs.readFileSync(markdownPath, 'utf8'), text);
    const terminal = activity(); terminal.refresh.status = 'COMPLETED';
    fs.writeFileSync(markdownPath, text.replace(JSON.stringify({ rule_refresh_activity: activity() }), JSON.stringify({ rule_refresh_activity: terminal })));
    assert.equal(JSON.parse(cli('--activity-record', markdownPath).stderr).code, 'ACTIVITY_TERMINAL');
  });
  test('Markdown accepts only one explicit intact section and never guesses code blocks', () => {
    const json = JSON.stringify({ rule_refresh_activity: activity() });
    const section = `<!-- RULE_REFRESH_ACTIVITY:BEGIN -->\n\`\`\`json\n${json}\n\`\`\`\n<!-- RULE_REFRESH_ACTIVITY:END -->`;
    assert.deepEqual(refresh.parseRuleRefreshActivityRecord(section), activity());
    for (const text of [`# Progress\n${json}`, section + section,
      '<!-- RULE_REFRESH_ACTIVITY:END --><!-- RULE_REFRESH_ACTIVITY:BEGIN -->',
      '<!-- RULE_REFRESH_ACTIVITY:BEGIN -->{broken<!-- RULE_REFRESH_ACTIVITY:END -->']) {
      assert.throws(() => refresh.parseRuleRefreshActivityRecord(text), { code: 'INVALID_ACTIVITY' });
    }
  });
  test('first refresh without a writable record uses explicit memory binding through capture read and delivery', () => {
    const value = activity(); value.refresh.snapshot_sha256 = null;
    const run = cli('--activity-json', JSON.stringify(value), '--activity-operation', 'capture');
    assert.equal(run.status, 0, run.stderr);
    value.refresh.snapshot_sha256 = JSON.parse(run.stdout).snapshot_sha256;
    const read = cli('--activity-json', JSON.stringify(value), '--expected', value.refresh.snapshot_sha256, '--file', catalog);
    assert.equal(read.status, 0, read.stderr);
    assert.equal(JSON.parse(read.stdout.split('\n')[0]).activity_guard.action, 'READ');
    value.refresh.status = 'COMPLETED';
    assert.equal(cli('--activity-json', JSON.stringify(value), '--activity-operation', 'deliver').status, 0);
    assert.equal(JSON.parse(cli('--activity-json', JSON.stringify(value)).stderr).code, 'ACTIVITY_TERMINAL');
    value.current.event_ref = 'other-event';
    assert.equal(JSON.parse(cli('--activity-json', JSON.stringify(value), '--activity-operation', 'deliver').stderr).code, 'ACTIVITY_MISROUTED');
    assert.equal(cli('--activity-json', JSON.stringify(value), '--activity-record', activityPath).status, 1);
    assert.equal(JSON.parse(cli('--activity-json', '{broken').stderr).code, 'INVALID_ACTIVITY');
  });
  test('actual CLI rejects reopening a delivered old refresh after a new delegation', () => {
    const value = activity();
    Object.assign(value.refresh, { request_ref: 'request-A', event_ref: 'event-A', turn_ref: 'turn-A', status: 'COMPLETED', delivery: 'DELIVERED' });
    saveActivity(value);
    const run = cli('--activity-record', activityPath, '--file', catalog, '--length', '3');
    assert.equal(run.status, 1); assert.equal(JSON.parse(run.stderr).code, 'ACTIVITY_TERMINAL');
    assert.equal(run.stdout, '');
    fs.writeFileSync(manifestPath, '{');
    assert.equal(JSON.parse(cli('--activity-record', activityPath).stderr).code, 'ACTIVITY_TERMINAL');
    writeManifest(original);
  });
  test('active refresh guard binds request, event and owning turn independently', () => {
    for (const field of ['request_ref', 'event_ref', 'turn_ref']) {
      const value = activity(); value.refresh[field] = 'old';
      assert.throws(() => refresh.inspectRuleRefreshActivity(value), { code: 'ACTIVITY_MISROUTED' });
    }
    assert.equal(refresh.inspectRuleRefreshActivity(activity(), { snapshot: captured.report.snapshot_sha256 }).action, 'READ');
  });
  test('an unfinished refresh keeps reading only while it owns the processing slot', () => {
    const value = activity(); value.refresh.status = 'QUEUED';
    assert.throws(() => refresh.inspectRuleRefreshActivity(value), { code: 'ACTIVITY_QUEUED' });
    value.refresh.status = 'ACTIVE';
    assert.equal(refresh.inspectRuleRefreshActivity(value).action, 'READ');
    value.refresh.status = 'BLOCKED';
    assert.throws(() => refresh.inspectRuleRefreshActivity(value), { code: 'ACTIVITY_BLOCKED' });
  });
  test('verified resumption may rebind a processing turn without changing the event', () => {
    const value = activity(); value.current.turn_ref = 'resumed-turn';
    assert.throws(() => refresh.inspectRuleRefreshActivity(value), { code: 'ACTIVITY_MISROUTED' });
    value.refresh.turn_ref = value.current.turn_ref;
    assert.equal(refresh.inspectRuleRefreshActivity(value).action, 'READ');
  });
  test('all terminal statuses reject reads even with a leftover cursor', () => {
    for (const status of ['COMPLETED', 'CANCELLED', 'SUPERSEDED']) {
      for (const delivery of ['PENDING', 'DELIVERED']) {
        const value = activity(); Object.assign(value.refresh, { status, delivery });
        assert.throws(() => refresh.inspectRuleRefreshActivity(value), { code: 'ACTIVITY_TERMINAL' });
      }
    }
  });
  test('terminal pending delivery permits only its own output, not old output for a new request', () => {
    const value = activity(); value.refresh.status = 'COMPLETED';
    assert.equal(refresh.inspectRuleRefreshActivity(value, { operation: 'deliver' }).action, 'DELIVER_ONLY');
    value.current.request_ref = 'request-C';
    assert.throws(() => refresh.inspectRuleRefreshActivity(value, { operation: 'deliver' }), { code: 'ACTIVITY_MISROUTED' });
    value.current.request_ref = value.refresh.request_ref; value.refresh.delivery = 'DELIVERED';
    assert.throws(() => refresh.inspectRuleRefreshActivity(value, { operation: 'deliver' }), { code: 'ACTIVITY_DELIVERED' });
  });
  test('failure or cancellation before the first snapshot can deliver without reopening capture', () => {
    for (const status of ['COMPLETED', 'CANCELLED', 'SUPERSEDED']) {
      const value = activity(); Object.assign(value.refresh, { status, snapshot_sha256: null }); saveActivity(value);
      assert.equal(refresh.inspectRuleRefreshActivity(value, { operation: 'deliver' }).action, 'DELIVER_ONLY');
      const run = cli('--activity-record', activityPath, '--activity-operation', 'deliver');
      assert.equal(run.status, 0, run.stderr); assert.equal(JSON.parse(run.stdout).action, 'DELIVER_ONLY');
      for (const operation of ['read', 'capture']) {
        assert.throws(() => refresh.inspectRuleRefreshActivity(value, { operation }), { code: 'ACTIVITY_TERMINAL' });
      }
    }
  });
  test('a genuinely new refresh event works without reviving the completed event', () => {
    const value = activity();
    for (const field of ['request_ref', 'event_ref', 'turn_ref']) value.current[field] = value.refresh[field] = `new-${field}`;
    assert.equal(refresh.inspectRuleRefreshActivity(value).action, 'READ');
    assert.throws(() => refresh.inspectRuleRefreshActivity(value, { operation: 'deliver' }), { code: 'ACTIVITY_NOT_TERMINAL' });
  });
  test('missing, malformed and ambiguous activity records cannot silently fall back', () => {
    const malformed = [null, {}, { ...activity(), schema_version: 2 }];
    for (const field of ['request_ref', 'event_ref', 'turn_ref']) {
      const value = activity(); value.current[field] = ''; malformed.push(value);
    }
    for (const update of [{ kind: 'BUSINESS' }, { status: 'UNKNOWN' }, { delivery: 'UNKNOWN' },
      { snapshot_sha256: 'old' }, { snapshot_sha256: [captured.report.snapshot_sha256] }, { delivery: 'DELIVERED' }]) {
      const value = activity(); Object.assign(value.refresh, update); malformed.push(value);
    }
    for (const value of malformed) assert.throws(() => refresh.inspectRuleRefreshActivity(value), { code: 'INVALID_ACTIVITY' });
    assert.throws(() => refresh.inspectRuleRefreshActivity(activity(), { operation: 'execute' }), { code: 'INVALID_INPUT' });
  });
  test('activity read binds the existing cursor snapshot and does not grant authority', () => {
    assert.throws(() => refresh.inspectRuleRefreshActivity(activity(), { snapshot: before.report.snapshot_sha256 }), { code: 'SOURCE_CHANGED' });
    const result = refresh.inspectRuleRefreshActivity(activity());
    assert.equal(result.provenance, 'NOT_ATTESTED'); assert.equal(result.host_interception, 'NOT_IMPLEMENTED');
  });
  test('guarded CLI emits text only for the matching active refresh', () => {
    saveActivity(activity());
    const run = cli('--activity-record', activityPath, '--file', catalog, '--expected', captured.report.snapshot_sha256, '--offset', '2', '--length', '5');
    assert.equal(run.status, 0, run.stderr);
    assert.equal(JSON.parse(run.stdout.slice(0, run.stdout.indexOf('\n'))).activity_guard.action, 'READ');
    assert.equal(run.stdout.slice(run.stdout.indexOf('\n') + 1), Array.from(unicode).slice(2, 7).join(''));
    const old = activity(); old.refresh.snapshot_sha256 = before.report.snapshot_sha256; saveActivity(old);
    const drift = cli('--activity-record', activityPath, '--file', catalog, '--length', '2');
    assert.equal(drift.stdout, ''); assert.equal(JSON.parse(drift.stderr).code, 'SOURCE_CHANGED');
  });
  test('new or verified rebased events can capture before a cursor baseline exists', () => {
    const value = activity(); value.refresh.snapshot_sha256 = null; saveActivity(value);
    assert.throws(() => refresh.inspectRuleRefreshActivity(value), { code: 'INVALID_ACTIVITY' });
    const run = cli('--activity-record', activityPath, '--activity-operation', 'capture');
    assert.equal(run.status, 0, run.stderr);
    const report = JSON.parse(run.stdout);
    assert.equal(report.activity_guard.action, 'CAPTURE_BASELINE');
    assert.equal(report.snapshot_sha256, captured.report.snapshot_sha256);
    assert.equal(JSON.parse(fs.readFileSync(activityPath, 'utf8')).rule_refresh_activity.refresh.snapshot_sha256, null);
    assert.equal(JSON.parse(cli('--activity-record', activityPath, '--activity-operation', 'capture', '--file', catalog).stderr).code, 'INVALID_INPUT');
    saveActivity(activity());
    assert.equal(JSON.parse(cli('--activity-record', activityPath, '--activity-operation', 'capture').stderr).code, 'INVALID_ACTIVITY');
  });
  test('delivery CLI does not capture current rules or emit their text', () => {
    const value = activity(); value.refresh.status = 'COMPLETED'; saveActivity(value);
    fs.writeFileSync(manifestPath, '{');
    const run = cli('--activity-record', activityPath, '--activity-operation', 'deliver');
    assert.equal(run.status, 0, run.stderr); assert.equal(JSON.parse(run.stdout).action, 'DELIVER_ONLY');
    writeManifest(original);
    for (const args of [['--file', catalog], ['--offset', '0', '--length', '2'], ['--expected', captured.report.snapshot_sha256]]) {
      assert.equal(JSON.parse(cli('--activity-record', activityPath, '--activity-operation', 'deliver', ...args).stderr).code, 'INVALID_INPUT');
    }
    value.current.event_ref = 'new-inbound-event'; saveActivity(value);
    const misrouted = cli('--activity-record', activityPath, '--activity-operation', 'deliver');
    assert.equal(JSON.parse(misrouted.stderr).code, 'ACTIVITY_MISROUTED'); assert.equal(misrouted.stdout, '');
  });
  test('explicit activity inputs fail closed while ordinary independent reads remain compatible', () => {
    fs.writeFileSync(activityPath, '{}');
    assert.equal(JSON.parse(cli('--activity-record', activityPath).stderr).code, 'INVALID_ACTIVITY');
    assert.equal(cli('--activity-operation', 'read').status, 1);
    const run = cli('--file', catalog); assert.equal(run.status, 0, run.stderr);
    assert.equal(JSON.parse(run.stdout.slice(0, run.stdout.indexOf('\n'))).activity_guard, 'NOT_REQUESTED');
  });
  test('CLI bounded text binds its exact range to the captured snapshot', () => {
    const run = cli('--file', catalog, '--expected', captured.report.snapshot_sha256, '--offset', '2', '--length', '5');
    assert.equal(run.status, 0, run.stderr);
    const newline = run.stdout.indexOf('\n');
    const report = JSON.parse(run.stdout.slice(0, newline));
    assert.equal(report.next_offset, 7);
    assert.equal(report.snapshot_sha256, captured.report.snapshot_sha256);
    assert.equal(report.text_reading, 'NOT_ATTESTED');
    assert.equal(run.stdout.slice(newline + 1), Array.from(unicode).slice(2, 7).join(''));
  });
  test('original whole-file CLI and default report remain compatible', () => {
    const run = cli('--file', catalog);
    assert.equal(run.status, 0, run.stderr);
    assert.equal(run.stdout.slice(run.stdout.indexOf('\n') + 1), unicode);
    assert.equal(JSON.parse(cli().stdout).text_reading, 'NOT_ATTESTED');
  });
  test('empty text and EOF emit zero text without claiming reading', () => {
    const empty = structuredClone(captured);
    empty.texts[catalog] = '';
    empty.report.rules.find(item => item.path_ref === catalog).sha256 = hash('');
    const segment = refresh.readRuleSegment(empty, catalog, { length: 10 });
    assert.equal(segment.text, ''); assert.equal(segment.start, 0); assert.equal(segment.end, 0);
    assert.equal(segment.total, 0); assert.equal(segment.next_offset, 0);
    assert.equal(segment.file_sha256, hash('')); assert.equal(segment.text_reading, 'NOT_ATTESTED');
  });
  test('CLI invalid or unbound ranges and duplicate flags are rejected', () => {
    for (const args of [
      ['--offset', '0', '--length', '2'], ['--file', catalog, '--offset', '0'],
      ['--file', catalog, '--length', '0'], ['--file', catalog, '--length', '2junk'],
      ['--file', catalog, '--offset', '-1', '--length', '2'],
      ['--file', catalog, '--offset', '1', '--length', '2'],
      ['--file', catalog, '--length', '2', '--length', '3']
    ]) { const run = cli(...args); assert.equal(run.status, 1); assert.equal(JSON.parse(run.stderr).code, 'INVALID_INPUT'); }
  });
  test('segmented CLI preserves strict pinned and stale snapshot rejection', () => {
    assert.equal(JSON.parse(cli('--file', catalog, '--length', '2', '--mode', 'pinned').stderr).code, 'MANIFEST_MISMATCH');
    assert.equal(JSON.parse(cli('--file', catalog, '--length', '2', '--expected', before.report.snapshot_sha256).stderr).code, 'SOURCE_CHANGED');
    assert.equal(fs.readFileSync(resolve(catalog), 'utf8'), unicode);
    assert.equal(fs.readFileSync(manifestPath, 'utf8'), JSON.stringify(original));
  });
  console.log(`Saved local rule refresh: PASS (${passed} synthetic cases; not live Agent behavior)`);
} finally { fs.rmSync(root, { recursive: true, force: true }); }
