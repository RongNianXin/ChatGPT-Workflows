import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../总指挥工作流/第二代总指挥的工作模式');
const repositoryPrefixes = ['.github/', '引用的外部工具/'];
const required = [
  ...Array.from({ length: 12 }, (_, index) => `${String(index).padStart(2, '0')}-`),
  '.github/scripts/HandoffSeal.mjs', '.github/scripts/Prepare-Handoff.mjs', '.github/scripts/HandoffWorkspaceScope.mjs', '.github/scripts/HandoffTransactionWorkspace.mjs',
  '.github/scripts/Inspect-WorkspaceTracking.mjs', '.github/scripts/Inspect-RuleRefresh.mjs',
  '.github/scripts/Mark-Handoff-Delivered.mjs', '.github/scripts/Inspect-QuotaProtection.mjs', '总指挥轻量交接启动配置.md',
  '规则刷新广播包.md', '规则刷新接收回执模板.md', 'templates/HANDOFF_STATE.schema.json',
  '引用的外部工具/外部工具目录.md', '引用的外部工具/外部工具自动对接规范.md'
];
const versionFiles = ['00-', '02-', '09-', '10-', '总指挥轻量交接启动配置.md'];
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const implementationFile = name => name.endsWith('.mjs') || name.endsWith('.py');
const fail = (code, message) => { throw Object.assign(new Error(message), { code }); };

function resolveFile(base, relative) {
  if (typeof relative !== 'string' || !relative || relative.includes('\\') ||
      relative.includes(':') || path.isAbsolute(relative) ||
      relative.split('/').some(part => !part || part === '..' || part === '.')) {
    fail('INVALID_PATH', 'Invalid rule path');
  }
  let current = base;
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    if (fs.lstatSync(current).isSymbolicLink()) fail('INVALID_PATH', `Linked rule path: ${relative}`);
  }
  const actual = fs.realpathSync(current);
  const inside = path.relative(base, actual);
  if (inside.startsWith(`..${path.sep}`) || inside === '..' || path.isAbsolute(inside) || !fs.statSync(actual).isFile()) {
    fail('INVALID_PATH', `Rule path escapes its root: ${relative}`);
  }
  return actual;
}

