import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { appendSeal, prepareTransition, verifyChain } from './HandoffSeal.mjs';
import { readGitWorkspaceBaseline } from './Prepare-Handoff.mjs';
import { verifyHandoffCandidate } from './Verify-Handoff-Candidate.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
// Keep fixture Git object paths short even when this suite runs from a local snapshot.
const cacheRoot = path.join(root, '.codex-manual-cache', 'cv');
fs.mkdirSync(cacheRoot, { recursive: true });
const relativeCache = path.relative(fs.realpathSync(root), fs.realpathSync(cacheRoot));
assert.ok(relativeCache && !relativeCache.startsWith('..') && !path.isAbsolute(relativeCache));
const temp = fs.mkdtempSync(path.join(cacheRoot, 'fixture-'));
const sourceRoot = path.join(temp, 'source');
const externalRoot = path.join(temp, 'external central');
fs.mkdirSync(sourceRoot); fs.mkdirSync(externalRoot);
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const git = args => {
  const result = spawnSync('git', ['-c', 'core.longpaths=true', '-C', sourceRoot, ...args], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
};
const stamp = '2026-01-01T00:00:00.000Z';
const manifestPath = path.join(root, '总指挥工作流', '第二代总指挥的工作模式', '规则刷新manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const ruleBaseline = { rule_version: manifest.rule_version, manifest_sha256: sha256(fs.readFileSync(manifestPath)) };
let event = 0;
let passed = 0;
const check = (name, run) => { run(); passed++; console.log(`PASS: ${name}`); };
const sources = {};
const internalSources = {};
const indexRef = 'control/status_index.md';
for (const name of ['status_index', 'central_work_items', 'current_view', 'central_entry', 'workflow_enablement']) {
  const pathRef = `control/${name}.md`;
  const metadata = name === 'status_index'
    ? { generation: 1, writer_id: 'TEST-COMMANDER', platform_task_id: 'UNKNOWN' }
    : { status_index: indexRef, root_ref: 'external_control_plane', ...(name === 'workflow_enablement' ? { central_entry: 'control/central_entry.md', central_entry_root_ref: 'external_control_plane' } : {}) };
  const tag = name === 'status_index' ? 'CONTROL_IDENTITY' : 'CONTROL_NAVIGATION';
  const body = `<!-- CURRENT:BEGIN -->\n<!-- ${tag}: ${JSON.stringify(metadata)} -->\n${name === 'workflow_enablement' ? '状态：enabled\n' : ''}<!-- CURRENT:END -->\n`;
  const file = path.join(externalRoot, pathRef);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);
  sources[name] = { owner: 'synthetic', path_ref: pathRef, root_ref: 'external_control_plane', digest: sha256(Buffer.from(body)), fact_cutoff: stamp };
  const internalBody = body.replaceAll('external_control_plane', 'source_root');
  const internalFile = path.join(sourceRoot, pathRef);
  fs.mkdirSync(path.dirname(internalFile), { recursive: true });
  fs.writeFileSync(internalFile, internalBody);
  internalSources[name] = { ...sources[name], root_ref: 'source_root', digest: sha256(Buffer.from(internalBody)) };
}
let workspace;
const makeCandidate = (overrides = {}) => {
  const sealDirectory = path.join(temp, `seals-${++event}`);
  const draft = {
    schema_version: 3, record_type: 'handoff-seal', generation: 1, writer_id: 'TEST-COMMANDER', old_writer_status: 'UNKNOWN',
    fact_cutoff: stamp, sealed_at: stamp, event_id: `synthetic-${event}`, sources, source_digest_status: 'PASS',
    rule_baseline: ruleBaseline, objective: { summary: 'synthetic candidate', breakpoint: 'read-only check' },
    prohibitions: ['remote-write'], communications: { status: 'NONE' }, workspace,
    remote: { status: 'PASS', default_ref: 'refs/heads/main', head: workspace.head, observed_at: stamp },
    control_handoff_confidence: 'HIGH', candidate_verification_status: 'PASS', switch_status: 'READY',
    handoff_phase: 'MATERIAL_PREPARED', runtime_acceptance_status: 'NOT_RUN', professional_acceptance_status: 'NOT_APPLICABLE',
    transition: null, migration: null, invalidation_conditions: ['source or workspace drift'], seal_digest: '', ...overrides
  };
  if (draft.handoff_phase === 'CURRENT_ATTESTATION') {
    appendSeal(sealDirectory, { ...draft, event_id: `${draft.event_id}-prepared`, handoff_phase: 'MATERIAL_PREPARED', switch_status: 'READY' }, { sourceRoot, externalControlPlaneRoot: externalRoot });
    const changedSource = path.join(externalRoot, sources.central_entry.path_ref);
    fs.appendFileSync(changedSource, '\n');
    draft.sources = { ...sources, central_entry: { ...sources.central_entry, digest: sha256(fs.readFileSync(changedSource)) } };
  }
  appendSeal(sealDirectory, draft, { sourceRoot, externalControlPlaneRoot: externalRoot });
  return sealDirectory;
};
const verify = (sealDirectory, extra = {}) => verifyHandoffCandidate({ sealDirectory, sourceRoot, externalControlPlaneRoot: externalRoot, ...extra });
const cli = (sealDirectory, flags = []) => {
  const result = spawnSync(process.execPath, [path.join(root, '.github', 'scripts', 'Verify-Handoff-Candidate.mjs'), sealDirectory, sourceRoot, ...flags], { cwd: temp, encoding: 'utf8' });
  assert.ifError(result.error);
  return { code: result.status, value: JSON.parse(result.stdout) };
};
try {
  git(['init', '--quiet', '--initial-branch=main']);
  // The production verifier also spawns Git; keep long-path support local to this fixture.
  git(['config', 'core.longpaths', 'true']);
  fs.writeFileSync(path.join(sourceRoot, 'probe.txt'), 'base\n');
  git(['add', '--', 'probe.txt']);
  git(['-c', 'user.name=Synthetic Test', '-c', 'user.email=test@example.invalid', 'commit', '--quiet', '-m', 'synthetic fixture']);
  git(['remote', 'add', 'origin', sourceRoot]); // Local self-remote: no network or real remote write.
  workspace = { root_ref: '<PROJECT_ROOT>', ...readGitWorkspaceBaseline(sourceRoot), required_untracked: [] };
  const candidate = makeCandidate();
  const internalCandidate = makeCandidate({ sources: internalSources });
  // The real candidate/rotation entry must accept unrelated in-flight changes.
  const inflightDirectory = path.join(sourceRoot, 'specialist');
  fs.mkdirSync(inflightDirectory);
  const inflightScope = { excluded_roots: [{ path_ref: 'specialist', owner: 'SYNTHETIC_SPECIALIST', reason: 'unrelated ordinary in-flight work', ownership_source_ref: 'control/central_entry.md' }] };
  const scopedWorkspace = { root_ref: '.', required_untracked: [], ...readGitWorkspaceBaseline(sourceRoot, [], inflightScope) };
  const scopedCandidate = makeCandidate({ workspace: scopedWorkspace, sources: internalSources });
  check('scoped seal and real candidate verify before in-flight changes', () => assert.equal(verify(scopedCandidate, { externalControlPlaneRoot: undefined }).status, 'READY'));
  fs.writeFileSync(path.join(inflightDirectory, 'task.js'), 'ordinary new in-flight file\n');
  check('real candidate accepts an unrelated new specialist file', () => assert.equal(verify(scopedCandidate, { externalControlPlaneRoot: undefined }).status, 'READY'));
  check('real CLI uses the same fixed scope', () => assert.equal(cli(scopedCandidate).value.status, 'READY'));
  const scopedPrevious = verifyChain(scopedCandidate, { sourceRoot }).latest;
  prepareTransition(scopedCandidate, { sourceRoot, expectedPreviousDigest: scopedPrevious.seal_digest, nextGeneration: 2, nextWriterId: 'SCOPED-NEXT', eventId: 'scoped-takeover', preparedAt: stamp });
  fs.writeFileSync(path.join(inflightDirectory, 'task.js'), 'ordinary updated in-flight file\n');
  check('unrelated in-flight changes preserve the matching stop-old preparation', () => assert.equal(verify(scopedCandidate, { externalControlPlaneRoot: undefined, nextGeneration: 2, nextWriterId: 'SCOPED-NEXT', eventId: 'scoped-takeover' }).rotation.can_stop_old, true));
  check('scoped seal cannot ignore a strict active specialist source', () => assert.throws(() => makeCandidate({ workspace: scopedWorkspace, sources: { ...internalSources, active_specialist: { owner: 'synthetic', path_ref: 'specialist/task.js', root_ref: 'source_root', digest: sha256(fs.readFileSync(path.join(inflightDirectory, 'task.js'))), fact_cutoff: stamp } } }), /invalid workspace baseline/));
  fs.unlinkSync(path.join(inflightDirectory, 'task.js'));
  fs.rmdirSync(inflightDirectory);
  check('material READY without a separately delivered intent permits stopping, not authority transfer', () => {
    const result = verify(candidate);
    assert.equal(result.status, 'READY');
    assert.equal(result.rotation?.status, 'DIRECT_PREPARE_AVAILABLE');
    assert.equal(result.rotation?.can_stop_old, true);
  });
  check('API retains repository-contained control sources without an external root', () => {
    const result = verify(internalCandidate, { externalControlPlaneRoot: undefined, remoteRequired: true });
    assert.equal(result.status, 'READY', result.errors.join('\n'));
    assert.equal(result.chain.latest_source_status, 'PASS');
    assert.equal(result.workspace.status, 'PASS');
    assert.equal(result.remote.status, 'PASS');
  });
  check('CLI retains repository-contained control sources without an external flag', () => {
    const result = cli(internalCandidate, ['--remote-required']);
    assert.equal(result.code, 0); assert.equal(result.value.status, 'READY');
  });
  check('API forwards external root through the real ready-candidate chain', () => {
    const result = verify(candidate, { remoteRequired: true });
    assert.equal(result.status, 'READY', result.errors.join('\n'));
    assert.equal(result.chain.control_status, 'READY');
    assert.equal(result.workspace.status, 'PASS');
    assert.equal(result.remote.status, 'PASS');
  });
  check('CLI forwards a root containing spaces from an unrelated cwd', () => {
    const result = cli(candidate, [`--external-control-plane-root=${externalRoot}`, '--remote-required']);
    assert.equal(result.code, 0); assert.equal(result.value.status, 'READY');
  });
  const target = { nextGeneration: 2, nextWriterId: 'TEST-NEXT', eventId: 'synthetic-takeover' };
  const targetFlags = ['--next-generation=2', '--next-writer-id=TEST-NEXT', '--takeover-event-id=synthetic-takeover'];
  for (const [layout, layoutSources, controlRoot] of [['internal', internalSources, undefined], ['external', sources, externalRoot]]) {
    const rotationCandidate = makeCandidate({ sources: layoutSources });
    const layoutOptions = { externalControlPlaneRoot: controlRoot };
    const layoutFlags = controlRoot ? [`--external-control-plane-root=${controlRoot}`] : [];
    const rotationVerify = extra => verify(rotationCandidate, { ...layoutOptions, ...extra });
    const predecessor = verifyChain(rotationCandidate, { sourceRoot, ...layoutOptions }).latest;
    check(`${layout}: known target without an intent remains a normal preparation step`, () => {
      const result = rotationVerify(target);
      assert.equal(result.status, 'READY'); assert.equal(result.rotation.status, 'DIRECT_PREPARE_AVAILABLE');
      assert.equal(result.rotation.can_stop_old, true);
      const command = cli(rotationCandidate, [...layoutFlags, ...targetFlags]);
      assert.equal(command.code, 0); assert.equal(command.value.rotation.can_stop_old, true);
    });
    const prepared = prepareTransition(rotationCandidate, { sourceRoot, ...layoutOptions, expectedPreviousDigest: predecessor.seal_digest, ...target, preparedAt: '2026-01-01T00:00:01.000Z' });
    check(`${layout}: a pending intent without the candidate binding cannot authorize stopping`, () => {
      const result = rotationVerify();
      assert.equal(result.status, 'READY'); assert.equal(result.rotation.status, 'TARGET_REQUIRED');
      assert.equal(result.rotation.can_stop_old, false);
      assert.equal(cli(rotationCandidate, layoutFlags).value.rotation.status, 'TARGET_REQUIRED');
    });
    check(`${layout}: real API and CLI match the complete pending target`, () => {
      const result = rotationVerify(target);
      assert.equal(result.status, 'READY'); assert.equal(result.rotation.status, 'MATCHED');
      assert.equal(result.rotation.can_stop_old, true);
      const command = cli(rotationCandidate, [...layoutFlags, ...targetFlags]);
      assert.equal(command.code, 0); assert.equal(command.value.rotation.can_stop_old, true);
      assert.equal(fs.readFileSync(prepared.path, 'utf8').includes('TEST-NEXT'), true);
    });
    if (layout === 'external') check('external: source changes after the first chain read revoke stopping before return', () => {
      const file = path.join(controlRoot, layoutSources.current_view.path_ref);
      const original = fs.readFileSync(file);
      const read = fs.readFileSync;
      let injected = false;
      try {
        fs.readFileSync = function (filename, ...args) {
          const value = read.call(fs, filename, ...args);
          if (!injected && typeof filename === 'string' && path.resolve(filename) === path.resolve(manifestPath)) {
            injected = true;
            fs.appendFileSync(file, '\nlate source drift');
          }
          return value;
        };
        const result = rotationVerify(target);
        assert.equal(injected, true);
        assert.equal(result.status, 'BLOCKED');
        assert.equal(result.rotation.can_stop_old, false);
        assert.match(result.errors.join('\n'), /CANDIDATE_CHANGED_DURING_VERIFY/);
      } finally { fs.readFileSync = read; fs.writeFileSync(file, original); }
    });
    for (const extra of [{ nextWriterId: 'WRONG-NEXT' }, { eventId: 'wrong-event' }]) {
      check(`${layout}: another candidate's writer or event only blocks stopping`, () => {
        const result = rotationVerify({ ...target, ...extra });
        assert.equal(result.status, 'READY'); assert.equal(result.rotation.status, 'MISMATCH');
        assert.equal(result.rotation.can_stop_old, false);
      });
    }
    for (const invalid of [{ nextGeneration: 3 }, { nextWriterId: 'TEST-COMMANDER' }, { nextGeneration: 2, nextWriterId: '' }]) {
      check(`${layout}: invalid or partial target is an input gap, not damaged sources`, () => {
        const result = rotationVerify(invalid);
        assert.equal(result.status, 'READY'); assert.equal(result.rotation.status, 'INPUT_REQUIRED');
        assert.equal(result.chain.latest_source_status, 'PASS'); assert.equal(result.rotation.can_stop_old, false);
      });
    }
    check(`${layout}: CLI incomplete target does not masquerade as a match`, () => {
      const result = cli(rotationCandidate, [...layoutFlags, '--next-generation=2']);
      assert.equal(result.code, 0); assert.equal(result.value.rotation.status, 'INPUT_REQUIRED');
      assert.equal(result.value.rotation.can_stop_old, false);
    });
    for (const invalidFlags of [['--next-generation='], ['--next-generation'], [...targetFlags, '--next-writer-id=OTHER-NEXT']]) {
      check(`${layout}: CLI empty, bare and duplicate target flags cannot silently select a target`, () => {
        const result = cli(rotationCandidate, [...layoutFlags, ...invalidFlags]);
        assert.equal(result.code, 0); assert.equal(result.value.rotation.status, 'INPUT_REQUIRED');
        assert.equal(result.value.rotation.can_stop_old, false);
      });
    }
    check(`${layout}: source and workspace drift revoke a previously matched stop prerequisite`, () => {
      for (const file of [path.join(controlRoot || sourceRoot, layoutSources.current_view.path_ref), path.join(sourceRoot, 'probe.txt')]) {
        const original = fs.readFileSync(file);
        try {
          fs.appendFileSync(file, 'drift');
          const result = rotationVerify(target);
          assert.equal(result.status, 'BLOCKED'); assert.equal(result.rotation.can_stop_old, false);
        } finally { fs.writeFileSync(file, original); }
      }
    });
    check(`${layout}: optional remote outage preserves restrictions; required remote blocks stopping`, () => {
      git(['remote', 'remove', 'origin']);
      try {
        const optional = rotationVerify(target);
        assert.equal(optional.status, 'READY_WITH_RESTRICTIONS'); assert.equal(optional.rotation.can_stop_old, true);
        const required = rotationVerify({ ...target, remoteRequired: true });
        assert.equal(required.status, 'BLOCKED'); assert.equal(required.rotation.can_stop_old, false);
      } finally { git(['remote', 'add', 'origin', sourceRoot]); }
    });
    check(`${layout}: prepared intent is immutable and cannot be replaced for another candidate`, () => {
      const original = fs.readFileSync(prepared.path);
      assert.throws(() => prepareTransition(rotationCandidate, { sourceRoot, ...layoutOptions, ...target, nextWriterId: 'OTHER-NEXT' }), /unconsumed transition intent/);
      assert.deepEqual(fs.readFileSync(prepared.path), original);
    });
    check(`${layout}: tampered pending intent cannot produce a stop recommendation`, () => {
      const original = fs.readFileSync(prepared.path);
      try {
        const intent = JSON.parse(original); intent.next_writer_id = 'TAMPERED-NEXT';
        fs.writeFileSync(prepared.path, JSON.stringify(intent));
        const result = rotationVerify(target);
        assert.equal(result.status, 'BLOCKED'); assert.equal(result.rotation.can_stop_old, false);
      } finally { fs.writeFileSync(prepared.path, original); }
    });
    check(`${layout}: candidate, prepare, readback, confirmed stop and takeover consume one intent`, () => {
      const indexFile = path.join(controlRoot || sourceRoot, layoutSources.status_index.path_ref);
      const original = fs.readFileSync(indexFile);
      try {
        // Synthetic operator confirmation; no real commander or platform task is changed.
        const updated = original.toString('utf8').replace('"generation":1', '"generation":2').replace('TEST-COMMANDER', target.nextWriterId);
        fs.writeFileSync(indexFile, updated);
        const takeover = { ...predecessor, generation: target.nextGeneration, writer_id: target.nextWriterId, event_id: target.eventId,
          old_writer_status: 'STOPPED_DISPATCH', handoff_phase: 'TAKEOVER_COMPLETED', switch_status: 'COMPLETED',
          fact_cutoff: '2026-01-01T00:00:02.000Z', sealed_at: '2026-01-01T00:00:02.000Z',
          sources: { ...layoutSources, status_index: { ...layoutSources.status_index, digest: sha256(Buffer.from(updated)) } } };
        appendSeal(rotationCandidate, takeover, { sourceRoot, ...layoutOptions, expectedPreviousDigest: predecessor.seal_digest, transitionTicket: prepared.path });
        const completed = verifyChain(rotationCandidate, { sourceRoot, ...layoutOptions });
        assert.equal(completed.status, 'PASS', completed.errors.join('\n'));
        assert.equal(completed.control_status, 'READY'); assert.equal(completed.latest.switch_status, 'COMPLETED');
        assert.equal(completed.latest.generation, 2); assert.equal(completed.latest.writer_id, target.nextWriterId);
        assert.equal(completed.latest.old_writer_status, 'STOPPED_DISPATCH'); assert.equal(completed.pending_intents.length, 0);
        const reuse = rotationVerify(target);
        assert.equal(reuse.status, 'BLOCKED'); assert.equal(reuse.rotation.can_stop_old, false);
        assert.throws(() => appendSeal(rotationCandidate, takeover, { sourceRoot, ...layoutOptions, transitionTicket: prepared.path }), /already consumed|does not match append|expected previous/);
      } finally { fs.writeFileSync(indexFile, original); }
    });
  }
  for (const value of [undefined, '']) {
    check(`API missing/empty external root remains INPUT_REQUIRED (${String(value)})`, () => {
      const result = verify(candidate, { externalControlPlaneRoot: value });
      assert.equal(result.status, 'BLOCKED'); assert.equal(result.chain.latest_source_status, 'NOT_CHECKED');
      assert.match(result.errors.join('\n'), /INPUT_REQUIRED/);
    });
  }
  for (const flags of [[], ['--external-control-plane-root='], ['--external-control-plane-root=   ']]) {
    check(`CLI absent/empty root does not resolve to cwd (${flags.length ? JSON.stringify(flags[0]) : 'absent'})`, () => {
      const result = cli(candidate, flags);
      assert.equal(result.code, 1); assert.equal(result.value.chain.latest_source_status, 'NOT_CHECKED');
      assert.match(result.value.errors.join('\n'), /INPUT_REQUIRED/);
    });
  }
  for (const invalidRoot of [path.join(temp, 'missing-root'), sourceRoot]) {
    check('API invalid external root blocks source verification', () => {
      const result = verify(candidate, { externalControlPlaneRoot: invalidRoot });
      assert.equal(result.status, 'BLOCKED'); assert.equal(result.chain.latest_source_status, 'FAIL');
    });
    check('CLI invalid external root blocks source verification', () => {
      const result = cli(candidate, [`--external-control-plane-root=${invalidRoot}`]);
      assert.equal(result.code, 1); assert.equal(result.value.status, 'BLOCKED');
    });
  }
  check('external source-byte drift is still rejected', () => {
    const file = path.join(externalRoot, sources.current_view.path_ref), original = fs.readFileSync(file);
    try { fs.appendFileSync(file, 'drift'); assert.equal(verify(candidate).chain.latest_source_status, 'FAIL'); }
    finally { fs.writeFileSync(file, original); }
  });
  check('rule fingerprint drift is still rejected', () => {
    const stale = makeCandidate({ rule_baseline: { ...ruleBaseline, manifest_sha256: '0'.repeat(64) } });
    assert.match(verify(stale).errors.join('\n'), /RULE_REBASE_PENDING/);
  });
  check('workspace content drift is still rejected', () => {
    const file = path.join(sourceRoot, 'probe.txt');
    try { fs.writeFileSync(file, 'changed\n'); assert.equal(verify(candidate).workspace.status, 'FAIL'); }
    finally { fs.writeFileSync(file, 'base\n'); }
  });
  check('remote-required and optional restriction branches remain distinct', () => {
    git(['remote', 'remove', 'origin']);
    try {
      assert.equal(verify(candidate).status, 'READY_WITH_RESTRICTIONS');
      const required = verify(candidate, { remoteRequired: true });
      assert.equal(required.status, 'BLOCKED'); assert.match(required.errors.join('\n'), /REMOTE_REQUIRED/);
    } finally { git(['remote', 'add', 'origin', sourceRoot]); }
  });
  const remoteFixture = path.join(temp, 'different-remote.git');
  const initRemote = spawnSync('git', ['-c', 'core.longpaths=true', 'init', '--bare', '--quiet', remoteFixture], { encoding: 'utf8' });
  assert.equal(initRemote.status, 0, initRemote.stderr);
  const configureRemote = spawnSync('git', ['-C', remoteFixture, 'config', 'core.longpaths', 'true'], { encoding: 'utf8' });
  assert.equal(configureRemote.status, 0, configureRemote.stderr);
  const changedHead = git(['-c', 'user.name=Synthetic Test', '-c', 'user.email=test@example.invalid', 'commit-tree', workspace.tree, '-p', workspace.head, '-m', 'different synthetic remote']);
  git(['push', '--quiet', remoteFixture, `${changedHead}:refs/heads/main`]);
  git(['remote', 'set-url', 'origin', remoteFixture]);
  try {
    check('API restricts observed remote drift when the next step does not require the remote', () => {
      const result = verify(candidate);
      assert.equal(result.status, 'READY_WITH_RESTRICTIONS'); assert.equal(result.remote.status, 'FAIL');
      assert.equal(result.remote.head, changedHead); assert.equal(result.remote.pinned_head, workspace.head);
      assert.match(result.errors.join('\n'), /REMOTE_BASELINE_DRIFT/);
    });
    check('CLI rejects observed remote drift when remote observation is required', () => {
      const result = cli(candidate, [`--external-control-plane-root=${externalRoot}`, '--remote-required']);
      assert.equal(result.code, 1); assert.equal(result.value.remote.status, 'FAIL');
      assert.match(result.value.errors.join('\n'), /REMOTE_BASELINE_DRIFT/);
    });
  } finally { git(['remote', 'set-url', 'origin', sourceRoot]); }
  check('recovered observation is not a pinned baseline conflict or a read-only readiness upgrade', () => {
    const unknown = makeCandidate({ remote: { status: 'UNKNOWN', default_ref: 'refs/heads/main', head: null, observed_at: null }, switch_status: 'READY_WITH_RESTRICTIONS', control_handoff_confidence: 'MEDIUM', candidate_verification_status: 'PASS_WITH_RESTRICTIONS' });
    const result = verify(unknown);
    assert.equal(result.status, 'READY_WITH_RESTRICTIONS'); assert.equal(result.remote.status, 'PASS');
    assert.doesNotMatch(result.errors.join('\n'), /REMOTE_BASELINE_DRIFT/);
  });
  check('current attestation cannot be re-used as a candidate', () => {
    const current = makeCandidate({ handoff_phase: 'CURRENT_ATTESTATION', switch_status: 'COMPLETED', old_writer_status: 'STOPPED_DISPATCH' });
    const result = verify(current);
    assert.equal(result.status, 'BLOCKED'); assert.equal(result.chain.phase, 'CURRENT_ATTESTATION');
    assert.match(result.errors.join('\n'), /CANDIDATE_PHASE_INVALID/);
  });
  console.log(`Candidate verification: PASS (${passed} hermetic API/CLI checks; synthetic state only)`);
} finally {
  const realTemp = fs.realpathSync(temp);
  assert.equal(path.dirname(realTemp), fs.realpathSync(cacheRoot));
  const relativeTemp = path.relative(fs.realpathSync(root), realTemp);
  assert.ok(relativeTemp && !relativeTemp.startsWith('..') && !path.isAbsolute(relativeTemp));
  fs.rmSync(realTemp, { recursive: true, force: true });
}
