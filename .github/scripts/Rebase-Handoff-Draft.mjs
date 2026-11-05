// Rebuild a handoff candidate from the same breakpoint.  This is deliberately
// separate from Prepare-Handoff: it never appends a seal, changes CURRENT, or
// creates a final attachment.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { validateSealDraftForAppend, normalizeCurrentMigrationDraft } from './HandoffSeal.mjs';
import { readGitWorkspaceBaseline, readLiveRemoteBaseline, verifyRuleManifest, verifyWorkspaceBaseline } from './Prepare-Handoff.mjs';

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const inside = (root, candidate) => { const rel = path.relative(root, candidate); return rel === '' || (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel)); };
const writeExclusive = (file, value) => { if (fs.existsSync(file)) throw new Error(`refusing to overwrite rebased draft: ${file}`); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' }); };

export function rebaseHandoffDraft(configPath, outputDraftPath) {
  const absoluteConfig = path.resolve(configPath);
  const configDir = path.dirname(absoluteConfig);
  const config = JSON.parse(fs.readFileSync(absoluteConfig, 'utf8'));
  const sourceRoot = fs.realpathSync(path.resolve(configDir, config.source_root));
  const externalRoot = config.external_control_plane_root ? fs.realpathSync(path.resolve(configDir, config.external_control_plane_root)) : null;
  const draft = JSON.parse(fs.readFileSync(path.resolve(configDir, config.draft_path), 'utf8'));
  const ruleRoot = fs.realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '总指挥工作流', '第二代总指挥的工作模式'));
  const manifestPath = path.resolve(configDir, config.rule_manifest_path);
  const manifest = verifyRuleManifest(ruleRoot, manifestPath);
  const manifestDigest = sha256(fs.readFileSync(manifestPath));
  const cutoff = new Date().toISOString();
  const wasCurrentMigration = draft?.handoff_phase === 'CURRENT_MIGRATION';
  const observedFiles = new Map();
  if (draft.remote?.status === 'NOT_APPLICABLE') throw new Error('INPUT_REQUIRED: formal handoff currently requires remote PASS or v4 UNKNOWN with REMOTE_UNOBSERVED; offline handoff is not supported by this entry');
  const rebased = wasCurrentMigration ? normalizeCurrentMigrationDraft(draft) : structuredClone(draft);
  rebased.rule_baseline = { rule_version: manifest.rule_version, manifest_sha256: manifestDigest, mode: 'LIVE', source_role: 'CANDIDATE_PINNED_BASELINE', compatibility: 'AFFECTED_RECHECK', action: 'REBASE' };
  rebased.fact_cutoff = cutoff;
  rebased.sealed_at = cutoff;
  rebased.seal_sequence = 0;
  rebased.previous_seal_digest = null;
  rebased.seal_digest = '';
  rebased.source_digest_status = 'PASS';
  for (const source of Object.values(rebased.sources ?? {})) {
    const root = source.root_ref === 'external_control_plane' ? externalRoot : sourceRoot;
    if (!root) throw new Error('INPUT_REQUIRED: external_control_plane_root is required for external sources');
    const absolute = fs.realpathSync(path.resolve(root, source.path_ref));
    if (!inside(root, absolute)) throw new Error(`source escapes source_root: ${source.path_ref}`);
    const actualDigest = sha256(fs.readFileSync(absolute));
    if (wasCurrentMigration && actualDigest !== source.digest) throw new Error(`INPUT_REQUIRED: sealed migration source changed: ${source.path_ref}; a receiver observation cannot replace historical source bytes`);
    if (source === rebased.sources?.handoff_inventory && actualDigest !== source.digest) {
      throw new Error('INPUT_REQUIRED: handoff_inventory changed after the draft was frozen; refresh its business facts from the current breakpoint and rebuild the candidate instead of silently rebasing its digest');
    }
    source.digest = actualDigest;
    source.fact_cutoff = cutoff;
    observedFiles.set(absolute, actualDigest);
  }
  const requiredItems = rebased.workspace?.required_untracked ?? [];
  if (!Array.isArray(requiredItems)) throw new Error('required_untracked must be an array');
  const requiredReasons = new Map();
  for (const item of requiredItems) {
    const ref = item?.path_ref;
    if (typeof ref !== 'string' || !ref || path.isAbsolute(ref) || path.win32.isAbsolute(ref) || ref.split(/[\\/]+/).includes('..') || requiredReasons.has(ref)) throw new Error('invalid or duplicate required_untracked path');
    requiredReasons.set(ref, item.reason);
  }
  const requiredRefs = requiredItems.map(item => item.path_ref);
  const refreshedRequired = requiredRefs.map(ref => {
    const absolute = fs.realpathSync(path.resolve(sourceRoot, ref));
    if (!inside(sourceRoot, absolute) || !fs.statSync(absolute).isFile()) throw new Error(`required file escapes source_root or is not a file: ${ref}`);
    const digest = sha256(fs.readFileSync(absolute));
    observedFiles.set(absolute, digest);
    return { path_ref: ref, sha256: digest, reason: requiredReasons.get(ref) ?? 'required handoff evidence' };
  });
  const liveWorkspace = readGitWorkspaceBaseline(sourceRoot, requiredRefs, rebased.workspace?.inflight_scope ?? null);
  if (!liveWorkspace?.head) throw new Error('INPUT_REQUIRED: a readable Git HEAD and workspace are required for rebase');
  rebased.workspace = {
    ...(rebased.workspace ?? {}),
    root_ref: draft.workspace?.root_ref ?? '.',
    ...liveWorkspace,
    required_untracked: refreshedRequired
  };
  if (rebased.remote?.status !== 'NOT_APPLICABLE' && rebased.remote?.default_ref) {
    try {
      const live = readLiveRemoteBaseline(sourceRoot, rebased.remote.default_ref);
      rebased.remote = { status: 'PASS', default_ref: rebased.remote.default_ref, head: live.head, observed_at: live.observed_at };
      rebased.fact_cutoff = live.observed_at;
      rebased.sealed_at = live.observed_at;
    } catch (error) {
      if (['REMOTE_PROBE_TIMEOUT', 'REMOTE_PROBE_ABORTED'].includes(error.code)) throw error;
      rebased.remote = { status: 'UNKNOWN', default_ref: rebased.remote.default_ref, head: null, observed_at: null };
      rebased.switch_status = 'READY_WITH_RESTRICTIONS';
      rebased.control_handoff_confidence = 'MEDIUM';
      rebased.candidate_verification_status = 'PASS_WITH_RESTRICTIONS';
    }
  }
  if (rebased.schema_version >= 4) {
    rebased.restrictions = (rebased.restrictions ?? []).filter(value => value !== 'REMOTE_UNOBSERVED');
    if (rebased.remote?.status === 'UNKNOWN') rebased.restrictions.push('REMOTE_UNOBSERVED');
  }
  if (wasCurrentMigration) {
    // CURRENT_MIGRATION is a completed control-plane migration record, not a
    // candidate that the receiving window can verify.  This entry creates a
    // new observation at the current breakpoint without touching the old seal.
    rebased.handoff_phase = 'MATERIAL_PREPARED';
    rebased.switch_status = rebased.remote?.status === 'PASS' && rebased.restrictions?.length === 0
      ? 'READY'
      : 'READY_WITH_RESTRICTIONS';
    rebased.candidate_verification_status = rebased.switch_status === 'READY'
      ? 'PASS'
      : 'PASS_WITH_RESTRICTIONS';
    rebased.transition = null;
    rebased.migration = null;
  }
  for (const [file, digest] of observedFiles) {
    if (sha256(fs.readFileSync(file)) !== digest) throw new Error(`INPUT_REQUIRED: evidence changed during rebase: ${path.relative(sourceRoot, file)}`);
  }
  if (sha256(fs.readFileSync(manifestPath)) !== manifestDigest) throw new Error('RULE_REBASE_PENDING: manifest changed during rebase');
  const drift = verifyWorkspaceBaseline(sourceRoot, rebased.workspace, rebased.sources, { externalControlPlaneRoot: externalRoot, ruleBaseline: rebased.rule_baseline, workflowRepositoryRoot: path.resolve(ruleRoot, '../..') });
  if (drift.length) throw new Error(`INPUT_REQUIRED: workspace changed during rebase: ${drift.join('; ')}`);
  const errors = validateSealDraftForAppend(rebased);
  if (errors.length) throw new Error(`invalid rebased observation: ${errors.join('; ')}`);
  writeExclusive(path.resolve(outputDraftPath), rebased);
  return { draft_path: path.resolve(outputDraftPath), rule_version: manifest.rule_version, manifest_sha256: manifestDigest, remote_status: rebased.remote?.status, workspace_head: rebased.workspace.head };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 4) { console.error('usage: node Rebase-Handoff-Draft.mjs <config-json> <new-draft-json>'); process.exitCode = 2; }
  else { try { console.log(JSON.stringify(rebaseHandoffDraft(process.argv[2], process.argv[3]), null, 2)); } catch (error) { console.error(error.message); process.exitCode = 1; } }
}