// Text and hashes come from the same captured bytes; the second read only checks stability.
export function captureRuleRefresh(ruleRoot = defaultRoot, { mode = 'local', expected, readFile = fs.readFileSync } = {}) {
  if (!['local', 'pinned'].includes(mode)) fail('INVALID_INPUT', 'Mode must be local or pinned');
  if (expected !== undefined && !/^[a-f0-9]{64}$/i.test(expected)) fail('INVALID_INPUT', 'Invalid expected snapshot');
  const root = fs.realpathSync(ruleRoot);
  const repository = fs.realpathSync(path.resolve(root, '../..'));
  const manifestPath = resolveFile(root, '规则刷新manifest.json');
  const manifestBytes = readFile(manifestPath);
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  if (manifest.schema_version !== 1 || manifest.path_base !== 'rule_root' ||
      manifest.repository_root_ref !== '../..' || manifest.scope !== 'core_workflow_full' ||
      typeof manifest.rule_version !== 'string' || !manifest.rule_version ||
      !Array.isArray(manifest.repository_root_prefixes) ||
      manifest.repository_root_prefixes.length !== repositoryPrefixes.length ||
      !repositoryPrefixes.every(prefix => manifest.repository_root_prefixes.includes(prefix)) ||
      !Array.isArray(manifest.rules) || !manifest.rules.length) {
    fail('INVALID_MANIFEST', 'Invalid rule manifest structure or scope');
  }
  const seen = new Set();
  for (const entry of manifest.rules) {
    if (typeof entry?.path_ref !== 'string' || !/^[a-f0-9]{64}$/i.test(entry.sha256 || '')) fail('INVALID_MANIFEST', 'Invalid rule entry');
    const key = entry.path_ref.normalize('NFC').toLowerCase();
    if (seen.has(key)) fail('INVALID_MANIFEST', 'Duplicate rule path');
    seen.add(key);
  }
  for (const name of required) {
    const matches = manifest.rules.filter(entry => name.endsWith('-') ? entry.path_ref.startsWith(name) : entry.path_ref === name);
    if (matches.length !== 1) fail('INVALID_MANIFEST', `Missing or ambiguous required rule: ${name}`);
  }
  const captures = manifest.rules.map(entry => {
    const base = repositoryPrefixes.some(prefix => entry.path_ref.startsWith(prefix)) ? repository : root;
    const file = resolveFile(base, entry.path_ref);
    const bytes = readFile(file);
    return { file, bytes, path_ref: entry.path_ref, sha256: digest(bytes), matches_manifest: digest(bytes) === entry.sha256.toLowerCase() };
  });
  if (digest(readFile(manifestPath)) !== digest(manifestBytes) || captures.some(item => {
    const base = repositoryPrefixes.some(prefix => item.path_ref.startsWith(prefix)) ? repository : root;
    return resolveFile(base, item.path_ref) !== item.file || digest(readFile(item.file)) !== item.sha256;
  })) fail('SOURCE_CHANGED', 'Saved rules changed during capture; reread the batch');
  const versionConsistent = versionFiles.every(name => {
    const item = captures.find(value => name.endsWith('-') ? value.path_ref.startsWith(name) : value.path_ref === name);
    return item.bytes.toString('utf8').match(/^版本：([^\r\n]+)/m)?.[1] === manifest.rule_version;
  });
  const rules = captures.map(({ path_ref, sha256, matches_manifest }) => ({ path_ref, sha256, matches_manifest }));
  const manifestHash = digest(manifestBytes);
  const snapshotHash = digest(JSON.stringify({ manifest_sha256: manifestHash, rules: rules.map(({ path_ref, sha256 }) => ({ path_ref, sha256 })).sort((a, b) => a.path_ref < b.path_ref ? -1 : a.path_ref > b.path_ref ? 1 : 0) }));
  if (expected && snapshotHash !== expected.toLowerCase()) fail('SOURCE_CHANGED', 'Current saved snapshot differs from the text baseline');
  const synchronized = versionConsistent && rules.every(item => item.matches_manifest);
  if (mode === 'pinned' && !synchronized) fail('MANIFEST_MISMATCH', 'Pinned verification requires synchronized versions and manifest hashes');
  const readingPlan = captures.filter(item => !implementationFile(item.path_ref)).map(item => ({
    path_ref: item.path_ref, file_sha256: item.sha256,
    total: Array.from(item.bytes.toString('utf8')).length, offset_unit: 'unicode_code_point'
  }));
  return {
    report: { result: 'PASS', mode, declared_version: manifest.rule_version, manifest_synchronized: synchronized,
      manifest_sha256: manifestHash, snapshot_sha256: snapshotHash, rules,
      text_reading: 'NOT_ATTESTED', editor_buffers: 'NOT_OBSERVED', reading_plan: readingPlan,
      implementation_on_demand: captures.filter(item => implementationFile(item.path_ref)).map(item => item.path_ref) },
    texts: Object.fromEntries(captures.map(item => [item.path_ref, item.bytes.toString('utf8')]))
  };
}

// Offsets count Unicode code points, so a segment never splits a surrogate pair.
// This describes text emitted by the tool, not text understood by an Agent.
export function readRuleSegment(capture, file, { offset = 0, length } = {}) {
  if (typeof file !== 'string' || !Object.hasOwn(capture.texts, file) || !Number.isSafeInteger(offset) || offset < 0 ||
      !Number.isSafeInteger(length) || length <= 0) fail('INVALID_INPUT', 'Invalid registered file or segment range');
  const points = Array.from(capture.texts[file]);
  if (offset > points.length) fail('INVALID_INPUT', 'Segment offset exceeds text length');
  const end = offset + Math.min(length, points.length - offset);
  return { result: capture.report.result, snapshot_sha256: capture.report.snapshot_sha256,
    file_sha256: capture.report.rules.find(item => item.path_ref === file).sha256,
    path_ref: file, offset_unit: 'unicode_code_point', start: offset, end,
    next_offset: end, total: points.length, text_reading: 'NOT_ATTESTED',
    text: points.slice(offset, end).join('') };
}

