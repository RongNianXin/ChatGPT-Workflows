// Contract tests for formal handoff artifact preparation.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { detectUnicodeCollisions, prepareFormalHandoff, REQUIRED_RULES } from './Prepare-Handoff.mjs';

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

function writeCurrent(relative, body) {
  const absolute = path.join(sourceRoot, relative);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, `# ${body}\n\n<!-- CURRENT:BEGIN -->\n${body}\n<!-- CURRENT:END -->\n\n<!-- HISTORY:BEGIN -->\nold\n`, 'utf8');
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
      central_work_items: writeCurrent('状态/中央 工作项.md', 'central'),
      current_view: writeCurrent('状态/当前视图-e\u0301.md', 'view'),
      status_index: writeCurrent(LONG_STATUS_PATH, `项目键：synthetic\n远端目标：refs/heads/main\nHEAD=${'b'.repeat(40)}\n规则清单摘要：${'0'.repeat(64)}`)
    },
    source_digest_status: 'PASS',
    objective: { summary: 'synthetic formal handoff', breakpoint: 'candidate verification' },
    prohibitions: ['remote-write'],
    communications: { status: 'NONE' },
    workspace: { root_ref: '<PROJECT_ROOT>', branch: 'main', head: 'b'.repeat(40), tree: 'c'.repeat(40), staged_count: 0, tracked_modified_count: 0, untracked_count: 0, required_untracked: [] },
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
  fs.writeFileSync(path.join(sourceRoot, '.gitignore'), '.handoff-private/\n', 'utf8');
  fs.writeFileSync(path.join(temp, 'snapshot-template.md'), '# {{SNAPSHOT_ID}}\nseal={{SEAL_DIGEST}}\ncutoff={{FACT_CUTOFF}}\nevent={{EVENT_ID}}\n', 'utf8');
  writeJson(path.join(temp, 'rule-manifest.json'), { schema_version: 1, rules: REQUIRED_RULES.map(path_ref => ({ path_ref, sha256: sha256(fs.readFileSync(path.join(workflowRoot, path_ref))) })) });

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
    assert.ok(LONG_STATUS_PATH.length > 150);
    assert.equal(sha256(fs.readFileSync(first.finalPath)), firstResult.receipt.snapshot_sha256);
    assert.doesNotMatch(fs.readFileSync(first.finalPath, 'utf8'), /{{[A-Z_]+}}/);
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
  console.log(`Prepare handoff: PASS (${passed} cases)`);
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

function readJsonForTest(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
