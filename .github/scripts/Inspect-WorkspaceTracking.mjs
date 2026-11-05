#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const fail = (code, phase, details = {}) => { throw Object.assign(new Error(code), { code, phase, details }); };
const pathKey = value => process.platform === 'win32' ? value.toLowerCase() : value;
const canonical = value => fs.realpathSync.native(path.resolve(value));
const redirectedEnvironment = new Set([
  'GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY',
  'GIT_ALTERNATE_OBJECT_DIRECTORIES', 'GIT_NAMESPACE', 'GIT_CONFIG', 'GIT_CONFIG_PARAMETERS',
  'GIT_CEILING_DIRECTORIES', 'GIT_DISCOVERY_ACROSS_FILESYSTEM', 'GIT_SHALLOW_FILE',
  'GIT_GRAFT_FILE', 'GIT_REPLACE_REF_BASE', 'GIT_QUARANTINE_PATH', 'GIT_ATTR_SOURCE',
  'GIT_LITERAL_PATHSPECS', 'GIT_GLOB_PATHSPECS', 'GIT_NOGLOB_PATHSPECS', 'GIT_ICASE_PATHSPECS'
]);

export function parseArguments(args) {
  const result = { stageSafe: false, reviewedPaths: [] };
  const seen = new Set();
  for (const arg of args) {
    if (seen.has(arg)) fail('DUPLICATE_ARGUMENT', 'input');
    seen.add(arg);
    if (arg === '--stage-safe') result.stageSafe = true;
    else if (arg === '--metadata-only') result.metadataOnly = true;
    else if (arg.startsWith('--reviewed-path=')) {
      const value = arg.slice('--reviewed-path='.length);
      if (!value) fail('EMPTY_ARGUMENT', 'input');
      result.reviewedPaths.push(process.platform === 'win32' ? value.replaceAll('\\', '/') : value);
    } else if (arg.startsWith('--project-root=')) {
      if (result.projectRoot !== undefined) fail('DUPLICATE_ARGUMENT', 'input');
      result.projectRoot = arg.slice('--project-root='.length);
      if (!result.projectRoot.trim()) fail('EMPTY_ARGUMENT', 'input');
    } else fail('UNKNOWN_ARGUMENT', 'input');
  }
  if (result.metadataOnly && (result.stageSafe || result.reviewedPaths.length)) fail('INCOMPATIBLE_MODES', 'input');
  if (result.stageSafe !== Boolean(result.reviewedPaths.length)) fail('EXPLICIT_REVIEW_REQUIRED', 'input');
  if (new Set(result.reviewedPaths).size !== result.reviewedPaths.length) fail('DUPLICATE_ARGUMENT', 'input');
  return result;
}
const protectedPatterns = [
  /^\.codex-manual-cache(?:[\\/]|$)/u,
  /^其他资料(?:[\\/]|$)/u,
  /全局提示词（严禁AI自动修改）/u,
  /操作者协作画像\.local\.md$/u,
  /操作者画像资料\.local(?:[\\/]|$)/u,
  /自用/u,
  /(?:^|[\\/])(?:\.env(?:\.|$)|.*\.(?:pem|key|p12|pfx))$/iu
];
const reviewPatterns = [
  /(?:secret|credential|password|token|cookie|backup|private|draft|详细分析报告|stage-a-report)/iu,
  /(?:^|[\\/])(?:tmp|temp|coverage|dist|build|node_modules)(?:[\\/]|$)/iu
];

// Fixed exclusions are not caller pathspecs. Directory excludes also prune traversal.
const inventoryExcludes = ['/.codex-manual-cache/', '/其他资料/', '全局提示词（严禁AI自动修改）/',
  '*自用*', '操作者协作画像.local.md', '操作者画像资料.local/',
  '.env', '.env.*', '*.pem', '*.key', '*.p12', '*.pfx']
  .map(pattern => pattern.replace(/[a-z]/giu, letter => `[${letter.toLowerCase()}${letter.toUpperCase()}]`));