// This checks a caller's existing event record, not the authenticity of its source.
export function inspectRuleRefreshActivity(activity, { operation = 'read', snapshot } = {}) {
  if (!['capture', 'read', 'deliver'].includes(operation)) fail('INVALID_INPUT', 'Activity operation must be capture, read or deliver');
  const current = activity?.current;
  const refresh = activity?.refresh;
  const refs = ['request_ref', 'event_ref', 'turn_ref'];
  const terminal = ['COMPLETED', 'CANCELLED', 'SUPERSEDED'];
  if (activity?.schema_version !== 1 || !refs.every(key => [current?.[key], refresh?.[key]]
    .every(value => typeof value === 'string' && value.length > 0 && value === value.trim())) ||
    refresh?.kind !== 'RULE_REFRESH' || !['ACTIVE', 'QUEUED', 'BLOCKED', ...terminal].includes(refresh.status) ||
    !['PENDING', 'DELIVERED'].includes(refresh.delivery) ||
    !((operation === 'capture' || terminal.includes(refresh.status)) && refresh.snapshot_sha256 === null ||
      typeof refresh.snapshot_sha256 === 'string' && /^[a-f0-9]{64}$/i.test(refresh.snapshot_sha256)) ||
    (!terminal.includes(refresh.status) && refresh.delivery !== 'PENDING')) {
    fail('INVALID_ACTIVITY', 'Missing or invalid rule_refresh_activity; recover the existing event record');
  }
  if (operation !== 'deliver' && terminal.includes(refresh.status)) {
    fail('ACTIVITY_TERMINAL', refresh.delivery === 'PENDING'
      ? 'Refresh has ended; deliver its pending result without reopening reads'
      : 'Refresh has ended and was delivered; a leftover cursor cannot reopen it');
  }
  if (refresh.status === 'QUEUED') fail('ACTIVITY_QUEUED', 'Queued refresh does not own the processing slot');
  if (refresh.status === 'BLOCKED') fail('ACTIVITY_BLOCKED', 'Refresh is blocked; verify its recovery conditions first');
  if (!refs.every(key => current[key] === refresh[key])) {
    fail('ACTIVITY_MISROUTED', 'Refresh does not belong to the verified current request, event and turn');
  }
  if (operation === 'capture') {
    if (refresh.snapshot_sha256 !== null) fail('INVALID_ACTIVITY', 'Capture requires a verified new or rebased event with no cursor baseline');
  } else if (operation === 'deliver') {
    if (!terminal.includes(refresh.status)) fail('ACTIVITY_NOT_TERMINAL', 'Verify the refresh outcome before delivery');
    if (refresh.delivery === 'DELIVERED') fail('ACTIVITY_DELIVERED', 'Result was already delivered; do not deliver it again');
  } else if (snapshot !== undefined && (typeof snapshot !== 'string' || !/^[a-f0-9]{64}$/i.test(snapshot) ||
    snapshot.toLowerCase() !== refresh.snapshot_sha256.toLowerCase())) {
    fail('SOURCE_CHANGED', 'Refresh cursor belongs to another saved snapshot; rebase its reading plan');
  }
  return { result: 'PASS', action: { capture: 'CAPTURE_BASELINE', read: 'READ', deliver: 'DELIVER_ONLY' }[operation],
    request_ref: refresh.request_ref, event_ref: refresh.event_ref, turn_ref: refresh.turn_ref,
    provenance: 'NOT_ATTESTED', host_interception: 'NOT_IMPLEMENTED' };
}

export function parseRuleRefreshActivityRecord(text) {
  const value = text.replace(/^\uFEFF/, '').trim();
  let json = value;
  if (!value.startsWith('{')) {
    const begin = '<!-- RULE_REFRESH_ACTIVITY:BEGIN -->';
    const end = '<!-- RULE_REFRESH_ACTIVITY:END -->';
    if (value.split(begin).length !== 2 || value.split(end).length !== 2 || value.indexOf(end) < value.indexOf(begin)) {
      fail('INVALID_ACTIVITY', 'Markdown requires exactly one RULE_REFRESH_ACTIVITY section');
    }
    json = value.slice(value.indexOf(begin) + begin.length, value.indexOf(end)).trim();
    if (json.startsWith('```')) {
      const fence = json.match(/^```json\s*\r?\n([\s\S]*?)\r?\n```$/);
      if (!fence) fail('INVALID_ACTIVITY', 'Activity section must contain JSON only');
      json = fence[1];
    }
  }
  try { return JSON.parse(json).rule_refresh_activity; }
  catch { fail('INVALID_ACTIVITY', 'Activity must contain valid JSON with rule_refresh_activity'); }
}

