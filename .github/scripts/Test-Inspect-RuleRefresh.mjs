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
