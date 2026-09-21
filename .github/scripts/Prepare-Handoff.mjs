// Atomic formal-handoff preparation. It creates a final-* artifact only after every gate passes.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { appendSeal, verifyChain } from './HandoffSeal.mjs';

export const REQUIRED_RULES = [
  '.github/scripts/HandoffSeal.mjs',
  '.github/scripts/Prepare-Handoff.mjs',
  '总指挥工作流/第二代总指挥的工作模式/templates/HANDOFF_STATE.schema.json',
  '总指挥工作流/第二代总指挥的工作模式/02-总指挥核心规则.md',
  '总指挥工作流/第二代总指挥的工作模式/04-状态、目标变更与交接规范.md',
  '总指挥工作流/第二代总指挥的工作模式/07-总指挥交接记录模板.md',
  '总指挥工作流/第二代总指挥的工作模式/09-自动化授权与风险分级.md',
  '总指挥工作流/第二代总指挥的工作模式/10-自动状态索引规范.md',
  '总指挥工作流/第二代总指挥的工作模式/总指挥轻量交接启动配置.md'
];
const CONFIG_KEYS = new Set(['seal_directory', 'source_root', 'draft_path', 'snapshot_template_path', 'final_output_path', 'receipt_output_path', 'rule_manifest_path', 'expected_previous_digest', 'transition_ticket']);
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const resolveFrom = (base, value) => path.resolve(base, value);
const isInside = (root, candidate) => {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
};
const physicalTarget = target => {
  const suffix = [];
  let cursor = path.resolve(target);
  while (!fs.existsSync(cursor)) {
    const parent = path.dirname(cursor);
    if (parent === cursor) throw new Error(`cannot resolve an existing ancestor for: ${target}`);
    suffix.unshift(path.basename(cursor));
    cursor = parent;
  }
  return path.join(fs.realpathSync(cursor), ...suffix);
};

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function verifyCurrentDocument(file, label) {
  const content = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  const markers = ['<!-- CURRENT:BEGIN -->', '<!-- CURRENT:END -->', '<!-- HISTORY:BEGIN -->'];
  for (const marker of markers) if (content.split(marker).length !== 2) throw new Error(`${label}: ${marker} must appear exactly once`);
  const begin = content.indexOf(markers[0]);
  const end = content.indexOf(markers[1]);
  const history = content.indexOf(markers[2]);
  if (!(begin < end && end < history)) throw new Error(`${label}: CURRENT/HISTORY markers are out of order`);
  if (!content.slice(begin + markers[0].length, end).trim()) throw new Error(`${label}: CURRENT block is empty`);
  const gap = content.slice(end + markers[1].length, history).replace(/<!--[\s\S]*?-->/g, '').trim();
  if (gap) throw new Error(`${label}: body text exists outside CURRENT and before HISTORY`);
}

function verifyRuleManifest(workflowRoot, manifestPath) {
  const manifest = readJson(manifestPath);
  if (manifest?.schema_version !== 1 || !Array.isArray(manifest.rules)) throw new Error('rule manifest must use schema_version 1 and a rules array');
  const entries = new Map(manifest.rules.map(item => [item?.path_ref, item]));
  for (const relative of REQUIRED_RULES) {
    const item = entries.get(relative);
    if (!item || !/^[0-9a-f]{64}$/.test(item.sha256 || '')) throw new Error(`rule manifest is missing a valid digest: ${relative}`);
    const absolute = fs.realpathSync(path.resolve(workflowRoot, relative));
    if (!isInside(workflowRoot, absolute)) throw new Error(`rule path escapes workflow root: ${relative}`);
    if (sha256(fs.readFileSync(absolute)) !== item.sha256) throw new Error(`rule digest mismatch: ${relative}`);
  }
  for (const tool of ['.github/scripts/HandoffSeal.mjs', '.github/scripts/Prepare-Handoff.mjs']) {
    const tracked = spawnSync('git', ['-C', workflowRoot, 'ls-files', '--error-unmatch', '--', tool], { encoding: 'utf8' });
    if (tracked.status !== 0) throw new Error(`handoff tool is not tracked in the verified workflow repository: ${tool}`);
  }
}

export function detectUnicodeCollisions(items) {
  const normalized = new Map();
  for (const item of items) {
    const key = item.normalize('NFC');
    if (normalized.has(key) && normalized.get(key) !== item) throw new Error(`Unicode normalization collision: ${normalized.get(key)} <> ${item}`);
    normalized.set(key, item);
  }
}

