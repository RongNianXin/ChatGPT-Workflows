// Immutable handoff-seal chain helper. It does not stop processes that bypass it.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { validWorkspaceFingerprint, validateScopedWorkspaceSources } from './HandoffWorkspaceScope.mjs';
import { assertControlReady, withControlLock, resolveSource } from './HandoffControl.mjs';

const HEX = /^[0-9a-f]{64}$/;
const TOP_LEVEL_KEYS = new Set(['schema_version', 'record_type', 'generation', 'writer_id', 'old_writer_status', 'seal_sequence', 'previous_seal_digest', 'fact_cutoff', 'sealed_at', 'event_id', 'sources', 'source_digest_status', 'rule_baseline', 'objective', 'prohibitions', 'communications', 'workspace', 'remote', 'control_handoff_confidence', 'candidate_verification_status', 'switch_status', 'handoff_phase', 'runtime_acceptance_status', 'professional_acceptance_status', 'transition', 'migration', 'invalidation_conditions', 'seal_digest', 'restrictions']);
const exactKeys = (value, allowed) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(key => allowed.includes(key));
const relativeRef = value => typeof value === 'string' && value.length > 0 && !path.isAbsolute(value) && !path.win32.isAbsolute(value) && !value.split(/[\\/]+/).includes('..');
const iso = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && !Number.isNaN(Date.parse(value));
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const insideRoot = (root, candidate) => {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
};
const sorted = value => {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, sorted(value[key])]));
  return value;
};
export const canonicalJson = value => JSON.stringify(sorted(value));
export const sealDigest = seal => digest(canonicalJson(Object.fromEntries(Object.entries(seal).filter(([key]) => key !== 'seal_digest'))));
export const transitionDigest = intent => digest(canonicalJson(Object.fromEntries(Object.entries(intent).filter(([key]) => key !== 'transition_digest'))));
export const recoveryDigest = recovery => digest(canonicalJson(Object.fromEntries(Object.entries(recovery).filter(([key]) => key !== 'recovery_digest'))));

