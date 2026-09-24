// Atomic formal-handoff preparation. It creates a final-* artifact only after every gate passes.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { appendSeal, sealDigest, validateControlPlaneRegistry, verifyChain } from './HandoffSeal.mjs';

export const REQUIRED_RULES = [
  '.github/scripts/HandoffSeal.mjs',
  '.github/scripts/Prepare-Handoff.mjs',
  '.github/scripts/Mark-Handoff-Delivered.mjs',
  '总指挥工作流/第二代总指挥的工作模式/templates/HANDOFF_STATE.schema.json',
  '总指挥工作流/第二代总指挥的工作模式/02-总指挥核心规则.md',
  '总指挥工作流/第二代总指挥的工作模式/04-状态、目标变更与交接规范.md',
  '总指挥工作流/第二代总指挥的工作模式/07-总指挥交接记录模板.md',
  '总指挥工作流/第二代总指挥的工作模式/09-自动化授权与风险分级.md',
  '总指挥工作流/第二代总指挥的工作模式/10-自动状态索引规范.md',
  '总指挥工作流/第二代总指挥的工作模式/总指挥轻量交接启动配置.md'
];
const CONFIG_KEYS = new Set(['seal_directory', 'source_root', 'external_control_plane_root', 'draft_path', 'snapshot_template_path', 'final_output_path', 'receipt_output_path', 'rule_manifest_path', 'expected_previous_digest', 'transition_ticket', 'project_key', 'preflight_only']);
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

function currentBlock(file, label) {
  const content = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  verifyCurrentDocument(file, label);
  const begin = content.indexOf('<!-- CURRENT:BEGIN -->') + '<!-- CURRENT:BEGIN -->'.length;
  const end = content.indexOf('<!-- CURRENT:END -->');
  return content.slice(begin, end);
}

