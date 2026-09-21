[CmdletBinding()]
param(
    [string]$TaskQuery,
    [switch]$AllAffected,
    [string]$CodexHome = (Join-Path $env:USERPROFILE '.codex'),
    [string]$CodexExe,
    [string]$NodeExe = 'node',
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

$hasTaskQuery = -not [string]::IsNullOrWhiteSpace($TaskQuery)
if (($AllAffected -and $hasTaskQuery) -or ((-not $AllAffected) -and (-not $hasTaskQuery))) {
    throw '必须且只能选择一种模式：AllAffected，或 TaskQuery。'
}
if (-not [string]::IsNullOrWhiteSpace($TaskQuery)) {
    $TaskQuery = $TaskQuery.Trim()
}

function Resolve-ExecutablePath {
    param([Parameter(Mandatory)][string]$Command)
    $resolved = Get-Command $Command -ErrorAction Stop
    return $resolved.Source
}

function Resolve-CodexExecutable {
    param([string]$RequestedPath)
    if (-not [string]::IsNullOrWhiteSpace($RequestedPath)) {
        if (-not (Test-Path -LiteralPath $RequestedPath -PathType Leaf)) {
            throw "指定的 Codex 可执行文件不存在：$RequestedPath"
        }
        return (Resolve-Path -LiteralPath $RequestedPath).Path
    }
    return Resolve-ExecutablePath 'codex.exe'
}

function Assert-CodexStopped {
    $runningCodex = @(Get-Process -Name 'Codex', 'codex' -ErrorAction SilentlyContinue)
    if ($runningCodex.Count -gt 0) {
        throw '修复前必须完全退出 Codex，包括系统托盘中的常驻进程。活动任务可能把异常路径再次写回。'
    }
}

function Invoke-SqliteHelper {
    param(
        [Parameter(Mandatory)][string]$Action,
        [Parameter(Mandatory)][string]$DatabasePath,
        [string]$Id = '-',
        [string]$Argument1,
        [string]$Argument2
    )
    $arguments = @($script:SqliteHelperPath, $Action, $DatabasePath, $Id)
    if ($PSBoundParameters.ContainsKey('Argument1')) { $arguments += $Argument1 }
    if ($PSBoundParameters.ContainsKey('Argument2')) { $arguments += $Argument2 }
    $json = & $script:ResolvedNodeExe @arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "SQLite 辅助程序失败：$json"
    }
    return ($json | Out-String | ConvertFrom-Json)
}

$resolvedCodexHome = (Resolve-Path -LiteralPath $CodexHome).Path
$stateDatabase = Join-Path $resolvedCodexHome 'state_5.sqlite'
if (-not (Test-Path -LiteralPath $stateDatabase -PathType Leaf)) {
    throw "找不到 Codex 状态数据库：$stateDatabase"
}

$script:ResolvedNodeExe = Resolve-ExecutablePath $NodeExe
$nodeVersion = & $script:ResolvedNodeExe --version
if ($LASTEXITCODE -ne 0) { throw 'Node.js 无法运行。' }
$nodeMajor = [int](($nodeVersion -replace '^v', '').Split('.')[0])
if ($nodeMajor -lt 22) {
    throw "需要 Node.js 22 或更高版本，当前为 $nodeVersion。"
}

$timestamp = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')
$backupDirectory = Join-Path (Join-Path $resolvedCodexHome 'backups') "thread-path-repair-$timestamp"
$script:SqliteHelperPath = Join-Path ([IO.Path]::GetTempPath()) "codex-path-repair-$PID-$timestamp.cjs"
$script:TitleResolverPath = Join-Path ([IO.Path]::GetTempPath()) "codex-title-resolver-$PID-$timestamp.cjs"

$sqliteHelper = @'
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');

const [action, databasePath, taskId, argument1, argument2] = process.argv.slice(2);
const db = new DatabaseSync(databasePath);
db.exec('PRAGMA busy_timeout=10000');

