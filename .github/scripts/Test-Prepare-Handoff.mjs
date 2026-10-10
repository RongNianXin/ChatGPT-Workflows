// Contract tests for formal handoff artifact preparation.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { classifyRuleDrift, detectUnicodeCollisions, findActiveControlPlaneIndexes, prepareFormalHandoff, readGitWorkspaceBaseline, readLiveRemoteBaseline, REQUIRED_RULES, verifyWorkspaceBaseline, verifyRuleManifest } from './Prepare-Handoff.mjs';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'prepare-handoff-'));
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const workflowRoot = path.resolve(scriptDir, '..', '..');
const sourceRoot = path.join(temp, '项目 来源');
const outputRoot = path.join(temp, '交付 输出');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const stamp = '2026-09-21T02:00:00.000Z';
const LONG_STATUS_PATH = `状态/${'长目录'.repeat(30)}/${'嵌套'.repeat(30)}/索引.md`;
let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log(`PASS: ${name}`); };

check('rule drift classifier separates same, compatible, affected and unavailable epochs', () => {
  const pinned = { rule_version: '2026-10-05.21', manifest_sha256: 'a'.repeat(64) };
  assert.deepEqual(classifyRuleDrift({ pinned, live: pinned }), { status: 'SAME', action: 'CONTINUE' });
  assert.deepEqual(classifyRuleDrift({ pinned, live: { rule_version: '2026-10-05.22', manifest_sha256: 'b'.repeat(64) }, changedPaths: ['06-复盘与优化规则.md'] }), { status: 'NEWER_COMPATIBLE', action: 'CONTINUE' });
  assert.deepEqual(classifyRuleDrift({ pinned, live: { rule_version: '2026-10-05.22', manifest_sha256: 'b'.repeat(64) }, changedPaths: ['02-总指挥核心规则.md'] }), { status: 'AFFECTED_RECHECK', action: 'REBASE' });
  assert.deepEqual(classifyRuleDrift({ pinned, live: null }), { status: 'UNAVAILABLE', action: 'STOP_AFFECTED' });
});

check('rule drift rejects incomplete baselines and never continues a reversed or reused epoch', () => {
  const pinned = { rule_version: '2026-10-08.9', manifest_sha256: 'a'.repeat(64) };
  const live = { rule_version: '2026-10-08.11', manifest_sha256: 'b'.repeat(64) };
  assert.equal(classifyRuleDrift({ pinned: {}, live: {} }).status, 'UNAVAILABLE');
  for (const rule_version of ['2026-10-08.8', pinned.rule_version, '2026-10-07.99']) {
    assert.equal(classifyRuleDrift({ pinned, live: { ...live, rule_version }, changedPaths: ['06-复盘与优化规则.md'] }).status, 'AFFECTED_RECHECK');
  }
  assert.equal(classifyRuleDrift({ pinned, live, changedPaths: ['06-复盘与优化规则.md'] }).status, 'NEWER_COMPATIBLE');
  assert.equal(classifyRuleDrift({ pinned, live: { ...live, rule_version: '2026-02-30.1' } }).status, 'UNAVAILABLE');
});

check('rule drift requires valid deltas and protects the actual candidate and workspace dependencies', () => {
  const pinned = { rule_version: '2026-10-08.9', manifest_sha256: 'a'.repeat(64) };
  const live = { rule_version: '2026-10-08.11', manifest_sha256: 'b'.repeat(64) };
  for (const changedPaths of [null, [null], ['../06-复盘与优化规则.md'], ['C:/<RULE_ROOT>/06.md'], [''],
    ['.github/scripts/Verify-Handoff-Candidate.mjs'], ['HandoffWorkspaceScope.mjs'], ['.github/scripts/Rebase-Handoff-Draft.mjs']]) {
    assert.equal(classifyRuleDrift({ pinned, live, changedPaths }).status, 'AFFECTED_RECHECK');
  }
});

function writeCurrent(relative, body) {
  const absolute = path.join(sourceRoot, relative);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  const metadata = relative === LONG_STATUS_PATH
    ? '<!-- CONTROL_IDENTITY: {"generation":1,"writer_id":"COMMANDER-GEN-1","platform_task_id":"00000000-0000-4000-8000-000000000001"} -->'
    : `<!-- CONTROL_NAVIGATION: ${JSON.stringify({ status_index: LONG_STATUS_PATH, root_ref: 'source_root', ...(relative === '状态/启用声明.md' ? { central_entry: '状态/入口.md', central_entry_root_ref: 'source_root' } : {}) })} -->`;
  fs.writeFileSync(absolute, `# ${body}\n\n<!-- CURRENT:BEGIN -->\n${metadata}\n${body}\n<!-- CURRENT:END -->\n\n<!-- HISTORY:BEGIN -->\nold\n`, 'utf8');
  return { owner: body, path_ref: relative.replaceAll('\\', '/'), digest: sha256(fs.readFileSync(absolute)), fact_cutoff: stamp };
}

