#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const events = new Set(['create', 'sync', 'complete', 'cancel', 'fail', 'pause', 'handoff', 'audit']);
const resources = new Set(['ACTIVE', 'RETAIN', 'PRESERVE', 'CANDIDATE', 'UNKNOWN']);
const assessments = ['ownership', 'preservation', 'dependencies', 'integration', 'authorization'];
const canonical = input => fs.realpathSync.native(path.resolve(input));
const pathKey = input => process.platform === 'win32' ? input.toLowerCase() : input;
const samePath = (a, b) => pathKey(canonical(a)) === pathKey(canonical(b));
const digest = input => crypto.createHash('sha256').update(input).digest('hex');

function git(cwd, args, allowed = [0]) {
  const result = spawnSync('git', ['--no-optional-locks', '-c', 'core.fsmonitor=false', '-c', 'core.untrackedCache=false', ...args], {
    cwd, encoding: 'utf8', timeout: 30000, maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_NO_LAZY_FETCH: '1', GIT_TERMINAL_PROMPT: '0' }
  });
  if (result.error || !allowed.includes(result.status)) throw new Error(`git ${args[0]}: ${result.error?.message || result.stderr.trim() || `exit ${result.status}`}`);
  return result;
}

function parseStatus(raw) {
  const fields = raw.split('\0').filter(Boolean);
  const entries = [];
  for (let i = 0; i < fields.length; i += 1) {
    const entry = { code: fields[i].slice(0, 2), path: fields[i].slice(3) };
    if (/[RC]/u.test(entry.code)) entry.original_path = fields[++i];
    entries.push(entry);
  }
  return entries;
}

function parseWorktrees(raw) {
  const entries = [];
  let entry;
  for (const field of raw.split('\0')) {
    if (field.startsWith('worktree ')) {
      entry = { path: field.slice(9) };
      entries.push(entry);
    } else if (entry && field) {
      const split = field.indexOf(' ');
      entry[split < 0 ? field : field.slice(0, split)] = split < 0 ? true : field.slice(split + 1);
    }
  }
  return entries;
}

