// Read-only projection checks shared by preparation and receiver adoption.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const assert = (condition, message) => { if (!condition) throw new Error(`receiver readiness: ${message}`); };
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const rootRef = item => item.root_ref ?? 'source_root';
const normalized = ref => ref.replaceAll('\\', '/').replace(/^\.\/+/, '').normalize('NFC');
const inside = (root, file) => {
  const ref = path.relative(root, file);
  return ref !== '..' && !ref.startsWith(`..${path.sep}`) && !path.isAbsolute(ref);
};

export const planSourceName = seal => seal.sources?.task_plan ? 'task_plan' : 'task_contract';

export function isCentralEntryAlias(target, name, seal) {
  const entry = seal.sources?.central_entry, projection = seal.sources?.[target.source_name];
  return name === 'central_entry' && ['central_work_items', 'current_view'].includes(target.kind) &&
    target.source_name === target.kind && entry && projection &&
    rootRef(target) === rootRef(projection) && rootRef(entry) === rootRef(projection) &&
    target.path_ref === projection.path_ref && entry.path_ref === projection.path_ref &&
    entry.digest === projection.digest;
}

export function projectionEvidence(target, seal) {
  const source = seal.sources?.[target.source_name];
  if (source) return { ...source, root_ref: rootRef(source) };
  assert(target.kind === 'progress' && target.source_name === 'progress' &&
    target.path_ref === 'progress.md' && rootRef(target) === 'source_root', 'projection has no sealed source');
  const required = (seal.workspace?.required_untracked ?? []).filter(item =>
    typeof item.path_ref === 'string' && normalized(item.path_ref).toLowerCase() === 'progress.md');
  assert(required.length === 1 && required[0].path_ref === 'progress.md' &&
    rootRef(required[0]) === 'source_root' && /^[a-f0-9]{64}$/i.test(required[0].sha256 ?? ''),
  'adoption progress requires unique protected workspace evidence');
  return { path_ref: 'progress.md', root_ref: 'source_root', digest: required[0].sha256 };
}

export function anchorMatches(text, anchor, line = false) {
  const escaped = anchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [...text.matchAll(new RegExp(line ? `^${escaped}\\r?$` : escaped, line ? 'gm' : 'g'))];
}

export function uniqueProjectionAnchor(text, candidates, label, line = true) {
  const source = text.replace(/<!-- RECEIVER_ADOPTION_[A-Za-z0-9._:-]+:BEGIN -->[\s\S]*?<!-- RECEIVER_ADOPTION_[A-Za-z0-9._:-]+:END -->/g, '');
  for (const candidate of candidates) if (anchorMatches(source, candidate, line).length === 1) return candidate;
  throw new Error(`receiver readiness: cannot derive unique adoption anchor: ${label}`);
}