const inventoryPathspecs = ['.codex-manual-cache/**', '其他资料/**',
  '**/全局提示词（严禁AI自动修改）/**', '**/*自用*', '**/*自用*/**',
  '**/操作者协作画像.local.md', '**/操作者画像资料.local/**', '**/.env', '**/.env.*',
  '**/*.pem', '**/*.key', '**/*.p12', '**/*.pfx'].map(pattern => `:(top,exclude,glob,icase)${pattern}`);
const nulRecords = raw => {
  if (typeof raw !== 'string' || (raw && !raw.endsWith('\0')) || raw.includes('\ufffd')) fail('INVALID_INVENTORY', 'parse');
  const records = raw ? raw.slice(0, -1).split('\0') : [];
  if (records.some(record => !record)) fail('INVALID_INVENTORY', 'parse');
  return records;
};
const inventoryPath = value => {
  if (!value || value.startsWith('/') || value.split('/').includes('..')) fail('INVALID_INVENTORY', 'parse');
  return value;
};
const parseIndex = raw => nulRecords(raw).map(record => {
  const match = /^(100644|100755|120000|160000|040000) ([0-9a-f]{40}|[0-9a-f]{64}) ([0-3])\t(.+)$/su.exec(record);
  if (!match) fail('INVALID_INVENTORY', 'parse');
  return { mode: match[1], stage: Number(match[3]), path: inventoryPath(match[4]) };
});

const parseStatus = raw => {
  if (raw && !raw.endsWith('\0')) fail('INVALID_STATUS', 'parse');
  const records = raw.split('\0').filter(Boolean);
  const entries = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!/^[ MADRCUT?!]{2} .+/su.test(record)) fail('INVALID_STATUS', 'parse');
    entries.push({ code: record.slice(0, 2), path: record.slice(3) });
    if (/[RC]/.test(record.slice(0, 2)) && !records[++index]) fail('INVALID_STATUS', 'parse');
  }
  return entries;
};
const classify = relativePath => {
  const normalized = relativePath.replaceAll('\\', '/');
  if (protectedPatterns.some(pattern => pattern.test(normalized))) return { category: 'PROTECTED', reason: '命中项目保护规则，不得自动纳入' };
  if (reviewPatterns.some(pattern => pattern.test(normalized))) return { category: 'REVIEW', reason: '文件名或目录提示可能含临时、敏感或来源不明内容' };
  return { category: 'SAFE_CANDIDATE', reason: '仅按路径筛出的候选；暂存前仍须核验任务范围、来源和内容' };
};

