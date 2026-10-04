#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const args = new Set(process.argv.slice(2));
const stageSafe = args.has('--stage-safe');
const reviewedPaths = [...args].filter(arg => arg.startsWith('--reviewed-path=')).map(arg => arg.slice('--reviewed-path='.length).replaceAll('\\', '/'));
if (stageSafe && !reviewedPaths.length) throw new Error('--stage-safe requires explicit --reviewed-path=<path> entries after scope and content review');
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

const run = (file, argv) => execFileSync(file, argv, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const parseStatus = raw => {
  const records = raw.split('\0').filter(Boolean);
  const entries = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    entries.push({ code: record.slice(0, 2), path: record.slice(3) });
    if (/[RC]/.test(record.slice(0, 2))) index += 1;
  }
  return entries;
};
const classify = relativePath => {
  const normalized = relativePath.replaceAll('\\', '/');
  if (protectedPatterns.some(pattern => pattern.test(normalized))) return { category: 'PROTECTED', reason: '命中项目保护规则，不得自动纳入' };
  if (reviewPatterns.some(pattern => pattern.test(normalized))) return { category: 'REVIEW', reason: '文件名或目录提示可能含临时、敏感或来源不明内容' };
  return { category: 'SAFE_CANDIDATE', reason: '仅按路径筛出的候选；暂存前仍须核验任务范围、来源和内容' };
};

const status = parseStatus(run('git', ['status', '--porcelain=v1', '-z', '--untracked-files=all']));
const untracked = status.filter(item => item.code === '??');
const results = untracked.map(item => ({ path: item.path, ...classify(item.path) }));
const safe = results.filter(item => item.category === 'SAFE_CANDIDATE').map(item => item.path);
if (stageSafe) {
  for (const candidate of reviewedPaths) {
    if (!safe.includes(candidate) || fs.lstatSync(path.resolve(root, candidate)).isSymbolicLink()) throw new Error(`reviewed path is not an eligible regular candidate: ${candidate}`);
  }
  run('git', ['add', '--', ...reviewedPaths]);
}
const output = {
  root,
  mode: stageSafe ? 'CLASSIFY_AND_STAGE_SAFE' : 'CLASSIFY_ONLY',
  untracked_count: untracked.length,
  safe_candidates: safe,
  staged_paths: stageSafe ? reviewedPaths : [],
  review_required: results.filter(item => item.category === 'REVIEW'),
  protected: results.filter(item => item.category === 'PROTECTED'),
  tracked_changes: status.filter(item => item.code !== '??').map(item => ({ code: item.code, path: item.path })),
  next_step: safe.length && !stageSafe ? '核验候选的任务范围和内容后，使用 --stage-safe --reviewed-path=<path> 逐项暂存；review_required 和 protected 不自动暂存' : '回读 git status，确认暂存范围与剩余待审查项'
};
console.log(JSON.stringify(output, null, 2));