function emit(value) { process.stdout.write(JSON.stringify(value)); }
function normalizeExtendedPath(value) {
  if (typeof value === 'string' && /^\\\\\?\\[A-Za-z]:\\/.test(value)) return value.slice(4);
  return null;
}
function getRow(id = taskId) {
  return db.prepare(`
    SELECT id, rollout_path, archived, archived_at, cli_version
    FROM threads WHERE id = ?
  `).get(id);
}
function allRows() {
  return db.prepare('SELECT id, rollout_path, archived FROM threads').all();
}
function collectAffectedRows(rows = allRows()) {
  const owners = new Map();
  for (const row of rows) {
    if (typeof row.rollout_path !== 'string') continue;
    const key = row.rollout_path.toLowerCase();
    if (!owners.has(key)) owners.set(key, []);
    owners.get(key).push(row.id);
  }
  const normalizedKeys = new Set();
  return rows
    .filter((row) => Number(row.archived) === 0)
    .map((row) => ({ ...row, normalized: normalizeExtendedPath(row.rollout_path) }))
    .filter((row) => row.normalized !== null)
    .map((row) => {
      if (!/^[A-Za-z]:\\/.test(row.normalized)) throw new Error(`unsupported-extended-path:${row.id}`);
      if (!fs.existsSync(row.rollout_path) || !fs.existsSync(row.normalized)) {
        throw new Error(`rollout-file-missing:${row.id}`);
      }
      const normalizedKey = row.normalized.toLowerCase();
      if (normalizedKeys.has(normalizedKey)) throw new Error(`duplicate-normalized-path:${row.id}`);
      normalizedKeys.add(normalizedKey);
      const collisions = (owners.get(normalizedKey) || []).filter((id) => id !== row.id);
      if (collisions.length > 0) throw new Error(`normalized-path-collision:${row.id}`);
      return {
        id: row.id,
        sourcePath: row.rollout_path,
        normalizedPath: row.normalized,
        size: fs.statSync(row.normalized).size
      };
    });
}
function readPlan(planPath) {
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  if (!Array.isArray(plan.affected)) throw new Error('invalid-plan');
  return plan;
}

