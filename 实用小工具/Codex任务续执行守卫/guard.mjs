import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const self = fileURLToPath(import.meta.url);
const registry = path.resolve(path.dirname(self), '../../.codex-manual-cache/task-continuation-guard');
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const canonical = file => fs.realpathSync.native(file);
const samePath = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
const within = (root, target) => { const rel = path.relative(root, target); return rel === '' || (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel)); };
const alive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
const terminal = new Set(['VERIFIED', 'WAIT', 'BLOCKED', 'CANCELLED', 'LIMIT', 'STALLED', 'CHECKER_ERROR', 'GUARD_ERROR', 'CLI_ERROR', 'UNVERIFIED']);
export function atomic(file, data) {
  const temp = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(data, null, 2)}\n`, { flag: 'wx' });
  fs.renameSync(temp, file);
}
function locked(directory, action) {
  const lock = path.join(directory, 'event.lock');
  const fd = fs.openSync(lock, 'wx'); // Never steal a lock from an unknown or live owner.
  try { fs.writeFileSync(fd, JSON.stringify({ pid: process.pid })); return action(); }
  finally { fs.closeSync(fd); fs.unlinkSync(lock); }
}
function stop(status, message) {
  return { continue: false, stopReason: status, systemMessage: `任务守卫：${message}；尚未取得完成验收。` };
}
function validateContract(source, base) {
  if (source.version !== 1 || !/^[a-zA-Z0-9_-]{1,80}$/.test(source.workItem ?? '')) throw Error('需要 version=1 和稳定 workItem');
  const c = structuredClone(source);
  c.cwd = canonical(path.resolve(base, c.cwd));
  for (const [key, min, max] of [['maxMinutes', 1, 1440], ['maxContinuations', 1, 20], ['maxNoProgress', 1, 5]]) {
    if (!Number.isInteger(c[key]) || c[key] < min || c[key] > max) throw Error(`非法上限 ${key}`);
  }
  const check = c.checker;
  if (!check || check.readOnly !== true || check.network !== 'none' || check.idempotent !== true || check.spawnsChildren !== false) throw Error('检查器必须声明只读、无网络、幂等、不派生子进程');
  if (!Array.isArray(check.args) || check.args.some(arg => typeof arg !== 'string')) throw Error('checker.args 必须是字符串数组');
  if (!Number.isInteger(check.timeoutSeconds) || check.timeoutSeconds < 1 || check.timeoutSeconds > 30) throw Error('检查器超时必须为1–30秒');
  check.executable = canonical(path.resolve(base, check.executable));
  check.entry = canonical(path.resolve(base, check.entry));
  if (!samePath(check.entry, check.executable) && (!check.args[0] || !samePath(canonical(path.resolve(c.cwd, check.args[0])), check.entry))) throw Error('解释器的第一个参数必须是固定检查脚本入口');
  if (!Array.isArray(check.pins) || !check.pins.length) throw Error('检查器程序和依赖必须固定指纹');
  check.pins = check.pins.map(pin => {
    const file = canonical(path.resolve(base, pin.path));
    if (!/^[a-f0-9]{64}$/.test(pin.sha256 ?? '') || hash(fs.readFileSync(file)) !== pin.sha256) throw Error('检查器指纹不符');
    return { path: file, sha256: pin.sha256 };
  });
  if (!check.pins.some(pin => samePath(pin.path, check.executable))) throw Error('检查器可执行程序未固定指纹');
  if (!check.pins.some(pin => samePath(pin.path, check.entry))) throw Error('检查器脚本入口未固定指纹');
  if (check.pins.some(pin => within(c.cwd, pin.path))) throw Error('检查器及固定依赖必须位于任务工作树之外');
  return c;
}
function check(contract, directory, remainingMs) {
  const checker = contract.checker;
  for (const pin of checker.pins) {
    if (hash(fs.readFileSync(pin.path)) !== pin.sha256) throw Error('检查器或已固定依赖被修改');
  }
  const result = spawnSync(checker.executable, checker.args, {
    cwd: contract.cwd, shell: false, windowsHide: true,
    timeout: Math.max(1, Math.min(checker.timeoutSeconds * 1000, remainingMs)),
    encoding: 'utf8', maxBuffer: 128 * 1024,
    env: { ...process.env, TASK_GUARD_RUN_DIR: directory },
  });
  if (result.error || result.signal || result.status === null) throw Error(`检查器执行失败：${result.error?.code ?? result.signal}`);
  const output = JSON.parse(result.stdout.replace(/^\uFEFF/, ''));
  const exits = { PASS: 0, ACTIONABLE_FAIL: 10, WAIT: 20, BLOCKED: 21 };
  if (!Object.hasOwn(exits, output.status) || result.status !== exits[output.status]) throw Error('检查器退出码与结构化状态不符');
  if (typeof output.reason !== 'string' || !output.reason.trim() || output.reason.length > 1500) throw Error('检查器原因缺失或过长');
  if (typeof output.progressKey !== 'string' || output.progressKey.length > 200) throw Error('检查器需要固定产物/失败集合的progressKey');
  if (!Array.isArray(output.pendingOperations) || output.pendingOperations.some(x => typeof x !== 'string' || x.length > 200)) throw Error('pendingOperations格式错误');
  if (output.status === 'PASS' && output.pendingOperations.length) throw Error('在途操作未结束不能通过验收');
  return output;
}

export function handleHook(directory, event) {
  return locked(directory, () => {
    const contractBytes = fs.readFileSync(path.join(directory, 'contract.json'));
    const stateFile = path.join(directory, 'state.json');
    const state = read(stateFile);
    const contract = JSON.parse(contractBytes);
    if (hash(contractBytes) !== state.contractHash) throw Error('固定契约被修改');
    if (hash(fs.readFileSync(self)) !== state.guardHash) throw Error('守卫程序在运行期间被修改');
    if (!event.session_id || !event.turn_id || !samePath(canonical(event.cwd), contract.cwd)) throw Error('钩子缺少身份或目录不符');
    if (state.sessionId && state.sessionId !== event.session_id) throw Error('钩子会话不符，禁止接管其他会话');
    state.sessionId ??= event.session_id;
    const kind = event.hook_event_name;
    const save = result => { atomic(stateFile, state); return result; };
    if (kind === 'Interrupt') {
      state.status = 'CANCELLED'; state.reason = '宿主中断';
      return save({ systemMessage: '任务守卫：已停止自动续作，任务未验收。' });
    }
    if (kind === 'PreToolUse' || kind === 'PostToolUse') {
      if (!event.tool_use_id) throw Error('缺少工具调用标识');
      if (state.status === 'VERIFIED') { state.status = 'RUNNING'; state.reason = '验收后发生了工具活动，须重新验收'; }
      if (kind === 'PreToolUse') state.activeTools[event.tool_use_id] = { tool: event.tool_name ?? 'unknown' };
      else {
        const response = event.tool_response;
        const text = typeof response === 'string' ? response : JSON.stringify(response ?? null);
        const running = /(?:Process running with session ID|Session ID:)\s*(\d+)/i.exec(text);
        const pollId = event.tool_input?.session_id;
        const commandTool = /^(Bash|exec_command|shell_command|shell|write_stdin)$/.test(event.tool_name ?? state.activeTools[event.tool_use_id]?.tool ?? '');
        const ended = /Process exited with code\s+-?\d+/i.test(text) || Number.isInteger(response?.exit_code) || ['completed', 'failed'].includes(response?.status);
        if (running || (commandTool && !ended)) {
          state.activeTools[event.tool_use_id] = { tool: event.tool_name ?? 'Bash', sessionId: running?.[1] ?? (pollId == null ? null : String(pollId)), unknown: !running };
        } else {
          delete state.activeTools[event.tool_use_id];
          if (ended && pollId != null) for (const [id, record] of Object.entries(state.activeTools)) if (record.sessionId === String(pollId)) delete state.activeTools[id];
        }
        if (/rejected[^\n]{0,200}blocked by policy|user denied|approval denied/i.test(text)) state.hostBlocked = true;
      }
      return save({});
    }
    if (kind !== 'Stop') return {};
    if (fs.existsSync(path.join(directory, 'cancel'))) {
      state.status = 'CANCELLED'; state.reason = '操作者停止了本次守卫';
      return save(stop(state.status, state.reason));
    }
    const eventHash = hash(JSON.stringify({ active: event.stop_hook_active, message: event.last_assistant_message }));
    const key = `${event.session_id}:${event.turn_id}:${eventHash}`;
    const prior = state.events[key];
    // Identical transport retries do not consume another continuation. An identical
    // second Stop after an actual continuation is conservatively stopped as stalled.
    // Another merged hook may have requested more work after our earlier PASS.
    // Recheck each new Stop; an old PASS must not certify later changes.
    if (terminal.has(state.status) && state.status !== 'VERIFIED') return save(stop(state.status, state.reason));
    if (prior?.eventHash === eventHash) {
      if (event.stop_hook_active === true && prior.result.decision === 'block') {
        state.status = 'STALLED'; state.reason = '重复的续作后结束事件无法区分重投与无进展，保守停止';
        return save(stop(state.status, state.reason));
      }
      if (state.status !== 'VERIFIED') return prior.result;
    }
    state.stopCount++;
    let output;
    const finish = (status, reason, result) => {
      state.status = status; state.reason = reason;
      state.events[key] = { eventHash, result };
      return save(result);
    };
    const halt = (status, reason) => finish(status, reason, stop(status, reason));
    if (fs.existsSync(path.join(directory, 'cancel'))) return halt('CANCELLED', '操作者停止了本次守卫');
    if (Date.now() >= state.deadline) return halt('LIMIT', '已达累计时限');
    if (state.hostBlocked) return halt('BLOCKED', '宿主明确拒绝了操作；不自动重试或绕过策略');
    if (Object.keys(state.activeTools).length) {
      output = { status: 'ACTIONABLE_FAIL', reason: '已有工具尚未取得最终结果，等待并回读原调用；不要重跑业务命令', progressKey: `tools:${Object.keys(state.activeTools).sort().join(',')}`, pendingOperations: Object.keys(state.activeTools) };
    } else {
      try { output = check(contract, directory, state.deadline - Date.now()); state.checkCount++; }
      catch (error) { return halt('CHECKER_ERROR', error.message); }
    }
    state.lastCheck = output;
    if (Date.now() >= state.deadline) return halt('LIMIT', '检查结束时已达累计时限');
    if (fs.existsSync(path.join(directory, 'cancel'))) return halt('CANCELLED', '检查期间收到停止信号');
    if (output.status === 'WAIT' || output.status === 'BLOCKED') return halt(output.status, output.reason);
    if (output.status === 'PASS') return finish('VERIFIED', output.reason, {});
    const fingerprint = hash(JSON.stringify([output.progressKey, output.pendingOperations]));
    state.noProgress = fingerprint === state.fingerprint ? state.noProgress + 1 : 0;
    state.fingerprint = fingerprint;
    if (state.noProgress >= contract.maxNoProgress) return halt('STALLED', '相同验收失败连续无进展，停止自动续作');
    if (state.continuations >= contract.maxContinuations) return halt('LIMIT', '已达自动续作次数上限');
    state.continuations++;
    const reason = `独立验收尚未通过：${output.reason}。继续原任务的已授权未完部分；先核对已有操作结果，不重放副作用，不绕过权限或人工门禁。已有在途操作：${output.pendingOperations.join(', ') || '无'}。本次为自动续作${state.continuations}/${contract.maxContinuations}，原时限与资源预算不重置；确有阻断请保留未验收状态。`;
    return finish('CONTINUING', output.reason, { decision: 'block', reason });
  });
}

export function prepare(contractFile, directory) {
  const contract = validateContract(read(contractFile), path.dirname(path.resolve(contractFile)));
  const parent = canonical(path.dirname(path.resolve(directory)));
  if (within(contract.cwd, parent) || within(contract.cwd, canonical(self)) || within(contract.cwd, registry)) throw Error('守卫程序、控制记录和唯一登记必须位于被守卫工作树之外');
  fs.mkdirSync(directory, { recursive: false }); // Refuse reuse and budget reset.
  const bytes = Buffer.from(`${JSON.stringify(contract, null, 2)}\n`);
  fs.writeFileSync(path.join(directory, 'contract.json'), bytes, { flag: 'wx' });
  atomic(path.join(directory, 'state.json'), {
    version: 1, status: 'ARMED', contractHash: hash(bytes), guardHash: hash(fs.readFileSync(self)), sessionId: null,
    deadline: Date.now() + contract.maxMinutes * 60000,
    continuations: 0, stopCount: 0, checkCount: 0, noProgress: 0, activeTools: {}, events: {},
  });
  return contract;
}
function commandQuote(value) {
  // The hook is a shell command. These characters are not valid installation paths
  // for this launcher; rejecting them avoids Windows and POSIX shell expansion.
  if (/[\r\n"%`$!&|<>^]/.test(value)) throw Error('守卫路径含不支持的shell字符');
  return `"${value}"`;
}
const toml = value => JSON.stringify(value);
export function hookOverrides(directory) {
  const nodeOnPath = spawnSync('node', ['-p', 'process.execPath'], { encoding: 'utf8', windowsHide: true });
  if (nodeOnPath.status !== 0 || !samePath(canonical(nodeOnPath.stdout.trim()), canonical(process.execPath))) throw Error('PATH上的Node与守卫运行时不一致');
  // A bare executable works in both PowerShell and cmd; a quoted executable
  // without PowerShell's call operator is only a string, not a command.
  const command = `node ${commandQuote(self)} hook ${commandQuote(path.resolve(directory))}`;
  return ['Stop', 'PreToolUse', 'PostToolUse', 'Interrupt'].map(event =>
    `hooks.${event} = [{ hooks = [{ type = "command", command = ${toml(command)}, timeout = ${event === 'Interrupt' ? 3 : 40} }] }]`);
}
export async function runTask({ contractFile, directory, prompt, codex, extraConfig = [], env = process.env }) {
  const source = read(contractFile);
  const cwd = canonical(path.resolve(path.dirname(path.resolve(contractFile)), source.cwd));
  fs.mkdirSync(registry, { recursive: true });
  const binding = hash(`${process.platform === 'win32' ? cwd.toLowerCase() : cwd}\n${source.workItem}`);
  const lockFile = path.join(registry, `${binding}.owner.lock`);
  const registration = path.join(registry, `${binding}.json`);
  let owner;
  try { owner = fs.openSync(lockFile, 'wx'); }
  catch { const old = read(lockFile); throw Error(`本工作项已有锁：${alive(old.pid) ? '实例仍存活' : '需核验旧状态后人工解除'}；不启动新业务`); }
  fs.writeFileSync(owner, JSON.stringify({ pid: process.pid, processStartedAt: new Date(Date.now() - process.uptime() * 1000).toISOString(), directory: path.resolve(directory) }));
  let child, timer, timedOut = false, cancelled = false;
  const terminate = () => {
    if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
    // Only the child created by this invocation, never an existing Codex process.
    if (process.platform === 'win32') spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    else { try { process.kill(-child.pid, 'SIGTERM'); } catch {} }
  };
  const cancel = () => { cancelled = true; if (fs.existsSync(directory)) fs.writeFileSync(path.join(directory, 'cancel'), ''); terminate(); };
  try {
    if (fs.existsSync(registration)) throw Error(`工作项已登记；请先回读原运行 ${read(registration).directory}，不可通过换目录清零预算`);
    const contract = prepare(contractFile, directory);
    fs.writeFileSync(registration, JSON.stringify({ directory: path.resolve(directory), workItem: source.workItem }), { flag: 'wx' });
    const overrides = ['features.hooks=true', ...hookOverrides(directory), ...extraConfig];
    const args = [...codex.prefix, '--no-daemon', '--dangerously-bypass-hook-trust', '-a', 'never', ...overrides.flatMap(c => ['-c', c]), 'exec', '--json', '--color', 'never', '-s', 'workspace-write', '-C', contract.cwd, '-'];
    const log = fs.openSync(path.join(directory, 'cli.jsonl'), 'wx');
    const errors = fs.openSync(path.join(directory, 'cli.stderr.log'), 'wx');
    try {
      child = spawn(codex.file, args, { shell: false, windowsHide: true, detached: process.platform !== 'win32', stdio: ['pipe', log, errors], env });
      child.stdin.on('error', () => {});
      child.stdin.end(`${prompt}\n\n本任务已启用独立验收守卫。不能用自报完成代替验收；自动续作不增加业务、资源、远端或其他权限。`);
      process.once('SIGINT', cancel); process.once('SIGTERM', cancel);
      const deadline = read(path.join(directory, 'state.json')).deadline;
      timer = setInterval(() => {
        if (fs.existsSync(path.join(directory, 'cancel'))) { cancelled = true; terminate(); }
        else if (Date.now() >= deadline) { timedOut = true; terminate(); }
      }, 250);
      const exit = await new Promise(resolve => {
        child.once('error', error => resolve({ code: null, error: error.message }));
        child.once('close', (code, signal) => resolve({ code, signal }));
      });
      clearInterval(timer);
      let state;
      try { state = read(path.join(directory, 'state.json')); }
      catch { state = { status: 'GUARD_ERROR', reason: '守卫状态不可读' }; }
      if (cancelled || fs.existsSync(path.join(directory, 'cancel'))) { state.status = 'CANCELLED'; state.reason = '本次运行已取消'; }
      else if (timedOut || Date.now() >= state.deadline) { state.status = 'LIMIT'; state.reason = '累计时限已到；仍在运行时仅终止本启动器拥有的CLI进程树'; }
      else if (fs.existsSync(path.join(directory, 'hook-error.json'))) {
        state.status = 'GUARD_ERROR';
        try { state.reason = read(path.join(directory, 'hook-error.json')).reason || '钩子异常'; }
        catch { state.reason = '钩子异常记录不可解析'; }
      }
      else if (exit.code !== 0) { state.status = 'CLI_ERROR'; state.reason = 'CLI异常退出；不自动重启或重放'; }
      else if (!terminal.has(state.status) || !state.stopCount) { state.status = 'UNVERIFIED'; state.reason = '缺少Stop终态验收，不能把CLI退出0当作完成'; }
      else if (state.status === 'VERIFIED' && (state.lastCheck?.status !== 'PASS' || !state.checkCount || Object.keys(state.activeTools ?? {}).length)) { state.status = 'UNVERIFIED'; state.reason = '有效验收记录或在途状态不一致'; }
      state.cliExit = exit;
      atomic(path.join(directory, 'state.json'), state);
      return { status: state.status, verified: state.status === 'VERIFIED', continuations: state.continuations, stopCount: state.stopCount, reason: state.reason, directory: path.resolve(directory) };
    } finally { fs.closeSync(log); fs.closeSync(errors); }
  } finally {
    clearInterval(timer); process.removeListener('SIGINT', cancel); process.removeListener('SIGTERM', cancel);
    fs.closeSync(owner); fs.unlinkSync(lockFile);
  }
}

