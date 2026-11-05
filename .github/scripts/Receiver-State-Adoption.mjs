// Finish the receiver-side part of a completed handoff.
// This is deliberately separate from the authority transaction: the four
// canonical CURRENT files are already settled, while this step creates the
// new receiver record and updates only explicitly listed local projections.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { byteDigest, withControlLock, writeAtomic, writeJournal } from './HandoffControl.mjs';
import { appendSeal, canonicalJson, observeControlIdentity, readChain, verifyChain } from './HandoffSeal.mjs';
import { readGitWorkspaceBaseline, verifyRuleManifest, verifyWorkspaceBaseline } from './Prepare-Handoff.mjs';
import { anchorMatches, isCentralEntryAlias, planSourceName, projectionEvidence, readReceiverProjection, receiverProjectionTargets } from './Receiver-Readiness.mjs';
import { captureTransactionWorkspace, verifyTransactionWorkspace } from './HandoffTransactionWorkspace.mjs';

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const ADOPTION_RECORD_TYPE = 'receiver-state-adoption';
const EVENT_RE = /^[A-Za-z0-9._:-]+$/;
const HEX_RE = /^[0-9a-f]{64}$/i;
const TARGET_KINDS = new Set(['loading_record', 'task_plan', 'progress', 'central_work_items', 'current_view']);
const defaultRules = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../总指挥工作流/第二代总指挥的工作模式');
const rootRef = item => item.root_ref ?? 'source_root';
function targetRoot(item, options) {
  const ref = rootRef(item);
  assert(['source_root', 'external_control_plane'].includes(ref), 'invalid adoption target root');
  assert(ref !== 'external_control_plane' || ['central_work_items', 'current_view'].includes(item.kind), 'only sealed central projections may use the external root');
  const root = ref === 'external_control_plane' ? options.externalControlPlaneRoot : options.sourceRoot;
  assert(root, 'adoption target root is missing');
  return fs.realpathSync(root);
}
const planTarget = (item, options, allowMissing) => resolveTarget(targetRoot(item, options), item.path_ref, { allowMissing });
const projectionPlan = plan => plan.filter(item => item.kind !== 'loading_record')
  .map(item => ({ ...item, root_ref: rootRef(item), names: [item.source_name] }));

function safeRef(value) {
  return typeof value === 'string'
    && value.length > 0
    && !path.isAbsolute(value)
    && !path.win32.isAbsolute(value)
    && !value.split(/[\\/]+/).includes('..')
    && !/[\0\r\n:]/.test(value);
}