export function inspectTracking({ projectRoot, stageSafe = false, metadataOnly = false, reviewedPaths = [], cwd = process.cwd(),
  env = process.env, spawn = spawnSync, timeoutMs = 30000, totalTimeoutMs = 60000,
  maxBuffer = 16 * 1024 * 1024, now = () => performance.now() } = {}) {
  const mode = metadataOnly ? 'PATH_INVENTORY_ONLY' : stageSafe ? 'CLASSIFY_AND_STAGE_SAFE' : 'CLASSIFY_ONLY';
  let root;
  let writeStarted = false;
  try {
    if (![timeoutMs, totalTimeoutMs, maxBuffer].every(value => Number.isSafeInteger(value) && value > 0)) fail('INVALID_BUDGET', 'input');
    if (metadataOnly && (stageSafe || reviewedPaths.length)) fail('INCOMPATIBLE_MODES', 'input');
    if (stageSafe !== Boolean(reviewedPaths.length)) fail('EXPLICIT_REVIEW_REQUIRED', 'input');
    // Git for Windows can redirect its own handles even when the caller uses pipes.
    const redirected = Object.keys(env).filter(name => {
      const key = name.toUpperCase();
      return redirectedEnvironment.has(key) || /^GIT_CONFIG_(?:COUNT|KEY_.*|VALUE_.*)$/u.test(key)
        || key.startsWith('GIT_TRACE') || key.startsWith('GIT_REDIRECT_');
    });
    if (redirected.length) fail('GIT_ENVIRONMENT_OVERRIDE', 'environment', { variables: redirected });
    const start = now();
    const git = (args, phase, at = root, allowed = [0], fixedPathspecs = false) => {
      const remaining = Math.floor(totalTimeoutMs - (now() - start));
      if (remaining <= 0) fail('TOTAL_BUDGET_EXCEEDED', phase);
      const result = spawn('git', ['--no-optional-locks', ...(fixedPathspecs ? [] : ['--literal-pathspecs']),
        '-c', 'core.fsmonitor=false', '-c', 'core.untrackedCache=false',
        '-c', 'status.submoduleSummary=false', ...args], {
        cwd: at, encoding: 'utf8', timeout: Math.min(timeoutMs, remaining), maxBuffer,
        windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...env, GIT_OPTIONAL_LOCKS: '0', GIT_NO_LAZY_FETCH: '1', GIT_TERMINAL_PROMPT: '0' }
      });
      if (result.error || !allowed.includes(result.status)) {
        const codes = { ENOENT: 'GIT_UNAVAILABLE', ETIMEDOUT: 'GIT_TIMEOUT', ENOBUFS: 'GIT_OUTPUT_LIMIT', EACCES: 'GIT_PERMISSION_DENIED' };
        fail(codes[result.error?.code] || 'GIT_FAILED', phase,
          { exit_status: result.status, signal: result.signal || null });
      }
      // ls-files can report unreadable directories only on stderr and still exit 0.
      if (fixedPathspecs && result.stderr?.trim()) fail('GIT_INVENTORY_WARNING', phase);
      return result.stdout;
    };
    const input = projectRoot === undefined ? cwd : projectRoot;
    if (typeof input !== 'string' || !input.trim()) fail('ROOT_REQUIRED', 'root');
    let actual;
    try {
      actual = canonical(input);
      if (!fs.statSync(actual).isDirectory()) fail('ROOT_NOT_DIRECTORY', 'root');
    } catch (error) {
      if (error.phase) throw error;
      fail(error.code === 'EACCES' ? 'ROOT_PERMISSION_DENIED' : 'ROOT_UNAVAILABLE', 'root');
    }
    const top = git(['rev-parse', '--show-toplevel'], 'root', actual).replace(/\r?\n$/u, '');
    root = canonical(top);
    if (projectRoot !== undefined && pathKey(root) !== pathKey(actual)) fail('EXPLICIT_ROOT_MISMATCH', 'root');
    if (metadataOnly) {
      const indexArgs = ['ls-files', '--stage', '--sparse', '-z', '--', ...inventoryPathspecs];
      const othersArgs = ['ls-files', '--others', '--exclude-standard', '-z',
        ...inventoryExcludes.map(pattern => `--exclude=${pattern}`), '--', ...inventoryPathspecs];
      const indexRaw = git(indexArgs, 'index_inventory', root, [0], true);
      const othersRaw = git(othersArgs, 'untracked_inventory', root, [0], true);
      const entries = parseIndex(indexRaw);
      const untracked = nulRecords(othersRaw).map(inventoryPath);
      if (git(indexArgs, 'index_inventory_recheck', root, [0], true) !== indexRaw
        || git(othersArgs, 'untracked_inventory_recheck', root, [0], true) !== othersRaw) fail('OBSERVATION_CHANGED', 'inventory_recheck');
      return { result: 'PARTIAL', complete: false, root, mode,
        index_entries: entries, untracked_paths: untracked,
        observation_scope: { protected_paths: 'EXCLUDED', worktree_content_changes: 'NOT_OBSERVED',
          index_changes_against_head: 'NOT_OBSERVED', submodule_internal_state: 'NOT_OBSERVED',
          unexpanded_untracked_directories: untracked.filter(name => name.endsWith('/')),
          unexpanded_sparse_directories: entries.filter(entry => entry.mode === '040000').map(entry => entry.path),
          unobserved_gitlinks: entries.filter(entry => entry.mode === '160000').map(entry => entry.path), content_snapshot: false },
        semantic_verification: 'NOT_PERFORMED', authorization_verified: false, write_state: 'NOT_STARTED',
        limits: 'Partial path inventory only. Git reads index and ignore rules and traverses non-excluded directories; no content comparison or filters. Excluded paths and sparse directories are not a full tracked-file list. Two matching observations are not an atomic snapshot. Requires trusted Git and stable external configuration, not an OS sandbox.',
        next_step: 'AI仅用路径盘点定位后续待核对象；不能据此声称干净、改动检查完成或可提交；需要完整状态时另行安全核验，不自动转写模式' };
    }
    const filters = () => {
      const raw = git(['config', '--includes', '--null', '--get-regexp', '^filter\\..*\\.(clean|process)$'], 'filter_preflight', root, [0, 1]);
      const commands = raw.split('\0').filter(Boolean).map(record => {
        const split = record.indexOf('\n');
        if (split < 1) fail('INVALID_CONFIG_RESPONSE', 'filter_preflight');
        return { key: record.slice(0, split), value: record.slice(split + 1) };
      }).filter(item => item.value.trim());
      if (commands.length) fail('EXECUTABLE_GIT_FILTER', 'filter_preflight', { count: commands.length });
    };
    filters();
    const statusArgs = ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--ignore-submodules=all'];
    const raw = git(statusArgs, 'status');
    const status = parseStatus(raw);
    const gitlinks = git(['ls-files', '--stage', '-z'], 'submodule_scope').split('\0').filter(Boolean)
      .filter(record => record.startsWith('160000 ')).map(record => record.slice(record.indexOf('\t') + 1));
    filters();
    if (git(statusArgs, 'status_recheck') !== raw) fail('OBSERVATION_CHANGED', 'status_recheck');
    const untracked = status.filter(item => item.code === '??');
    const results = untracked.map(item => ({ path: item.path, ...classify(item.path) }));
    const safe = results.filter(item => item.category === 'SAFE_CANDIDATE').map(item => item.path);
    if (stageSafe) {
      for (const candidate of reviewedPaths) {
        if (!safe.includes(candidate) || !fs.lstatSync(path.resolve(root, candidate)).isFile() || fs.lstatSync(path.resolve(root, candidate)).isSymbolicLink()) fail('INELIGIBLE_REVIEWED_PATH', 'stage_preflight');
      }
      writeStarted = true;
      git(['add', '--', ...reviewedPaths], 'stage');
    }
    return {
      result: 'PASS', complete: true, root, mode,
      untracked_count: untracked.length, safe_candidates: safe,
      staged_paths: stageSafe ? reviewedPaths : [],
      review_required: results.filter(item => item.category === 'REVIEW'),
      protected: results.filter(item => item.category === 'PROTECTED'),
      tracked_changes: status.filter(item => item.code !== '??').map(item => ({ code: item.code, path: item.path })),
      observation_scope: { submodule_internal_state: 'NOT_OBSERVED', submodule_commit_changes: 'NOT_OBSERVED', unobserved_gitlinks: gitlinks, content_snapshot: false },
      semantic_verification: 'NOT_PERFORMED', authorization_verified: false,
      limits: 'Path classification is not provenance, content, privacy or authorization review. Git may read tracked content internally. Stable path status is not an atomic snapshot. Configuration preflight is not an OS sandbox. Staging remains separately authorized and subject to concurrent changes.',
      next_step: safe.length && !stageSafe ? '候选只表示路径初筛；AI核验任务范围、来源、内容及当次授权后才可逐项暂存，不自动进入写模式' : 'AI回读暂存范围及剩余待审查项；未观察的子模块不能称干净'
    };
  } catch (error) {
    return { result: 'BLOCKED', complete: false, root: root || null, mode,
      write_state: writeStarted ? 'UNKNOWN_REQUIRES_READBACK' : 'NOT_STARTED',
      error: { code: error.phase ? error.code : 'INSPECTION_FAILED', phase: error.phase || 'inspection', ...error.details },
      next_step: '只暂停依赖本观察的动作；AI核具体缺口，写入结果未知先回读，不自动重放、安装、改配置或放宽安全门禁' };
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let output;
  try { output = inspectTracking(parseArguments(process.argv.slice(2))); }
  catch (error) { output = { result: 'BLOCKED', complete: false, write_state: 'NOT_STARTED', error: { code: error.code, phase: error.phase } }; }
  console.log(JSON.stringify(output, null, 2));
  if (output.result !== 'PASS') process.exitCode = output.result === 'PARTIAL' ? 2 : 1;
}