// A projection comes from the existing sole record; it is not another authority database.
export function inspect({ worktree, event, record }) {
  if (!worktree || !events.has(event)) throw new Error('INPUT_REQUIRED: explicit --worktree and valid --event are required');
  const result = {
    schema_version: 1, mode: 'READ_ONLY', event, worktree: path.resolve(worktree),
    observed: {}, declared: null, gaps: [], decision: 'REVIEW_REQUIRED',
    semantic_verification: 'NOT_PERFORMED', deletion_authorized: false,
    limits: 'Only the explicit worktree and projection are read. Declarations do not verify ownership, processes, restoration, integration or deletion authority. No fetch, refs/config writes, GC, process control or removal.'
  };
  try {
    const actual = canonical(worktree);
    const root = git(actual, ['rev-parse', '--show-toplevel']).stdout.trim();
    if (!samePath(root, actual)) throw new Error('WORKTREE_ROOT_REQUIRED: subdirectories are not worktree roots');
    result.observed.canonical_path = actual;
    if (pathKey(path.resolve(worktree)) !== pathKey(actual)) result.gaps.push('PATH_ALIAS_REQUIRES_EXACT_TARGET_REVIEW');
    const entries = parseWorktrees(git(actual, ['worktree', 'list', '--porcelain', '-z']).stdout);
    // Other listed worktree paths may be absent; compare metadata without opening their directories.
    const entry = entries.find(item => pathKey(path.resolve(item.path)) === pathKey(actual));
    if (!entry) throw new Error('WORKTREE_NOT_REGISTERED');
    const head = git(actual, ['rev-parse', '--verify', 'HEAD']).stdout.trim();
    const branch = git(actual, ['symbolic-ref', '--quiet', '--short', 'HEAD'], [0, 1]);
    const status = git(actual, ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--ignored=matching']).stdout;
    result.observed = { ...result.observed, head, branch: branch.status === 1 ? null : branch.stdout.trim(),
      detached: branch.status === 1, primary: entry === entries[0], locked: Object.hasOwn(entry, 'locked'),
      status: parseStatus(status), status_fingerprint: digest(`${head}\0${status}`),
      containing_local_refs: git(actual, ['for-each-ref', '--contains', head, '--format=%(refname)', 'refs/heads/', 'refs/tags/']).stdout.trim().split('\n').filter(Boolean)
    };
    const headAfter = git(actual, ['rev-parse', '--verify', 'HEAD']).stdout.trim();
    const statusAfter = git(actual, ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--ignored=matching']).stdout;
    if (headAfter !== head || statusAfter !== status) result.gaps.push('OBSERVATION_CHANGED_RETRY_THIS_OBJECT');
    if (result.observed.primary) result.gaps.push('PRIMARY_WORKTREE_REQUIRES_SEPARATE_POLICY');
    if (result.observed.locked) result.gaps.push('LOCKED_WORKTREE');
    if (result.observed.status.some(item => item.code !== '!!')) result.gaps.push('UNCOMMITTED_OR_UNTRACKED_RESULTS_REVIEW');
    if (result.observed.status.some(item => item.code === '!!')) result.gaps.push('IGNORED_CONTENT_REVIEW');
    if (!result.observed.containing_local_refs.length) result.gaps.push('NO_CONTAINING_LOCAL_BRANCH_OR_TAG_REVIEW_RECOVERY');
  } catch (error) {
    result.gaps.push(`GIT_OBSERVATION_UNAVAILABLE: ${error.message}`);
    result.decision = 'OBSERVATION_BLOCKED';
  }
  if (!record) result.gaps.push('RECORD_PROJECTION_REQUIRED');
  else {
    try {
      const text = fs.readFileSync(record, 'utf8').replace(/^\uFEFF/u, '');
      const projection = JSON.parse(text);
      if (!projection || Array.isArray(projection) || projection.schema_version !== 1) throw new Error('schema_version must be 1');
      result.declared = projection;
      result.projection_sha256 = digest(text);
      if (typeof projection.worktree_path !== 'string' || !samePath(projection.worktree_path, worktree)) result.gaps.push('RECORD_WORKTREE_MISMATCH');
      for (const key of ['record_ref', 'owner', 'next_action_owner', 'recheck_condition', 'reason']) {
        if (typeof projection[key] !== 'string' || !projection[key].trim() || /^(UNKNOWN|PENDING)$/iu.test(projection[key])) result.gaps.push(`RECORD_FIELD_REQUIRED:${key}`);
      }
      if (!resources.has(projection.resource_state)) result.gaps.push('RESOURCE_STATE_REQUIRED');
      if (projection.observed_head !== result.observed.head || projection.observed_status_fingerprint !== result.observed.status_fingerprint) result.gaps.push('PROJECTION_OBSERVATION_STALE');
      for (const key of assessments) {
        const assessment = projection.assessments?.[key];
        if (!assessment || typeof assessment.status !== 'string' || typeof assessment.ref !== 'string' || !assessment.ref.trim() || typeof assessment.actor !== 'string' || !assessment.actor.trim()) result.gaps.push(`ASSESSMENT_REQUIRED:${key}`);
        else if (assessment.status !== 'CONFIRMED') result.gaps.push(`ASSESSMENT_REVIEW:${key}`);
      }
    } catch (error) { result.gaps.push(`RECORD_PROJECTION_UNAVAILABLE: ${error.message}`); }
  }
  // Even complete, fresh declarations require evidence review by the responsible actor.
  if (result.decision !== 'OBSERVATION_BLOCKED') {
    if (!result.gaps.length && result.declared.resource_state === 'CANDIDATE') result.decision = 'CANDIDATE_PENDING_EVIDENCE_REVIEW';
    else if (!result.gaps.length && result.declared.resource_state === 'ACTIVE') result.decision = 'DECLARED_ACTIVE';
    else if (!result.gaps.length && result.declared.resource_state === 'RETAIN') result.decision = 'DECLARED_RETAIN';
  }
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = {};
    for (let i = 2; i < process.argv.length; i += 2) {
      const name = process.argv[i];
      if (!['--worktree', '--event', '--record'].includes(name) || !process.argv[i + 1] || process.argv[i + 1].startsWith('--') || Object.hasOwn(options, name.slice(2))) throw new Error('INPUT_REQUIRED: use --worktree <path> --event <create|sync|complete|cancel|fail|pause|handoff|audit> [--record <projection.json>]; unknown or duplicate options rejected');
      options[name.slice(2)] = process.argv[i + 1];
    }
    console.log(JSON.stringify(inspect(options), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