function inside(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function physicalTarget(root, ref) {
  assert(safeRef(ref), `unsafe adoption path: ${ref}`);
  let cursor = path.resolve(root, ref);
  const suffix = [];
  while (!fs.existsSync(cursor)) {
    const parent = path.dirname(cursor);
    assert(parent !== cursor, `cannot resolve adoption path: ${ref}`);
    suffix.unshift(path.basename(cursor));
    cursor = parent;
  }
  assert(!fs.lstatSync(cursor).isSymbolicLink(), `adoption parent is a link: ${ref}`);
  return path.join(fs.realpathSync(cursor), ...suffix);
}

function resolveTarget(root, ref, { allowMissing = false } = {}) {
  const target = physicalTarget(root, ref);
  if (fs.existsSync(target)) {
    const stat = fs.lstatSync(target);
    assert(!stat.isSymbolicLink(), `adoption target is a link: ${ref}`);
    assert(stat.isFile(), `adoption target is not a file: ${ref}`);
  } else {
    assert(allowMissing, `adoption target is missing: ${ref}`);
  }
  assert(inside(root, target), `adoption target escapes source root: ${ref}`);
  return target;
}

function gitStatus(root, args) {
  return spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
}

function assertIgnoredPrivateDirectory(root, directory) {
  const relative = path.relative(path.resolve(root), path.resolve(directory)).replaceAll('\\', '/');
  assert(relative && inside(root, directory), 'adoption directory must stay inside source root');
  const ignored = gitStatus(root, ['check-ignore', '--quiet', '--no-index', '--', `${relative}/`]);
  assert(ignored.status === 0, 'adoption directory must be ignored by the source repository');
  const tracked = gitStatus(root, ['ls-files', '--', relative]);
  assert(tracked.status === 0 && !tracked.stdout.trim(), 'adoption directory must remain untracked');
}

function currentBody(file) {
  const text = fs.readFileSync(file, 'utf8');
  const begin = '<!-- CURRENT:BEGIN -->';
  const end = '<!-- CURRENT:END -->';
  const start = text.indexOf(begin);
  const finish = text.indexOf(end);
  assert(start >= 0 && finish > start, `current projection boundaries missing: ${file}`);
  return text.slice(start + begin.length, finish);
}

function checkSourceAlignment(latest, options, names) {
  const errors = [];
  for (const name of names) {
    const source = latest.sources?.[name];
    if (!source) {
      errors.push(`missing adoption assertion source: ${name}`);
      continue;
    }
    try {
      const root = source.root_ref === 'external_control_plane' ? options.externalControlPlaneRoot : options.sourceRoot;
      const file = path.resolve(root, source.path_ref);
      if (!inside(root, file) || byteDigest(fs.readFileSync(file)) !== source.digest) errors.push(`adoption source drift: ${name}`);
    } catch (error) {
      errors.push(`adoption source unreadable: ${name}: ${error.message}`);
    }
  }
  return errors;
}

function targetConfig(options) {
  const adoption = options.adoption;
  assert(adoption && typeof adoption === 'object' && !Array.isArray(adoption), 'adoption configuration is required');
  assert(EVENT_RE.test(adoption.expected_event_id || ''), 'adoption expected_event_id is required');
  assert(HEX_RE.test(adoption.expected_completed_seal_digest || ''), 'adoption expected_completed_seal_digest is required');
  assert(safeRef(adoption.directory), 'adoption directory must be a relative path');
  const loading = adoption.loading_record;
  assert(loading && safeRef(loading.path_ref) && loading.create_if_missing === true, 'adoption loading_record must explicitly allow creation');
  const adoptionDirectory = normalizedRef(adoption.directory);
  const loadingPath = normalizedRef(loading.path_ref);
  assert(loadingPath === adoptionDirectory || loadingPath.startsWith(`${adoptionDirectory}/`), 'adoption loading_record must stay inside the ignored adoption directory');
  const targets = Array.isArray(adoption.targets) ? adoption.targets : [];
  assert(!targets.some(item => item?.kind === 'loading_record'), 'adoption targets may not contain an extra loading_record');
  const all = [{ kind: 'loading_record', ...loading }, ...targets];
  for (const kind of ['task_plan', 'progress', 'central_work_items', 'current_view']) {
    assert(all.filter(item => item.kind === kind).length === 1, `adoption must bind exactly one ${kind}`);
  }
  const seen = new Set();
  for (const item of all) {
    assert(TARGET_KINDS.has(item.kind), `unsupported adoption target kind: ${item.kind}`);
    assert(safeRef(item.path_ref), `unsafe adoption target path: ${item.path_ref}`);
    targetRoot(item, options);
    const key = `${rootRef(item)}:${item.path_ref.normalize('NFC').toLowerCase()}`;
    assert(!seen.has(key), `duplicate adoption target: ${item.path_ref}`);
    seen.add(key);
    if (item.kind !== 'loading_record') {
      assert(typeof item.source_name === 'string' && item.source_name.length > 0, `${item.kind} requires source_name`);
      assert(item.mode === 'insert_after', `${item.kind} requires insert_after mode`);
      assert(typeof item.anchor === 'string' && item.anchor.length > 0, `${item.kind} requires an anchor`);
      assert(item.anchor_mode === undefined || item.anchor_mode === 'line', 'unsupported adoption anchor mode');
      if (item.anchor_mode === 'line') assert(!/[\r\n]/.test(item.anchor), 'line adoption anchor must be a single line');
      assert(typeof item.marker === 'string' && /^[A-Za-z0-9._:-]+$/.test(item.marker), `${item.kind} requires a safe marker`);
    }
    if (item.expected_sha256 !== undefined && item.expected_sha256 !== null) assert(HEX_RE.test(item.expected_sha256), `invalid expected sha256: ${item.path_ref}`);
  }
  return { adoption, all, targets, loading };
}

export function deriveReceiverAdoption(options, latest, controlPlan = []) {
  const sourceRoot = fs.realpathSync(options.sourceRoot);
  const configuredRoot = options.receiverStateRoot
    || (options.receiverConfigPath ? path.dirname(path.resolve(options.receiverConfigPath)) : path.join(sourceRoot, '.codex-private', 'receiver-state-adoption'));
  // A new event never reuses the preceding receiver's committed journal.
  const directory = path.resolve(configuredRoot, `event-${latest.seal_digest}`);
  assert(inside(sourceRoot, directory), 'receiver adoption directory must stay inside source root');
  const directoryRef = path.relative(sourceRoot, directory).replaceAll('\\', '/');
  assert(safeRef(directoryRef), 'receiver adoption directory must be a safe relative path');
  const loadingPath = path.join(directory, 'loading-record.json');
  const loadingRef = path.relative(sourceRoot, loadingPath).replaceAll('\\', '/');
  const journalFile = path.join(directory, 'receiver-state-adoption.json');
  const existingJournal = fs.existsSync(journalFile) ? readJournal(journalFile) : null;
  const lineAnchors = !existingJournal || existingJournal.protocol_version >= 3;
  const priorPlan = new Map((existingJournal?.event_id === latest.event_id ? existingJournal.plan ?? [] : [])
    .filter(item => item?.kind && typeof item.path_ref === 'string')
    .map(item => [`${item.kind}:${item.path_ref}`, item]));
  const targets = receiverProjectionTargets(options, latest, { controlPlan, line: lineAnchors, verifyDigest: !existingJournal });
  for (const target of targets) {
    const prior = priorPlan.get(`${target.kind}:${target.path_ref}`);
    if (prior) target.expected_sha256 = prior.before_sha256;
  }
  return {
    directory: directoryRef,
    expected_event_id: latest.event_id,
    expected_completed_seal_digest: latest.seal_digest,
    assert_sources: defaultAssertionSources(latest),
    loading_record: { path_ref: loadingRef, create_if_missing: true }, targets
  };
}

function normalizedRef(value) {
  return value.replaceAll('\\', '/').replace(/^\.\/+/, '').normalize('NFC');
}

function defaultAssertionSources(latest) {
  return ['status_index', 'central_work_items', 'current_view', 'task_contract', 'task_plan', 'progress']
    .filter(name => !['progress', 'task_plan', 'task_contract'].includes(name) || latest.sources?.[name]);
}

function currentAdoptionRules(options, baseline, adoptedAt) {
  const workflowRoot = options.workflowRoot || defaultRules;
  const manifestPath = options.manifestPath || path.join(workflowRoot, '规则刷新manifest.json');
  const manifest = verifyRuleManifest(workflowRoot, manifestPath);
  const current = { rule_version: manifest.rule_version, manifest_sha256: byteDigest(fs.readFileSync(manifestPath)) };
  const changed = current.rule_version !== baseline.rule_baseline.rule_version ||
    current.manifest_sha256 !== baseline.rule_baseline.manifest_sha256;
  const loading = options.adoption.rule_loading;
  if (!changed && loading === undefined) return { rule_baseline: baseline.rule_baseline };
  assert(loading && loading.status === 'INDEPENDENTLY_LOADED' &&
    options.recipient.writerId === baseline.writer_id &&
    loading.project_key === options.recipient.projectKey && loading.writer_id === baseline.writer_id &&
    loading.platform_task_id === options.recipient.platformTaskId &&
    loading.event_id === baseline.event_id && loading.completed_seal_digest === baseline.seal_digest &&
    loading.rule_version === current.rule_version && loading.manifest_sha256 === current.manifest_sha256 &&
    Number.isFinite(Date.parse(loading.loaded_at)) &&
    Date.parse(loading.loaded_at) >= Date.parse(baseline.sealed_at) &&
    Date.parse(loading.loaded_at) <= Date.parse(adoptedAt),
  'adoption requires independent current rule loading bound to this receiver');
  return { rule_baseline: changed ? { ...current, mode: 'LIVE', source_role: 'PROJECT_ADOPTION_RECORD',
    compatibility: 'AFFECTED_RECHECK', action: 'CONTINUE' } : baseline.rule_baseline,
  authority_rule_baseline: baseline.rule_baseline, rule_loading: structuredClone(loading) };
}

function progressEvidence(baseline) {
  return projectionEvidence({ kind: 'progress', source_name: 'progress', path_ref: 'progress.md' }, baseline);
}

function assertRecordRules(record, baseline, options) {
  const expected = currentAdoptionRules(options, baseline, record.adopted_at);
  for (const field of ['rule_baseline', 'authority_rule_baseline', 'rule_loading']) {
    assert(canonicalJson(record[field] ?? null) === canonicalJson(expected[field] ?? null),
      'adoption journal current rule loading or baseline changed');
  }
}

function assertProjectionBinding(target, latest, options, config) {
  const expected = {
    task_plan: {
      sourceName: planSourceName(latest),
      pathRef: latest.sources?.[planSourceName(latest)]?.path_ref
    },
    progress: {
      sourceName: 'progress',
      pathRef: progressEvidence(latest).path_ref
    },
    central_work_items: {
      sourceName: 'central_work_items',
      pathRef: latest.sources?.central_work_items?.path_ref
    },
    current_view: {
      sourceName: 'current_view',
      pathRef: latest.sources?.current_view?.path_ref
    }
  }[target.kind];
  assert(expected?.pathRef, `adoption ${target.kind} has no sealed projection path`);
  assert(target.source_name === expected.sourceName, `adoption ${target.kind} source binding must be ${expected.sourceName}`);
  assert(normalizedRef(target.path_ref) === normalizedRef(expected.pathRef), `adoption ${target.kind} path is not the sealed projection: ${target.path_ref}`);
  assert(target.path_ref === expected.pathRef, `adoption ${target.kind} path spelling must match the sealed projection`);
  assert(rootRef(target) === (latest.sources?.[expected.sourceName]?.root_ref ?? 'source_root'), 'adoption projection root differs from sealed source');
  projectionEvidence(target, latest);
  assert(target.allow_tracked === true, `adoption ${target.kind} requires explicit tracked projection permission`);
  return expected;
}

function assertTargetNotControlFile(targetConfig, latest, options, sealDirectory) {
  const { path_ref: ref, kind, source_name: sourceName } = targetConfig;
  const normalized = normalizedRef(ref).toLowerCase();
  assert(normalized !== '.git' && !normalized.startsWith('.git/'), `adoption target cannot be inside the Git metadata directory: ${ref}`);
  const target = planTarget(targetConfig, options, true);
  const gitMetadata = path.join(targetRoot(targetConfig, options), '.git');
  assert(!fs.existsSync(gitMetadata) || !inside(fs.realpathSync(gitMetadata), target), `adoption target aliases Git metadata: ${ref}`);
  const seal = fs.realpathSync(sealDirectory);
  assert(!inside(seal, target), `adoption target cannot be inside the seal directory: ${ref}`);
  for (const [name, source] of Object.entries(latest.sources ?? {})) {
    const root = source.root_ref === 'external_control_plane' ? options.externalControlPlaneRoot : options.sourceRoot;
    if (root && fs.existsSync(root)) {
      const sourcePath = path.resolve(root, source.path_ref);
      if (fs.existsSync(sourcePath) && fs.realpathSync(sourcePath) === target) {
        const allowedProjection = ['task_plan', 'progress', 'central_work_items', 'current_view'].includes(kind)
          && (sourceName === name || isCentralEntryAlias(targetConfig, name, latest))
          && ['task_contract', 'task_plan', 'progress', 'central_work_items', 'current_view', 'central_entry'].includes(name);
        if (!allowedProjection) throw new Error(`adoption target aliases a protected source: ${ref}`);
      }
    }
  }
  if (!['task_plan', 'progress', 'central_work_items', 'current_view', 'loading_record'].includes(kind)) {
    throw new Error(`unsupported adoption target kind: ${kind}`);
  }
  if (rootRef(targetConfig) === 'external_control_plane') return target;
  const tracked = gitStatus(options.sourceRoot, ['ls-files', '--', ref]);
  if (tracked.status === 0 && tracked.stdout.trim()) {
    assert(targetConfig.allow_tracked === true && kind !== 'loading_record', `adoption tracked target requires explicit projection permission: ${ref}`);
  } else {
    assert(tracked.status === 0, `cannot inspect adoption target tracking state: ${ref}`);
  }
  return target;
}

function blockFor(record, marker) {
  const begin = `<!-- ${marker}:BEGIN -->`;
  const end = `<!-- ${marker}:END -->`;
  const restrictions = record.restrictions?.length ? record.restrictions.join('、') : '无';
  return [
    begin,
    '### 接收方当前采用记录（机器生成）',
    `- 当前总指挥：世代${record.generation}；写者 ${record.writer_id}`,
    `- 当前平台任务：${record.platform_task_id}`,
    `- 规则版本：${record.rule_baseline.rule_version}；规则清单摘要：${record.rule_baseline.manifest_sha256}`,
    `- 接收方加载记录：${record.receiver_loading_record}`,
    `- 完成交接事件：${record.event_id}`,
    '- 协调权：ACTIVE；中央计划、进度、队列和收报沿当前项目范围继续',
    '- 产品修改、Goal、自动化、远端写入和发布仍需分别核权',
    `- 业务依赖限制：${restrictions}`,
    end
  ].join('\n');
}

function renderManagedTarget(before, target, block) {
  const begin = `<!-- ${target.marker}:BEGIN -->`;
  const end = `<!-- ${target.marker}:END -->`;
  const beginCount = before.split(begin).length - 1;
  const endCount = before.split(end).length - 1;
  if (beginCount || endCount) {
    assert(beginCount === 1 && endCount === 1, `${target.kind} adoption markers must be unique`);
    const start = before.indexOf(begin);
    const finish = before.indexOf(end) + end.length;
    assert(finish > start, `${target.kind} adoption marker order is invalid`);
    return `${before.slice(0, start)}${block}${before.slice(finish)}`;
  }
  const matches = anchorMatches(before, target.anchor, target.anchor_mode === 'line');
  assert(matches.length === 1, `${target.kind} adoption anchor must appear exactly once`);
  const at = matches[0].index + matches[0][0].length;
  const prefix = before.slice(0, at);
  const suffix = before.slice(at);
  return `${prefix}${prefix.endsWith('\n') ? '' : '\n'}\n${block}\n${suffix}`;
}

function loadingRecordFor(latest, options, record, pathRef) {
  return {
    record_type: 'commander_loading_record',
    schema_version: 1,
    project_key: options.recipient.projectKey,
    generation: latest.generation,
    writer_id: latest.writer_id,
    platform_task_id: options.recipient.platformTaskId,
    loaded_at: record.adopted_at,
    rule_version: record.rule_baseline.rule_version,
    manifest_sha256: record.rule_baseline.manifest_sha256,
    ...(record.authority_rule_baseline ? { authority_rule_baseline: record.authority_rule_baseline,
      rule_loading: record.rule_loading } : {}),
    source: 'RECEIVER_STATE_ADOPTION',
    status: 'ADOPTED',
    event_id: options.adoption.expected_event_id,
    completed_seal_digest: options.adoption.expected_completed_seal_digest,
    receiver_loading_record: pathRef,
    objective: latest.objective,
    restrictions: latest.restrictions ?? [],
    permissions: {
      coordination: 'ALLOWED',
      product_write: 'SEPARATE_AUTH_REQUIRED',
      goal: 'SEPARATE_GATE',
      automation: 'SEPARATE_GATE',
      remote: 'SEPARATE_AUTH_REQUIRED',
      publish: 'SEPARATE_AUTH_REQUIRED'
    },
    source_pointers: Object.fromEntries(Object.entries(latest.sources ?? {}).map(([name, source]) => [name, { root_ref: source.root_ref ?? 'source_root', path_ref: source.path_ref, digest: source.digest }])),
    note: '本记录由接收方在已完成控制面交接后独立建立，不继承来源窗口的已读或授权。'
  };
}

function targetPlan(latest, options, config, record, controlPlan = []) {
  const plan = [];
  const refs = config.all.map(item => item.path_ref);
  for (const target of config.all) {
    if (target.kind !== 'loading_record') assertProjectionBinding(target, latest, options, config);
    const file = assertTargetNotControlFile(target, latest, options, options.sealDirectory);
    const exists = fs.existsSync(file);
    const before = exists ? (target.kind !== 'loading_record'
      ? readReceiverProjection(target, latest, options, controlPlan).bytes : fs.readFileSync(file)) : null;
    if (target.expected_sha256 !== undefined && target.expected_sha256 !== null) {
      assert(exists && byteDigest(before) === target.expected_sha256, `adoption target baseline drift: ${target.path_ref}`);
    } else assert(!exists, `adoption target without expected sha must be absent: ${target.path_ref}`);
    let after;
    if (target.kind === 'loading_record') {
      const recordBytes = Buffer.from(`${JSON.stringify(loadingRecordFor(latest, options, record, target.path_ref), null, 2)}\n`);
      after = recordBytes;
    } else {
      assert(exists, `adoption projection target is missing: ${target.path_ref}`);
      const current = before.toString('utf8');
      after = Buffer.from(renderManagedTarget(current, target, blockFor(record, target.marker)));
    }
    plan.push({
      kind: target.kind,
      path_ref: target.path_ref,
      ...(rootRef(target) !== 'source_root' ? { root_ref: rootRef(target) } : {}),
      before_sha256: before ? byteDigest(before) : null,
      after_sha256: byteDigest(after),
      before: before ? before.toString('base64') : null,
      after: after.toString('base64'),
      source_name: target.source_name ?? null,
      created: !exists
    });
  }
  assert(new Set(config.all.map(item => `${rootRef(item)}:${normalizedRef(item.path_ref)}`)).size === refs.length, 'adoption target set must be unique');
  return plan;
}

// Validate the future receiver projection without creating adoption state.
export function preflightReceiverAdoption(options, completed, controlPlan) {
  const adoption = options.adoption || deriveReceiverAdoption(options, completed, controlPlan);
  const effective = { ...options, adoption };
  const config = targetConfig(effective);
  const names = adoption.assert_sources ?? defaultAssertionSources(completed);
  assert(Array.isArray(names) && names.every(name => completed.sources?.[name]), 'missing adoption assertion source');
  const directory = physicalTarget(options.sourceRoot, adoption.directory);
  assertIgnoredPrivateDirectory(options.sourceRoot, directory);
  const record = { generation: completed.generation, writer_id: completed.writer_id,
    platform_task_id: options.recipient.platformTaskId, event_id: completed.event_id,
    rule_baseline: completed.rule_baseline, adopted_at: new Date().toISOString(),
    receiver_loading_record: config.loading.path_ref, restrictions: completed.restrictions ?? [] };
  // All binding, alias, path, expected-byte and render checks used by adoption.
  targetPlan(completed, effective, config, record, controlPlan);
  for (const target of config.targets) readReceiverProjection(target, completed, effective, controlPlan);
  return { status: 'PASS', target_count: config.all.length, writes: 0 };
}

function strictBase64(value, label) {
  assert(typeof value === 'string' && value.length > 0 && /^[A-Za-z0-9+/]*={0,2}$/.test(value) && value.length % 4 === 0, `invalid adoption ${label} bytes`);
  const bytes = Buffer.from(value, 'base64');
  assert(bytes.toString('base64') === value, `invalid adoption ${label} encoding`);
  return bytes;
}

function validateAdoptionPlan(plan, latest, options, config, record, baseline = latest) {
  assert(Array.isArray(plan) && plan.length === config.all.length, 'adoption journal plan does not match the configured target count');
  const targets = new Map(config.all.map(item => [`${item.kind}:${normalizedRef(item.path_ref)}`, item]));
  const seen = new Set();
  for (const item of plan) {
    assert(item && typeof item === 'object' && typeof item.kind === 'string' && typeof item.path_ref === 'string', 'adoption journal plan item is malformed');
    const key = `${item.kind}:${normalizedRef(item.path_ref)}`;
    const target = targets.get(key);
    assert(target && !seen.has(key), `adoption journal plan target is not bound to the current configuration: ${item.path_ref}`);
    seen.add(key);
    assert(rootRef(item) === rootRef(target), 'adoption journal root binding changed');
    if (target.kind !== 'loading_record') assertProjectionBinding(target, latest, options, config);
    assertTargetNotControlFile(target, latest, options, options.sealDirectory);
    const before = item.before === null ? null : strictBase64(item.before, `before:${item.path_ref}`);
    const after = strictBase64(item.after, `after:${item.path_ref}`);
    assert(item.before_sha256 === (before ? byteDigest(before) : null), `adoption journal before digest mismatch: ${item.path_ref}`);
    assert(item.after_sha256 === byteDigest(after), `adoption journal after digest mismatch: ${item.path_ref}`);
    assert(Boolean(item.created) === (before === null), `adoption journal created flag mismatch: ${item.path_ref}`);
    assert(item.before_sha256 === (target.expected_sha256 ?? null), `adoption journal baseline is not the configured baseline: ${item.path_ref}`);
    if (target.kind !== 'loading_record') assert(item.before_sha256 === projectionEvidence(target, baseline).digest, 'adoption journal before bytes differ from the completed seal');
    const expectedAfter = target.kind === 'loading_record'
      ? Buffer.from(`${JSON.stringify(loadingRecordFor(baseline, options, record, target.path_ref), null, 2)}\n`)
      : Buffer.from(renderManagedTarget(before.toString('utf8'), target, blockFor(record, target.marker)));
    assert(after.equals(expectedAfter), `adoption journal target bytes are not derived from the current configuration: ${item.path_ref}`);
    const file = planTarget(item, options, Boolean(item.created));
    const actual = fs.existsSync(file) ? byteDigest(fs.readFileSync(file)) : null;
    assert(actual === item.before_sha256 || actual === item.after_sha256, `adoption target changed outside its transaction: ${item.path_ref}`);
  }
  assert(seen.size === targets.size, 'adoption journal plan is missing a configured target');
  return plan;
}

function assertPlanState(plan, options) {
  for (const item of plan) {
    const file = planTarget(item, options, item.created);
    const actual = fs.existsSync(file) ? byteDigest(fs.readFileSync(file)) : null;
    assert(actual === item.before_sha256 || actual === item.after_sha256, `adoption target changed outside its transaction: ${item.path_ref}`);
  }
}

function writePlan(plan, options, fault) {
  for (let index = 0; index < plan.length; index++) {
    const item = plan[index];
    const file = planTarget(item, options, item.created);
    const actual = fs.existsSync(file) ? byteDigest(fs.readFileSync(file)) : null;
    if (actual === item.before_sha256) {
      writeAtomic(file, Buffer.from(item.after, 'base64'));
    } else assert(actual === item.after_sha256, `adoption target CAS conflict: ${item.path_ref}`);
    fault?.(`after-adoption-write-${index}`);
  }
}

function rollbackPlan(plan, options) {
  for (const item of [...plan].reverse()) {
    const file = planTarget(item, options, true);
    const actual = fs.existsSync(file) ? byteDigest(fs.readFileSync(file)) : null;
    if (actual !== item.after_sha256) {
      if (actual === item.before_sha256) continue;
      throw new Error(`adoption rollback blocked by third bytes: ${item.path_ref}`);
    }
    if (item.before === null) fs.unlinkSync(file);
    else writeAtomic(file, Buffer.from(item.before, 'base64'));
  }
}

function updateWorkspace(latest, plan, options) {
  const required = [...(latest.workspace.required_untracked ?? [])].map(item => ({ ...item }));
  for (const item of plan) {
    if (rootRef(item) !== 'source_root') continue;
    const existing = required.find(entry => entry.path_ref === item.path_ref);
    if (existing) existing.sha256 = item.after_sha256;
    else required.push({ path_ref: item.path_ref, sha256: item.after_sha256, reason: 'Receiver adoption state' });
  }
  required.sort((a, b) => a.path_ref.localeCompare(b.path_ref));
  const baseline = readGitWorkspaceBaseline(options.sourceRoot, required.map(item => item.path_ref), latest.workspace.inflight_scope ?? null);
  return { root_ref: latest.workspace.root_ref, ...baseline, required_untracked: required };
}

function attestationDraft(latest, plan, options, record) {
  const now = record.adopted_at;
  const draft = structuredClone(latest);
  draft.schema_version = 4;
  draft.handoff_phase = 'CURRENT_ATTESTATION';
  draft.switch_status = 'COMPLETED';
  draft.event_id = `${options.adoption.expected_event_id}:receiver-adoption`;
  draft.fact_cutoff = now;
  draft.sealed_at = now;
  draft.transition = null;
  draft.migration = null;
  delete draft.authority_recovery;
  draft.seal_digest = '';
  draft.communications = { status: 'NONE' };
  draft.runtime_acceptance_status = 'NOT_RUN';
  draft.professional_acceptance_status = 'NOT_RUN';
  draft.control_handoff_confidence = 'HIGH';
  draft.rule_baseline = structuredClone(record.rule_baseline);
  for (const item of plan) {
    const names = Object.keys(draft.sources).filter(name => item.source_name &&
      (name === item.source_name || isCentralEntryAlias(item, name, draft)));
    for (const name of names) {
      draft.sources[name] = {
        ...draft.sources[name],
        digest: item.after_sha256,
        fact_cutoff: now
      };
    }
  }
  draft.workspace = updateWorkspace(latest, plan, options);
  return draft;
}

function adoptionResult(record, attestedSealDigest, plan) {
  const restrictions = record.restrictions ?? [];
  return {
    status: 'COMPLETED',
    coordination_status: 'ACTIVE',
    coordination_scope: 'FULL_CENTRAL_COORDINATION',
    receiver_loading_record: 'CREATED',
    task_plan_alignment: 'PASS',
    progress_alignment: 'PASS',
    central_sources_alignment: 'PASS',
    product_write: 'SEPARATE_AUTH_REQUIRED',
    goal: 'SEPARATE_GATE',
    automation: 'SEPARATE_GATE',
    remote: 'SEPARATE_AUTH_REQUIRED',
    publish: 'SEPARATE_AUTH_REQUIRED',
    business_dependency_restrictions: restrictions,
    restrictions,
    adopted_seal_digest: attestedSealDigest,
    target_count: plan.length,
    writes: plan.length + 1
  };
}

function journalPath(directory) {
  return path.join(directory, 'receiver-state-adoption.json');
}

function lockPath(directory) {
  return path.join(directory, '.receiver-state-adoption.lock');
}

function readJournal(file) {
  if (!fs.existsSync(file)) return null;
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert(value.record_type === ADOPTION_RECORD_TYPE && ['PREPARED', 'TARGETS_WRITTEN', 'ATTESTATION_PENDING', 'COMMITTED', 'ROLLBACK_BLOCKED'].includes(value.status), 'invalid adoption journal');
  assert([1, 2, 3].includes(value.protocol_version), 'unsupported adoption journal protocol');
  assert(value.protocol_version === 3 || (!value.record?.authority_rule_baseline && !value.record?.rule_loading),
    'legacy adoption journal cannot certify independent current rule loading');
  return value;
}

function withAdoptionLock(directory, run) {
  fs.mkdirSync(directory, { recursive: true });
  const lock = lockPath(directory);
  const fd = fs.openSync(lock, 'wx');
  try { fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, created_at: new Date().toISOString() })); return run(); }
  finally { fs.closeSync(fd); if (fs.existsSync(lock)) fs.unlinkSync(lock); }
}