function verifyProjectBinding(sourceRoot, statusIndexPath, draft, projectKey) {
  const block = currentBlock(statusIndexPath, 'status_index');
  if (!/^项目键：[^\r\n]+$/m.test(block)) throw new Error('status_index current block is missing a project key');
  const statusProjectKey = block.match(/^项目键：([^\r\n]+)$/m)?.[1]?.trim();
  if (!projectKey || statusProjectKey !== projectKey) throw new Error(`status_index project key does not match configuration: ${projectKey}`);
  const remoteRef = draft.remote?.default_ref;
  const remoteLine = block.split(/\r?\n/).find(line => line.startsWith('远端目标：'));
  if (!remoteRef || !remoteLine || remoteLine.slice('远端目标：'.length).trim() !== remoteRef) {
    throw new Error(`status_index current block does not bind the handoff to remote target: ${remoteRef}`);
  }
  if (!draft.workspace?.head || !block.includes(draft.workspace.head)) throw new Error('status_index current block does not contain the sealed workspace HEAD');
  const topLevel = spawnSync('git', ['-C', sourceRoot, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' });
  if (topLevel.status !== 0 || fs.realpathSync(topLevel.stdout.trim()) !== fs.realpathSync(sourceRoot)) throw new Error('source_root is not the Git repository root used by the handoff');
}

function verifyRuleManifestBinding(statusIndexPath, manifestDigest) {
  const block = currentBlock(statusIndexPath, 'status_index');
  const match = block.match(/规则清单摘要：([0-9a-f]{64})/i);
  if (!match) throw new Error('status_index current block is missing 规则清单摘要');
  if (match[1].toLowerCase() !== manifestDigest.toLowerCase()) throw new Error(`status_index rule manifest digest mismatch: expected ${manifestDigest}, found ${match[1]}`);
}

function findActiveControlPlaneIndexes(sourceRoot, canonicalStatusIndex, registry = null) {
  const historical = new Set((registry?.legacy_indexes ?? []).filter(item => item?.status === 'HISTORICAL_ONLY').map(item => item.path));
  const found = [];
  const walk = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (entry.isFile() && entry.name === 'AI状态索引.md') {
        const resolved = fs.realpathSync(absolute);
        if (resolved !== canonicalStatusIndex) {
          const content = fs.readFileSync(resolved, 'utf8');
          const relative = path.relative(sourceRoot, resolved).replaceAll('\\', '/');
          if (content.includes('<!-- CURRENT:BEGIN -->') && !historical.has(relative)) found.push(relative);
        }
      }
    }
  };
  walk(sourceRoot);
  return found;
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

function sourceRootFor(source, sourceRoot, externalControlPlaneRoot) {
  if (source?.root_ref === 'external_control_plane') {
    if (!externalControlPlaneRoot) throw new Error('external control-plane source requires external_control_plane_root');
    return externalControlPlaneRoot;
  }
  return sourceRoot;
}

function resolveSource(source, sourceRoot, externalControlPlaneRoot, label) {
  const root = sourceRootFor(source, sourceRoot, externalControlPlaneRoot);
  const resolved = fs.realpathSync(path.resolve(root, source.path_ref));
  if (!isInside(root, resolved)) throw new Error(`${label} escapes its declared source root`);
  return resolved;
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
  for (const key of ['seal_directory', 'source_root', 'draft_path', 'snapshot_template_path', 'final_output_path', 'receipt_output_path', 'rule_manifest_path', 'project_key']) if (typeof config[key] !== 'string' || !config[key]) throw new Error(`missing configuration field: ${key}`);
  if (config.preflight_only !== undefined && typeof config.preflight_only !== 'boolean') throw new Error('preflight_only must be boolean');
  const preflightOnly = config.preflight_only === true;

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const workflowRoot = fs.realpathSync(path.resolve(scriptDir, '..', '..'));
  const sealDirectory = resolveFrom(configDir, config.seal_directory);
  const sourceRoot = fs.realpathSync(resolveFrom(configDir, config.source_root));
  const externalControlPlaneRoot = config.external_control_plane_root ? fs.realpathSync(resolveFrom(configDir, config.external_control_plane_root)) : null;
  const draftPath = resolveFrom(configDir, config.draft_path);
  const templatePath = resolveFrom(configDir, config.snapshot_template_path);
  const finalPath = resolveFrom(configDir, config.final_output_path);
  const receiptPath = resolveFrom(configDir, config.receipt_output_path);
  const manifestPath = resolveFrom(configDir, config.rule_manifest_path);
  if (!/^[a-z0-9][a-z0-9._-]*-commander-handoff-\d{8}-final-\d+\.md$/i.test(path.basename(finalPath))) throw new Error('formal output filename must include project slug, date, final, and an incrementing number');
  if (finalPath === receiptPath) throw new Error('formal output and receipt must use different paths');
  const physicalFinalPath = physicalTarget(finalPath);
  const physicalReceiptPath = physicalTarget(receiptPath);
  if (isInside(workflowRoot, physicalFinalPath) || isInside(workflowRoot, physicalReceiptPath) || isInside(sourceRoot, physicalFinalPath) || isInside(sourceRoot, physicalReceiptPath) || (externalControlPlaneRoot && (isInside(externalControlPlaneRoot, physicalFinalPath) || isInside(externalControlPlaneRoot, physicalReceiptPath)))) throw new Error('formal output and receipt must be stored outside the workflow, source, and external control-plane repositories');
  if (fs.existsSync(finalPath) || fs.existsSync(receiptPath)) throw new Error('formal output or receipt already exists');

  const physicalSealDirectory = physicalTarget(sealDirectory);
  if (!isInside(sourceRoot, physicalSealDirectory)) throw new Error('seal directory must stay inside the source repository');
  if (!preflightOnly) fs.mkdirSync(sealDirectory, { recursive: true });
  const realSealDirectory = preflightOnly ? physicalSealDirectory : fs.realpathSync(sealDirectory);
  if (!isInside(sourceRoot, realSealDirectory)) throw new Error('seal directory must stay inside the source repository');
  const sealRelative = path.relative(sourceRoot, realSealDirectory).replaceAll('\\', '/');
  const ignored = spawnSync('git', ['-C', sourceRoot, 'check-ignore', '-q', '--', sealRelative]);
  if (ignored.status !== 0) throw new Error('seal directory must be excluded by the source repository .gitignore');

  const ruleManifestDigest = sha256(fs.readFileSync(manifestPath));
  verifyRuleManifest(workflowRoot, manifestPath);
  const draft = readJson(draftPath);
  const existingSealState = verifyChain(realSealDirectory, { sourceRoot, externalControlPlaneRoot, verifyLatestSources: false });
  const hasLegacySealRecords = existingSealState.records.some(record => record.schema_version < 3);
  if (draft.handoff_phase === 'CURRENT_MIGRATION' && hasLegacySealRecords) {
    throw new Error('LEGACY_MIGRATION_REQUIRES_EMPTY_V3_DIRECTORY: keep the v1/v2 seal directory read-only and configure a separate empty directory for the first v3 migration seal');
  }
  const allowedPreflightPhase = preflightOnly && draft.handoff_phase === 'CURRENT_MIGRATION';
  if (draft.schema_version !== 3 || (!allowedPreflightPhase && draft.handoff_phase !== 'MATERIAL_PREPARED') || (!allowedPreflightPhase && !['READY', 'READY_WITH_RESTRICTIONS'].includes(draft.switch_status))) throw new Error('formal handoff requires a schema v3 MATERIAL_PREPARED draft in READY or READY_WITH_RESTRICTIONS');
  const sourceRefs = Object.values(draft.sources ?? {}).filter(item => item.root_ref !== 'external_control_plane').map(item => item.path_ref);
  // required_untracked is a protection summary, not a formal source inventory.
  const inventory = unicodeInventory(sourceRoot, sourceRefs);
  for (const name of ['central_work_items', 'current_view', 'status_index']) {
    const source = draft.sources?.[name];
    if (!source) throw new Error(`missing canonical source: ${name}`);
    const sourcePath = resolveSource(source, sourceRoot, externalControlPlaneRoot, name);
    verifyCurrentDocument(sourcePath, name);
  }
  const canonicalStatusIndex = resolveSource(draft.sources.status_index, sourceRoot, externalControlPlaneRoot, 'status_index');
  verifyProjectBinding(sourceRoot, canonicalStatusIndex, draft, config.project_key);
  verifyRuleManifestBinding(canonicalStatusIndex, ruleManifestDigest);
  let registry = null;
  const registryRef = draft.sources?.control_plane_registry?.path_ref;
  if (registryRef) {
    const registryPath = resolveSource(draft.sources.control_plane_registry, sourceRoot, externalControlPlaneRoot, 'control_plane_registry');
    registry = readJson(registryPath);
    const statusRoot = sourceRootFor(draft.sources.status_index, sourceRoot, externalControlPlaneRoot);
    const registryErrors = validateControlPlaneRegistry(registry, statusRoot, draft.sources.status_index.path_ref);
    if (registryErrors.length) throw new Error(`control-plane registry invalid: ${registryErrors.join('; ')}`);
  }
  const duplicateIndexes = findActiveControlPlaneIndexes(sourceRoot, canonicalStatusIndex, registry);
  if (duplicateIndexes.length) throw new Error(`DUPLICATE_CONTROL_PLANE: active AI status indexes outside canonical source: ${duplicateIndexes.join(', ')}`);

  // Validate and render the template before appending an immutable seal. A malformed
  // delivery template must not advance the seal chain without producing an artifact.
  let rendered = fs.readFileSync(templatePath, 'utf8');
  const snapshotId = path.basename(finalPath, '.md');
  const templateTokens = ['{{SNAPSHOT_ID}}', '{{SEAL_DIGEST}}', '{{FACT_CUTOFF}}', '{{EVENT_ID}}'];
  for (const token of templateTokens) if (!rendered.includes(token)) throw new Error(`snapshot template is missing placeholder: ${token}`);

  const sourceDigestErrors = [];
  for (const [name, source] of Object.entries(draft.sources ?? {})) {
    const sourcePath = resolveSource(source, sourceRoot, externalControlPlaneRoot, name);
    if (sha256(fs.readFileSync(sourcePath)) !== source.digest) sourceDigestErrors.push(`${name}: source digest mismatch`);
    if (source.fact_cutoff !== draft.fact_cutoff) sourceDigestErrors.push(`${name}: source fact_cutoff mismatch`);
  }
  if (sourceDigestErrors.length) throw new Error(`preflight source verification failed: ${sourceDigestErrors.join('; ')}`);
  if (preflightOnly) return {
    status: 'READY',
    mode: 'PREFLIGHT_ONLY',
    project_key: config.project_key,
    source_root: sourceRoot,
    external_control_plane_root: externalControlPlaneRoot,
    source_count: Object.keys(draft.sources ?? {}).length,
    workspace_protection: {
      staged_count: draft.workspace?.staged_count ?? null,
      tracked_modified_count: draft.workspace?.tracked_modified_count ?? null,
      untracked_count: draft.workspace?.untracked_count ?? null,
      required_untracked_count: draft.workspace?.required_untracked?.length ?? 0,
      required_untracked_is_inventory: false
    },
    legacy_migration: draft.handoff_phase === 'CURRENT_MIGRATION' ? 'BOUND_TO_LEGACY_SUMMARY' : 'NONE'
  };

  // If a previous attempt appended the immutable seal but failed while writing
  // the external artifact, reuse that exact seal. This makes preparation
  // retryable without advancing the chain or inventing a second event.
  const preAppend = verifyChain(realSealDirectory, { sourceRoot, externalControlPlaneRoot, verifyLatestSources: false });
  let seal;
  const reusable = preAppend.latest && preAppend.latest.event_id === draft.event_id
    && preAppend.latest.generation === draft.generation
    && preAppend.latest.writer_id === draft.writer_id
    && preAppend.latest.handoff_phase === draft.handoff_phase
    && preAppend.latest.seal_digest === (() => {
      const candidate = { ...draft, seal_sequence: preAppend.latest.seal_sequence, previous_seal_digest: preAppend.latest.previous_seal_digest };
      return sealDigest(candidate);
    })();
  if (reusable) {
    seal = preAppend.latest;
  } else {
    seal = appendSeal(realSealDirectory, draft, {
      expectedPreviousDigest: config.expected_previous_digest,
      sourceRoot,
      externalControlPlaneRoot,
      transitionTicket: config.transition_ticket ? resolveFrom(configDir, config.transition_ticket) : undefined
    });
  }
  const verified = verifyChain(realSealDirectory, { sourceRoot, externalControlPlaneRoot });
  if (verified.status !== 'PASS' || !verified.handoff_ready || verified.latest?.seal_digest !== seal.seal_digest || verified.latest_source_status !== 'PASS') throw new Error(`new seal did not pass live verification: ${verified.errors.join('; ')}`);

  const replacements = {
    '{{SNAPSHOT_ID}}': snapshotId,
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
    const finalVerification = verifyChain(realSealDirectory, { sourceRoot, externalControlPlaneRoot });
    if (finalVerification.status !== 'PASS' || !finalVerification.handoff_ready || finalVerification.latest?.seal_digest !== seal.seal_digest || finalVerification.latest_source_status !== 'PASS') throw new Error(`facts drifted while rendering the attachment: ${finalVerification.errors.join('; ')}`);
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
