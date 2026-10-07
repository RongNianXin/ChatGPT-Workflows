import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { verifyChain } from './HandoffSeal.mjs';
import { classifyRuleDrift, verifyRuleManifest, verifyWorkspaceBaseline, readLiveRemoteBaseline } from './Prepare-Handoff.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultWorkflowRoot = path.resolve(here, '..', '..', '总指挥工作流', '第二代总指挥的工作模式');
const sha = value => String(value || '').toLowerCase();

export function verifyHandoffCandidate({ sealDirectory, sourceRoot, externalControlPlaneRoot, workflowRoot = defaultWorkflowRoot, manifestPath = path.join(workflowRoot, '规则刷新manifest.json'), remoteRequired = false } = {}) {
  const result = { status: 'BLOCKED', chain: null, rule: null, workspace: null, remote: null, actions: [], errors: [] };
  let chain;
  try { chain = verifyChain(sealDirectory, { sourceRoot, externalControlPlaneRoot }); } catch (error) { result.errors.push(`SEAL_VERIFY_FAILED: ${error.message}`); return result; }
  result.chain = { status: chain.status, control_status: chain.control_status, handoff_ready: chain.handoff_ready, latest_source_status: chain.latest_source_status, phase: chain.latest?.handoff_phase ?? null };
  if (chain.status !== 'PASS' || chain.control_status !== 'READY' || !chain.latest) { result.errors.push(...(chain.errors || ['candidate seal is not ready'])); return result; }
  if (chain.latest.handoff_phase !== 'MATERIAL_PREPARED') {
    result.errors.push(`CANDIDATE_PHASE_INVALID: expected MATERIAL_PREPARED, found ${chain.latest.handoff_phase}`);
    result.actions.push('已完成接管的封条只能按历史/当前状态核验，不能重复作为候选输入');
    return result;
  }
  let liveManifest;
  try { liveManifest = verifyRuleManifest(workflowRoot, manifestPath); }
  catch (error) { result.rule = { status: error.message.startsWith('INPUT_REQUIRED:') ? 'INPUT_REQUIRED' : 'FAIL' }; result.errors.push(`RULE_SOURCE_INVALID: ${error.message}`); return result; }
  const liveManifestDigest = liveManifest && fs.existsSync(manifestPath)
    ? crypto.createHash('sha256').update(fs.readFileSync(manifestPath)).digest('hex') : null;
  const pinned = chain.latest.rule_baseline || {};
  const live = { rule_version: liveManifest.rule_version, manifest_sha256: liveManifestDigest };
  const drift = classifyRuleDrift({ pinned, live });
  result.rule = { status: drift.status, action: drift.action, pinned: { rule_version: pinned.rule_version, manifest_sha256: pinned.manifest_sha256 }, live };
  if (drift.status !== 'SAME') {
    result.errors.push(`RULE_REBASE_PENDING: ${drift.status}`);
    result.actions.push('由仍拥有唯一写权的移交方在原断点重建候选并重新运行 1C/1D');
    return result;
  }
  const workspaceErrors = verifyWorkspaceBaseline(sourceRoot, chain.latest.workspace);
  result.workspace = { status: workspaceErrors.length ? 'FAIL' : 'PASS', errors: workspaceErrors };
  if (workspaceErrors.length) { result.errors.push(...workspaceErrors); return result; }
  try {
    const remote = readLiveRemoteBaseline(sourceRoot, chain.latest.remote?.default_ref || 'origin/main');
    result.remote = { status: 'PASS', head: remote.head, observed_at: remote.observed_at };
  } catch (error) {
    result.remote = { status: 'UNKNOWN', error: error.message };
    if (remoteRequired) { result.errors.push(`REMOTE_REQUIRED: ${error.message}`); return result; }
    result.actions.push('远端暂不可观察；下一步不依赖远端时可保持 READY_WITH_RESTRICTIONS，恢复后重核');
  }
  if (result.remote?.status === 'PASS' && chain.latest.remote?.status === 'PASS' && sha(result.remote.head) !== sha(chain.latest.remote.head)) {
    result.remote = { ...result.remote, status: 'FAIL', pinned_head: chain.latest.remote?.head ?? null };
    result.errors.push('REMOTE_BASELINE_DRIFT: observed remote HEAD differs from the candidate baseline');
    result.actions.push('远端基线已变化；由移交方核对差额并重建候选。下一步依赖远端时暂停，不按网络不可观察处理');
    if (remoteRequired) return result;
  }
  result.status = result.remote?.status !== 'PASS' || chain.latest.switch_status === 'READY_WITH_RESTRICTIONS' ? 'READY_WITH_RESTRICTIONS' : 'READY';
  return result;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [sealDirectory, sourceRoot, ...rest] = process.argv.slice(2);
  if (!sealDirectory || !sourceRoot) { console.error('usage: node Verify-Handoff-Candidate.mjs <seal-directory> <source-root> [--external-control-plane-root=<root>] [--remote-required]'); process.exitCode = 2; }
  else {
    const externalRootValue = rest.find(value => value.startsWith('--external-control-plane-root='))?.slice('--external-control-plane-root='.length);
    const externalControlPlaneRoot = externalRootValue?.trim() ? path.resolve(externalRootValue) : undefined;
    const output = verifyHandoffCandidate({ sealDirectory: path.resolve(sealDirectory), sourceRoot: path.resolve(sourceRoot), externalControlPlaneRoot, remoteRequired: rest.includes('--remote-required') });
    console.log(JSON.stringify(output, null, 2));
    process.exitCode = ['READY', 'READY_WITH_RESTRICTIONS'].includes(output.status) ? 0 : 1;
  }
}
