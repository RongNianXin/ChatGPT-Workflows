// Contract fixtures only; this is not a production handoff collector or installer.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const temp = mkdtempSync(join(tmpdir(), 'workflow-identity-'));
const repo = join(temp, 'source');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const git = (args, cwd = repo) => execFileSync('git', ['-c', 'core.autocrlf=false', ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
let passed = 0;
const check = (name, action) => { action(); passed++; console.log(`PASS: ${name}`); };
try {
  execFileSync('git', ['init', '--quiet', repo]);
  const put = (path, body) => writeFileSync(join(repo, path), body);
  put('.gitattributes', '*.txt text eol=lf\n*.bin -text\n');
  put('source.txt', 'alpha\nbeta\n');
  put('lock.txt', 'dependency=1\n');
  git(['add', '--', '.gitattributes', 'source.txt', 'lock.txt']);
  git(['-c', 'user.name=Synthetic', '-c', 'user.email=synthetic@example.invalid', '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'synthetic baseline']);
  const head = git(['rev-parse', 'HEAD']);
  const tree = git(['rev-parse', 'HEAD^{tree}']);
  const raw = path => sha(readFileSync(join(repo, path)));
  // Only known built-in text normalization in this fixture; never discover/run user filters.
  const canonical = path => git(['hash-object', `--path=${path}`, path]);
  const committed = git(['rev-parse', 'HEAD:source.txt']);
  check('same tree: CRLF/LF canonical identity matches while raw hashes differ', () => {
    const lf = raw('source.txt');
    put('source.txt', 'alpha\r\nbeta\r\n');
    assert.notEqual(raw('source.txt'), lf);
    assert.equal(canonical('source.txt'), committed);
    assert.equal(git(['rev-parse', 'HEAD^{tree}']), tree);
  });
  check('same HEAD: different uncommitted content must differ', () => {
    put('source.txt', 'changed\n');
    assert.equal(git(['rev-parse', 'HEAD']), head);
    assert.notEqual(canonical('source.txt'), committed);
  });
  check('index and worktree are distinct evidence', () => {
    git(['add', '--', 'source.txt']);
    put('source.txt', 'changed again\n');
    assert.notEqual(git(['rev-parse', ':source.txt']), canonical('source.txt'));
  });
  put('model.bin', Buffer.from([0, 1, 255]));
  const manifest = () => JSON.stringify({ version: 'fixture-v1', head: git(['rev-parse', 'HEAD']), index: git(['rev-parse', ':source.txt']), source: canonical('source.txt'), model: raw('model.bin') });
  check('same worktree: unchanged required uncommitted result is reusable', () => {
    const before = manifest();
    assert.equal(manifest(), before);
  });
  check('new worktree does not inherit tracked delta or required untracked model', () => {
    const target = join(temp, 'target');
    git(['worktree', 'add', '--quiet', '--detach', target, head]);
    assert.notEqual(readFileSync(join(target, 'source.txt'), 'utf8'), readFileSync(join(repo, 'source.txt'), 'utf8'));
    assert.equal(existsSync(join(target, 'model.bin')), false);
  });
  check('same source: lock/model changes are separate runtime differences', () => {
    const source = canonical('source.txt');
    const lock = raw('lock.txt');
    const model = raw('model.bin');
    put('lock.txt', 'dependency=2\n');
    put('model.bin', Buffer.from([0, 2, 255]));
    assert.equal(canonical('source.txt'), source);
    assert.notEqual(raw('lock.txt'), lock);
    assert.notEqual(raw('model.bin'), model);
  });
  check('changed content during capture invalidates that snapshot', () => {
    const before = manifest();
    put('source.txt', 'concurrent edit\n');
    assert.notEqual(manifest(), before);
  });
  // Documentary cases verify the normative boundary, not real ML/performance behavior.
  const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
  const contract = readFileSync(join(root, '总指挥工作流/第二代总指挥的工作模式/04-状态、目标变更与交接规范.md'), 'utf8');
  const documentary = [
    ['missing model blocks dependent actions only', ['只阻断依赖缺失层的动作', '必要且被 Git 忽略的模型/资产']],
    ['performance and ML use predefined conditions, not one timing or bitwise promise', ['同条件、多次测量和分段日志', '跨硬件逐位一致']],
    ['secret/cache/log admission rejected without deleting history', ['先审查清单再采集/打包', '排除不等于删除历史', '不得用秘密值哈希冒充脱敏']],
    ['unknown filters and old aggregate remain unverified', ['未知或不可信过滤器不运行', '旧记录值', '不能声称旧聚合值已复算']],
    ['not run is distinct from failed', ['NOT_RUN / UNKNOWN', '已证明不满足才用 FAIL']],
    ['squash mapping and first divergence preserve causal uncertainty', ['squash/rebase 不一定生成 merge commit', '第一处分叉是定位线索']],
  ];
  for (const [name, phrases] of documentary) check(`document contract: ${name}`, () => phrases.forEach(p => assert.ok(contract.includes(p), p)));
  const schedulerGuide = readFileSync(join(root, '总指挥工作流/第二代总指挥的工作模式/templates/SCHEDULER_REBUILD_GUIDE.md'), 'utf8');
  check('scheduler guide is non-sensitive and references the canonical prompt entry', () => {
    assert.match(schedulerGuide, /source_prompt_entry:/);
    assert.match(schedulerGuide, /不复制正文/);
    assert.match(schedulerGuide, /完整的非秘密提示词/);
    assert.match(schedulerGuide, /original_prompt_non_secret:/);
    assert.match(schedulerGuide, /post_creation_verification:/);
    assert.doesNotMatch(schedulerGuide, /^task_id:/m);
    assert.doesNotMatch(schedulerGuide, /^credential:/m);
  });
  const schedulerDecision = ({ exists, duplicate = false, fingerprintMatch = false, ambiguous = false }) => {
    if (ambiguous || duplicate) return 'BLOCKED';
    if (exists && fingerprintMatch) return 'VERIFY_ONLY';
    if (exists) return 'STOP_AND_REVIEW';
    return 'REBUILD_CANDIDATE_ONLY';
  };
  check('existing automation is verification-only', () => {
    assert.equal(schedulerDecision({ exists: true, fingerprintMatch: true }), 'VERIFY_ONLY');
  });
  check('missing automation yields an authorization-gated rebuild candidate', () => {
    assert.equal(schedulerDecision({ exists: false }), 'REBUILD_CANDIDATE_ONLY');
    assert.equal(schedulerDecision({ exists: false, ambiguous: true }), 'BLOCKED');
    assert.equal(schedulerDecision({ exists: false, duplicate: true }), 'BLOCKED');
  });
  console.log(`Handoff identity: PASS (${passed} cases; 7 Git/file fixtures, 9 documentary boundaries)`);
} finally {
  const child = relative(resolve(tmpdir()), resolve(temp));
  if (!child.startsWith('..') && !isAbsolute(child) && child.startsWith('workflow-identity-')) rmSync(temp, { recursive: true, force: true });
}