function makeDraft(eventId) {
  return {
    schema_version: 3,
    record_type: 'handoff-seal',
    generation: 1,
    writer_id: 'COMMANDER-GEN-1',
    old_writer_status: 'UNKNOWN',
    seal_sequence: 0,
    previous_seal_digest: null,
    fact_cutoff: stamp,
    sealed_at: stamp,
    event_id: eventId,
    sources: {
      central_entry: writeCurrent('状态/入口.md', 'navigation'),
      workflow_enablement: writeCurrent('状态/启用声明.md', '状态：enabled'),
      central_work_items: writeCurrent('状态/中央 工作项.md', 'central'),
      current_view: writeCurrent('状态/当前视图-e\u0301.md', 'view'),
      status_index: writeCurrent(LONG_STATUS_PATH, `项目键：synthetic\n远端目标：refs/heads/main\nHEAD=${'b'.repeat(40)}\n规则清单摘要：${'0'.repeat(64)}`)
    },
    source_digest_status: 'PASS',
    rule_baseline: { rule_version: '2026-09-28.4', manifest_sha256: 'e'.repeat(64) },
    objective: { summary: 'synthetic formal handoff', breakpoint: 'candidate verification' },
    prohibitions: ['remote-write'],
    communications: { status: 'NONE' },
    workspace: { root_ref: '<PROJECT_ROOT>', branch: 'main', head: 'b'.repeat(40), tree: 'c'.repeat(40), staged_count: 0, tracked_modified_count: 0, untracked_count: 0, required_untracked: [], worktree_fingerprint: { algorithm: 'git-diff-binary+untracked-content-sha256-v1', tracked_diff_sha256: 'f'.repeat(64), untracked_digest: 'a'.repeat(64) } },
    remote: { status: 'PASS', default_ref: 'refs/heads/main', head: 'd'.repeat(40), observed_at: stamp },
    control_handoff_confidence: 'HIGH',
    candidate_verification_status: 'PASS',
    switch_status: 'READY',
    handoff_phase: 'MATERIAL_PREPARED',
    runtime_acceptance_status: 'UNKNOWN',
    professional_acceptance_status: 'NOT_RUN',
    transition: null,
    migration: null,
    invalidation_conditions: ['source drift'],
    seal_digest: ''
  };
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function prepareCase(number, eventId) {
  const caseRoot = path.join(temp, `case-${number}`);
  fs.mkdirSync(caseRoot, { recursive: true });
  const draftPath = path.join(caseRoot, 'draft.json');
  const configPath = path.join(caseRoot, 'config.json');
  const finalPath = path.join(outputRoot, `sample-project-commander-handoff-20260921-final-${number}.md`);
  const receiptPath = path.join(outputRoot, `receipt-${number}.json`);
  const draft = makeDraft(eventId);
  const statusPath = path.resolve(sourceRoot, draft.sources.status_index.path_ref);
  const manifestDigest = sha256(fs.readFileSync(path.join(temp, 'rule-manifest.json')));
  draft.rule_baseline = { rule_version: '2026-09-28.4', manifest_sha256: manifestDigest };
  const statusBody = fs.readFileSync(statusPath, 'utf8');
  const updatedStatusBody = statusBody.replaceAll(`规则清单摘要：${'0'.repeat(64)}`, `规则清单摘要：${manifestDigest}`);
  assert.notEqual(updatedStatusBody, statusBody, 'synthetic status fixture must include a zeroed rule manifest marker');
  fs.writeFileSync(statusPath, updatedStatusBody, 'utf8');
  draft.sources.status_index.digest = sha256(fs.readFileSync(statusPath));
  writeJson(draftPath, draft);
  writeJson(configPath, {
    seal_directory: path.join(sourceRoot, '.handoff-private', `case-${number}`),
    source_root: sourceRoot,
    draft_path: draftPath,
    snapshot_template_path: path.join(temp, 'snapshot-template.md'),
    final_output_path: finalPath,
    receipt_output_path: receiptPath,
    rule_manifest_path: path.join(temp, 'rule-manifest.json'),
    project_key: 'synthetic',
    expected_previous_digest: null
  });
  return { configPath, finalPath, receiptPath };
}

try {
  fs.mkdirSync(sourceRoot, { recursive: true });
  spawnSync('git', ['init', '--quiet', sourceRoot], { stdio: 'inherit' });
  fs.writeFileSync(path.join(sourceRoot, '.gitignore'), `.handoff-private/\n${LONG_STATUS_PATH}\n${LONG_STATUS_PATH}.handoff-control.lock\n${LONG_STATUS_PATH}.handoff-transaction.json\n${LONG_STATUS_PATH}.*.tmp\n${LONG_STATUS_PATH}.handoff-transaction.json.*.tmp\n`, 'utf8');
  fs.writeFileSync(path.join(temp, 'snapshot-template.md'), '# {{SNAPSHOT_ID}}\nseal={{SEAL_DIGEST}}\ncutoff={{FACT_CUTOFF}}\nevent={{EVENT_ID}}\nverify={{VERIFICATION_COMMAND}}\n', 'utf8');
  const workflowFilesRoot = path.join(workflowRoot, '总指挥工作流', '第二代总指挥的工作模式');
  const ruleFilePath = path_ref => path.join(path_ref.startsWith('.github/') || path_ref.startsWith('总指挥工作流/') ? workflowRoot : workflowFilesRoot, path_ref);
  writeJson(path.join(temp, 'rule-manifest.json'), { schema_version: 1, rule_version: '2026-09-28.4', rules: REQUIRED_RULES.map(path_ref => ({ path_ref, sha256: sha256(fs.readFileSync(ruleFilePath(path_ref))) })) });

  const extendedManifestPath = path.join(temp, 'external-rule-manifest.json');
  const extendedManifest = readJsonForTest(path.join(temp, 'rule-manifest.json'));
  extendedManifest.repository_root_ref = '../..';
  extendedManifest.repository_root_prefixes = ['.github/', '引用的外部工具/'];
  const externalRule = '引用的外部工具/外部工具自动对接规范.md';
  extendedManifest.rules.push({ path_ref: externalRule, sha256: sha256(fs.readFileSync(path.join(workflowRoot, externalRule))) });
  writeJson(extendedManifestPath, extendedManifest);
  check('manifest verifies registered external dependencies from the workflow repository root', () => {
    assert.equal(verifyRuleManifest(workflowFilesRoot, extendedManifestPath).rules.length, REQUIRED_RULES.length + 1);
  });
  extendedManifest.rules.at(-1).sha256 = '0'.repeat(64);
  writeJson(extendedManifestPath, extendedManifest);
  check('external dependency digest mismatch fails the real handoff manifest verifier', () => {
    assert.throws(() => verifyRuleManifest(workflowFilesRoot, extendedManifestPath), /rule digest mismatch/);
  });
  extendedManifest.rules.at(-1).path_ref = '引用的外部工具/missing-rule.md';
  writeJson(extendedManifestPath, extendedManifest);
  check('missing external dependency fails instead of silently checking only legacy entries', () => {
    assert.throws(() => verifyRuleManifest(workflowFilesRoot, extendedManifestPath), /ENOENT/);
  });
  extendedManifest.rules.at(-1).path_ref = '引用的外部工具/../../outside.md';
  writeJson(extendedManifestPath, extendedManifest);
  check('external dependency path traversal is rejected before reading outside the repository', () => {
    assert.throws(() => verifyRuleManifest(workflowFilesRoot, extendedManifestPath), /invalid entry/);
  });

  check('Unicode NFC/NFD collisions are rejected without renaming', () => assert.throws(() => detectUnicodeCollisions(['资料/é.md', '资料/e\u0301.md']), /Unicode normalization collision/));
  const cli = spawnSync(process.execPath, ['./Prepare-Handoff.mjs'], { cwd: scriptDir, encoding: 'utf8' });
  check('CLI reports usage when configuration is missing', () => { assert.equal(cli.status, 2); assert.match(cli.stderr, /usage:/); });

  spawnSync('git', ['-C', sourceRoot, 'config', 'core.quotePath', 'true']);
  const first = prepareCase(1, 'formal-event-1');
  const firstResult = prepareFormalHandoff(first.configPath);
  check('formal artifact is finalized after seal and source verification', () => {
    assert.equal(firstResult.chain_status, 'PASS');
    assert.ok(fs.existsSync(first.finalPath));
    assert.ok(fs.existsSync(first.receiptPath));
    assert.equal(firstResult.receipt.artifact_status, 'GENERATED_NOT_DELIVERED');
    assert.equal(firstResult.receipt.unicode_inventory.mode, 'GIT_NUL');
    assert.equal(firstResult.receipt.verification.expected.handoff_ready, true);
    assert.match(firstResult.receipt.verification.command, /HandoffSeal\.mjs/);
    assert.ok(LONG_STATUS_PATH.length > 150);
    assert.equal(sha256(fs.readFileSync(first.finalPath)), firstResult.receipt.snapshot_sha256);
    assert.doesNotMatch(fs.readFileSync(first.finalPath, 'utf8'), /{{[A-Z_]+}}/);
    assert.ok(fs.readFileSync(first.finalPath, 'utf8').includes(firstResult.receipt.verification.command));
  });

  const staleVerification = prepareCase(15, 'formal-event-15');
  const staleTemplate = path.join(path.dirname(staleVerification.configPath), 'stale-template.md');
  fs.writeFileSync(staleTemplate, '# {{SNAPSHOT_ID}}\nseal={{SEAL_DIGEST}}\ncutoff={{FACT_CUTOFF}}\nevent={{EVENT_ID}}\nverify=node "old/HandoffSeal.mjs" verify "old-seals" "old-root"\n', 'utf8');
  const staleConfig = readJsonForTest(staleVerification.configPath);
  staleConfig.snapshot_template_path = staleTemplate;
  writeJson(staleVerification.configPath, staleConfig);
  check('stale verification command is normalized to the live seal directory', () => {
    const result = prepareFormalHandoff(staleVerification.configPath);
    assert.equal(result.chain_status, 'PASS');
    assert.ok(fs.readFileSync(staleVerification.finalPath, 'utf8').includes(result.receipt.verification.command));
    assert.doesNotMatch(fs.readFileSync(staleVerification.finalPath, 'utf8'), /old-seals/);
  });

  const preflight = prepareCase(2, 'preflight-event-2');
  const preflightConfig = readJsonForTest(preflight.configPath);
  preflightConfig.preflight_only = true;
  writeJson(preflight.configPath, preflightConfig);
  const preflightResult = prepareFormalHandoff(preflight.configPath);
  check('preflight validates sources without creating a seal or formal artifact', () => {
    assert.equal(preflightResult.status, 'READY');
    assert.equal(preflightResult.mode, 'PREFLIGHT_ONLY');
    assert.equal(preflightResult.workspace_protection.required_untracked_is_inventory, false);
    assert.equal(fs.existsSync(preflight.finalPath), false);
    assert.equal(fs.existsSync(path.join(sourceRoot, '.handoff-private', 'case-2')), false);
  });
  check('private storage failure is caught by preflight and formal generation before seals', () => {
    const ignored = fs.readFileSync(path.join(sourceRoot, '.gitignore'));
    fs.writeFileSync(path.join(sourceRoot, '.gitignore'), '.handoff-private/\n');
    try {
      assert.throws(() => prepareFormalHandoff(preflight.configPath), /CONTROL_STORAGE/);
      const formalConfig = { ...preflightConfig, preflight_only: false };
      writeJson(preflight.configPath, formalConfig);
      assert.throws(() => prepareFormalHandoff(preflight.configPath), /CONTROL_STORAGE/);
      assert.equal(fs.existsSync(preflight.finalPath), false);
      const sealDir = path.join(sourceRoot, '.handoff-private', 'case-2');
      assert.equal(fs.existsSync(sealDir) ? fs.readdirSync(sealDir).filter(name => name.startsWith('handoff-state.')).length : 0, 0);
    } finally { fs.writeFileSync(path.join(sourceRoot, '.gitignore'), ignored); writeJson(preflight.configPath, preflightConfig); }
  });

  const badTemplate = prepareCase(11, 'formal-event-11');
  const badTemplateConfig = readJsonForTest(badTemplate.configPath);
  const badTemplatePath = path.join(path.dirname(badTemplate.configPath), 'bad-template.md');
  fs.writeFileSync(badTemplatePath, '# {{SNAPSHOT_ID}}\nseal={{SEAL_DIGEST}}\n', 'utf8');
  badTemplateConfig.snapshot_template_path = badTemplatePath;
  writeJson(badTemplate.configPath, badTemplateConfig);
  const badSealDir = path.resolve(sourceRoot, '.handoff-private', 'case-11');
  const sealsBeforeTemplateFailure = fs.existsSync(badSealDir) ? fs.readdirSync(badSealDir).length : 0;
  check('malformed delivery template fails before appending a seal', () => {
    assert.throws(() => prepareFormalHandoff(badTemplate.configPath), /missing placeholder/);
    assert.equal(fs.existsSync(badTemplate.finalPath), false);
    assert.equal(fs.existsSync(badTemplate.receiptPath), false);
    const sealsAfterTemplateFailure = fs.existsSync(badSealDir) ? fs.readdirSync(badSealDir).length : 0;
    assert.equal(sealsAfterTemplateFailure, sealsBeforeTemplateFailure);
  });

  const retryable = prepareCase(12, 'formal-event-12');
  check('artifact retry reuses an already appended seal', () => {
    const first = prepareFormalHandoff(retryable.configPath);
    fs.rmSync(retryable.finalPath, { force: true });
    fs.rmSync(retryable.receiptPath, { force: true });
    const second = prepareFormalHandoff(retryable.configPath);
    assert.equal(second.receipt.seal_digest, first.receipt.seal_digest);
    assert.equal(second.receipt.event_id, first.receipt.event_id);
    const seals = fs.readdirSync(path.resolve(sourceRoot, '.handoff-private', 'case-12')).filter(name => name.startsWith('handoff-state.'));
    assert.equal(seals.length, 1);
  });

  spawnSync('git', ['-C', sourceRoot, 'config', 'core.quotePath', 'false']);
  const second = prepareCase(2, 'formal-event-2');
  const secondResult = prepareFormalHandoff(second.configPath);
  check('NUL-delimited Unicode inventory is independent of core.quotePath', () => assert.equal(secondResult.receipt.unicode_inventory.mode, 'GIT_NUL'));

  const malformed = prepareCase(3, 'formal-event-3');
  const malformedDraft = readJsonForTest(path.join(path.dirname(malformed.configPath), 'draft.json'));
  const currentPath = path.join(sourceRoot, malformedDraft.sources.current_view.path_ref);
  const broken = fs.readFileSync(currentPath, 'utf8').replace('<!-- HISTORY:BEGIN -->', 'stray-current-text\n<!-- HISTORY:BEGIN -->');
  fs.writeFileSync(currentPath, broken, 'utf8');
  malformedDraft.sources.current_view.digest = sha256(fs.readFileSync(currentPath));
  writeJson(path.join(path.dirname(malformed.configPath), 'draft.json'), malformedDraft);
  check('CURRENT/HISTORY boundary violations block final output', () => {
    assert.throws(() => prepareFormalHandoff(malformed.configPath), /outside CURRENT/);
    assert.equal(fs.existsSync(malformed.finalPath), false);
    assert.equal(fs.existsSync(malformed.receiptPath), false);
  });

  const repositoryOutput = prepareCase(4, 'formal-event-4');
  const repositoryOutputConfig = readJsonForTest(repositoryOutput.configPath);
  repositoryOutputConfig.final_output_path = path.join(sourceRoot, 'sample-project-commander-handoff-20260921-final-4.md');
  writeJson(repositoryOutput.configPath, repositoryOutputConfig);
  check('formal artifacts cannot be written into either repository', () => assert.throws(() => prepareFormalHandoff(repositoryOutput.configPath), /stored outside/));

  const visibleSeal = prepareCase(5, 'formal-event-5');
  const visibleSealConfig = readJsonForTest(visibleSeal.configPath);
  visibleSealConfig.seal_directory = path.join(sourceRoot, 'visible-seals');
  writeJson(visibleSeal.configPath, visibleSealConfig);
  check('seal directory must be protected by source repository ignore rules', () => assert.throws(() => prepareFormalHandoff(visibleSeal.configPath), /must be excluded/));

  const staleBinding = prepareCase(6, 'formal-event-6');
  const staleDraft = readJsonForTest(path.join(path.dirname(staleBinding.configPath), 'draft.json'));
  const staleIndex = path.join(sourceRoot, staleDraft.sources.status_index.path_ref);
  fs.writeFileSync(staleIndex, fs.readFileSync(staleIndex, 'utf8').replace(/远端目标：refs\/heads\/main/g, '远端目标：origin/main'), 'utf8');
  staleDraft.sources.status_index.digest = sha256(fs.readFileSync(staleIndex));
  writeJson(path.join(path.dirname(staleBinding.configPath), 'draft.json'), staleDraft);
  check('stale project binding blocks formal output', () => {
    assert.throws(() => prepareFormalHandoff(staleBinding.configPath), /project key|remote target|workspace HEAD/);
    assert.equal(fs.existsSync(staleBinding.finalPath), false);
    assert.equal(fs.existsSync(staleBinding.receiptPath), false);
  });

  const staleManifest = prepareCase(13, 'formal-event-13');
  const staleManifestDraft = readJsonForTest(path.join(path.dirname(staleManifest.configPath), 'draft.json'));
  const staleManifestIndex = path.join(sourceRoot, staleManifestDraft.sources.status_index.path_ref);
  const staleManifestBody = fs.readFileSync(staleManifestIndex, 'utf8').replace(/(CURRENT:BEGIN -->[\s\S]*?规则清单摘要：)[0-9a-f]{64}/i, `$1${'0'.repeat(64)}`);
  fs.writeFileSync(staleManifestIndex, staleManifestBody, 'utf8');
  staleManifestDraft.sources.status_index.digest = sha256(fs.readFileSync(staleManifestIndex));
  writeJson(path.join(path.dirname(staleManifest.configPath), 'draft.json'), staleManifestDraft);
  check('stale rule manifest binding blocks formal output', () => {
    assert.throws(() => prepareFormalHandoff(staleManifest.configPath), /rule manifest digest mismatch/);
    assert.equal(fs.existsSync(staleManifest.finalPath), false);
    assert.equal(fs.existsSync(staleManifest.receiptPath), false);
  });

  const staleRules = prepareCase(14, 'formal-event-14');
  const sharedManifest = path.join(temp, 'rule-manifest.json');
  const sharedManifestBytes = fs.readFileSync(sharedManifest);
  fs.writeFileSync(sharedManifest, Buffer.concat([sharedManifestBytes, Buffer.from('\n')]));
  check('rule baseline drift supersedes a candidate', () => {
    assert.throws(() => prepareFormalHandoff(staleRules.configPath), /RULE_REBASE_REQUIRED/);
    assert.equal(fs.existsSync(staleRules.finalPath), false);
  });
  fs.writeFileSync(sharedManifest, sharedManifestBytes);

  check('control-plane scan does not enumerate or read protected subtrees', () => {
    const scanRoot = path.join(temp, 'scan-boundary');
    const protectedRoots = [path.join(scanRoot, '其他资料'), path.join(scanRoot, '普通', '全局提示词（严禁AI自动修改）')];
    for (const directory of protectedRoots) {
      fs.mkdirSync(path.join(directory, '子目录'), { recursive: true });
      fs.writeFileSync(path.join(directory, '子目录', 'AI状态索引.md'), '<!-- CURRENT:BEGIN -->');
    }
    const originalRead = fs.readFileSync;
    const originalList = fs.readdirSync;
    const assertAllowed = file => {
      if (typeof file !== 'string') return;
      const resolved = path.resolve(file);
      assert.equal(protectedRoots.some(root => resolved === root || resolved.startsWith(root + path.sep)), false, 'accessed protected subtree');
    };
    try {
      fs.readFileSync = (file, ...args) => { assertAllowed(file); return originalRead(file, ...args); };
      fs.readdirSync = (file, ...args) => { assertAllowed(file); return originalList(file, ...args); };
      assert.deepEqual(findActiveControlPlaneIndexes(scanRoot, path.join(scanRoot, 'canonical.md')), []);
    } finally {
      fs.readFileSync = originalRead;
      fs.readdirSync = originalList;
    }
  });
  check('control-plane scan still finds deeply nested ignored and untracked indexes', () => {
    const scanRoot = path.join(temp, 'scan-coverage');
    fs.mkdirSync(path.join(scanRoot, '.local', '深层'), { recursive: true });
    fs.writeFileSync(path.join(scanRoot, '.gitignore'), '.local/\n');
    fs.writeFileSync(path.join(scanRoot, '.local', '深层', 'AI状态索引.md'), '<!-- CURRENT:BEGIN -->');
    fs.mkdirSync(path.join(scanRoot, '其他资料备份'), { recursive: true });
    fs.writeFileSync(path.join(scanRoot, '其他资料备份', 'AI状态索引.md'), '<!-- CURRENT:BEGIN -->');
    assert.deepEqual(findActiveControlPlaneIndexes(scanRoot, path.join(scanRoot, 'canonical.md')).sort(), ['.local/深层/AI状态索引.md', '其他资料备份/AI状态索引.md'].sort());
  });
  check('control-plane scan does not follow a directory alias into a protected subtree', () => {
    const scanRoot = path.join(temp, 'scan-alias');
    const protectedRoot = path.join(scanRoot, '其他资料');
    fs.mkdirSync(protectedRoot, { recursive: true });
    fs.writeFileSync(path.join(protectedRoot, 'AI状态索引.md'), '<!-- CURRENT:BEGIN -->');
    fs.symlinkSync(protectedRoot, path.join(scanRoot, 'alias'), process.platform === 'win32' ? 'junction' : 'dir');
    const originalList = fs.readdirSync;
    const originalRead = fs.readFileSync;
    const assertAllowed = file => {
      if (typeof file !== 'string') return;
      const relative = path.relative(protectedRoot, fs.realpathSync(file));
      assert.equal(relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative)), false, 'followed protected alias');
    };
    try {
      fs.readdirSync = (file, ...args) => { assertAllowed(file); return originalList(file, ...args); };
      fs.readFileSync = (file, ...args) => { assertAllowed(file); return originalRead(file, ...args); };
      assert.deepEqual(findActiveControlPlaneIndexes(scanRoot, path.join(scanRoot, 'canonical.md')), []);
    } finally {
      fs.readdirSync = originalList;
      fs.readFileSync = originalRead;
    }
  });

  const duplicateBinding = prepareCase(7, 'formal-event-7');
  const duplicateIndex = path.join(sourceRoot, '历史', 'AI状态索引.md');
  fs.mkdirSync(path.dirname(duplicateIndex), { recursive: true });
  fs.writeFileSync(duplicateIndex, '<!-- CURRENT:BEGIN -->\nold\n<!-- CURRENT:END -->\n', 'utf8');
  check('duplicate active control planes block formal output', () => {
    assert.throws(() => prepareFormalHandoff(duplicateBinding.configPath), /DUPLICATE_CONTROL_PLANE/);
    assert.equal(fs.existsSync(duplicateBinding.finalPath), false);
    assert.equal(fs.existsSync(duplicateBinding.receiptPath), false);
  });
  fs.rmSync(path.dirname(duplicateIndex), { recursive: true, force: true });
  const registeredLegacy = prepareCase(9, 'formal-event-9');
  const registeredDraft = readJsonForTest(path.join(path.dirname(registeredLegacy.configPath), 'draft.json'));
  const legacyPath = path.join(sourceRoot, 'legacy', 'AI状态索引.md');
  fs.mkdirSync(path.dirname(legacyPath), { recursive: true });
  fs.writeFileSync(legacyPath, '<!-- CURRENT:BEGIN -->\nlegacy\n<!-- CURRENT:END -->\n<!-- HISTORY:BEGIN -->\n', 'utf8');
  const registryPath = path.join(sourceRoot, 'control-plane-registry.json');
  writeJson(registryPath, { schema_version: 1, canonical_index: registeredDraft.sources.status_index.path_ref, legacy_indexes: [{ path: 'legacy/AI状态索引.md', status: 'HISTORICAL_ONLY', sha256: sha256(fs.readFileSync(legacyPath)), reason: 'preserved historical evidence' }] });
  registeredDraft.sources.control_plane_registry = { owner: 'current-commander', path_ref: 'control-plane-registry.json', digest: sha256(fs.readFileSync(registryPath)), fact_cutoff: stamp };
  writeJson(path.join(path.dirname(registeredLegacy.configPath), 'draft.json'), registeredDraft);
  check('registered historical control plane does not block formal output', () => {
    const result = prepareFormalHandoff(registeredLegacy.configPath);
    assert.equal(result.chain_status, 'PASS');
    assert.equal(fs.existsSync(registeredLegacy.finalPath), true);
  });
  fs.writeFileSync(legacyPath, fs.readFileSync(legacyPath, 'utf8').replace('legacy', 'drifted'), 'utf8');
  const drifted = prepareCase(10, 'formal-event-10');
  const driftedDraft = readJsonForTest(path.join(path.dirname(drifted.configPath), 'draft.json'));
  driftedDraft.sources.control_plane_registry = registeredDraft.sources.control_plane_registry;
  writeJson(path.join(path.dirname(drifted.configPath), 'draft.json'), driftedDraft);
  check('registered historical control-plane drift blocks output', () => {
    assert.throws(() => prepareFormalHandoff(drifted.configPath), /source digest|control-plane registry|historical control-plane/);
    assert.equal(fs.existsSync(drifted.finalPath), false);
  });
  const wrongProject = prepareCase(8, 'formal-event-8');
  const wrongConfig = readJsonForTest(wrongProject.configPath); wrongConfig.project_key = 'other-project'; writeJson(wrongProject.configPath, wrongConfig);
  check('project key mismatch blocks formal output', () => {
    assert.throws(() => prepareFormalHandoff(wrongProject.configPath), /project key/);
    assert.equal(fs.existsSync(wrongProject.finalPath), false);
    assert.equal(fs.existsSync(wrongProject.receiptPath), false);
  });
  const workspaceProbe = path.join(temp, 'workspace-probe');
  fs.mkdirSync(workspaceProbe, { recursive: true });
  spawnSync('git', ['init', '--quiet', workspaceProbe], { stdio: 'inherit' });
  fs.writeFileSync(path.join(workspaceProbe, 'probe.txt'), 'base\n', 'utf8');
  spawnSync('git', ['-C', workspaceProbe, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'add', '--', 'probe.txt'], { stdio: 'inherit' });
  spawnSync('git', ['-C', workspaceProbe, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '--quiet', '-m', 'probe'], { stdio: 'inherit' });
  const probeBaseline = readGitWorkspaceBaseline(workspaceProbe);
  check('live Git baseline drift is detected instead of trusting a stale draft', () => {
    fs.writeFileSync(path.join(workspaceProbe, 'probe.txt'), 'changed\n', 'utf8');
    assert.ok(verifyWorkspaceBaseline(workspaceProbe, probeBaseline).some(error => error.includes('tracked_modified_count')));
  });
  check('same-count untracked replacement is detected by content fingerprint', () => {
    fs.writeFileSync(path.join(workspaceProbe, 'probe.txt'), 'base\n', 'utf8');
    fs.writeFileSync(path.join(workspaceProbe, 'untracked.txt'), 'one\n', 'utf8');
    const sameCountBaseline = readGitWorkspaceBaseline(workspaceProbe);
    fs.writeFileSync(path.join(workspaceProbe, 'untracked.txt'), 'two\n', 'utf8');
    assert.ok(verifyWorkspaceBaseline(workspaceProbe, sameCountBaseline).some(error => error.includes('worktree_fingerprint.untracked_digest')));
  });
  check('live remote probe observes the advertised head instead of a stale draft value', () => {
    const remoteBare = path.join(temp, 'remote-probe.git');
    const remoteWork = path.join(temp, 'remote-probe-work');
    spawnSync('git', ['init', '--bare', '--quiet', remoteBare], { stdio: 'inherit' });
    spawnSync('git', ['init', '--quiet', remoteWork], { stdio: 'inherit' });
    spawnSync('git', ['-C', remoteWork, 'config', 'user.name', 'Test'], { stdio: 'inherit' });
    spawnSync('git', ['-C', remoteWork, 'config', 'user.email', 'test@example.invalid'], { stdio: 'inherit' });
    fs.writeFileSync(path.join(remoteWork, 'remote.txt'), 'one\n', 'utf8');
    spawnSync('git', ['-C', remoteWork, 'add', '--', 'remote.txt'], { stdio: 'inherit' });
    spawnSync('git', ['-C', remoteWork, 'commit', '--quiet', '-m', 'one'], { stdio: 'inherit' });
    spawnSync('git', ['-C', remoteWork, 'remote', 'add', 'origin', remoteBare], { stdio: 'inherit' });
    spawnSync('git', ['-C', remoteWork, 'push', '--quiet', '-u', 'origin', 'HEAD:main'], { stdio: 'inherit' });
    const firstRemote = readLiveRemoteBaseline(remoteWork, 'origin/main');
    assert.match(firstRemote.head, /^[0-9a-f]{40}$/);
    const staleHead = firstRemote.head;
    fs.writeFileSync(path.join(remoteWork, 'remote.txt'), 'two\n', 'utf8');
    spawnSync('git', ['-C', remoteWork, 'add', '--', 'remote.txt'], { stdio: 'inherit' });
    spawnSync('git', ['-C', remoteWork, 'commit', '--quiet', '-m', 'two'], { stdio: 'inherit' });
    spawnSync('git', ['-C', remoteWork, 'push', '--quiet', 'origin', 'HEAD:main'], { stdio: 'inherit' });
    const secondRemote = readLiveRemoteBaseline(remoteWork, 'origin/main');
    assert.notEqual(secondRemote.head, staleHead);
  });
  const rebaseScript = path.join(scriptDir, 'Rebase-Handoff-Draft.mjs');
  check('rebase CLI executes its usage gate from a Unicode Windows path', () => {
    const result = spawnSync(process.execPath, [rebaseScript], { cwd: temp, encoding: 'utf8' });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /usage:/);
  });
  const fixtureGit = args => {
    const result = spawnSync('git', ['-C', sourceRoot, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  // The earlier legacy-drift rejection deliberately left an invalid index.
  // Retire only that synthetic file before exercising unrelated remote gates.
  fs.unlinkSync(legacyPath);
  fixtureGit(['add', '--', '.gitignore']);
  fixtureGit(['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '--quiet', '-m', 'synthetic baseline']);
  fixtureGit(['branch', '-M', 'main']);
  fixtureGit(['remote', 'add', 'origin', sourceRoot]);
  const restrictedCase = number => {
    const input = prepareCase(number, `restricted-event-${number}`);
    const config = readJsonForTest(input.configPath);
    const draft = readJsonForTest(config.draft_path);
    const indexPath = path.join(sourceRoot, draft.sources.status_index.path_ref);
    fs.writeFileSync(indexPath, fs.readFileSync(indexPath, 'utf8').replaceAll('b'.repeat(40), fixtureGit(['rev-parse', 'HEAD'])));
    draft.sources.status_index.digest = sha256(fs.readFileSync(indexPath));
    draft.workspace = { ...draft.workspace, ...readGitWorkspaceBaseline(sourceRoot) };
    draft.remote.head = fixtureGit(['rev-parse', 'HEAD']);
    draft.switch_status = 'READY_WITH_RESTRICTIONS';
    draft.control_handoff_confidence = 'MEDIUM';
    draft.candidate_verification_status = 'PASS_WITH_RESTRICTIONS';
    config.preflight_only = true;
    writeJson(config.draft_path, draft);
    writeJson(input.configPath, config);
    return { ...input, config, draft };
  };
  check('restricted preflight still rejects an observed remote HEAD conflict', () => {
    const input = restrictedCase(401);
    input.draft.remote.head = 'd'.repeat(40);
    writeJson(input.config.draft_path, input.draft);
    assert.throws(() => prepareFormalHandoff(input.configPath), /preflight remote baseline drift/);
    assert.equal(fs.existsSync(input.finalPath), false);
    assert.equal(fs.existsSync(input.config.seal_directory), false);
  });
  check('restricted preflight permits an unobservable remote without writing artifacts', () => {
    const input = restrictedCase(402);
    fixtureGit(['remote', 'remove', 'origin']);
    try {
      assert.equal(prepareFormalHandoff(input.configPath).status, 'READY_WITH_RESTRICTIONS');
      assert.equal(fs.existsSync(input.finalPath), false);
      assert.equal(fs.existsSync(input.config.seal_directory), false);
    } finally { fixtureGit(['remote', 'add', 'origin', sourceRoot]); }
  });
  function hydrationCase(number) {
    const input = restrictedCase(number);
    const manifestPath = path.join(workflowFilesRoot, '规则刷新manifest.json');
    const liveManifest = readJsonForTest(manifestPath);
    const oldDigest = input.draft.rule_baseline.manifest_sha256;
    const manifestDigest = sha256(fs.readFileSync(manifestPath));
    input.draft.rule_baseline = { rule_version: liveManifest.rule_version, manifest_sha256: manifestDigest };
    const indexPath = path.join(sourceRoot, input.draft.sources.status_index.path_ref);
    fs.writeFileSync(indexPath, fs.readFileSync(indexPath, 'utf8').replaceAll(oldDigest, manifestDigest));
    input.draft.sources.status_index.digest = sha256(fs.readFileSync(indexPath));
    const externalRoot = path.join(temp, `外部 中央-${number}`);
    fs.mkdirSync(externalRoot);
    const inventoryPath = path.join(sourceRoot, 'inventory.json');
    fs.writeFileSync(inventoryPath, JSON.stringify({ loading_record: '材料\\loading.json', task_contract: '材料/task-contract.md' }));
    fs.mkdirSync(path.join(sourceRoot, '材料'), { recursive: true });
    fs.writeFileSync(path.join(sourceRoot, '材料/loading.json'), '{}\n');
    fs.writeFileSync(path.join(sourceRoot, '材料/task-contract.md'), 'synthetic contract\n');
    input.draft.sources.loading_record = { owner: 'synthetic', root_ref: 'source_root', path_ref: '材料/loading.json', digest: sha256(fs.readFileSync(path.join(sourceRoot, '材料/loading.json'))), fact_cutoff: stamp };
    input.draft.sources.handoff_inventory = { owner: 'synthetic', root_ref: 'source_root', path_ref: 'inventory.json', digest: sha256(fs.readFileSync(inventoryPath)), fact_cutoff: stamp };
    input.draft.workspace = { ...input.draft.workspace, ...readGitWorkspaceBaseline(sourceRoot) };
    const templatePath = path.join(path.dirname(input.configPath), 'hydration-template.md');
    fs.writeFileSync(templatePath, '# {{SNAPSHOT_ID}}\nseal={{SEAL_DIGEST}}\ncutoff={{FACT_CUTOFF}}\nevent={{EVENT_ID}}\nverify={{VERIFICATION_COMMAND}}\n- 规则根：{{RULE_ROOT}}\n- 机器记录：{{MACHINE_RECORD}}\n- 独立生成回执：{{RECEIPT_PATH}}\n- [身份索引](<old-candidate\\index.md>)\n- [中央清单](old-candidate/list.md)\n- [进度视图](<old-candidate/view.md>)\n- [本任务加载记录](<old-candidate\\loading.json>)\n- [本轮任务契约](<old-candidate/task-contract.md>)\n## 轻量加载基线\nstale baseline\n## 使用边界\nread only\n');
    input.config.preflight_only = false;
    input.config.external_control_plane_root = externalRoot;
    input.config.rule_manifest_path = manifestPath;
    input.config.snapshot_template_path = templatePath;
    input.config.receipt_output_path = path.relative(path.dirname(input.configPath), input.receiptPath);
    writeJson(input.config.draft_path, input.draft);
    writeJson(input.configPath, input.config);
    return { ...input, inventoryPath, templatePath };
  }
  check('hydrated snapshot uses the verified public rule root and resolved receipt and source inventory', () => {
    const input = hydrationCase(403);
    prepareFormalHandoff(input.configPath);
    const body = fs.readFileSync(input.finalPath, 'utf8');
    assert.ok(body.includes(`- 规则根：${workflowFilesRoot}`));
    assert.ok(body.includes(`- 机器记录：${input.inventoryPath}`));
    assert.ok(body.includes(`- 独立生成回执：${input.receiptPath}`));
    for (const [label, name] of [['身份索引', 'status_index'], ['中央清单', 'central_work_items'], ['进度视图', 'current_view'], ['本任务加载记录', 'loading_record']]) {
      assert.ok(body.includes(`[${label}](<${path.resolve(sourceRoot, input.draft.sources[name].path_ref).replaceAll('\\', '/')}>`));
    }
    assert.ok(body.includes(`[本轮任务契约](<${path.resolve(sourceRoot, '材料/task-contract.md').replaceAll('\\', '/')}>`));
    assert.match(body, /机器记录指针，读取前核验/);
    assert.match(body, /--summary/);
    assert.doesNotMatch(body, /stale baseline|old-candidate|{{[A-Z_]+}}/);
  });
  let hydrationNumber = 410;
  for (const [name, ref] of [['parent escape', '../outside.md'], ['absolute', 'C:/<OUTSIDE>/contract.md'], ['Markdown injection', 'contract>\n.md']]) check(`hydration refuses ${name} inventory pointer before sealing`, () => {
    const input = hydrationCase(hydrationNumber++);
    fs.writeFileSync(input.inventoryPath, JSON.stringify({ task_contract: ref }));
    input.draft.sources.handoff_inventory.digest = sha256(fs.readFileSync(input.inventoryPath));
    input.draft.workspace = { ...input.draft.workspace, ...readGitWorkspaceBaseline(sourceRoot) };
    writeJson(input.config.draft_path, input.draft);
    assert.throws(() => prepareFormalHandoff(input.configPath), /INPUT_REQUIRED.*unsafe task_contract/);
    assert.deepEqual(fs.readdirSync(input.config.seal_directory), []); assert.equal(fs.existsSync(input.finalPath), false);
  });
  check('inventory is digest-verified before JSON parsing or link derivation', () => {
    const input = hydrationCase(hydrationNumber++);
    fs.writeFileSync(input.inventoryPath, 'not-json');
    assert.throws(() => prepareFormalHandoff(input.configPath), /handoff_inventory: source digest mismatch/);
    assert.deepEqual(fs.readdirSync(input.config.seal_directory), []);
  });
  check('required loading source cannot be replaced by an unbound inventory path', () => {
    const input = hydrationCase(hydrationNumber++);
    delete input.draft.sources.loading_record; writeJson(input.config.draft_path, input.draft);
    assert.throws(() => prepareFormalHandoff(input.configPath), /INPUT_REQUIRED.*loading_record source required/);
    assert.equal(fs.existsSync(input.finalPath), false);
  });
  check('inventory and sealed loading source disagreement is explicit input required', () => {
    const input = hydrationCase(hydrationNumber++);
    fs.writeFileSync(input.inventoryPath, JSON.stringify({ loading_record: 'old-loading.json', task_contract: '材料/task-contract.md' }));
    input.draft.sources.handoff_inventory.digest = sha256(fs.readFileSync(input.inventoryPath));
    input.draft.workspace = { ...input.draft.workspace, ...readGitWorkspaceBaseline(sourceRoot) };
    writeJson(input.config.draft_path, input.draft);
    assert.throws(() => prepareFormalHandoff(input.configPath), /INPUT_REQUIRED.*loading_record inventory\/source mismatch/);
  });
  check('null inventory is rejected as input required before sealing', () => {
    const input = hydrationCase(hydrationNumber++);
    fs.writeFileSync(input.inventoryPath, 'null');
    input.draft.sources.handoff_inventory.digest = sha256(fs.readFileSync(input.inventoryPath));
    input.draft.workspace = { ...input.draft.workspace, ...readGitWorkspaceBaseline(sourceRoot) };
    writeJson(input.config.draft_path, input.draft);
    assert.throws(() => prepareFormalHandoff(input.configPath), /INPUT_REQUIRED.*handoff_inventory must be an object/);
    assert.deepEqual(fs.readdirSync(input.config.seal_directory), []);
  });
  check('sealed task contract replaces the pointer-only claim and must match inventory', () => {
    const input = hydrationCase(hydrationNumber++);
    input.draft.sources.task_contract = { owner: 'synthetic', root_ref: 'source_root', path_ref: '材料/task-contract.md', digest: sha256(fs.readFileSync(path.join(sourceRoot, '材料/task-contract.md'))), fact_cutoff: stamp };
    writeJson(input.config.draft_path, input.draft);
    assert.equal(prepareFormalHandoff(input.configPath).chain_status, 'PASS');
    const body = fs.readFileSync(input.finalPath, 'utf8');
    assert.match(body, /\[本轮任务契约\].*；封条来源/); assert.doesNotMatch(body, /机器记录指针，读取前核验/);
  });
  check('old hydration template without optional links remains supported', () => {
    const input = hydrationCase(hydrationNumber++);
    fs.writeFileSync(input.templatePath, fs.readFileSync(input.templatePath, 'utf8').replace(/^- \[[^\r\n]*\r?\n/gm, ''));
    delete input.draft.sources.handoff_inventory; delete input.draft.sources.loading_record;
    writeJson(input.config.draft_path, input.draft);
    assert.equal(prepareFormalHandoff(input.configPath).chain_status, 'PASS');
  });
  check('rebase CLI resolves relative configuration from a separate source repository and unrelated cwd', () => {
    const input = restrictedCase(404);
    const configDir = path.dirname(input.configPath);
    input.config.source_root = path.relative(configDir, sourceRoot);
    input.config.draft_path = 'draft.json';
    input.config.rule_manifest_path = path.relative(configDir, path.join(temp, 'rule-manifest.json'));
    writeJson(input.configPath, input.config);
    const originalDigest = sha256(fs.readFileSync(path.join(configDir, 'draft.json')));
    const output = path.join(configDir, 'rebased.json');
    const result = spawnSync(process.execPath, [rebaseScript, input.configPath, output], { cwd: outputRoot, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).workspace_head, fixtureGit(['rev-parse', 'HEAD']));
    assert.equal(readJsonForTest(output).objective.breakpoint, input.draft.objective.breakpoint);
    assert.equal(sha256(fs.readFileSync(path.join(configDir, 'draft.json'))), originalDigest);
    const retry = spawnSync(process.execPath, [rebaseScript, input.configPath, output], { cwd: outputRoot, encoding: 'utf8' });
    assert.equal(retry.status, 1); assert.match(retry.stderr, /refusing to overwrite/);
  });
  check('protected non-source drift after rendering cannot produce a final attachment', () => {
    const latePath = path.join(sourceRoot, 'late-protected.txt');
    fs.writeFileSync(latePath, 'before rendering\n');
    const input = restrictedCase(405);
    input.config.preflight_only = false;
    writeJson(input.configPath, input.config);
    const originalOpen = fs.openSync, originalSync = fs.fsyncSync;
    let snapshotFd = null, injected = false;
    fs.openSync = function (file, ...args) {
      const fd = originalOpen.call(this, file, ...args);
      if (String(file).includes(path.basename(input.finalPath)) && String(file).endsWith('.tmp')) snapshotFd = fd;
      return fd;
    };
    fs.fsyncSync = function (fd) {
      originalSync.call(this, fd);
      if (!injected && fd === snapshotFd) { injected = true; fs.writeFileSync(latePath, 'changed during rendering\n'); }
    };
    try {
      assert.throws(() => prepareFormalHandoff(input.configPath), /workspace drifted while rendering/);
      assert.equal(injected, true);
      assert.equal(fs.existsSync(input.finalPath), false);
      assert.equal(fs.existsSync(input.receiptPath), false);
    } finally { fs.openSync = originalOpen; fs.fsyncSync = originalSync; fs.unlinkSync(latePath); }
  });
  console.log(`Prepare handoff: PASS (${passed} cases)`);
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

function readJsonForTest(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
