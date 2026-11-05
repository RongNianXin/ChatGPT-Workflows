// Credentials stay inside the query program and its dedicated subprocess pipes.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function resolveNativeCommand(name, environment) {
  const filename = process.platform === 'win32' ? `${name}.exe` : name;
  for (const directory of (environment.PATH ?? environment.Path ?? '').split(path.delimiter).filter(Boolean)) {
    const candidate = path.resolve(directory, filename);
    try {
      const actual = fs.realpathSync(candidate);
      if (fs.statSync(actual).isFile()) return actual;
    } catch (error) {
      if (!['ENOENT', 'ENOTDIR', 'EACCES'].includes(error.code)) throw error;
    }
  }
  return null;
}

export function verifiedGitHubHead(response, repository, ref) {
  if (response.status !== 0) return '';
  try {
    const body = JSON.parse(response.stdout), url = new URL(body.url);
    if (body.ref !== ref || body.object?.type !== 'commit' || typeof body.object.sha !== 'string' ||
        !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(body.object.sha) ||
        url.protocol !== 'https:' || url.host !== 'api.github.com' || url.username || url.password || url.search || url.hash ||
        decodeURIComponent(url.pathname).toLowerCase() !== `/repos/${repository}/git/${ref}`.toLowerCase() ||
        decodeURIComponent(url.pathname).slice(-ref.length) !== ref) return '';
    return body.object.sha;
  } catch { return ''; }
}

export function readAuthenticatedGitHubRef(apiUrl, {
  run = spawnSync, now = () => performance.now(), timeoutMs = 10000,
  resolveCommand = resolveNativeCommand, environment = process.env
} = {}) {
  const invalid = () => { throw new Error('invalid authenticated ref target'); };
  let url;
  try { url = new URL(apiUrl); } catch { invalid(); }
  if (url.href !== apiUrl || url.origin !== 'https://api.github.com' || url.username || url.password || url.search || url.hash) invalid();
  const target = url.pathname.match(/^\/repos\/([A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)\/([A-Za-z0-9_.-]+)\/git\/ref\/heads\/(.+)$/);
  if (!target || ['.', '..'].includes(target[2])) invalid();
  let branch;
  try { branch = decodeURIComponent(target[3]); } catch { invalid(); }
  if (/[\x00-\x20\x7f~^:?*\[\\]/.test(branch) || branch.includes('..') || branch.includes('@{') ||
      branch.split('/').some(part => !part || part.startsWith('.') || part.endsWith('.') || part.endsWith('.lock'))) invalid();
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) throw new Error('invalid authenticated observation time limit');
  const deadline = now() + timeoutMs;
  const failure = code => Object.assign(new Error('authenticated remote observation failed; credential details suppressed'), { code });
  const remaining = () => {
    const value = Math.floor(deadline - now());
    if (value <= 0) throw failure('REMOTE_PROBE_TIMEOUT');
    return value;
  };
  const env = { ...environment, GH_PROMPT_DISABLED: '1', GH_NO_UPDATE_NOTIFIER: '1', GH_NO_EXTENSION_UPDATE_NOTIFIER: '1' };
  for (const key of Object.keys(env)) {
    if (/^(?:GH_HOST|GH_REPO|GH_DEBUG|DEBUG|GH_HTTP_UNIX_SOCKET|SSLKEYLOGFILE)$/i.test(key)) delete env[key];
  }
  let gh, curl;
  try { gh = resolveCommand('gh', env); curl = resolveCommand('curl', env); }
  catch { throw failure('REMOTE_PROBE_ABORTED'); }
  remaining();
  if (!gh || !curl) return '';
  const invoke = (exe, args, { input, maxBuffer = 1024 * 1024 } = {}) => {
    let result;
    try {
      result = run(exe, args, { encoding: 'utf8', env, shell: false, windowsHide: true,
        stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'], timeout: remaining(),
        killSignal: 'SIGKILL', maxBuffer, ...(input === undefined ? {} : { input }) });
    } catch (error) {
      throw failure(error.code === 'REMOTE_PROBE_TIMEOUT' ? error.code : 'REMOTE_PROBE_ABORTED');
    }
    if (now() > deadline) throw failure('REMOTE_PROBE_TIMEOUT');
    if (result.error?.code === 'ENOENT' && !result.signal) return { status: 1, stdout: '' };
    if (result.error || result.signal || result.status === null) {
      throw failure(result.error?.code === 'ETIMEDOUT' ? 'REMOTE_PROBE_TIMEOUT' : 'REMOTE_PROBE_ABORTED');
    }
    return result;
  };
  // Use the existing selected GitHub credential source; never log its output.
  const credential = invoke(gh, ['auth', 'token', '--hostname', 'github.com'], { maxBuffer: 8192 });
  if (credential.status !== 0 || typeof credential.stdout !== 'string') return '';
  const token = credential.stdout.replace(/\r?\n$/, '');
  if (!/^[A-Za-z0-9_]{1,4096}$/.test(token)) return '';
  const response = invoke(curl, ['--disable', '-fsS', '--globoff', '--proto', '=https',
    '--max-redirs', '0', '--max-time', String(remaining() / 1000), '--request', 'GET',
    '--config', '-', '--url', apiUrl, '--write-out', '\n%{http_code}'],
  { input: `header = "Authorization: Bearer ${token}"\n` });
  if (response.status === 28) throw failure('REMOTE_PROBE_TIMEOUT');
  if (response.status !== 0 || typeof response.stdout !== 'string' || !response.stdout.endsWith('\n200')) return '';
  const head = verifiedGitHubHead({ status: 0, stdout: response.stdout.slice(0, -4) },
    `${target[1]}/${target[2]}`, `refs/heads/${branch}`);
  // A legacy credential may itself look like an object ID. Do not echo it,
  // including the lowercase normalization performed by the outer query.
  return head && !head.toLowerCase().includes(token.toLowerCase()) ? head : '';
}
