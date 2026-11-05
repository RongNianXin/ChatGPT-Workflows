// Use synthetic files and a minimal DOM seam; no browser or source-file mutation.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const tool = path.join(root, '总指挥工作流/第二代总指挥的工作模式/tools/pipeline-step-deck');
const fixture = fs.mkdtempSync(path.join(root, '.planning/deck-safety-'));
const sandbox = path.join(fixture, 'sandbox');
const copiedTool = path.join(sandbox, path.relative(root, tool));
fs.mkdirSync(copiedTool, { recursive: true });
for (const name of ['build-enhanced-deck.mjs', 'PIPELINE_STEP_DECK_ENHANCEMENTS.js']) {
  fs.copyFileSync(path.join(tool, name), path.join(copiedTool, name));
}
fs.writeFileSync(path.join(sandbox, 'AGENTS.md'), 'Synthetic protected source\n');
const builder = path.join(copiedTool, 'build-enhanced-deck.mjs');
const html = '<html><body><div id="evidenceStage"></div></body></html>';
const run = args => spawnSync(process.execPath, [builder, ...args], { cwd: fixture, encoding: 'utf8', timeout: 10000, windowsHide: true });
const failures = [];
let passed = 0;
const check = (name, fn) => {
  try { fn(); passed++; } catch (error) { failures.push(`${name}: ${error.message}`); }
};
const makeInput = name => { const file = path.join(fixture, name); fs.writeFileSync(file, html); return file; };
check('explicit distinct output works and input is preserved', () => {
  const input = makeInput('valid.html'), output = path.join(fixture, 'result.html');
  assert.equal(run([input, output]).status, 0);
  assert.equal(fs.readFileSync(input, 'utf8'), html);
  assert.equal((fs.readFileSync(output, 'utf8').match(/data-pipeline-step-deck-enhancements=/g) ?? []).length, 1);
});
check('omitting output cannot write beside a template', () => {
  const input = makeInput('default.html');
  assert.notEqual(run([input]).status, 0);
  assert.equal(fs.existsSync(path.join(fixture, 'default-enhanced.html')), false);
});
check('input equals output is rejected without mutation', () => {
  const input = makeInput('same.html');
  assert.notEqual(run([input, input]).status, 0);
  assert.equal(fs.readFileSync(input, 'utf8'), html);
});
check('existing output and hardlink are preserved', () => {
  const input = makeInput('link-source.html'), output = path.join(fixture, 'hardlink.html');
  fs.linkSync(input, output);
  assert.notEqual(run([input, output]).status, 0);
  assert.equal(fs.readFileSync(input, 'utf8'), html);
});
check('dangling output link is rejected', () => {
  // A junction-backed directory exercises Windows aliases without symlink privileges.
  const alias = path.join(fixture, 'alias');
  fs.symlinkSync(fixture, alias, process.platform === 'win32' ? 'junction' : 'dir');
  const input = makeInput('alias-source.html');
  assert.notEqual(run([input, path.join(alias, 'alias-source.html')]).status, 0);
  assert.equal(fs.readFileSync(input, 'utf8'), html);
});
check('protected existing target is rejected before any write', () => {
  const input = makeInput('protected-source.html');
  const protectedFile = path.join(sandbox, 'AGENTS.md'), before = fs.readFileSync(protectedFile);
  // Existing content is independently protected by exclusive creation.
  assert.notEqual(run([input, protectedFile]).status, 0);
  assert(fs.readFileSync(protectedFile).equals(before));
});
const runtime = fs.readFileSync(path.join(tool, 'PIPELINE_STEP_DECK_ENHANCEMENTS.js'), 'utf8');
function functionSource(name) {
  const start = runtime.indexOf(`  function ${name}(`);
  assert(start >= 0, `Missing runtime function: ${name}`);
  const next = runtime.indexOf('\n  function ', start + 1);
  return runtime.slice(start, next < 0 ? undefined : next);
}
const dedupe = identities => {
  const cards = identities.map(artifactIdentity => ({ __pipelineEntry: { artifactIdentity }, hidden: false, querySelector: () => ({}), appendChild: () => {} }));
  const column = { dataset: {}, querySelectorAll: () => cards, closest: () => null };
  const context = {
    column, VERSION: 'synthetic', CONTROL_ATTRIBUTE: 'synthetic',
    formatKeyParameters: () => '', makeButton: () => ({ addEventListener() {} }),
    document: { createElement: () => ({ setAttribute() {}, append() {}, appendChild() {} }) },
    window: { dispatchEvent() {} }, Event: class {}
  };
  vm.runInNewContext(['nullableText', 'artifactIdentityFor', 'executionIdentityLabel', 'applyExactArtifactDedupe'].map(functionSource).join('\n') + '\napplyExactArtifactDedupe(column);', context);
  return cards.map(card => card.hidden);
};
const identity = { stage: 'decode', role: 'mask', kind: 'image', sha256: 'a'.repeat(64) };
check('exact duplicate still folds', () => assert.deepEqual(dedupe([identity, { ...identity }]), [false, true]));
check('delimiter in identity fields never merges distinct artifacts', () => {
  assert.deepEqual(dedupe([{ ...identity, stage: 'decode|main' }, { ...identity, stage: 'decode', role: 'main|mask' }]), [false, false]);
});
console.log(JSON.stringify({ passed, failed: failures.length, failures, fixture: path.relative(root, fixture) }));
if (failures.length) process.exitCode = 1;