function unicodeInventory(sourceRoot, refs) {
  const result = spawnSync('git', ['-C', sourceRoot, 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], { encoding: 'buffer', maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0) throw new Error('cannot read the source repository path inventory with NUL-delimited Git output');
  const paths = new Set(refs);
  for (const item of result.stdout.toString('utf8').split('\0')) if (item) paths.add(item.replaceAll('\\', '/'));
  detectUnicodeCollisions(paths);
  return { mode: 'GIT_NUL', count: paths.size };
}

function atomicWriteExclusive(finalPath, bytes) {
  fs.mkdirSync(path.dirname(finalPath), { recursive: true });
  if (fs.existsSync(finalPath)) throw new Error(`refusing to overwrite existing output: ${finalPath}`);
  const tempPath = path.join(path.dirname(finalPath), `.${path.basename(finalPath)}.${process.pid}.tmp`);
  const fd = fs.openSync(tempPath, 'wx');
  try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.linkSync(tempPath, finalPath);
  fs.unlinkSync(tempPath);
}

export function prepareFormalHandoff(configPath) {
  const absoluteConfig = path.resolve(configPath);
  const configDir = path.dirname(absoluteConfig);
  const config = readJson(absoluteConfig);
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('configuration must be an object');
  for (const key of Object.keys(config)) if (!CONFIG_KEYS.has(key)) throw new Error(`unknown configuration field: ${key}`);
  for (const key of ['seal_directory', 'source_root', 'draft_path', 'snapshot_template_path', 'final_output_path', 'receipt_output_path', 'rule_manifest_path']) if (typeof config[key] !== 'string' || !config[key]) throw new Error(`missing configuration field: ${key}`);

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const workflowRoot = fs.realpathSync(path.resolve(scriptDir, '..', '..'));
  const sealDirectory = resolveFrom(configDir, config.seal_directory);
  const sourceRoot = fs.realpathSync(resolveFrom(configDir, config.source_root));
  const draftPath = resolveFrom(configDir, config.draft_path);
  const templatePath = resolveFrom(configDir, config.snapshot_template_path);
  const finalPath = resolveFrom(configDir, config.final_output_path);
  const receiptPath = resolveFrom(configDir, config.receipt_output_path);
  const manifestPath = resolveFrom(configDir, config.rule_manifest_path);
  if (!/^[a-z0-9][a-z0-9._-]*-commander-handoff-\d{8}-final-\d+\.md$/i.test(path.basename(finalPath))) throw new Error('formal output filename must include project slug, date, final, and an incrementing number');
  if (finalPath === receiptPath) throw new Error('formal output and receipt must use different paths');
  const physicalFinalPath = physicalTarget(finalPath);
  const physicalReceiptPath = physicalTarget(receiptPath);
  if (isInside(workflowRoot, physicalFinalPath) || isInside(workflowRoot, physicalReceiptPath) || isInside(sourceRoot, physicalFinalPath) || isInside(sourceRoot, physicalReceiptPath)) throw new Error('formal output and receipt must be stored outside the workflow and source repositories');
  if (fs.existsSync(finalPath) || fs.existsSync(receiptPath)) throw new Error('formal output or receipt already exists');

  const physicalSealDirectory = physicalTarget(sealDirectory);
  if (!isInside(sourceRoot, physicalSealDirectory)) throw new Error('seal directory must stay inside the source repository');
  fs.mkdirSync(sealDirectory, { recursive: true });
  const realSealDirectory = fs.realpathSync(sealDirectory);
  if (!isInside(sourceRoot, realSealDirectory)) throw new Error('seal directory must stay inside the source repository');
  const sealRelative = path.relative(sourceRoot, realSealDirectory).replaceAll('\\', '/');
  const ignored = spawnSync('git', ['-C', sourceRoot, 'check-ignore', '-q', '--', sealRelative]);
  if (ignored.status !== 0) throw new Error('seal directory must be excluded by the source repository .gitignore');

  const ruleManifestDigest = sha256(fs.readFileSync(manifestPath));
  verifyRuleManifest(workflowRoot, manifestPath);
  const draft = readJson(draftPath);
  if (draft.schema_version !== 3 || draft.handoff_phase !== 'MATERIAL_PREPARED' || !['READY', 'READY_WITH_RESTRICTIONS'].includes(draft.switch_status)) throw new Error('formal handoff requires a schema v3 MATERIAL_PREPARED draft in READY or READY_WITH_RESTRICTIONS');
  const sourceRefs = Object.values(draft.sources ?? {}).map(item => item.path_ref);
  const inventory = unicodeInventory(sourceRoot, [...sourceRefs, ...(draft.workspace?.required_untracked ?? []).map(item => item.path_ref)]);
  for (const name of ['central_work_items', 'current_view', 'status_index']) {
    const ref = draft.sources?.[name]?.path_ref;
    if (!ref) throw new Error(`missing canonical source: ${name}`);
    const sourcePath = fs.realpathSync(path.resolve(sourceRoot, ref));
    if (!isInside(sourceRoot, sourcePath)) throw new Error(`canonical source escapes source root: ${name}`);
    verifyCurrentDocument(sourcePath, name);
  }

  const seal = appendSeal(realSealDirectory, draft, {
    expectedPreviousDigest: config.expected_previous_digest,
    sourceRoot,
    transitionTicket: config.transition_ticket ? resolveFrom(configDir, config.transition_ticket) : undefined
  });
  const verified = verifyChain(realSealDirectory, { sourceRoot });
  if (verified.status !== 'PASS' || verified.latest?.seal_digest !== seal.seal_digest || verified.latest_source_status !== 'PASS') throw new Error(`new seal did not pass live verification: ${verified.errors.join('; ')}`);

  let rendered = fs.readFileSync(templatePath, 'utf8');
  const replacements = {
    '{{SNAPSHOT_ID}}': path.basename(finalPath, '.md'),
    '{{SEAL_DIGEST}}': seal.seal_digest,
    '{{FACT_CUTOFF}}': seal.fact_cutoff,
    '{{EVENT_ID}}': seal.event_id
  };
  for (const [token, value] of Object.entries(replacements)) {
    if (!rendered.includes(token)) throw new Error(`snapshot template is missing placeholder: ${token}`);
    rendered = rendered.replaceAll(token, value);
  }
  const finalBytes = Buffer.from(rendered, 'utf8');
  const tempSnapshot = path.join(path.dirname(finalPath), `.${path.basename(finalPath)}.${process.pid}.tmp`);
  fs.mkdirSync(path.dirname(finalPath), { recursive: true });
  const tempFd = fs.openSync(tempSnapshot, 'wx');
  try { fs.writeFileSync(tempFd, finalBytes); fs.fsyncSync(tempFd); } finally { fs.closeSync(tempFd); }
  try {
    if (sha256(fs.readFileSync(manifestPath)) !== ruleManifestDigest) throw new Error('rule manifest drifted while preparing the attachment');
    verifyRuleManifest(workflowRoot, manifestPath);
    const finalVerification = verifyChain(realSealDirectory, { sourceRoot });
    if (finalVerification.status !== 'PASS' || finalVerification.latest?.seal_digest !== seal.seal_digest || finalVerification.latest_source_status !== 'PASS') throw new Error(`facts drifted while rendering the attachment: ${finalVerification.errors.join('; ')}`);
    const receipt = {
      schema_version: 1,
      artifact_status: 'GENERATED_NOT_DELIVERED',
      snapshot_id: path.basename(finalPath, '.md'),
      snapshot_file: path.basename(finalPath),
      snapshot_sha256: sha256(finalBytes),
      seal_digest: seal.seal_digest,
      fact_cutoff: seal.fact_cutoff,
      event_id: seal.event_id,
      rule_manifest_sha256: ruleManifestDigest,
      unicode_inventory: inventory
    };
    if (physicalTarget(finalPath) !== physicalFinalPath || physicalTarget(receiptPath) !== physicalReceiptPath) throw new Error('output path resolution drifted while preparing the attachment');
    atomicWriteExclusive(receiptPath, Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`, 'utf8'));
    if (physicalTarget(finalPath) !== physicalFinalPath) throw new Error('formal output path resolution drifted before finalization');
    fs.linkSync(tempSnapshot, finalPath);
    fs.unlinkSync(tempSnapshot);
    return { final_path: finalPath, receipt_path: receiptPath, receipt, chain_status: finalVerification.status };
  } catch (error) {
    if (fs.existsSync(tempSnapshot)) fs.unlinkSync(tempSnapshot);
    throw error;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  if (process.argv.length !== 3) { console.error('usage: node Prepare-Handoff.mjs <config-json>'); process.exitCode = 2; }
  else {
    try { console.log(JSON.stringify(prepareFormalHandoff(process.argv[2]), null, 2)); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
  }
}