const fail = (errors, message) => errors.push(message);
const RULE_BASELINE_KEYS = ['rule_version', 'manifest_sha256', 'mode', 'source_role', 'snapshot_ref', 'snapshot_sha256', 'observed_live_rule_version', 'observed_live_manifest_sha256', 'compatibility', 'action'];
function validateRuleBaseline(value, errors) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !exactKeys(value, RULE_BASELINE_KEYS) || typeof value.rule_version !== 'string' || !value.rule_version || !HEX.test(value.manifest_sha256 || '')) {
    fail(errors, 'invalid rule baseline');
    return;
  }
  if (value.mode !== undefined && !['LIVE', 'PINNED_SNAPSHOT'].includes(value.mode)) fail(errors, 'invalid rule baseline mode');
  if (value.source_role !== undefined && !['PUBLIC_RULE_SOURCE', 'CANDIDATE_PINNED_BASELINE', 'PROJECT_ADOPTION_RECORD'].includes(value.source_role)) fail(errors, 'invalid rule baseline source_role');
  if (value.snapshot_ref !== undefined && !relativeRef(value.snapshot_ref)) fail(errors, 'invalid rule baseline snapshot_ref');
  if (value.snapshot_sha256 !== undefined && !HEX.test(value.snapshot_sha256 || '')) fail(errors, 'invalid rule baseline snapshot_sha256');
  if (value.observed_live_rule_version !== undefined && (typeof value.observed_live_rule_version !== 'string' || !value.observed_live_rule_version)) fail(errors, 'invalid observed live rule version');
  if (value.observed_live_manifest_sha256 !== undefined && !HEX.test(value.observed_live_manifest_sha256 || '')) fail(errors, 'invalid observed live manifest digest');
  if (value.compatibility !== undefined && !['SAME', 'NEWER_COMPATIBLE', 'AFFECTED_RECHECK', 'INCOMPATIBLE', 'UNAVAILABLE'].includes(value.compatibility)) fail(errors, 'invalid rule compatibility');
  if (value.action !== undefined && !['CONTINUE', 'REBASE', 'STOP_AFFECTED'].includes(value.action)) fail(errors, 'invalid rule action');
  if (value.mode === 'PINNED_SNAPSHOT' && value.source_role !== 'CANDIDATE_PINNED_BASELINE') fail(errors, 'pinned rule baseline must identify candidate source role');
  if (value.mode === 'PINNED_SNAPSHOT' && (!value.snapshot_ref || !value.snapshot_sha256)) fail(errors, 'pinned rule baseline requires snapshot reference and digest');
}
function verifySourceFiles(seal, sourceRoot, externalControlPlaneRoot) {
  if (!sourceRoot) return ['INPUT_REQUIRED: provide <source-root> to verify the code source'];
  let internalRoot;
  try { internalRoot = fs.realpathSync(path.resolve(sourceRoot)); } catch (error) { return [`source root verification failed: ${error.message}`]; }
  let externalRoot = null;
  if (externalControlPlaneRoot) {
    try { externalRoot = fs.realpathSync(path.resolve(externalControlPlaneRoot)); } catch (error) { return [`external control-plane root verification failed: ${error.message}`]; }
  }
  const errors = [];
  for (const [name, source] of Object.entries(seal.sources ?? {})) {
    try {
      const root = source.root_ref === 'external_control_plane' ? externalRoot : internalRoot;
      if (!root) throw new Error(`INPUT_REQUIRED: missing ${source.root_ref === 'external_control_plane' ? 'external control-plane root; rerun with --external-control-plane-root=<root>' : 'source root'}`);
      const resolved = fs.realpathSync(path.resolve(root, source.path_ref));
      if (!insideRoot(root, resolved)) throw new Error('source path escapes root');
      if (digest(fs.readFileSync(resolved)) !== source.digest) throw new Error('source digest mismatch');
      if (name === 'control_plane_registry') {
        const registry = JSON.parse(fs.readFileSync(resolved, 'utf8'));
        const statusSource = seal.sources?.status_index;
        const registrySource = seal.sources?.control_plane_registry;
        const registryRoot = registrySource?.root_ref === 'external_control_plane' ? externalRoot : internalRoot;
        const registryErrors = validateControlPlaneRegistry(registry, registryRoot, statusSource?.path_ref);
        if (registryErrors.length) throw new Error(registryErrors.join('; '));
      }
    } catch (error) { errors.push(`source verification failed: ${name}: ${error.message}`); }
  }
  const baseline = seal.rule_baseline;
  if (baseline?.mode === 'PINNED_SNAPSHOT') {
    try {
      const snapshot = fs.realpathSync(path.resolve(internalRoot, baseline.snapshot_ref));
      if (!insideRoot(internalRoot, snapshot)) throw new Error('snapshot path escapes source root');
      if (digest(fs.readFileSync(snapshot)) !== baseline.snapshot_sha256) throw new Error('snapshot digest mismatch');
    } catch (error) { errors.push(`rule snapshot verification failed: ${error.message}`); }
  }
  errors.push(...validateScopedWorkspaceSources(seal.workspace, seal.sources, { sourceRoot: internalRoot, externalControlPlaneRoot: externalRoot, ruleBaseline: seal.rule_baseline, workflowRepositoryRoot: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..') }));
  return errors;
}

export function validateControlPlaneRegistry(registry, sourceRoot, canonicalStatusIndexRef) {
  const errors = [];
  if (!registry || typeof registry !== 'object' || Array.isArray(registry)) return ['registry must be an object'];
  if (registry.schema_version !== 1) errors.push('registry schema_version must be 1');
  if (registry.canonical_index !== canonicalStatusIndexRef) errors.push('registry canonical index mismatch');
  if (!Array.isArray(registry.legacy_indexes)) errors.push('registry legacy_indexes must be an array');
  const seen = new Set([canonicalStatusIndexRef]);
  for (const item of registry.legacy_indexes ?? []) {
    if (!item || typeof item.path !== 'string' || item.status !== 'HISTORICAL_ONLY' || !HEX.test(item.sha256 || '') || typeof item.reason !== 'string' || !item.reason) { errors.push('invalid historical control-plane entry'); continue; }
    if (seen.has(item.path)) { errors.push(`duplicate control-plane path: ${item.path}`); continue; }
    seen.add(item.path);
    try {
      const resolved = fs.realpathSync(path.resolve(sourceRoot, item.path));
      if (!insideRoot(sourceRoot, resolved) || resolved === fs.realpathSync(path.resolve(sourceRoot))) throw new Error('path escapes source root');
      if (digest(fs.readFileSync(resolved)) !== item.sha256) throw new Error('digest mismatch');
      const content = fs.readFileSync(resolved, 'utf8');
      if (!content.includes('<!-- CURRENT:BEGIN -->')) throw new Error('historical entry is not a CURRENT control-plane record');
    } catch (error) { errors.push(`historical control-plane verification failed: ${item.path}: ${error.message}`); }
  }
  return errors;
}
export const CONTROL_IDENTITY_SOURCES = ['status_index', 'central_work_items', 'current_view', 'central_entry', 'workflow_enablement'];

// Live identity evidence is separate from immutable history and byte integrity.
export function verifyControlIdentity(seal, { sourceRoot, externalControlPlaneRoot } = {}) {
  if (!CONTROL_IDENTITY_SOURCES.every(name => seal?.sources?.[name])) {
    return { status: 'NOT_CHECKED', errors: ['CONTROL_IDENTITY_REQUIRED: missing canonical identity/navigation sources'] };
  }
  const errors = [];
  try { assertControlReady(seal, { sourceRoot, externalControlPlaneRoot }); }
  catch (error) { return { status: error.message.includes('INPUT_REQUIRED:') ? 'NOT_CHECKED' : 'FAIL', errors: [error.message], platform_mapping_status: 'NOT_CHECKED' }; }
  const bodies = {};
  let platformMappingStatus = 'NOT_CHECKED';
  for (const name of CONTROL_IDENTITY_SOURCES) {
    try {
      const source = seal.sources[name];
      const root = source.root_ref === 'external_control_plane' ? externalControlPlaneRoot : sourceRoot;
      if (!root) throw new Error('INPUT_REQUIRED: missing identity source root');
      const realRoot = fs.realpathSync(root);
      const file = fs.realpathSync(path.resolve(realRoot, source.path_ref));
      if (!insideRoot(realRoot, file)) throw new Error('identity source escapes root');
      const content = fs.readFileSync(file, 'utf8');
      const begin = '<!-- CURRENT:BEGIN -->', end = '<!-- CURRENT:END -->';
      if (name === 'workflow_enablement' && !content.includes(begin) && !content.includes(end)) bodies[name] = content;
      else {
        if (content.split(begin).length !== 2 || content.split(end).length !== 2 || content.indexOf(begin) >= content.indexOf(end)) throw new Error('invalid CURRENT boundary');
        bodies[name] = content.slice(content.indexOf(begin) + begin.length, content.indexOf(end));
      }
    } catch (error) { errors.push(`${name}: ${error.message}`); }
  }
  const marker = (name, tag) => {
    const matches = [...(bodies[name] ?? '').matchAll(new RegExp(`<!-- ${tag}: ([\\s\\S]*?) -->`, 'g'))];
    if (matches.length !== 1) throw new Error(`${name}: requires exactly one ${tag} marker`);
    return JSON.parse(matches[0][1]);
  };
  try {
    const identity = marker('status_index', 'CONTROL_IDENTITY');
    if (!exactKeys(identity, ['generation', 'writer_id', 'platform_task_id']) || !Number.isInteger(identity.generation) || identity.generation < 1 || !/^[A-Za-z0-9._-]+$/.test(identity.writer_id ?? '') || !(identity.platform_task_id === 'UNKNOWN' || /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(identity.platform_task_id ?? ''))) throw new Error('invalid canonical identity mapping');
    platformMappingStatus = identity.platform_task_id === 'UNKNOWN' ? 'UNKNOWN' : 'RECORDED_NOT_PLATFORM_VERIFIED';
    if (identity.generation !== seal.generation || identity.writer_id !== seal.writer_id) throw new Error('canonical identity does not match seal');
    for (const name of CONTROL_IDENTITY_SOURCES) {
      if (name !== 'status_index') {
        const navigation = marker(name, 'CONTROL_NAVIGATION');
        if (!exactKeys(navigation, name === 'workflow_enablement' ? ['status_index', 'root_ref', 'central_entry', 'central_entry_root_ref'] : ['status_index', 'root_ref']) || navigation.status_index !== seal.sources.status_index.path_ref || navigation.root_ref !== (seal.sources.status_index.root_ref ?? 'source_root')) throw new Error(`${name}: canonical navigation mismatch`);
        if (name === 'workflow_enablement') {
          const states = [...bodies[name].matchAll(/^[\t ]*(?:状态|state)[\t ]*[:：=][\t ]*([^\r\n]*)$/gm)];
          if (states.length !== 1 || !/^(?:enabled|`enabled`)$/.test(states[0][1].trim())) throw new Error('workflow_enablement: requires an explicit enabled state');
          if (navigation.central_entry !== seal.sources.central_entry.path_ref || navigation.central_entry_root_ref !== (seal.sources.central_entry.root_ref ?? 'source_root')) throw new Error('workflow_enablement: declared central entry mismatch');
        }
        if ((bodies[name] ?? '').includes('<!-- CONTROL_IDENTITY:')) throw new Error(`${name}: identity belongs only in status_index`);
      }
      // Recognized current declarations are checked; historical text is excluded.
      const fields = [
        [/(?:当前唯一中央写者|唯一当前写者绑定|中央登记唯一写者|唯一中央写者|当前写者|writer_id)\s*[:：=]\s*`?([A-Za-z0-9._-]+)/g, identity.writer_id],
        [/(?:当前总指挥世代|generation)\s*[:：=]\s*`?(\d+)/g, String(identity.generation)],
        [/(?:当前任务\s*ID|平台任务\s*ID|platform_task_id)\s*[:：=]\s*`?([A-Za-z0-9-]+)/g, identity.platform_task_id]
      ];
      for (const [pattern, expected] of fields) {
        for (const match of (bodies[name] ?? '').matchAll(pattern)) if (match[1] !== expected) throw new Error(`${name}: conflicting current identity declaration`);
      }
    }
  } catch (error) { errors.push(error.message); }
  return { status: errors.length ? errors.some(error => error.includes('INPUT_REQUIRED:')) ? 'NOT_CHECKED' : 'FAIL' : 'PASS', errors, platform_mapping_status: platformMappingStatus };
}
export function validateSeal(seal, { checkDigest = true, requireExtensions = false } = {}) {
  const errors = [];
  if (!seal || typeof seal !== 'object' || Array.isArray(seal)) return ['seal must be an object'];
  for (const key of Object.keys(seal)) if (!TOP_LEVEL_KEYS.has(key)) fail(errors, `unknown top-level field: ${key}`);
  if (![1, 2, 3, 4].includes(seal.schema_version)) fail(errors, 'schema_version must be 1, 2, 3, or 4');
  if (seal.schema_version < 4 && Object.hasOwn(seal, 'restrictions')) fail(errors, 'legacy seal cannot contain v4 restrictions');
  if (seal.schema_version === 4 && (!Array.isArray(seal.restrictions) || seal.restrictions.some(value => value !== 'REMOTE_UNOBSERVED') || new Set(seal.restrictions).size !== seal.restrictions.length || (seal.remote?.status === 'UNKNOWN') !== seal.restrictions.includes('REMOTE_UNOBSERVED'))) fail(errors, 'invalid v4 dependency restrictions');
  if (seal.record_type !== 'handoff-seal') fail(errors, 'record_type must be handoff-seal');
  if (!Number.isInteger(seal.generation) || seal.generation < 1) fail(errors, 'generation must be a positive integer');
  if (!/^[A-Za-z0-9._-]+$/.test(seal.writer_id || '')) fail(errors, 'writer_id is not a portable logical id');
  if (!['IDLE', 'STOPPED_DISPATCH', 'ARCHIVED', 'UNKNOWN'].includes(seal.old_writer_status)) fail(errors, 'invalid old_writer_status');
  if (!Number.isInteger(seal.seal_sequence) || seal.seal_sequence < 1) fail(errors, 'seal_sequence must be positive');
  if (seal.previous_seal_digest !== null && !HEX.test(seal.previous_seal_digest || '')) fail(errors, 'invalid previous_seal_digest');
  for (const key of ['fact_cutoff', 'sealed_at']) if (!iso(seal[key])) fail(errors, `${key} must be an ISO timestamp`);
  if (seal.schema_version >= 3 && iso(seal.fact_cutoff) && iso(seal.sealed_at) && Date.parse(seal.sealed_at) < Date.parse(seal.fact_cutoff)) fail(errors, 'sealed_at must not precede fact_cutoff');
  if (!/^[A-Za-z0-9._:-]+$/.test(seal.event_id || '')) fail(errors, 'event_id is not a portable logical id');
  if (!seal.sources || typeof seal.sources !== 'object' || Array.isArray(seal.sources) || !Object.keys(seal.sources).length) fail(errors, 'sources must be non-empty');
  else for (const [name, source] of Object.entries(seal.sources)) {
    const sourceKeys = seal.schema_version >= 3 ? ['owner', 'path_ref', 'digest', 'fact_cutoff', 'root_ref'] : ['owner', 'path_ref', 'digest', 'fact_cutoff'];
    if (!exactKeys(source, sourceKeys) || typeof source.owner !== 'string' || !source.owner || !relativeRef(source.path_ref) || !HEX.test(source.digest || '') || !iso(source.fact_cutoff)) fail(errors, `invalid source: ${name}`);
    if (!relativeRef(source.path_ref)) fail(errors, `unsafe source path: ${name}`);
    if (seal.schema_version >= 3 && source.root_ref !== undefined && !['source_root', 'external_control_plane'].includes(source.root_ref)) fail(errors, `invalid source root_ref: ${name}`);
    if (seal.schema_version >= 3 && source.root_ref === 'external_control_plane' && name !== 'control_plane_registry' && !CONTROL_IDENTITY_SOURCES.includes(name)) fail(errors, `external root is only allowed for control-plane sources: ${name}`);
    if (Date.parse(source.fact_cutoff) > Date.parse(seal.fact_cutoff)) fail(errors, `source fact_cutoff is after seal fact_cutoff: ${name}`);
  }
  if (!['PASS', 'UNKNOWN', 'FAIL'].includes(seal.source_digest_status)) fail(errors, 'invalid source_digest_status');
  const rules = seal.rule_baseline;
  if (!rules && !requireExtensions) {
    // v3 records written before the rule-baseline extension remain readable history.
  } else validateRuleBaseline(rules, errors);
  if (!exactKeys(seal.objective, ['summary', 'breakpoint']) || typeof seal.objective.summary !== 'string' || typeof seal.objective.breakpoint !== 'string') fail(errors, 'objective summary/breakpoint required');
  if (!Array.isArray(seal.prohibitions) || seal.prohibitions.some(value => typeof value !== 'string')) fail(errors, 'prohibitions must be an array of strings');
  if (!exactKeys(seal.communications, ['status']) || !['NONE', 'AUTHORIZED', 'PENDING_CONFIRMATION', 'BLOCKED'].includes(seal.communications.status)) fail(errors, 'invalid communications status');
  const w = seal.workspace;
  const workspaceKeys = ['root_ref', 'branch', 'head', 'tree', 'staged_count', 'tracked_modified_count', 'untracked_count', 'required_untracked'];
  const legacyWorkspace = w && !Object.hasOwn(w, 'worktree_fingerprint');
  if (!w || (!legacyWorkspace && !exactKeys(w, [...workspaceKeys, 'worktree_fingerprint', ...(Object.hasOwn(w, 'inflight_scope') ? ['inflight_scope'] : [])])) || (legacyWorkspace && !requireExtensions && !exactKeys(w, workspaceKeys)) || (legacyWorkspace && requireExtensions) || typeof w.root_ref !== 'string' || !w.root_ref || typeof w.branch !== 'string' || !w.branch || !/^[0-9a-f]{40,64}$/.test(w.head || '') || !/^[0-9a-f]{40,64}$/.test(w.tree || '') || !Number.isInteger(w.staged_count) || w.staged_count < 0 || !Number.isInteger(w.tracked_modified_count) || w.tracked_modified_count < 0 || !Number.isInteger(w.untracked_count) || w.untracked_count < 0 || !Array.isArray(w.required_untracked) || (!legacyWorkspace && !validWorkspaceFingerprint(w, seal.sources, { ruleBaseline: seal.rule_baseline }))) fail(errors, 'invalid workspace baseline');
  else for (const item of w.required_untracked) if (!exactKeys(item, ['path_ref', 'sha256', 'reason']) || !relativeRef(item.path_ref) || !HEX.test(item.sha256 || '') || typeof item.reason !== 'string' || !item.reason) fail(errors, 'invalid required_untracked item');
  const r = seal.remote;
  if (!exactKeys(r, ['status', 'default_ref', 'head', 'observed_at']) || !['PASS', 'UNKNOWN', 'FAIL', 'NOT_APPLICABLE'].includes(r.status) || typeof r.default_ref !== 'string' || !r.default_ref || (r.head !== null && !/^[0-9a-f]{40,64}$/.test(r.head || '')) || (r.observed_at !== null && !iso(r.observed_at))) fail(errors, 'invalid remote baseline');
  if (!['HIGH', 'MEDIUM', 'LOW'].includes(seal.control_handoff_confidence)) fail(errors, 'invalid control_handoff_confidence');
  if (!['READY', 'READY_WITH_RESTRICTIONS', 'BLOCKED', 'COMPLETED'].includes(seal.switch_status)) fail(errors, 'invalid switch_status');
  if (seal.schema_version >= 2) {
    if (!['NOT_RUN', 'PASS', 'PASS_WITH_RESTRICTIONS', 'FAIL'].includes(seal.candidate_verification_status)) fail(errors, 'invalid candidate_verification_status');
    if (!['MATERIAL_PREPARED', 'TAKEOVER_COMPLETED', 'CURRENT_MIGRATION', 'CURRENT_ATTESTATION'].includes(seal.handoff_phase)) fail(errors, 'invalid handoff_phase');
    if (seal.handoff_phase === 'MATERIAL_PREPARED' && seal.switch_status === 'COMPLETED') fail(errors, 'material preparation cannot be COMPLETED');
    if (seal.handoff_phase === 'TAKEOVER_COMPLETED' && seal.switch_status !== 'COMPLETED') fail(errors, 'takeover phase requires COMPLETED');
    if (seal.handoff_phase === 'CURRENT_MIGRATION') {
      if (seal.switch_status !== 'COMPLETED' || seal.seal_sequence !== 1 || seal.previous_seal_digest !== null || seal.transition !== null) fail(errors, 'current migration must be the first completed seal without a transition');
      if (!exactKeys(seal.migration, ['legacy_latest_seal_digest', 'legacy_generation', 'legacy_writer_id', 'migrated_at', 'basis']) || !HEX.test(seal.migration?.legacy_latest_seal_digest || '') || !Number.isInteger(seal.migration?.legacy_generation) || seal.migration?.legacy_generation < 1 || !/^[A-Za-z0-9._-]+$/.test(seal.migration?.legacy_writer_id || '') || !iso(seal.migration?.migrated_at) || seal.migration?.basis !== 'CURRENT_ONLY_NO_RETROACTIVE_TRANSITION') fail(errors, 'invalid current migration evidence');
    } else if (seal.migration !== null) fail(errors, 'non-migration seal must not contain migration evidence');
    if (seal.handoff_phase === 'CURRENT_ATTESTATION' && (!['BLOCKED', 'COMPLETED'].includes(seal.switch_status) || seal.transition !== null || seal.migration !== null)) fail(errors, 'current attestation must be blocked or completed without transition or migration evidence');
  }
  for (const key of ['runtime_acceptance_status', 'professional_acceptance_status']) if (!['PASS', 'FAIL', 'NOT_RUN', 'UNKNOWN', 'NOT_APPLICABLE'].includes(seal[key])) fail(errors, `invalid ${key}`);
  if (!Array.isArray(seal.invalidation_conditions) || seal.invalidation_conditions.length === 0 || seal.invalidation_conditions.some(value => typeof value !== 'string')) fail(errors, 'invalidation_conditions must be a non-empty string array');
  const requiresReadyEvidence = seal.control_handoff_confidence === 'HIGH' || ['READY', 'READY_WITH_RESTRICTIONS', 'COMPLETED'].includes(seal.switch_status);
  if (requiresReadyEvidence && !['central_work_items', 'current_view', 'status_index'].every(key => seal.sources?.[key])) fail(errors, 'control handoff requires all canonical sources');
  if (requiresReadyEvidence && r?.observed_at !== null && Date.parse(r.observed_at) > Date.parse(seal.fact_cutoff)) fail(errors, 'remote observed_at must not be after fact_cutoff');
  if (seal.control_handoff_confidence === 'HIGH' && ((r?.status !== 'PASS' && !(seal.schema_version === 4 && r?.status === 'UNKNOWN' && seal.restrictions?.includes('REMOTE_UNOBSERVED'))) || seal.source_digest_status !== 'PASS')) fail(errors, 'HIGH control handoff requires remote PASS and source digest PASS');
  // A restricted candidate may be handed off when the remote is temporarily
  // unobservable, provided all local/control-plane evidence is current.  A
  // v3 READY/COMPLETED still requires a live remote baseline; v4 may use
  // UNKNOWN with the explicit REMOTE_UNOBSERVED restriction below.
  if (['READY', 'COMPLETED'].includes(seal.switch_status) && ((r?.status !== 'PASS' && !(seal.schema_version === 4 && r?.status === 'UNKNOWN' && seal.restrictions?.includes('REMOTE_UNOBSERVED'))) || seal.source_digest_status !== 'PASS')) fail(errors, 'READY status requires remote PASS and source digest PASS');
  if (seal.switch_status === 'READY_WITH_RESTRICTIONS' && seal.source_digest_status !== 'PASS') fail(errors, 'READY_WITH_RESTRICTIONS requires source digest PASS');
  // READY describes candidate material readiness, not a transfer of authority.
  if (seal.switch_status === 'COMPLETED' && !['STOPPED_DISPATCH', 'ARCHIVED'].includes(seal.old_writer_status)) fail(errors, 'COMPLETED requires old writer stopped or archived');
  if (seal.switch_status === 'COMPLETED' && seal.control_handoff_confidence !== 'HIGH') fail(errors, 'COMPLETED requires control_handoff_confidence HIGH');
  if (seal.schema_version >= 2 && seal.switch_status === 'COMPLETED') {
    if (!['PASS', 'PASS_WITH_RESTRICTIONS'].includes(seal.candidate_verification_status)) fail(errors, 'COMPLETED requires candidate verification');
    if (!['CURRENT_MIGRATION', 'CURRENT_ATTESTATION'].includes(seal.handoff_phase) && (!exactKeys(seal.transition, ['intent_digest', 'previous_seal_digest', 'prepared_at']) || !HEX.test(seal.transition?.intent_digest || '') || !HEX.test(seal.transition?.previous_seal_digest || '') || !iso(seal.transition?.prepared_at))) fail(errors, 'COMPLETED requires a valid transition intent');
  }
  if (!HEX.test(seal.seal_digest || '')) fail(errors, 'invalid seal_digest');
  if (checkDigest && seal.seal_digest !== sealDigest(seal)) fail(errors, 'seal_digest mismatch');
  return errors;
}

function sealFiles(dir) {
  return fs.readdirSync(dir).filter(name => /^handoff-state\.\d+\.[0-9a-f]{64}\.json$/.test(name)).sort((a, b) => Number(a.split('.')[1]) - Number(b.split('.')[1]));
}
export function readChain(dir, { ignoreOwnLock = false } = {}) {
  const errors = [];
  if (!fs.existsSync(dir)) return { records: [], errors: ['seal directory missing'] };
  const leftovers = fs.readdirSync(dir).filter(name => (name === '.handoff.lock' && !ignoreOwnLock) || name.includes('.tmp') || (!/^handoff-state\.\d+\.[0-9a-f]{64}\.json$/.test(name) && !/^handoff-transition\.\d+\.[0-9a-f]{64}\.json$/.test(name) && !/^handoff-transition-recovery\.\d+\.[0-9a-f]{64}\.json$/.test(name) && name !== '.handoff.lock'));
  leftovers.forEach(name => fail(errors, `recovery artifact present: ${name}`));
  const records = [];
  for (const file of sealFiles(dir)) {
    try {
      const seal = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
      const match = /^handoff-state\.(\d+)\.([0-9a-f]{64})\.json$/.exec(file);
      if (match && (Number(match[1]) !== seal.seal_sequence || match[2] !== seal.seal_digest)) fail(errors, `${file}: filename does not match seal fields`);
      const itemErrors = validateSeal(seal); itemErrors.forEach(e => fail(errors, `${file}: ${e}`)); records.push(seal);
    }
    catch (error) { fail(errors, `${file}: ${error.message}`); }
  }
  const transitionPredecessors = new Set();
  const intents = new Map();
  for (const file of fs.readdirSync(dir).filter(name => /^handoff-transition\.\d+\.[0-9a-f]{64}\.json$/.test(name))) {
    try {
      const intent = readTransitionIntent(path.join(dir, file));
      if (transitionPredecessors.has(intent.previous_seal_digest)) fail(errors, `duplicate transition intent for ${intent.previous_seal_digest}`);
      transitionPredecessors.add(intent.previous_seal_digest);
      intents.set(intent.transition_digest, intent);
    } catch (error) { fail(errors, `${file}: ${error.message}`); }
  }
  const recoveries = new Map();
  for (const file of fs.readdirSync(dir).filter(name => /^handoff-transition-recovery\.\d+\.[0-9a-f]{64}\.json$/.test(name))) {
    try {
      const recovery = readTransitionRecovery(path.join(dir, file));
      const intent = intents.get(recovery.intent_digest);
      if (!intent) throw new Error('recovery references a missing transition intent');
      if (recoveries.has(recovery.intent_digest)) throw new Error('transition intent has more than one recovery');
      if (recovery.previous_seal_digest !== intent.previous_seal_digest || recovery.previous_sequence !== intent.previous_sequence || recovery.generation !== intent.previous_generation || recovery.writer_id !== intent.previous_writer_id || Date.parse(recovery.recovered_at) < Date.parse(intent.prepared_at)) throw new Error('recovery does not match transition predecessor or time');
      recoveries.set(recovery.intent_digest, recovery);
    } catch (error) { fail(errors, `${file}: ${error.message}`); }
  }
  const seen = new Set();
  const seenEventIds = new Set();
  let hasLegacyRecords = false;
  let seenStrictV3 = false;
  records.sort((a, b) => a.seal_sequence - b.seal_sequence);
  records.forEach((seal, index) => {
    if (seal.schema_version < 3) hasLegacyRecords = true;
    if (seal.schema_version < 3 && seenStrictV3) fail(errors, `legacy schema record appears after v3 at sequence ${seal.seal_sequence}`);
    if (seal.schema_version >= 3) seenStrictV3 = true;
    if (seen.has(seal.seal_sequence)) fail(errors, `duplicate seal_sequence: ${seal.seal_sequence}`); seen.add(seal.seal_sequence);
    const previous = records[index - 1];
    if (!previous && seal.seal_sequence !== 1) fail(errors, 'first seal must have sequence 1');
    if (!previous && seal.previous_seal_digest !== null) fail(errors, 'first seal must have null previous_seal_digest');
    if (previous && (seal.seal_sequence !== previous.seal_sequence + 1 || seal.previous_seal_digest !== previous.seal_digest)) fail(errors, `chain break at sequence ${seal.seal_sequence}`);
    if (previous && seal.generation < previous.generation) fail(errors, `generation rollback at sequence ${seal.seal_sequence}`);
    if (previous && seal.generation === previous.generation && seal.writer_id !== previous.writer_id) fail(errors, `writer change without generation transition at sequence ${seal.seal_sequence}`);
    if (previous && seal.generation > previous.generation && (seal.generation !== previous.generation + 1 || seal.writer_id === previous.writer_id || !['STOPPED_DISPATCH', 'ARCHIVED'].includes(seal.old_writer_status))) fail(errors, `unsafe generation transition at sequence ${seal.seal_sequence}`);
    if (seal.schema_version >= 3 && seenEventIds.has(seal.event_id)) fail(errors, `duplicate event_id at sequence ${seal.seal_sequence}: ${seal.event_id}`);
    if (seal.schema_version >= 3 && previous && Date.parse(seal.fact_cutoff) < Date.parse(previous.fact_cutoff)) fail(errors, `fact_cutoff rollback at sequence ${seal.seal_sequence}`);
    if (seal.schema_version >= 3 && previous && Date.parse(seal.sealed_at) < Date.parse(previous.sealed_at)) fail(errors, `sealed_at rollback at sequence ${seal.seal_sequence}`);
    if (seal.handoff_phase === 'CURRENT_ATTESTATION' && (!previous || seal.generation !== previous.generation || seal.writer_id !== previous.writer_id || seal.transition !== null || seal.migration !== null)) fail(errors, `invalid current attestation at sequence ${seal.seal_sequence}`);
    if (seal.schema_version >= 3 && seal.handoff_phase === 'CURRENT_ATTESTATION' && previous) {
      const names = new Set([...Object.keys(previous.sources ?? {}), ...Object.keys(seal.sources ?? {})]);
      if (![...names].some(name => previous.sources?.[name]?.digest !== seal.sources?.[name]?.digest)) fail(errors, `current attestation has no source change at sequence ${seal.seal_sequence}`);
    }
    if (seal.transition !== null && seal.transition !== undefined) {
      const intent = intents.get(seal.transition.intent_digest);
      if (!intent) fail(errors, `missing transition intent at sequence ${seal.seal_sequence}`);
      else if (!previous || intent.previous_seal_digest !== previous.seal_digest || intent.previous_sequence !== previous.seal_sequence || intent.previous_generation !== previous.generation || intent.previous_writer_id !== previous.writer_id || intent.next_generation !== seal.generation || intent.next_writer_id !== seal.writer_id || intent.event_id !== seal.event_id || seal.transition.previous_seal_digest !== intent.previous_seal_digest || seal.transition.prepared_at !== intent.prepared_at) fail(errors, `transition intent mismatch at sequence ${seal.seal_sequence}`);
      if (intent?.record_type === 'handoff-direct-transition-intent' && seal.schema_version !== 4) fail(errors, 'direct recipient evidence cannot be consumed by a legacy seal');
      if (seal.schema_version >= 3 && previous && Date.parse(seal.transition.prepared_at) < Date.parse(previous.sealed_at)) fail(errors, `transition prepared_at precedes predecessor seal at sequence ${seal.seal_sequence}`);
      if (seal.schema_version >= 3 && Date.parse(seal.transition.prepared_at) > Date.parse(seal.sealed_at)) fail(errors, `transition prepared_at follows takeover seal at sequence ${seal.seal_sequence}`);
    }
    seenEventIds.add(seal.event_id);
  });
  const consumed = new Map();
  for (const seal of records) if (seal.transition?.intent_digest) consumed.set(seal.transition.intent_digest, (consumed.get(seal.transition.intent_digest) ?? 0) + 1);
  for (const [intentDigest, count] of consumed) if (count > 1) fail(errors, `transition intent consumed more than once: ${intentDigest}`);
  for (const [intentDigest, recovery] of recoveries) {
    if (consumed.has(intentDigest)) fail(errors, `recovered transition intent was consumed: ${intentDigest}`);
    if (seenEventIds.has(recovery.event_id) || [...intents.values()].some(intent => intent.event_id === recovery.event_id) || [...recoveries.values()].filter(other => other.event_id === recovery.event_id).length !== 1) fail(errors, `recovery event_id already exists: ${recovery.event_id}`);
    const predecessor = records.find(record => record.seal_digest === recovery.previous_seal_digest);
    if (!predecessor || predecessor.seal_sequence !== recovery.previous_sequence || predecessor.generation !== recovery.generation || predecessor.writer_id !== recovery.writer_id || Date.parse(recovery.recovered_at) < Date.parse(predecessor.sealed_at)) fail(errors, `recovery predecessor mismatch: ${intentDigest}`);
    const successor = records.find(record => record.seal_sequence === recovery.previous_sequence + 1);
    if (successor && (successor.handoff_phase !== 'CURRENT_ATTESTATION' || successor.generation !== recovery.generation || successor.writer_id !== recovery.writer_id || Date.parse(successor.sealed_at) < Date.parse(recovery.recovered_at))) fail(errors, `recovered intent must be followed by same-writer current attestation: ${intentDigest}`);
  }
  const pendingIntents = [...intents.values()].filter(intent => !consumed.has(intent.transition_digest) && !recoveries.has(intent.transition_digest));
  const latest = records.at(-1);
  for (const intent of pendingIntents) if (!latest || intent.previous_seal_digest !== latest.seal_digest || intent.previous_sequence !== latest.seal_sequence || intent.previous_generation !== latest.generation || intent.previous_writer_id !== latest.writer_id) fail(errors, `stale unconsumed transition intent: ${intent.transition_digest}`);
  return { records, intents: [...intents.values()], recoveries: [...recoveries.values()], pending_intents: pendingIntents, historical_assurance: hasLegacyRecords ? 'LEGACY_UNVERIFIED' : 'STRICT_V3', errors };
}

export function verifyChain(dir, options = {}) {
  const result = readChain(dir, options);
  const latest = result.records.at(-1) ?? null;
  if (!latest) result.errors.push('no immutable seal record');
  if (latest?.sources?.status_index && options.verifyLatestSources !== false) { try { assertControlReady(latest, options); } catch (error) { result.errors.push(error.message); } }
  const requiresLiveSources = options.verifyLatestSources !== false && latest && latest.source_digest_status === 'PASS' && latest.sources;
  const sourceVerificationErrors = requiresLiveSources
    ? verifySourceFiles(latest, options.sourceRoot, options.externalControlPlaneRoot)
    : [];
  sourceVerificationErrors.forEach(error => result.errors.push(error));
  if (latest && latest.switch_status === 'COMPLETED' && latest.control_handoff_confidence !== 'HIGH') result.errors.push('COMPLETED requires control_handoff_confidence HIGH');
  if (latest && latest.schema_version < 4 && latest.control_handoff_confidence === 'HIGH' && latest.remote.status === 'UNKNOWN') result.errors.push('HIGH control handoff cannot hide unknown remote baseline');
  const latestSourceStatus = requiresLiveSources
    ? sourceVerificationErrors.length === 0
      ? 'PASS'
      : sourceVerificationErrors.some(error => error.includes('INPUT_REQUIRED:')) ? 'NOT_CHECKED' : 'FAIL'
    : 'NOT_CHECKED';
  const identity = requiresLiveSources && sourceVerificationErrors.length === 0
    ? verifyControlIdentity(latest, options) : { status: 'NOT_CHECKED', errors: [] };
  if (identity.status === 'FAIL') result.errors.push(...identity.errors);
  const awaitingRecoveryAttestation = result.recoveries?.some(recovery => recovery.previous_seal_digest === latest?.seal_digest);
  const controlStatus = result.errors.length || awaitingRecoveryAttestation || latest?.switch_status === 'BLOCKED' || latestSourceStatus !== 'PASS' || identity.status !== 'PASS' ? 'BLOCKED' : 'READY';
  const handoffReady = controlStatus === 'READY' && latest && ['READY', 'READY_WITH_RESTRICTIONS', 'COMPLETED'].includes(latest.switch_status);
  return { ...result, latest, latest_source_status: latestSourceStatus, control_identity_status: identity.status, control_identity_errors: identity.errors, control_status: controlStatus, handoff_ready: Boolean(handoffReady), transition_status: result.pending_intents?.length ? 'PENDING' : 'SETTLED', recovery_status: awaitingRecoveryAttestation ? 'AWAITING_ATTESTATION' : 'SETTLED', status: result.errors.length ? 'BLOCKED' : 'PASS' };
}

function validateTransitionIntent(intent) {
  const errors = [];
  if (!exactKeys(intent, ['record_type', 'previous_seal_digest', 'previous_sequence', 'previous_generation', 'previous_writer_id', 'next_generation', 'next_writer_id', 'event_id', 'prepared_at', 'previous_source_status', 'transition_digest', ...(intent.record_type === 'handoff-direct-transition-intent' ? ['authorization'] : [])])) return ['invalid transition intent fields'];
  if (intent.record_type === 'handoff-direct-transition-intent') {
    errors.push(...validateDirectConfirmation(intent.authorization, { writerId: intent.next_writer_id, platformTaskId: intent.authorization?.recipient_platform_id, projectKey: intent.authorization?.project_key }, { seal_digest: intent.previous_seal_digest, generation: intent.previous_generation, writer_id: intent.previous_writer_id }));
    if (Date.parse(intent.authorization?.confirmed_at) > Date.parse(intent.prepared_at)) fail(errors, 'direct preparation precedes operator confirmation');
  }
  if (!['handoff-transition-intent', 'handoff-direct-transition-intent'].includes(intent.record_type)) fail(errors, 'invalid transition record_type');
  if (!HEX.test(intent.previous_seal_digest || '') || !Number.isInteger(intent.previous_sequence) || intent.previous_sequence < 1) fail(errors, 'invalid transition predecessor');
  if (!Number.isInteger(intent.previous_generation) || !Number.isInteger(intent.next_generation) || intent.previous_generation < 1 || intent.next_generation < 1) fail(errors, 'invalid transition generation');
  if (!/^[A-Za-z0-9._-]+$/.test(intent.previous_writer_id || '') || !/^[A-Za-z0-9._-]+$/.test(intent.next_writer_id || '')) fail(errors, 'invalid transition writer');
  if (!/^[A-Za-z0-9._:-]+$/.test(intent.event_id || '') || !iso(intent.prepared_at) || intent.previous_source_status !== 'PASS') fail(errors, 'invalid transition evidence');
  if (!HEX.test(intent.transition_digest || '') || intent.transition_digest !== transitionDigest(intent)) fail(errors, 'transition digest mismatch');
  return errors;
}

function readTransitionIntent(ticketPath) {
  const intent = JSON.parse(fs.readFileSync(ticketPath, 'utf8'));
  const errors = validateTransitionIntent(intent);
  if (errors.length) throw new Error(errors.join('; '));
  const filename = path.basename(ticketPath);
  const match = /^handoff-transition\.(\d+)\.([0-9a-f]{64})\.json$/.exec(filename);
  if (!match || Number(match[1]) !== intent.previous_sequence || match[2] !== intent.transition_digest) throw new Error('transition filename does not match intent');
  return intent;
}

function validateTransitionRecovery(recovery) {
  const errors = [];
  if (!exactKeys(recovery, ['record_type', 'intent_digest', 'previous_seal_digest', 'previous_sequence', 'generation', 'writer_id', 'reason', 'event_id', 'recovered_at', 'previous_source_status', 'drifted_sources', 'recovery_digest'])) return ['invalid transition recovery fields'];
  if (recovery.record_type !== 'handoff-transition-recovery' || recovery.reason !== 'RULE_REBASE' || !['PASS', 'DRIFTED_NONCONTROL'].includes(recovery.previous_source_status)) fail(errors, 'invalid transition recovery evidence');
  if (!Array.isArray(recovery.drifted_sources) || recovery.drifted_sources.some(item => !exactKeys(item, ['name', 'actual_digest']) || !/^[a-z][a-z0-9_]*$/.test(item.name || '') || !HEX.test(item.actual_digest || '')) || new Set(recovery.drifted_sources.map(item => item.name)).size !== recovery.drifted_sources.length || recovery.drifted_sources.some((item, index) => index > 0 && item.name <= recovery.drifted_sources[index - 1].name) || (recovery.previous_source_status === 'PASS') !== (recovery.drifted_sources.length === 0)) fail(errors, 'invalid transition recovery drift inventory');
  if (!HEX.test(recovery.intent_digest || '') || !HEX.test(recovery.previous_seal_digest || '') || !Number.isInteger(recovery.previous_sequence) || recovery.previous_sequence < 1 || !Number.isInteger(recovery.generation) || recovery.generation < 1 || !/^[A-Za-z0-9._-]+$/.test(recovery.writer_id || '')) fail(errors, 'invalid transition recovery predecessor');
  if (!/^[A-Za-z0-9._:-]+$/.test(recovery.event_id || '') || !iso(recovery.recovered_at)) fail(errors, 'invalid transition recovery event or time');
  if (!HEX.test(recovery.recovery_digest || '') || recovery.recovery_digest !== recoveryDigest(recovery)) fail(errors, 'transition recovery digest mismatch');
  return errors;
}
function readTransitionRecovery(recoveryPath) {
  const recovery = JSON.parse(fs.readFileSync(recoveryPath, 'utf8'));
  const errors = validateTransitionRecovery(recovery);
  if (errors.length) throw new Error(errors.join('; '));
  const match = /^handoff-transition-recovery\.(\d+)\.([0-9a-f]{64})\.json$/.exec(path.basename(recoveryPath));
  if (!match || Number(match[1]) !== recovery.previous_sequence || match[2] !== recovery.recovery_digest) throw new Error('transition recovery filename does not match record');
  return recovery;
}
function recoverTransitionLocked(dir, { sourceRoot, externalControlPlaneRoot, expectedPreviousDigest, expectedIntentDigest, eventId, recoveredAt = new Date().toISOString() } = {}) {
  const lock = path.join(dir, '.handoff.lock');
  const fd = fs.openSync(lock, 'wx');
  try {
    const current = verifyChain(dir, { ignoreOwnLock: true, sourceRoot, externalControlPlaneRoot, verifyLatestSources: false });
    if (current.status !== 'PASS') throw new Error(`current seal history is invalid: ${current.errors.join('; ')}`);
    const predecessor = current.latest;
    if (predecessor.seal_digest !== expectedPreviousDigest) throw new Error('expected previous digest mismatch');
    if (current.pending_intents.length !== 1 || current.pending_intents[0].transition_digest !== expectedIntentDigest) throw new Error('expected unique pending transition intent mismatch');
    if (current.records.some(record => record.event_id === eventId) || current.intents.some(intent => intent.event_id === eventId) || current.recoveries.some(recovery => recovery.event_id === eventId)) throw new Error('event_id already exists in the handoff chain');
    const intent = current.pending_intents[0];
    if (Date.parse(recoveredAt) < Date.parse(intent.prepared_at) || Date.parse(recoveredAt) < Date.parse(predecessor.sealed_at)) throw new Error('recovery time precedes the intent or predecessor');
    const protectedSources = new Set([...CONTROL_IDENTITY_SOURCES, 'control_plane_registry']);
    const audit = () => {
      const errors = verifySourceFiles(predecessor, sourceRoot, externalControlPlaneRoot);
      const drifted = [];
      for (const error of errors) {
        const match = /^source verification failed: ([a-z][a-z0-9_]*): source digest mismatch$/.exec(error);
        if (!match || protectedSources.has(match[1])) throw new Error(`recovery cannot bypass control or unreadable source: ${error}`);
        const name = match[1];
        const source = predecessor.sources[name];
        const root = source.root_ref === 'external_control_plane' ? externalControlPlaneRoot : sourceRoot;
        const resolved = fs.realpathSync(path.resolve(root, source.path_ref));
        if (!insideRoot(root, resolved)) throw new Error(`recovery source escapes root: ${name}`);
        drifted.push({ name, actual_digest: digest(fs.readFileSync(resolved)) });
      }
      const identity = verifyControlIdentity(predecessor, { sourceRoot, externalControlPlaneRoot });
      if (identity.status !== 'PASS') throw new Error(`recovery control identity is not verified: ${identity.errors.join('; ')}`);
      return drifted.sort((a, b) => a.name.localeCompare(b.name));
    };
    const driftedSources = audit();
    if (canonicalJson(driftedSources) !== canonicalJson(audit())) throw new Error('recovery source changed during observation');
    const recovery = { record_type: 'handoff-transition-recovery', intent_digest: intent.transition_digest, previous_seal_digest: predecessor.seal_digest, previous_sequence: predecessor.seal_sequence, generation: predecessor.generation, writer_id: predecessor.writer_id, reason: 'RULE_REBASE', event_id: eventId, recovered_at: recoveredAt, previous_source_status: driftedSources.length ? 'DRIFTED_NONCONTROL' : 'PASS', drifted_sources: driftedSources, recovery_digest: '' };
    recovery.recovery_digest = recoveryDigest(recovery);
    const errors = validateTransitionRecovery(recovery);
    if (errors.length) throw new Error(errors.join('; '));
    const finalPath = path.join(dir, `handoff-transition-recovery.${recovery.previous_sequence}.${recovery.recovery_digest}.json`);
    const tempPath = `${finalPath}.${process.pid}.tmp`;
    const out = fs.openSync(tempPath, 'wx');
    try { fs.writeFileSync(out, `${JSON.stringify(recovery, null, 2)}\n`, 'utf8'); fs.fsyncSync(out); } finally { fs.closeSync(out); }
    fs.renameSync(tempPath, finalPath);
    return { recovery, path: finalPath };
  } finally { fs.closeSync(fd); fs.unlinkSync(lock); }
}
function prepareTransitionLocked(dir, { sourceRoot, externalControlPlaneRoot, expectedPreviousDigest, nextGeneration, nextWriterId, eventId, preparedAt = new Date().toISOString(), authorization } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const lock = path.join(dir, '.handoff.lock');
  const fd = fs.openSync(lock, 'wx');
  try {
    const current = verifyChain(dir, { ignoreOwnLock: true, sourceRoot, externalControlPlaneRoot });
    if (current.status !== 'PASS') throw new Error(`current seal is not live-valid: ${current.errors.join('; ')}`);
    const previous = current.latest;
    if (expectedPreviousDigest !== undefined && expectedPreviousDigest !== previous.seal_digest) throw new Error('expected previous digest mismatch');
    const generationTransition = nextGeneration === previous.generation + 1 && nextWriterId !== previous.writer_id;
    if (!generationTransition) throw new Error('transition intent requires the next generation and a different writer');
    if (current.pending_intents.length) throw new Error('an unconsumed transition intent already exists');
    if (current.recoveries.some(recovery => recovery.previous_seal_digest === previous.seal_digest)) throw new Error('recovered intent requires a new current attestation before preparing another transition');
    if (current.records.some(record => record.event_id === eventId) || current.intents.some(intent => intent.event_id === eventId) || current.recoveries.some(recovery => recovery.event_id === eventId)) throw new Error('event_id already exists in the handoff chain');
    if (Date.parse(preparedAt) < Date.parse(previous.sealed_at)) throw new Error('transition prepared_at precedes predecessor seal');
    const intent = {
      record_type: authorization ? 'handoff-direct-transition-intent' : 'handoff-transition-intent', previous_seal_digest: previous.seal_digest, previous_sequence: previous.seal_sequence,
      previous_generation: previous.generation, previous_writer_id: previous.writer_id, next_generation: nextGeneration,
      next_writer_id: nextWriterId, event_id: eventId, prepared_at: preparedAt, previous_source_status: 'PASS', transition_digest: '',
      ...(authorization ? { authorization: structuredClone(authorization) } : {})
    };
    intent.transition_digest = transitionDigest(intent);
    const intentErrors = validateTransitionIntent(intent);
    if (intentErrors.length) throw new Error(`transition intent invalid: ${intentErrors.join('; ')}`);
    const finalObservation = verifyChain(dir, { ignoreOwnLock: true, sourceRoot, externalControlPlaneRoot });
    if (finalObservation.status !== 'PASS' || finalObservation.latest?.seal_digest !== previous.seal_digest || finalObservation.pending_intents.length) throw new Error('transition source changed before preparation');
    const finalPath = path.join(dir, `handoff-transition.${intent.previous_sequence}.${intent.transition_digest}.json`);
    const tempPath = `${finalPath}.${process.pid}.tmp`;
    const out = fs.openSync(tempPath, 'wx');
    try { fs.writeFileSync(out, `${JSON.stringify(intent, null, 2)}\n`, 'utf8'); fs.fsyncSync(out); } finally { fs.closeSync(out); }
    fs.renameSync(tempPath, finalPath);
    return { intent, path: finalPath };
  } finally { fs.closeSync(fd); fs.unlinkSync(lock); }
}

function appendSealLocked(dir, draft, { expectedPreviousDigest, sourceRoot, externalControlPlaneRoot, transitionTicket } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const lock = path.join(dir, '.handoff.lock');
  const fd = fs.openSync(lock, 'wx');
  try {
    const current = verifyChain(dir, { ignoreOwnLock: true, sourceRoot, externalControlPlaneRoot, verifyLatestSources: false });
    const emptyChainErrors = current.records.length === 0 && current.errors.every(error => error === 'no immutable seal record');
    if (current.errors.length && !emptyChainErrors) throw new Error(`existing chain invalid: ${current.errors.join('; ')}`);
    const previous = current.latest;
    const actualPreviousDigest = previous?.seal_digest ?? null;
    if (expectedPreviousDigest !== undefined && expectedPreviousDigest !== actualPreviousDigest) throw new Error('expected previous digest mismatch');
    if (current.pending_intents.length && !transitionTicket) throw new Error('an unconsumed transition intent must be consumed or explicitly recovered before appending');
    const seal = structuredClone(draft);
    const recovery = current.recoveries.find(item => item.previous_seal_digest === previous?.seal_digest);
    if (recovery && (seal.handoff_phase !== 'CURRENT_ATTESTATION' || Date.parse(seal.sealed_at) < Date.parse(recovery.recovered_at))) throw new Error('recovered intent requires a later same-writer current attestation');
    if (![3, 4].includes(seal.schema_version)) throw new Error('new seal writes require schema_version 3 or 4; schema 1/2 records are read-only legacy history');
    if (previous && seal.generation < previous.generation) throw new Error('generation rollback');
    if (previous && seal.generation === previous.generation && seal.writer_id !== previous.writer_id) throw new Error('writer change without generation transition');
    if (previous && seal.generation > previous.generation && (seal.generation !== previous.generation + 1 || seal.writer_id === previous.writer_id || !['STOPPED_DISPATCH', 'ARCHIVED'].includes(seal.old_writer_status))) throw new Error('unsafe generation transition');
    const previousSourceErrors = previous ? verifySourceFiles(previous, sourceRoot, externalControlPlaneRoot) : [];
    let intent = null;
    if (transitionTicket) {
      const resolvedTicket = fs.realpathSync(path.resolve(transitionTicket));
      const resolvedDir = fs.realpathSync(path.resolve(dir));
      if (path.dirname(resolvedTicket) !== resolvedDir) throw new Error('transition ticket must be stored in the seal directory');
      intent = readTransitionIntent(transitionTicket);
      if (!previous || intent.previous_seal_digest !== previous.seal_digest || intent.previous_sequence !== previous.seal_sequence || intent.previous_generation !== previous.generation || intent.previous_writer_id !== previous.writer_id || intent.next_generation !== seal.generation || intent.next_writer_id !== seal.writer_id || intent.event_id !== seal.event_id) throw new Error('transition intent does not match append');
      if (intent.record_type === 'handoff-direct-transition-intent' && seal.schema_version !== 4) throw new Error('direct recipient evidence requires schema_version 4');
      if (intent.record_type === 'handoff-direct-transition-intent') {
        const body = fs.readFileSync(resolveSource(seal.sources.status_index, { sourceRoot, externalControlPlaneRoot }), 'utf8').split('<!-- CURRENT:BEGIN -->')[1]?.split('<!-- CURRENT:END -->')[0];
        const mapping = JSON.parse(body?.match(/<!-- CONTROL_IDENTITY: (.*?) -->/)?.[1] || 'null');
        if (mapping?.platform_task_id !== intent.authorization.recipient_platform_id || body?.match(/^项目键：([^\r\n]+)$/m)?.[1]?.trim() !== intent.authorization.project_key) throw new Error('direct intent recipient platform or project does not match new CURRENT');
      }
      seal.transition = { intent_digest: intent.transition_digest, previous_seal_digest: intent.previous_seal_digest, prepared_at: intent.prepared_at };
    } else if (previousSourceErrors.length && seal.handoff_phase !== 'CURRENT_ATTESTATION') throw new Error(previousSourceErrors.join('; '));
    if (previous && seal.generation > previous.generation && !intent) throw new Error('generation transition requires a pre-update intent');
    if (intent && (!previous || seal.generation === previous.generation)) throw new Error('transition intent may only be consumed by a generation transition');
    if (previous && seal.generation > previous.generation && seal.switch_status !== 'COMPLETED') throw new Error('generation transition requires a completed seal');
    if (seal.handoff_phase === 'CURRENT_ATTESTATION' && (!previous || seal.generation !== previous.generation || seal.writer_id !== previous.writer_id || transitionTicket)) throw new Error('current attestation requires an existing seal with the same generation and writer');
    seal.seal_sequence = (previous?.seal_sequence ?? 0) + 1;
    seal.previous_seal_digest = previous?.seal_digest ?? null;
    if (current.records.some(record => record.event_id === seal.event_id) || current.intents.some(previousIntent => previousIntent.event_id === seal.event_id && previousIntent.transition_digest !== intent?.transition_digest) || current.recoveries.some(recovery => recovery.event_id === seal.event_id)) throw new Error('event_id already exists in the handoff chain');
    if (previous && Date.parse(seal.fact_cutoff) < Date.parse(previous.fact_cutoff)) throw new Error('fact_cutoff rollback');
    if (previous && Date.parse(seal.sealed_at) < Date.parse(previous.sealed_at)) throw new Error('sealed_at rollback');
    if (intent && Date.parse(intent.prepared_at) > Date.parse(seal.sealed_at)) throw new Error('transition prepared_at follows takeover seal');
    if (seal.handoff_phase === 'CURRENT_ATTESTATION' && previous) {
      const names = new Set([...Object.keys(previous.sources ?? {}), ...Object.keys(seal.sources ?? {})]);
      if (![...names].some(name => previous.sources?.[name]?.digest !== seal.sources?.[name]?.digest)) throw new Error('current attestation requires at least one changed source digest');
    }
    seal.seal_digest = sealDigest(seal);
    const errors = validateSeal(seal, { requireExtensions: true });
    if (errors.length) throw new Error(`draft invalid: ${errors.join('; ')}`);
    if (seal.control_handoff_confidence === 'HIGH' || ['READY', 'READY_WITH_RESTRICTIONS', 'COMPLETED'].includes(seal.switch_status)) {
      const sourceErrors = verifySourceFiles(seal, sourceRoot, externalControlPlaneRoot);
      if (sourceErrors.length) throw new Error(sourceErrors.join('; '));
      if (seal.sources.central_entry || seal.sources.workflow_enablement) {
        const identity = verifyControlIdentity(seal, { sourceRoot, externalControlPlaneRoot });
        if (identity.status !== 'PASS') throw new Error(`control identity verification failed: ${identity.errors.join('; ')}`);
      }
    }
    const finalName = `handoff-state.${seal.seal_sequence}.${seal.seal_digest}.json`;
    const tempName = `${finalName}.${process.pid}.tmp`;
    const tempPath = path.join(dir, tempName);
    const finalPath = path.join(dir, finalName);
    const out = fs.openSync(tempPath, 'wx');
    try { fs.writeFileSync(out, `${JSON.stringify(seal, null, 2)}\n`, 'utf8'); fs.fsyncSync(out); } finally { fs.closeSync(out); }
    fs.renameSync(tempPath, finalPath);
    return seal;
  } finally { fs.closeSync(fd); fs.unlinkSync(lock); }
}


// Every supported writer uses the same canonical index lock, then the chain lock.
export function prepareTransition(dir, options = {}) {
  if (options.authorization) throw new Error('direct confirmation requires the versioned direct entry');
  const previous = readChain(dir, { ignoreOwnLock: true }).records.at(-1);
  return withControlLock(previous, options, () => { assertControlReady(previous, options); return prepareTransitionLocked(dir, options); });
}
// Structural evidence checks cannot authenticate a caller. The receiving agent must
// first resolve evidence_ref to the actual current operator message, not an attachment.
export function validateDirectConfirmation(value, recipient, previous) {
  const keys = ['protocol_version', 'origin', 'evidence_ref', 'confirmed_at', 'project_key', 'previous_seal_digest', 'old_generation', 'old_writer_id', 'old_writer_status', 'recipient_writer_id', 'recipient_platform_id', 'scope', 'transfer_confirmed'];
  if (!exactKeys(value, keys) || keys.some(key => !Object.hasOwn(value, key))) return ['direct confirmation fields required'];
  const errors = [];
  if (value.protocol_version !== 1 || value.origin !== 'CURRENT_OPERATOR_MESSAGE' || value.scope !== 'HANDOFF_PREPARE_COMMIT_ONLY' || value.transfer_confirmed !== true || typeof value.evidence_ref !== 'string' || !value.evidence_ref.trim() || !iso(value.confirmed_at)) errors.push('direct operator confirmation and original evidence required');
  if (!['STOPPED_DISPATCH', 'ARCHIVED'].includes(value.old_writer_status)) errors.push('old writer must be explicitly stopped');
  if (value.previous_seal_digest !== previous?.seal_digest || value.old_generation !== previous?.generation || value.old_writer_id !== previous?.writer_id) errors.push('confirmation predecessor mismatch');
  if (!recipient || value.recipient_writer_id !== recipient.writerId || value.recipient_platform_id !== recipient.platformTaskId || value.project_key !== recipient.projectKey || !/^[A-Za-z0-9._-]+$/.test(recipient.writerId || '') || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(recipient.platformTaskId || '') || typeof recipient.projectKey !== 'string' || !recipient.projectKey.trim()) errors.push('confirmation recipient or project mismatch');
  if (value.recipient_writer_id === previous?.writer_id) errors.push('confirmation requires a different recipient writer');
  return errors;
}
export function prepareDirectTransition(dir, options) {
  const previous = readChain(dir, { ignoreOwnLock: true }).records.at(-1);
  const errors = validateDirectConfirmation(options.confirmation, options.recipient, previous);
  if (errors.length) throw new Error(errors.join('; '));
  return withControlLock(previous, options, () => {
    assertControlReady(previous, options);
    return prepareTransitionLocked(dir, { ...options, expectedPreviousDigest: previous.seal_digest, nextGeneration: previous.generation + 1, nextWriterId: options.recipient.writerId, authorization: options.confirmation });
  });
}
export function recoverTransition(dir, options = {}) {
  const previous = readChain(dir, { ignoreOwnLock: true }).records.at(-1);
  return withControlLock(previous, options, () => { assertControlReady(previous, options); return recoverTransitionLocked(dir, options); });
}
export function appendSeal(dir, draft, options = {}) {
  const previous = readChain(dir, { ignoreOwnLock: true }).records.at(-1);
  const anchor = previous || draft;
  return withControlLock(anchor, options, () => {
    assertControlReady(anchor, options);
    if (previous && resolveSource(previous.sources.status_index, options) !== resolveSource(draft.sources.status_index, options)) throw new Error('canonical index change requires explicit migration');
    return appendSealLocked(dir, draft, options);
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [command, target, sourceRoot, ...rest] = process.argv.slice(2);
  if (command === 'verify' && target) { const historicalOnly = rest.includes('--history-only'); const externalControlPlaneRoot = rest.find(value => value.startsWith('--external-control-plane-root='))?.slice('--external-control-plane-root='.length); const result = verifyChain(path.resolve(target), { sourceRoot, externalControlPlaneRoot, verifyLatestSources: !historicalOnly }); console.log(JSON.stringify(result, null, 2)); process.exitCode = result.status === 'PASS' ? 0 : 1; }
  else if (command === 'prepare' && target && sourceRoot && rest.length >= 3) { const [nextGeneration, nextWriterId, eventId] = rest; const externalControlPlaneRoot = rest.find(value => value.startsWith('--external-control-plane-root='))?.slice('--external-control-plane-root='.length); const result = prepareTransition(path.resolve(target), { sourceRoot, externalControlPlaneRoot, nextGeneration: Number(nextGeneration), nextWriterId, eventId }); console.log(JSON.stringify(result, null, 2)); }
  else if (command === 'recover' && target && sourceRoot && rest.length >= 3) { const [previousDigest, intentDigest, eventId] = rest; const externalControlPlaneRoot = rest.find(value => value.startsWith('--external-control-plane-root='))?.slice('--external-control-plane-root='.length); const result = recoverTransition(path.resolve(target), { sourceRoot, externalControlPlaneRoot, expectedPreviousDigest: previousDigest, expectedIntentDigest: intentDigest, eventId }); console.log(JSON.stringify(result, null, 2)); }
  else if (command === 'append' && target && sourceRoot && rest.length >= 1) { const [draftPath, transitionTicket] = rest; const externalControlPlaneRoot = rest.find(value => value.startsWith('--external-control-plane-root='))?.slice('--external-control-plane-root='.length); const draft = JSON.parse(fs.readFileSync(draftPath, 'utf8')); const result = appendSeal(path.resolve(target), draft, { sourceRoot, externalControlPlaneRoot, transitionTicket }); console.log(JSON.stringify(result, null, 2)); }
  else { console.error('usage: node HandoffSeal.mjs verify <seal-directory> <source-root> [--external-control-plane-root=<root>] [--history-only] | prepare <seal-directory> <source-root> <next-generation> <next-writer-id> <event-id> [--external-control-plane-root=<root>] | recover <seal-directory> <source-root> <previous-digest> <intent-digest> <recovery-event-id> [--external-control-plane-root=<root>] | append <seal-directory> <source-root> <draft-json> [transition-ticket] [--external-control-plane-root=<root>]'); process.exitCode = 2; }
}