function verifyCommittedJournal(journal, options) {
  const config = targetConfig(options);
  assert(journal.status === 'COMMITTED', 'adoption journal is not committed');
  assert(journal.event_id === options.adoption.expected_event_id, 'adoption journal event mismatch');
  assert(journal.target_config_digest === byteDigest(Buffer.from(canonicalJson(config.all))), 'adoption target configuration changed');
  const history = readChain(options.sealDirectory);
  assert(!history.errors.length && history.records.some(record => record.seal_digest === journal.attested_seal_digest && record.event_id === journal.attestation_event_id), 'committed adoption attestation is missing from the seal chain');
  assert(history.records.at(-1)?.seal_digest === journal.attested_seal_digest, 'committed adoption is no longer the current seal');
  const latest = history.records.at(-1);
  const baseline = latest.handoff_phase === 'CURRENT_ATTESTATION' ? history.records.at(-2) : latest;
  assert(baseline, 'committed adoption baseline is missing');
  assert(baseline.seal_digest === options.adoption.expected_completed_seal_digest && baseline.event_id === options.adoption.expected_event_id, 'committed adoption predecessor mismatch');
  assert(journal.record?.project_key === options.recipient.projectKey &&
    journal.record?.writer_id === options.recipient.writerId &&
    journal.record?.event_id === baseline.event_id &&
    journal.record?.receiver_loading_record === config.loading.path_ref &&
    canonicalJson(journal.record?.restrictions) === canonicalJson(baseline.restrictions ?? []),
  'committed adoption record identity or restrictions changed');
  assertRecordRules(journal.record, baseline, options);
  assert(canonicalJson(latest.rule_baseline) === canonicalJson(journal.record.rule_baseline), 'adoption attestation rule baseline differs from its frozen record');
  const sourceErrors = checkSourceAlignment(latest, options, config.adoption.assert_sources ?? defaultAssertionSources(latest));
  assert(!sourceErrors.length, sourceErrors.join('; '));
  validateAdoptionPlan(journal.plan, latest, options, config, journal.record, baseline);
  assert(journal.completed_seal_digest === options.adoption.expected_completed_seal_digest
    && journal.record?.generation === latest.generation
    && journal.record?.writer_id === latest.writer_id
    && journal.record?.platform_task_id === options.recipient.platformTaskId,
  'committed adoption identity does not match the current receiver');
  for (const item of journal.plan) {
    const file = planTarget(item, options, false);
    assert(byteDigest(fs.readFileSync(file)) === item.after_sha256, `committed adoption target drift: ${item.path_ref}`);
  }
  return adoptionResult(journal.record, journal.attested_seal_digest, journal.plan);
}

