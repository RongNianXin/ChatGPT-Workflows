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
      status_index: writeCurrent(LONG_STATUS_PATH, 'index')
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
  writeJson(draftPath, makeDraft(eventId));
  writeJson(configPath, {
    seal_directory: path.join(sourceRoot, '.handoff-private', `case-${number}`),
    source_root: sourceRoot,
    draft_path: draftPath,
    snapshot_template_path: path.join(temp, 'snapshot-template.md'),
    final_output_path: finalPath,
    receipt_output_path: receiptPath,
    rule_manifest_path: path.join(temp, 'rule-manifest.json'),
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
  console.log(`Prepare handoff: PASS (${passed} cases)`);
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

function readJsonForTest(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
