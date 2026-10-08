import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../总指挥工作流/第二代总指挥的工作模式');
const repositoryPrefixes = ['.github/', '引用的外部工具/'];
const required = [
  ...Array.from({ length: 12 }, (_, index) => `${String(index).padStart(2, '0')}-`),
  '.github/scripts/HandoffSeal.mjs', '.github/scripts/Prepare-Handoff.mjs', '.github/scripts/HandoffWorkspaceScope.mjs',
  '.github/scripts/Inspect-WorkspaceTracking.mjs', '.github/scripts/Inspect-RuleRefresh.mjs',
  '.github/scripts/Mark-Handoff-Delivered.mjs', '.github/scripts/Inspect-QuotaProtection.mjs', '总指挥轻量交接启动配置.md',
  '规则刷新广播包.md', '规则刷新接收回执模板.md', 'templates/HANDOFF_STATE.schema.json',
  '引用的外部工具/外部工具目录.md', '引用的外部工具/外部工具自动对接规范.md'
];
const versionFiles = ['00-', '02-', '09-', '10-', '总指挥轻量交接启动配置.md'];
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
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
  return {
    report: { result: 'PASS', mode, declared_version: manifest.rule_version, manifest_synchronized: synchronized,
      manifest_sha256: manifestHash, snapshot_sha256: snapshotHash, rules,
      text_reading: 'NOT_ATTESTED', editor_buffers: 'NOT_OBSERVED' },
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

function main(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    if (!['--rule-root', '--mode', '--expected', '--file', '--offset', '--length'].includes(flag) || !argv[index + 1] || options[flag] !== undefined) {
      fail('INVALID_INPUT', 'Usage: node Inspect-RuleRefresh.mjs [--rule-root PATH] [--mode local|pinned] [--expected SHA256] [--file PATH_REF] [--offset N --length N]');
    }
    options[flag] = argv[index + 1];
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
  if (segmented) {
    const { text, ...segment } = readRuleSegment(captured, options['--file'], {
      offset: Number(options['--offset'] ?? 0), length: Number(options['--length'])
    });
    console.log(JSON.stringify(segment));
    process.stdout.write(text);
    return;
  }
  if (options['--file']) {
    if (!Object.hasOwn(texts, options['--file'])) fail('INVALID_INPUT', 'Requested file is not a registered rule');
    console.log(JSON.stringify({ result: report.result, snapshot_sha256: report.snapshot_sha256, text_reading: 'NOT_ATTESTED' }));
    process.stdout.write(texts[options['--file']]);
  } else console.log(JSON.stringify(report, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(JSON.stringify({ result: 'FAIL', code: error.code || 'READ_ERROR', message: error.message })); process.exitCode = 1; }
}
