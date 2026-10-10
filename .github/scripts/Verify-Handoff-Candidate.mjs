import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { verifyChain } from './HandoffSeal.mjs';
import { assertPrivateControlStorage } from './HandoffControl.mjs';
import { classifyRuleDrift, verifyRuleManifest, verifyWorkspaceBaseline, readLiveRemoteBaseline } from './Prepare-Handoff.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultWorkflowRoot = path.resolve(here, '..', '..', '总指挥工作流', '第二代总指挥的工作模式');
const sha = value => String(value || '').toLowerCase();

// Material readiness permits a stop recommendation; actual takeover still needs
// direct operator confirmation and the receiving-agent commit entry.
function verifyRotation(chain, { nextGeneration, nextWriterId, eventId }) {
  const result = { status: 'NOT_PREPARED', can_stop_old: false, errors: [] };
  const target = [nextGeneration, nextWriterId, eventId];
  const supplied = target.some(value => value !== undefined);
  if (supplied && (!Number.isSafeInteger(nextGeneration) || nextGeneration !== chain.latest.generation + 1 ||
      typeof nextWriterId !== 'string' || !/^[A-Za-z0-9._-]+$/.test(nextWriterId) || nextWriterId === chain.latest.writer_id ||
      typeof eventId !== 'string' || !/^[A-Za-z0-9._:-]+$/.test(eventId))) {
    return { ...result, status: 'INPUT_REQUIRED', errors: ['INPUT_REQUIRED: provide the next generation, different writer and takeover event as one valid target'] };
  }
  const intents = chain.pending_intents || [];
  if (!intents.length) return { ...result, status: 'DIRECT_PREPARE_AVAILABLE', can_stop_old: true };
  if (!supplied) return { ...result, status: 'TARGET_REQUIRED', errors: ['INPUT_REQUIRED: bind the pending intent to this candidate before stopping the old writer'] };
  if (intents.length !== 1 || intents[0].next_generation !== nextGeneration || intents[0].next_writer_id !== nextWriterId || intents[0].event_id !== eventId) {
    return { ...result, status: 'MISMATCH', errors: ['ROTATION_TARGET_MISMATCH: pending intent does not match this candidate target'] };
  }
  return { ...result, status: 'MATCHED', can_stop_old: true };
}