function readActivityRecord(file) {
  if (!fs.lstatSync(file).isFile() || fs.lstatSync(file).isSymbolicLink()) fail('INVALID_ACTIVITY', 'Activity record must be a regular file');
  return parseRuleRefreshActivityRecord(fs.readFileSync(file, 'utf8'));
}

function main(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    if (!['--rule-root', '--mode', '--expected', '--file', '--offset', '--length', '--activity-record', '--activity-json', '--activity-operation'].includes(flag) || !argv[index + 1] || options[flag] !== undefined) {
      fail('INVALID_INPUT', 'Usage: node Inspect-RuleRefresh.mjs [--rule-root PATH] [--mode local|pinned] [--expected SHA256] [--file PATH_REF] [--offset N --length N] [--activity-record PATH | --activity-json JSON] [--activity-operation capture|read|deliver]');
    }
    options[flag] = argv[index + 1];
  }
  if (options['--activity-record'] && options['--activity-json']) fail('INVALID_INPUT', 'Choose one activity carrier');
  if (options['--activity-operation'] && !options['--activity-record'] && !options['--activity-json']) fail('INVALID_INPUT', 'Activity operation requires an explicit activity carrier');
  const operation = options['--activity-operation'] || 'read';
  let activity;
  if (options['--activity-record']) activity = readActivityRecord(options['--activity-record']);
  else if (options['--activity-json']) {
    try { activity = JSON.parse(options['--activity-json']); }
    catch { fail('INVALID_ACTIVITY', 'Inline activity must be valid JSON'); }
  }
  let activityGuard = activity !== undefined || options['--activity-record'] || options['--activity-json']
    ? inspectRuleRefreshActivity(activity, { operation }) : 'NOT_REQUESTED';
  if (operation === 'deliver') {
    if (['--file', '--offset', '--length', '--mode', '--expected'].some(flag => options[flag] !== undefined)) {
      fail('INVALID_INPUT', 'Delivery checks cannot emit rule text or capture a new rule baseline');
    }
    console.log(JSON.stringify(activityGuard));
    return;
  }
  if (operation === 'capture' && ['--file', '--offset', '--length', '--expected'].some(flag => options[flag] !== undefined)) {
    fail('INVALID_INPUT', 'Initial or rebased capture cannot emit rule text or reuse a cursor');
  }
  const segmented = options['--offset'] !== undefined || options['--length'] !== undefined;
  if (segmented && (!options['--file'] || options['--length'] === undefined ||
      !/^\d+$/.test(options['--length']) || (options['--offset'] !== undefined && !/^\d+$/.test(options['--offset'])))) {
    fail('INVALID_INPUT', 'Segments require --file and a positive integer --length; --offset defaults to zero');
  }
  if (segmented && Number(options['--offset'] ?? 0) > 0 && !options['--expected']) {
    fail('INVALID_INPUT', 'Continuation requires --expected to bind the same saved snapshot');
  }
  const captured = captureRuleRefresh(options['--rule-root'] || defaultRoot, { mode: options['--mode'] || 'local', expected: options['--expected'] });
  const { report, texts } = captured;
  if (activityGuard !== 'NOT_REQUESTED') activityGuard = inspectRuleRefreshActivity(activity, { operation, snapshot: report.snapshot_sha256 });
  if (segmented) {
    const { text, ...segment } = readRuleSegment(captured, options['--file'], {
      offset: Number(options['--offset'] ?? 0), length: Number(options['--length'])
    });
    console.log(JSON.stringify({ ...segment, activity_guard: activityGuard }));
    process.stdout.write(text);
    return;
  }
  if (options['--file']) {
    if (!Object.hasOwn(texts, options['--file'])) fail('INVALID_INPUT', 'Requested file is not a registered rule');
    console.log(JSON.stringify({ result: report.result, snapshot_sha256: report.snapshot_sha256, text_reading: 'NOT_ATTESTED', activity_guard: activityGuard }));
    process.stdout.write(texts[options['--file']]);
  } else console.log(JSON.stringify({ ...report, activity_guard: activityGuard }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(JSON.stringify({ result: 'FAIL', code: error.code || 'READ_ERROR', message: error.message })); process.exitCode = 1; }
}
