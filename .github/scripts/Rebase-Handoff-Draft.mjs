// Rebuild a handoff candidate from the same breakpoint.  This is deliberately
// separate from Prepare-Handoff: it never appends a seal, changes CURRENT, or
// creates a final attachment.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readGitWorkspaceBaseline, readLiveRemoteBaseline, verifyRuleManifest } from './Prepare-Handoff.mjs';

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const inside = (root, candidate) => { const rel = path.relative(root, candidate); return rel === '' || (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel)); };
const writeExclusive = (file, value) => { if (fs.existsSync(file)) throw new Error(`refusing to overwrite rebased draft: ${file}`); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); };

export function rebaseHandoffDraft(configPath, outputDraftPath) {
  const absoluteConfig = path.resolve(configPath);
  const configDir = path.dirname(absoluteConfig);
  const config = JSON.parse(fs.readFileSync(absoluteConfig, 'utf8'));
  const sourceRoot = fs.realpathSync(path.resolve(configDir, config.source_root));
  const draft = JSON.parse(fs.readFileSync(path.resolve(configDir, config.draft_path), 'utf8'));
  const ruleRoot = fs.realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '总指挥工作流', '第二代总指挥的工作模式'));
  const manifestPath = path.resolve(configDir, config.rule_manifest_path);
  const manifest = verifyRuleManifest(ruleRoot, manifestPath);
  const manifestDigest = sha256(fs.readFileSync(manifestPath));
  const cutoff = new Date().toISOString();
  const rebased = structuredClone(draft);
  rebased.rule_baseline = { rule_version: manifest.rule_version, manifest_sha256: manifestDigest, mode: 'LIVE', source_role: 'CANDIDATE_PINNED_BASELINE', compatibility: 'AFFECTED_RECHECK', action: 'REBASE' };
  rebased.fact_cutoff = cutoff;
  rebased.sealed_at = cutoff;
  rebased.seal_sequence = 0;
  rebased.previous_seal_digest = null;
  rebased.seal_digest = '';
  rebased.source_digest_status = 'PASS';
  for (const source of Object.values(rebased.sources ?? {})) {
    const root = source.root_ref === 'external_control_plane' ? null : sourceRoot;
    if (!root) throw new Error('INPUT_REQUIRED: external_control_plane rebase is not supported by this entry; use an authorized owner-managed draft');
    const absolute = fs.realpathSync(path.resolve(root, source.path_ref));
    if (!inside(root, absolute)) throw new Error(`source escapes source_root: ${source.path_ref}`);
    source.digest = sha256(fs.readFileSync(absolute));
    source.fact_cutoff = cutoff;
  }
  rebased.workspace = { ...(rebased.workspace ?? {}), root_ref: '.', ...readGitWorkspaceBaseline(sourceRoot, rebased.workspace?.required_untracked?.map(item => item.path_ref) ?? [], rebased.workspace?.inflight_scope ?? null) };
  if (rebased.remote?.status === 'PASS') {
    try {
      const live = readLiveRemoteBaseline(sourceRoot, rebased.remote.default_ref);
      rebased.remote = { status: 'PASS', default_ref: rebased.remote.default_ref, head: live.head, observed_at: live.observed_at };
      rebased.fact_cutoff = live.observed_at;
      rebased.sealed_at = live.observed_at;
    } catch {
      rebased.remote = { status: 'UNKNOWN', default_ref: rebased.remote.default_ref, head: null, observed_at: null };
      rebased.switch_status = 'READY_WITH_RESTRICTIONS';
      rebased.control_handoff_confidence = 'MEDIUM';
      rebased.candidate_verification_status = 'PASS_WITH_RESTRICTIONS';
    }
  }
  writeExclusive(path.resolve(outputDraftPath), rebased);
  return { draft_path: path.resolve(outputDraftPath), rule_version: manifest.rule_version, manifest_sha256: manifestDigest, remote_status: rebased.remote?.status, workspace_head: rebased.workspace.head };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 4) { console.error('usage: node Rebase-Handoff-Draft.mjs <config-json> <new-draft-json>'); process.exitCode = 2; }
  else { try { console.log(JSON.stringify(rebaseHandoffDraft(process.argv[2], process.argv[3]), null, 2)); } catch (error) { console.error(error.message); process.exitCode = 1; } }
}