if (action === 'inspect-all') {
  db.exec('BEGIN');
  try {
    const integrity = db.prepare('PRAGMA integrity_check').get().integrity_check;
    if (integrity !== 'ok') throw new Error(`integrity-check-failed:${integrity}`);
    const rows = allRows();
    const affected = collectAffectedRows(rows);
    const unarchivedCount = rows.filter((row) => Number(row.archived) === 0).length;
    db.exec('COMMIT');
    emit({ ok: true, integrity, unarchivedCount, count: affected.length, rows: affected });
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
} else if (action === 'inspect') {
  const integrity = db.prepare('PRAGMA integrity_check').get().integrity_check;
  if (integrity !== 'ok') throw new Error(`integrity-check-failed:${integrity}`);
  const row = getRow();
  if (!row) {
    emit({ ok: false, reason: 'thread-not-found', integrity });
  } else {
    const normalized = normalizeExtendedPath(row.rollout_path);
    emit({
      ok: true,
      integrity,
      id: row.id,
      archived: Number(row.archived),
      archivedAt: row.archived_at,
      cliVersion: row.cli_version,
      hasExtendedPrefix: normalized !== null,
      sourceExists: fs.existsSync(row.rollout_path),
      normalizedExists: normalized ? fs.existsSync(normalized) : false,
      sourcePath: row.rollout_path,
      normalizedPath: normalized
    });
  }
} else if (action === 'backup') {
  if (fs.existsSync(argument1)) throw new Error('backup-already-exists');
  const quoted = argument1.replaceAll("'", "''");
  db.exec(`VACUUM INTO '${quoted}'`);
  emit({ ok: fs.existsSync(argument1) });
} else if (action === 'normalize-all') {
  const plan = readPlan(argument1);
  db.exec('BEGIN IMMEDIATE');
  try {
    const current = db.prepare('SELECT rollout_path, archived FROM threads WHERE id = ?');
    const update = db.prepare('UPDATE threads SET rollout_path = ? WHERE id = ? AND rollout_path = ? AND archived = 0');
    let changes = 0;
    for (const row of plan.affected) {
      const value = current.get(row.id);
      if (!value || Number(value.archived) !== 0 || value.rollout_path !== row.sourcePath) {
        throw new Error(`rollout-path-changed:${row.id}`);
      }
      const result = update.run(row.normalizedPath, row.id, row.sourcePath);
      if (Number(result.changes) !== 1) throw new Error(`conditional-update-failed:${row.id}`);
      changes += Number(result.changes);
    }
    db.exec('COMMIT');
    emit({ ok: true, changes });
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
} else if (action === 'verify-all') {
  const plan = readPlan(argument1);
  const current = db.prepare('SELECT rollout_path, archived FROM threads WHERE id = ?');
  const failed = [];
  for (const row of plan.affected) {
    const value = current.get(row.id);
    if (!value || Number(value.archived) !== 0 || value.rollout_path !== row.normalizedPath || !fs.existsSync(value.rollout_path)) {
      failed.push(row.id);
    }
  }
  const remainingExtended = collectAffectedRows().length;
  const integrity = db.prepare('PRAGMA integrity_check').get().integrity_check;
  emit({ ok: failed.length === 0 && remainingExtended === 0 && integrity === 'ok', failed, remainingExtended, integrity });
} else if (action === 'rollback-all') {
  const plan = readPlan(argument1);
  db.exec('BEGIN IMMEDIATE');
  try {
    const current = db.prepare('SELECT rollout_path, archived FROM threads WHERE id = ?');
    const update = db.prepare('UPDATE threads SET rollout_path = ? WHERE id = ? AND rollout_path = ? AND archived = 0');
    let restored = 0;
    let skipped = 0;
    for (const row of plan.affected) {
      const value = current.get(row.id);
      if (value && Number(value.archived) === 0 && value.rollout_path === row.normalizedPath) {
        restored += Number(update.run(row.sourcePath, row.id, row.normalizedPath).changes);
      } else {
        skipped += 1;
      }
    }
    db.exec('COMMIT');
    emit({ ok: skipped === 0, restored, skipped });
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
} else if (action === 'normalize') {
  db.exec('BEGIN IMMEDIATE');
  try {
    const row = getRow();
    if (!row) throw new Error('thread-not-found');
    if (Number(row.archived) !== 0) throw new Error('thread-already-archived');
    if (row.rollout_path !== argument1) throw new Error('rollout-path-changed');
    const result = db.prepare('UPDATE threads SET rollout_path = ? WHERE id = ? AND rollout_path = ? AND archived = 0')
      .run(argument2, taskId, argument1);
    if (Number(result.changes) !== 1) throw new Error('conditional-update-failed');
    db.exec('COMMIT');
    emit({ ok: true, changes: Number(result.changes) });
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
} else if (action === 'verify') {
  const row = getRow();
  const integrity = db.prepare('PRAGMA integrity_check').get().integrity_check;
  emit({
    ok: Boolean(row) && Number(row.archived) === 0 && row.rollout_path === argument1 && fs.existsSync(argument1) && integrity === 'ok',
    archived: row ? Number(row.archived) : null,
    rolloutPath: row ? row.rollout_path : null,
    integrity
  });
} else if (action === 'rollback') {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = db.prepare('UPDATE threads SET rollout_path = ? WHERE id = ? AND rollout_path = ? AND archived = 0')
      .run(argument1, taskId, argument2);
    db.exec('COMMIT');
    emit({ ok: Number(result.changes) === 1, changes: Number(result.changes) });
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
} else {
  throw new Error(`unknown-action:${action}`);
}
'@
Set-Content -LiteralPath $script:SqliteHelperPath -Value $sqliteHelper -Encoding utf8NoBOM

$titleResolver = @'
const { spawn } = require('node:child_process');
const readline = require('node:readline');

const [codexExe, query] = process.argv.slice(2);
if (!codexExe || !query) throw new Error('invalid-arguments');
const child = spawn(codexExe, ['app-server'], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
const lines = readline.createInterface({ input: child.stdout });
const pending = new Map();
let nextId = 1;
let exited = false;
let stderr = '';

child.stderr.on('data', (chunk) => { if (stderr.length < 16000) stderr += chunk.toString('utf8'); });
function rejectPending(error) {
  for (const entry of pending.values()) {
    clearTimeout(entry.timer);
    entry.reject(error);
  }
  pending.clear();
}
child.on('error', rejectPending);
child.on('exit', (code) => {
  exited = true;
  if (pending.size > 0) rejectPending(new Error(`app-server-exited:${code}:${stderr.trim()}`));
});
lines.on('line', (line) => {
  let message;
  try { message = JSON.parse(line); } catch { return; }
  if (message.id === undefined || !pending.has(message.id)) return;
  const entry = pending.get(message.id);
  pending.delete(message.id);
  clearTimeout(entry.timer);
  if (message.error) entry.reject(new Error(`${entry.method}:${message.error.message || JSON.stringify(message.error)}`));
  else entry.resolve(message.result || {});
});
function request(method, params, timeoutMs = 60000) {
  if (exited) return Promise.reject(new Error('app-server-not-running'));
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`${method}:timeout`));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer, method });
    child.stdin.write(`${JSON.stringify({ method, id, params })}\n`);
  });
}
async function listMatches() {
  const rows = [];
  let cursor = null;
  for (let page = 0; page < 10000; page += 1) {
    const result = await request('thread/list', {
      archived: false,
      sourceKinds: ['cli', 'vscode', 'appServer', 'unknown'],
      searchTerm: query,
      cursor,
      limit: 100,
      sortKey: 'created_at',
      sortDirection: 'desc'
    });
    if (!Array.isArray(result.data)) throw new Error('thread-list-invalid-response');
    for (const thread of result.data) {
      if (thread && typeof thread.id === 'string') rows.push({ id: thread.id, name: thread.name || '' });
    }
    cursor = result.nextCursor || null;
    if (!cursor) return rows;
  }
  throw new Error('thread-list-pagination-limit');
}
async function main() {
  await request('initialize', {
    clientInfo: { name: 'local_path_repair', title: 'Local Codex Path Repair', version: '1.0.0' }
  });
  child.stdin.write(`${JSON.stringify({ method: 'initialized', params: {} })}\n`);
  const candidates = await listMatches();
  const matches = candidates.filter((thread) => thread.name === query);
  return { ok: true, matches, candidates: candidates.slice(0, 10) };
}
main().then((result) => {
  process.stdout.write(JSON.stringify(result));
  try { child.stdin.end(); } catch {}
  setTimeout(() => { if (!exited) child.kill(); }, 100);
}).catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n${stderr}`);
  try { child.kill(); } catch {}
  process.exitCode = 1;
});
'@

function Resolve-TaskIdFromQuery {
    param([Parameter(Mandatory)][string]$Query)
    if ($Query -match '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$') {
        return $Query.ToLowerInvariant()
    }
    Set-Content -LiteralPath $script:TitleResolverPath -Value $titleResolver -Encoding utf8NoBOM
    $resolvedCodexExe = Resolve-CodexExecutable $CodexExe
    $json = & $script:ResolvedNodeExe $script:TitleResolverPath $resolvedCodexExe $Query 2>&1
    if ($LASTEXITCODE -ne 0) { throw "标题查询失败：$json" }
    $result = $json | Out-String | ConvertFrom-Json
    $matches = @($result.matches)
    if ($matches.Count -eq 1) {
        Write-Host "标题唯一匹配：$($matches[0].name) [$($matches[0].id)]"
        return $matches[0].id
    }
    if ($matches.Count -gt 1) {
        Write-Host '存在多个完全同名任务，请改用任务 ID：'
        $matches | ForEach-Object { Write-Host "- $($_.name) [$($_.id)]" }
        throw '标题不唯一，未修改任何数据。'
    }
    $candidates = @($result.candidates)
    if ($candidates.Count -gt 0) {
        Write-Host '没有完整标题匹配。以下是片段候选，请复制完整标题或改用任务 ID：'
        $candidates | ForEach-Object { Write-Host "- $($_.name) [$($_.id)]" }
    }
    throw '找不到完整标题匹配的未归档任务，未修改任何数据。'
}

$bulkNormalized = $false
$bulkManifestPath = $null
$targetNormalized = $false
$targetInspection = $null
$resolvedTaskId = $null

try {
    if ($AllAffected) {
        $inspection = Invoke-SqliteHelper -Action inspect-all -DatabasePath $stateDatabase
        Write-Host "扫描完成：未归档任务 $($inspection.unarchivedCount) 个；已知扩展路径异常 $($inspection.count) 个；数据库完整性：$($inspection.integrity)。"
        if ($DryRun) {
            if ($inspection.count -eq 0) {
                Write-Host 'RESULT_CODE=BULK_NO_CHANGES'
                Write-Host '只读扫描完成：没有需要修复的已知路径异常，未修改数据库。'
            }
            else {
                Write-Host 'RESULT_CODE=BULK_FAULTS_FOUND'
                Write-Host '只读扫描发现已知路径异常：正式修复前请完全退出 Codex。当前未修改数据库。'
            }
            return
        }
        if ($inspection.count -eq 0) {
            Write-Host 'RESULT_CODE=BULK_NO_CHANGES'
            Write-Host '没有需要修复的已知路径异常。'
            return
        }

        Assert-CodexStopped
        New-Item -ItemType Directory -Path $backupDirectory -Force | Out-Null
        $databaseBackup = Join-Path $backupDirectory 'state_5.sqlite'
        $backup = Invoke-SqliteHelper -Action backup -DatabasePath $stateDatabase -Argument1 $databaseBackup
        if (-not $backup.ok) { throw 'SQLite 一致性备份失败。' }

        $affected = @($inspection.rows)
        foreach ($row in $affected) {
            $hash = (Get-FileHash -LiteralPath $row.normalizedPath -Algorithm SHA256).Hash
            $row | Add-Member -NotePropertyName sessionSha256 -NotePropertyValue $hash
        }
        $bulkManifestPath = Join-Path $backupDirectory 'manifest.json'
        $manifest = [ordered]@{
            createdAtUtc = [DateTime]::UtcNow.ToString('o')
            status = 'prepared'
            mode = 'repair-all-affected'
            stateDatabaseSha256 = (Get-FileHash -LiteralPath $databaseBackup -Algorithm SHA256).Hash
            affected = $affected
        }
        $manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $bulkManifestPath -Encoding utf8NoBOM

        Assert-CodexStopped
        $normalized = Invoke-SqliteHelper -Action normalize-all -DatabasePath $stateDatabase -Argument1 $bulkManifestPath
        if (-not $normalized.ok -or $normalized.changes -ne $inspection.count) {
            throw '批量条件更新数量与扫描结果不一致。'
        }
        $bulkNormalized = $true
        $verification = Invoke-SqliteHelper -Action verify-all -DatabasePath $stateDatabase -Argument1 $bulkManifestPath
        if (-not $verification.ok) {
            throw "批量修复回读失败：remaining=$($verification.remainingExtended), integrity=$($verification.integrity)"
        }
        $manifest.status = 'success'
        $manifest.completedAtUtc = [DateTime]::UtcNow.ToString('o')
        $manifest.changedRows = $normalized.changes
        $manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $bulkManifestPath -Encoding utf8NoBOM
        $bulkNormalized = $false
        Write-Host 'RESULT_CODE=BULK_REPAIRED'
        Write-Host "修复成功：已规范化 $($normalized.changes) 个异常任务；没有归档任何任务。"
        Write-Host "备份目录：$backupDirectory"
        return
    }

    $resolvedTaskId = Resolve-TaskIdFromQuery -Query $TaskQuery
    $targetInspection = Invoke-SqliteHelper -Action inspect -DatabasePath $stateDatabase -Id $resolvedTaskId
    if (-not $targetInspection.ok) { throw '状态数据库中找不到该任务。' }
    if ($targetInspection.archived -eq 1) {
        Write-Host 'RESULT_CODE=TASK_ALREADY_ARCHIVED'
        Write-Host '该任务已经归档，本工具不会修改已归档任务。'
        return
    }
    if (-not $targetInspection.hasExtendedPrefix) {
        Write-Host 'RESULT_CODE=NO_KNOWN_FAULT'
        Write-Host '分析完成：该任务不存在已知的 Windows 扩展路径异常，未修改任何数据。'
        return
    }
    if (-not $targetInspection.sourceExists -or -not $targetInspection.normalizedExists) {
        throw '任务带有扩展路径，但扩展路径和普通路径没有同时指向现存文件；本工具拒绝修改。'
    }

    Write-Host 'RESULT_CODE=KNOWN_PATH_FAULT'
    Write-Host '分析命中：该任务的 rollout_path 带有 Windows 扩展路径前缀，且源文件实际存在。'
    Write-Host "任务创建时的 Codex 内核版本：$($targetInspection.cliVersion)"
    if ($DryRun) {
        Write-Host '只读分析完成：未修改数据库。'
        return
    }

    Assert-CodexStopped
    New-Item -ItemType Directory -Path $backupDirectory -Force | Out-Null
    $databaseBackup = Join-Path $backupDirectory 'state_5.sqlite'
    $sessionBackup = Join-Path $backupDirectory 'session.jsonl'
    $backup = Invoke-SqliteHelper -Action backup -DatabasePath $stateDatabase -Id $resolvedTaskId -Argument1 $databaseBackup
    if (-not $backup.ok) { throw 'SQLite 一致性备份失败。' }
    Copy-Item -LiteralPath $targetInspection.normalizedPath -Destination $sessionBackup

    $manifestPath = Join-Path $backupDirectory 'manifest.json'
    $manifest = [ordered]@{
        createdAtUtc = [DateTime]::UtcNow.ToString('o')
        status = 'prepared'
        mode = 'repair-one'
        taskId = $resolvedTaskId
        stateDatabaseSha256 = (Get-FileHash -LiteralPath $databaseBackup -Algorithm SHA256).Hash
        sessionSha256 = (Get-FileHash -LiteralPath $sessionBackup -Algorithm SHA256).Hash
        originalRolloutPath = $targetInspection.sourcePath
        repairedRolloutPath = $targetInspection.normalizedPath
    }
    $manifest | ConvertTo-Json | Set-Content -LiteralPath $manifestPath -Encoding utf8NoBOM

    Assert-CodexStopped
    $normalized = Invoke-SqliteHelper -Action normalize -DatabasePath $stateDatabase -Id $resolvedTaskId -Argument1 $targetInspection.sourcePath -Argument2 $targetInspection.normalizedPath
    if (-not $normalized.ok -or $normalized.changes -ne 1) { throw '目标任务条件更新失败。' }
    $targetNormalized = $true
    $verification = Invoke-SqliteHelper -Action verify -DatabasePath $stateDatabase -Id $resolvedTaskId -Argument1 $targetInspection.normalizedPath
    if (-not $verification.ok) { throw "目标任务修复回读失败：integrity=$($verification.integrity)" }
    $manifest.status = 'success'
    $manifest.completedAtUtc = [DateTime]::UtcNow.ToString('o')
    $manifest | ConvertTo-Json | Set-Content -LiteralPath $manifestPath -Encoding utf8NoBOM
    $targetNormalized = $false
    Write-Host 'RESULT_CODE=TASK_REPAIRED'
    Write-Host '修复成功：只规范化了目标任务的路径；没有归档任何任务。'
    Write-Host "备份目录：$backupDirectory"
}
catch {
    $originalError = $_
    if ($bulkNormalized -and -not [string]::IsNullOrWhiteSpace($bulkManifestPath)) {
        try {
            $rollback = Invoke-SqliteHelper -Action rollback-all -DatabasePath $stateDatabase -Argument1 $bulkManifestPath
            throw "$($originalError.Exception.Message)`n批量路径修改回滚结果：restored=$($rollback.restored), skipped=$($rollback.skipped)。备份位于：$backupDirectory"
        }
        catch {
            if ($_.Exception.Message -like '*批量路径修改回滚结果*') { throw }
            throw "$($originalError.Exception.Message)`n批量回滚失败。备份位于：$backupDirectory`n回滚错误：$($_.Exception.Message)"
        }
    }
    if ($targetNormalized -and $null -ne $targetInspection) {
        try {
            $rollback = Invoke-SqliteHelper -Action rollback -DatabasePath $stateDatabase -Id $resolvedTaskId -Argument1 $targetInspection.sourcePath -Argument2 $targetInspection.normalizedPath
            throw "$($originalError.Exception.Message)`n目标路径修改回滚结果：changes=$($rollback.changes)。备份位于：$backupDirectory"
        }
        catch {
            if ($_.Exception.Message -like '*目标路径修改回滚结果*') { throw }
            throw "$($originalError.Exception.Message)`n目标回滚失败。备份位于：$backupDirectory`n回滚错误：$($_.Exception.Message)"
        }
    }
    throw
}
finally {
    if (Test-Path -LiteralPath $script:SqliteHelperPath) {
        Remove-Item -LiteralPath $script:SqliteHelperPath -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path -LiteralPath $script:TitleResolverPath) {
        Remove-Item -LiteralPath $script:TitleResolverPath -Force -ErrorAction SilentlyContinue
    }
}