export function readReceiverProjection(target, seal, options, controlPlan = [], { verifyDigest = true } = {}) {
  const evidence = projectionEvidence(target, seal), ref = evidence.path_ref;
  assert(typeof ref === 'string' && ref && !path.isAbsolute(ref) && !path.win32.isAbsolute(ref) &&
    !ref.split(/[\\/]+/).some(part => part === '..' || part.toLowerCase() === '.git') && !/[\0\r\n:]/.test(ref), 'unsafe projection path');
  assert(['source_root', 'external_control_plane'].includes(rootRef(evidence)), 'invalid projection root');
  assert(rootRef(evidence) === 'source_root' || ['central_work_items', 'current_view'].includes(target.kind),
    'only sealed central projections may use the external root');
  const configuredRoot = rootRef(evidence) === 'source_root' ? options.sourceRoot : options.externalControlPlaneRoot;
  assert(configuredRoot, 'projection root is missing');
  const root = fs.realpathSync(configuredRoot);
  const file = path.resolve(root, ref);
  assert(!fs.lstatSync(file).isSymbolicLink() && inside(root, fs.realpathSync(file)) && fs.statSync(file).isFile(),
    'projection escapes its root or is not a regular file');
  const gitMetadata = path.join(root, '.git');
  assert(!fs.existsSync(gitMetadata) || !inside(fs.realpathSync(gitMetadata), fs.realpathSync(file)),
    'projection aliases Git metadata');
  if (options.sealDirectory && fs.existsSync(options.sealDirectory)) {
    assert(!inside(fs.realpathSync(options.sealDirectory), fs.realpathSync(file)), 'projection aliases immutable seal storage');
  }
  for (const [name, source] of Object.entries(seal.sources ?? {})) {
    if (name === target.source_name || isCentralEntryAlias(target, name, seal)) continue;
    const sourceRoot = rootRef(source) === 'external_control_plane' ? options.externalControlPlaneRoot : options.sourceRoot;
    assert(sourceRoot, 'protected source root is missing');
    assert(fs.realpathSync(path.resolve(sourceRoot, source.path_ref)) !== fs.realpathSync(file),
      `projection aliases protected source: ${name}`);
  }
  let bytes = fs.readFileSync(file);
  const changes = controlPlan.filter(item => rootRef(item) === rootRef(evidence) && item.path_ref === ref);
  assert(changes.length <= 1, 'ambiguous control projection');
  if (changes.length) {
    const change = changes[0];
    assert(hash(bytes) === change.before_sha256, 'control projection before bytes changed');
    bytes = Buffer.from(change.after, 'base64');
    assert(hash(bytes) === change.after_sha256, 'control projection after bytes changed');
  }
  if (verifyDigest) assert(hash(bytes) === evidence.digest, `projection digest mismatch: ${target.kind}`);
  if (target.kind === 'task_plan' || target.kind === 'progress') {
    let json = false;
    try { JSON.parse(bytes.toString('utf8')); json = true; } catch { /* Markdown is expected. */ }
    assert(!json, `${target.kind} must be Markdown; preserve JSON task_contract and seal a separate task_plan`);
  }
  return { evidence, bytes, file };
}

export function receiverProjectionTargets(options, seal, { central = true, controlPlan = [], line = true, verifyDigest = true } = {}) {
  const planName = planSourceName(seal);
  const specs = [
    ['task_plan', planName, seal.sources?.[planName]?.path_ref, ['<a id="current-plan"></a>', '# 总指挥研发计划与续接入口']],
    ['progress', 'progress', seal.sources?.progress?.path_ref ?? 'progress.md', ['# Progress Log']]
  ];
  if (central) for (const name of ['central_work_items', 'current_view']) {
    specs.push([name, name, seal.sources?.[name]?.path_ref, [`当前平台任务：${options.recipient.platformTaskId}`]]);
  }
  return specs.map(([kind, source_name, path_ref, anchors]) => {
    const evidence = projectionEvidence({ kind, source_name, path_ref }, seal);
    const target = { kind, source_name, path_ref, root_ref: rootRef(evidence) };
    const { bytes } = readReceiverProjection(target, seal, options, controlPlan, { verifyDigest });
    const text = bytes.toString('utf8'), marker = `RECEIVER_ADOPTION_${kind.toUpperCase()}`;
    const begin = `<!-- ${marker}:BEGIN -->`, end = `<!-- ${marker}:END -->`;
    if (text.includes(begin) || text.includes(end)) {
      assert(text.split(begin).length === 2 && text.split(end).length === 2 &&
        text.indexOf(begin) < text.indexOf(end), `${kind} adoption markers must be unique and ordered`);
    }
    const { root_ref: ref, ...portable } = target;
    return { ...portable, ...(ref !== 'source_root' ? { root_ref: ref } : {}), expected_sha256: hash(bytes), mode: 'insert_after',
      anchor: uniqueProjectionAnchor(text, anchors, kind, line),
      ...(line ? { anchor_mode: 'line' } : {}),
      marker, allow_tracked: true };
  });
}

export function verifyReceiverReadiness(seal, options) {
  const targets = receiverProjectionTargets(options, seal, { central: false });
  return { status: 'PASS', target_count: targets.length, plan_source: planSourceName(seal) };
}