export function verifyHandoffCandidate({ sealDirectory, sourceRoot, externalControlPlaneRoot, workflowRoot = defaultWorkflowRoot, manifestPath = path.join(workflowRoot, '规则刷新manifest.json'), remoteRequired = false, nextGeneration, nextWriterId, eventId } = {}) {
  const result = { status: 'BLOCKED', chain: null, rule: null, workspace: null, remote: null, rotation: { status: 'NOT_CHECKED', can_stop_old: false, errors: [] }, actions: [], errors: [] };
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
  try { assertPrivateControlStorage(chain.latest, { sourceRoot, externalControlPlaneRoot }); }
  catch (error) {
    result.errors.push(error.message);
    result.actions.push('材料链与登记存储分开判断：未停旧时不得建议停旧；已停旧时不得恢复旧调度。由获准执行方保留原件，准备私有布局及重新绑定候选。公共修复不代来源迁移，无需手拼参数');
    return result;
  }
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
    result.actions.push('规则变化只暂停受影响切换；接收方定点核验并保存新观察，无法证明安全时给出最小恢复，不正常返旧取票据');
    return result;
  }
  const workspaceErrors = verifyWorkspaceBaseline(sourceRoot, chain.latest.workspace, chain.latest.sources, { externalControlPlaneRoot, ruleBaseline: chain.latest.rule_baseline, workflowRepositoryRoot: path.resolve(workflowRoot, '../..') });
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
  // A stop recommendation must use an unchanged observation group, not the first cached chain.
  try {
    const finalChain = verifyChain(sealDirectory, { sourceRoot, externalControlPlaneRoot });
    assertPrivateControlStorage(finalChain.latest, { sourceRoot, externalControlPlaneRoot });
    const finalManifest = verifyRuleManifest(workflowRoot, manifestPath);
    const finalManifestDigest = crypto.createHash('sha256').update(fs.readFileSync(manifestPath)).digest('hex');
    const finalWorkspaceErrors = verifyWorkspaceBaseline(sourceRoot, chain.latest.workspace, chain.latest.sources, { externalControlPlaneRoot, ruleBaseline: chain.latest.rule_baseline, workflowRepositoryRoot: path.resolve(workflowRoot, '../..') });
    const intents = value => JSON.stringify((value.pending_intents || []).map(intent => intent.transition_digest).sort());
    if (finalChain.status !== 'PASS' || finalChain.control_status !== 'READY' ||
        finalChain.latest?.seal_digest !== chain.latest.seal_digest || intents(finalChain) !== intents(chain) ||
        finalManifest.rule_version !== live.rule_version || finalManifestDigest !== live.manifest_sha256 || finalWorkspaceErrors.length) {
      result.chain = { status: finalChain.status, control_status: finalChain.control_status, handoff_ready: finalChain.handoff_ready, latest_source_status: finalChain.latest_source_status, phase: finalChain.latest?.handoff_phase ?? null };
      result.workspace = { status: finalWorkspaceErrors.length ? 'FAIL' : 'PASS', errors: finalWorkspaceErrors };
      result.errors.push('CANDIDATE_CHANGED_DURING_VERIFY: chain, intent, rules or protected workspace changed before return', ...(finalChain.errors || []), ...finalWorkspaceErrors);
      result.actions.push('核验期间证据已变化；只重新核对受影响来源与候选，完成前不得提示停旧');
      return result;
    }
    chain = finalChain;
  } catch (error) {
    result.errors.push(`CANDIDATE_CHANGED_DURING_VERIFY: final observation could not be verified: ${error.message}`);
    result.actions.push('返回前复核未完成；补齐具体缺口后重新核验，不按旧缓存提示停旧');
    return result;
  }
  result.status = result.remote?.status !== 'PASS' || chain.latest.switch_status === 'READY_WITH_RESTRICTIONS' ? 'READY_WITH_RESTRICTIONS' : 'READY';
  result.rotation = verifyRotation(chain, { nextGeneration, nextWriterId, eventId });
  if (!result.rotation.can_stop_old) {
    result.actions.push(result.rotation.status === 'NOT_PREPARED'
      ? '材料已通过；接收方在操作者直接停旧及转权确认后内部准备并提交，不要求另取票据'
      : '材料与停旧条件分别判定；先补齐或核对本候选目标及匹配轮换意图，暂不提示操作者停旧');
  }
  return result;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [sealDirectory, sourceRoot, ...rest] = process.argv.slice(2);
  if (!sealDirectory || !sourceRoot) { console.error('usage: node Verify-Handoff-Candidate.mjs <seal-directory> <source-root> [--external-control-plane-root=<root>] [--remote-required] [--next-generation=<n> --next-writer-id=<writer> --takeover-event-id=<event>]'); process.exitCode = 2; }
  else {
    const externalRootValue = rest.find(value => value.startsWith('--external-control-plane-root='))?.slice('--external-control-plane-root='.length);
    const externalControlPlaneRoot = externalRootValue?.trim() ? path.resolve(externalRootValue) : undefined;
    const flag = name => rest.find(value => value.startsWith(`${name}=`))?.slice(name.length + 1);
    const generationValue = flag('--next-generation');
    const malformedTarget = ['--next-generation', '--next-writer-id', '--takeover-event-id'].some(name =>
      rest.includes(name) || rest.filter(value => value.startsWith(`${name}=`)).length > 1);
    const output = verifyHandoffCandidate({ sealDirectory: path.resolve(sealDirectory), sourceRoot: path.resolve(sourceRoot), externalControlPlaneRoot, remoteRequired: rest.includes('--remote-required'),
      nextGeneration: malformedTarget ? NaN : generationValue === undefined ? undefined : Number(generationValue), nextWriterId: flag('--next-writer-id'), eventId: flag('--takeover-event-id') });
    console.log(JSON.stringify(output, null, 2));
    process.exitCode = ['READY', 'READY_WITH_RESTRICTIONS'].includes(output.status) ? 0 : 1;
  }
}