function verifyFrozenAttestation(journal, baseline, options, config, record) {
  const history = readChain(options.sealDirectory);
  assert(!history.errors.length, 'adoption pending attestation history is invalid');
  const appended = history.records.find(item => item.event_id === journal.attestation_event_id);
  assert(appended && history.records.at(-1)?.seal_digest === appended.seal_digest &&
    appended.previous_seal_digest === baseline.seal_digest, 'adoption pending attestation is not the current direct successor');
  assertRecordRules(record, baseline, options);
  validateAdoptionPlan(journal.plan, appended, options, config, record, baseline);
  verifyTransactionWorkspace({ plan: projectionPlan(journal.plan), workspace_projection: journal.workspace_projection },
    baseline, { ...options, workspaceAmendment: undefined });
  for (const item of journal.plan) {
    assert(byteDigest(fs.readFileSync(planTarget(item, options, false))) === item.after_sha256,
      'adoption pending attestation target is not fully written');
  }
  const expected = attestationDraft(baseline, journal.plan, options, record);
  assert(journal.attestation_draft_digest === byteDigest(Buffer.from(canonicalJson(expected))), 'adoption pending attestation draft changed');
  Object.assign(expected, { seal_sequence: appended.seal_sequence, previous_seal_digest: baseline.seal_digest, seal_digest: appended.seal_digest });
  assert(canonicalJson(expected) === canonicalJson(appended), 'adoption pending attestation differs from immutable history');
  const chain = verifyChain(options.sealDirectory, options);
  assert(chain.status === 'PASS' && chain.control_status === 'READY', 'adoption pending attestation is not currently ready');
  return appended;
}