async function main() {
  const [action, ...args] = process.argv.slice(2);
  if (action === 'hook') {
    try {
      let input = ''; for await (const chunk of process.stdin) { input += chunk; if (input.length > 1024 * 1024) throw Error('钩子输入过大'); }
      console.log(JSON.stringify(handleHook(path.resolve(args[0]), JSON.parse(input))));
    } catch (error) {
      try { atomic(path.join(args[0], 'hook-error.json'), { status: 'GUARD_ERROR', reason: error.message }); } catch {}
      console.log(JSON.stringify(stop('GUARD_ERROR', error.message)));
    }
  } else if (action === 'status') {
    const state = read(path.join(args[0], 'state.json'));
    console.log(JSON.stringify({ status: state.status, finalized: Boolean(state.cliExit), verified: state.status === 'VERIFIED' && state.cliExit?.code === 0, reason: state.reason, continuations: state.continuations, stopCount: state.stopCount, checkCount: state.checkCount }, null, 2));
  } else if (action === 'stop') {
    if (!fs.existsSync(path.join(args[0], 'state.json'))) throw Error('不是守卫运行目录');
    fs.writeFileSync(path.join(args[0], 'cancel'), ''); console.log('已请求停止本次守卫，不影响其他任务');
  } else if (action === 'run') {
    const options = Object.fromEntries(Array.from({ length: args.length / 2 }, (_, i) => [args[i * 2], args[i * 2 + 1]]));
    const result = await runTask({ contractFile: path.resolve(options['--contract']), directory: path.resolve(options['--run-dir']), prompt: fs.readFileSync(options['--prompt'], 'utf8'), codex: { file: process.execPath, prefix: [canonical(options['--codex-js'])] } });
    console.log(JSON.stringify(result, null, 2)); process.exitCode = result.verified ? 0 : 2;
  } else throw Error('用法：guard.mjs run --contract 文件 --prompt 文件 --run-dir 新目录 --codex-js 已安装CLI脚本；status/stop 运行目录');
}
if (process.argv[1] && samePath(path.resolve(process.argv[1]), self)) main().catch(error => { console.error(error.message); process.exitCode = 2; });