export function readCommittedReceiverAdoption(options) {
  const config = targetConfig(options);
  const sourceRoot = fs.realpathSync(options.sourceRoot);
  options = { ...options, sourceRoot };
  const directory = physicalTarget(sourceRoot, config.adoption.directory);
  assertIgnoredPrivateDirectory(sourceRoot, directory);
  const journalFile = journalPath(directory);
  const journal = readJournal(journalFile);
  assert(journal, 'POST_COMMIT_READBACK_BLOCKED: receiver adoption journal is missing');
  if (journal.status === 'ATTESTATION_PENDING') {
    throw Object.assign(new Error('ADOPTION_JOURNAL_PENDING: verify the frozen attestation before repairing its journal'), { code: 'ADOPTION_JOURNAL_PENDING' });
  }
  const result = verifyCommittedJournal(journal, options);
  return { ...result, writes: 0, readback: true };
}

export function adoptReceiverState(options) {
  const config = targetConfig(options);
  const sourceRoot = fs.realpathSync(options.sourceRoot);
  options = { ...options, sourceRoot };
  const directory = physicalTarget(sourceRoot, config.adoption.directory);
  assertIgnoredPrivateDirectory(sourceRoot, directory);
  fs.mkdirSync(directory, { recursive: true });
  const journalFile = journalPath(directory);
  const initialHistory = readChain(options.sealDirectory);
  assert(!initialHistory.errors.length && initialHistory.records.length, `adoption seal history invalid: ${initialHistory.errors.join('; ')}`);
  return withControlLock(initialHistory.records.at(-1), options, () => withAdoptionLock(directory, () => {
    const existing = readJournal(journalFile);
    if (existing?.status === 'COMMITTED') return { ...verifyCommittedJournal(existing, options), writes: 0 };
    if (existing?.status === 'ROLLBACK_BLOCKED') throw new Error('ADOPTION_ROLLBACK_BLOCKED: inspect the adoption journal before retrying');
    const history = readChain(options.sealDirectory);
    assert(!history.errors.length && history.records.length, `adoption seal history invalid: ${history.errors.join('; ')}`);
    const latest = history.records.at(-1);
    const baseline = history.records.find(item => item.seal_digest === config.adoption.expected_completed_seal_digest);
    assert(baseline && baseline.event_id === config.adoption.expected_event_id &&
      ['TAKEOVER_COMPLETED', 'AUTHORITY_RECOVERY_COMPLETED'].includes(baseline.handoff_phase) &&
      baseline.switch_status === 'COMPLETED', 'adoption completed baseline is missing');
    assert(latest.seal_digest === baseline.seal_digest ||
      (latest.handoff_phase === 'CURRENT_ATTESTATION' && latest.event_id === `${baseline.event_id}:receiver-adoption` &&
       latest.previous_seal_digest === baseline.seal_digest), 'adoption cannot replay a historical receiver over newer authority');
    const identity = observeControlIdentity(latest, options);
    assert(identity.status === 'PASS' && identity.identity.writer_id === options.recipient.writerId &&
      identity.identity.platform_task_id === options.recipient.platformTaskId &&
      identity.identity.generation === baseline.generation, 'adoption receiver identity does not match the current authority');
    if (!existing) {
      assert(latest.seal_digest === config.adoption.expected_completed_seal_digest, 'ADOPTION_COMPLETED_SEAL_MISMATCH: receiver must use the exact completed handoff');
      assert(latest.event_id === config.adoption.expected_event_id, 'ADOPTION_EVENT_MISMATCH: completed handoff event differs');
      assert(['TAKEOVER_COMPLETED', 'AUTHORITY_RECOVERY_COMPLETED'].includes(latest.handoff_phase) && latest.switch_status === 'COMPLETED', 'ADOPTION_COMPLETION_REQUIRED: no completed handoff');
      const identity = observeControlIdentity(latest, options);
      assert(identity.status === 'PASS' && identity.identity.writer_id === options.recipient.writerId && identity.identity.platform_task_id === options.recipient.platformTaskId, `ADOPTION_IDENTITY_BLOCKED: ${identity.errors.join('; ')}`);
      const chain = verifyChain(options.sealDirectory, options);
      assert(chain.status === 'PASS' && chain.control_status === 'READY', `ADOPTION_CHAIN_BLOCKED: ${chain.errors.join('; ')}`);
      const sourceErrors = checkSourceAlignment(latest, options, config.adoption.assert_sources ?? defaultAssertionSources(latest));
      assert(!sourceErrors.length, sourceErrors.join('; '));
    } else {
      assert(existing.event_id === config.adoption.expected_event_id && existing.completed_seal_digest === config.adoption.expected_completed_seal_digest, 'adoption journal binding changed');
      assert(existing.target_config_digest === byteDigest(Buffer.from(canonicalJson(config.all))), 'adoption journal target configuration changed');
    }
    if (!existing) {
      const workspaceErrors = verifyWorkspaceBaseline(sourceRoot, baseline.workspace, baseline.sources, {
        externalControlPlaneRoot: options.externalControlPlaneRoot
      });
      assert(!workspaceErrors.length, `adoption workspace drift: ${workspaceErrors.join('; ')}`);
    }
    const adoptedAt = existing?.adopted_at || new Date().toISOString();
    const record = existing?.record || {
      project_key: options.recipient.projectKey,
      generation: latest.generation,
      writer_id: latest.writer_id,
      platform_task_id: options.recipient.platformTaskId,
      ...currentAdoptionRules(options, baseline, adoptedAt),
      event_id: config.adoption.expected_event_id,
      adopted_at: adoptedAt,
      receiver_loading_record: config.loading.path_ref,
      restrictions: latest.restrictions ?? []
    };
    assert(record.project_key === options.recipient.projectKey && record.generation === baseline.generation &&
      record.writer_id === baseline.writer_id && record.platform_task_id === options.recipient.platformTaskId &&
      record.event_id === baseline.event_id && record.receiver_loading_record === config.loading.path_ref &&
      canonicalJson(record.restrictions) === canonicalJson(baseline.restrictions ?? []) &&
      record.adopted_at === adoptedAt, 'adoption journal record identity or baseline changed');
    assertRecordRules(record, baseline, options);
    const plan = existing?.plan || targetPlan(baseline, options, config, record);
    validateAdoptionPlan(plan, baseline, options, config, record, baseline);
    // The completed seal already includes the transfer amendment; adoption starts from that new baseline.
    const adoptionWorkspaceOptions = { ...options, workspaceAmendment: undefined };
    if (existing) {
      assert(existing.workspace_projection?.version === 2, 'ADOPTION_RECOVERY_PROOF_REQUIRED: pending legacy adoption has no frozen workspace proof');
      verifyTransactionWorkspace({ plan: projectionPlan(plan), workspace_projection: existing.workspace_projection }, baseline, adoptionWorkspaceOptions);
      const untouchedNames = Object.keys(baseline.sources).filter(name => !plan.some(item =>
        item.source_name && rootRef(item) === rootRef(baseline.sources[name]) && item.path_ref === baseline.sources[name].path_ref));
      const sourceErrors = checkSourceAlignment(baseline, options, untouchedNames);
      assert(!sourceErrors.length, sourceErrors.join('; '));
    }
    if (!existing) {
      const prepared = {
        record_type: ADOPTION_RECORD_TYPE,
        protocol_version: 3,
        status: 'PREPARED',
        event_id: config.adoption.expected_event_id,
        completed_seal_digest: config.adoption.expected_completed_seal_digest,
        adopted_at: adoptedAt,
        target_config_digest: byteDigest(Buffer.from(canonicalJson(config.all))),
        record,
        plan,
        workspace_projection: captureTransactionWorkspace(baseline, projectionPlan(plan), adoptionWorkspaceOptions),
        attestation_event_id: `${config.adoption.expected_event_id}:receiver-adoption`,
        attested_seal_digest: null
      };
      writeJournal(journalFile, prepared);
    }
    if (existing?.status === 'ATTESTATION_PENDING') {
      const pendingHistory = readChain(options.sealDirectory);
      const appended = pendingHistory.records.find(record => record.event_id === existing.attestation_event_id);
      if (appended) {
        verifyFrozenAttestation(existing, baseline, options, config, record);
        existing.status = 'COMMITTED';
        existing.attested_seal_digest = appended.seal_digest;
        writeJournal(journalFile, existing);
        return { ...verifyCommittedJournal(existing, options), writes: 1 };
      }
      assert(pendingHistory.records.at(-1)?.seal_digest === config.adoption.expected_completed_seal_digest, 'ADOPTION_ATTESTATION_CONFLICT: the completed handoff changed before attestation');
    }
    try {
      assertRecordRules(record, baseline, options);
      assertPlanState(plan, options);
      writePlan(plan, options, options.fault);
      const written = JSON.parse(fs.readFileSync(journalFile, 'utf8'));
      written.status = 'TARGETS_WRITTEN';
      writeJournal(journalFile, written);
      const liveBeforeAttestation = readChain(options.sealDirectory);
      assertRecordRules(record, baseline, options);
      assert(liveBeforeAttestation.records.at(-1)?.seal_digest === config.adoption.expected_completed_seal_digest, 'ADOPTION_SEAL_CHANGED_BEFORE_ATTESTATION');
      verifyTransactionWorkspace({ plan: projectionPlan(plan), workspace_projection: written.workspace_projection },
        baseline, adoptionWorkspaceOptions);
      const draft = attestationDraft(liveBeforeAttestation.records.at(-1), plan, options, record);
      verifyTransactionWorkspace({ plan: projectionPlan(plan), workspace_projection: written.workspace_projection },
        baseline, adoptionWorkspaceOptions);
      written.status = 'ATTESTATION_PENDING';
      written.attestation_event_id = draft.event_id;
      written.attestation_draft_digest = byteDigest(Buffer.from(canonicalJson(draft)));
      writeJournal(journalFile, written);
      const seal = appendSeal(options.sealDirectory, draft, { ...options, expectedPreviousDigest: config.adoption.expected_completed_seal_digest });
      options.fault?.('after-adoption-attestation');
      const after = JSON.parse(fs.readFileSync(journalFile, 'utf8'));
      after.status = 'COMMITTED';
      after.attested_seal_digest = seal.seal_digest;
      writeJournal(journalFile, after);
      return adoptionResult(record, seal.seal_digest, plan);
    } catch (error) {
      try {
        const current = readJournal(journalFile);
        const live = readChain(options.sealDirectory);
        const attestationAppended = current?.status === 'ATTESTATION_PENDING'
          && live.records.some(item => item.event_id === current.attestation_event_id);
        if (current?.status !== 'COMMITTED' && !attestationAppended) {
          rollbackPlan(plan, options);
          current.status = 'PREPARED';
          writeJournal(journalFile, current);
        } else if (attestationAppended && current.status !== 'COMMITTED') {
          const appended = verifyFrozenAttestation(current, baseline, options, config, record);
          current.status = 'COMMITTED';
          current.attested_seal_digest = appended.seal_digest;
          writeJournal(journalFile, current);
        }
      } catch (rollbackError) {
        const current = readJournal(journalFile) || { record_type: ADOPTION_RECORD_TYPE, protocol_version: 1, event_id: config.adoption.expected_event_id, completed_seal_digest: config.adoption.expected_completed_seal_digest, plan };
        current.status = 'ROLLBACK_BLOCKED';
        current.rollback_error = rollbackError.message;
        writeJournal(journalFile, current);
      }
      throw error;
    }
  }));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    const configPath = process.argv[2];
    assert(configPath, 'usage: node Receiver-State-Adoption.mjs <receiver-config.json>');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const base = path.dirname(path.resolve(configPath));
    for (const name of ['sourceRoot', 'externalControlPlaneRoot', 'sealDirectory', 'workflowRoot', 'manifestPath']) if (config[name]) config[name] = path.resolve(base, config[name]);
    console.log(JSON.stringify(adoptReceiverState(config), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
