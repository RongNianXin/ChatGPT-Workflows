[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$analyzer = Join-Path $root '实用小工具/Codex会话交接评估/check-codex-session.ps1'
$tokens = $null; $errors = $null
$ast = [Management.Automation.Language.Parser]::ParseFile($analyzer, [ref]$tokens, [ref]$errors)
if ($errors.Count) { throw ($errors | Out-String) }
# Extract pure functions only: never discover or open real user sessions.
foreach ($name in @('New-ContextObservationState','Reset-ContextObservations','Get-NullableTokenNumber',
    'Set-ContextObservationIdentity','Add-ContextObservation','Get-ContextTrend','Get-HandoffAssessmentScore')) {
    $definition = $ast.Find({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $name}, $true)
    if ($null -eq $definition) { throw "Missing function: $name" }
    . ([scriptblock]::Create($definition.Extent.Text))
}
$script:checks = 0
function Check($Condition, [string]$Label) {
    if (-not $Condition) { throw "Regression: $Label" }
    $script:checks++
}
function Info($InputValue, $WindowValue = 1000, $Total = 100, $Cache = 0) {
    return [pscustomobject]@{last_token_usage=[pscustomobject]@{input_tokens=$InputValue;cached_input_tokens=$Cache};
        model_context_window=$WindowValue;total_token_usage=[pscustomobject]@{total_tokens=$Total}}
}
$s = New-ContextObservationState; $turns = @{}
Set-ContextObservationIdentity $s 'fixture-model' 'fixture-provider'
Check ($null -eq (Get-ContextTrend $s $turns).Percent) 'empty is unknown'
foreach ($v in @($null, -1, 'invalid', [double]::NaN, [double]::PositiveInfinity, $true)) {
    Add-ContextObservation $s (Info $v) 1 'fixture'
    Check ($null -eq $s.Current) 'invalid or missing input is unknown'
}
Add-ContextObservation $s (Info 0) 1 'fixture'
Check ((Get-ContextTrend $s $turns).Percent -eq 0) 'valid zero remains zero'
Add-ContextObservation $s (Info 100 1000 200 90) 1 'fixture'
Check ((Get-ContextTrend $s $turns).Percent -eq 10) 'cached input is not added twice'
Add-ContextObservation $s (Info 100 0 300) 1 'fixture'
Check ($null -eq $s.Current) 'zero window is unknown'
for ($i=1; $i -le 6; $i++) {
    $turns[$i]=@{Status='completed'}
    Add-ContextObservation $s (Info (100+10*$i) 1000 (1000*$i) 50) $i 'fixture'
    Add-ContextObservation $s (Info (100+10*$i) 1000 (1000*$i) 50) $i 'duplicate'
    if ($i -lt 6) { Check ($null -eq (Get-ContextTrend $s $turns).Growth) 'fewer than six turns has no growth' }
}
$trend = Get-ContextTrend $s $turns
Check ($trend.Samples -eq 6 -and $trend.Growth -eq 10 -and $null -eq $trend.Rounds -and $null -eq $trend.ForecastPercent) 'six turns measure growth without arbitrary observation targets'
Add-ContextObservation $s (Info 160 1000 6000 50) 7 'duplicate-new-turn'
Check ($s.Points.Count -eq 6) 'duplicate usage cannot create a new turn sample'
$turns[6].Status='unfinished'
Check ($null -eq (Get-ContextTrend $s $turns).Growth) 'unfinished turn excluded'
$turns[6].Status='completed'
Set-ContextObservationIdentity $s 'different-model' 'fixture-provider'
Check ($s.Points.Count -eq 0 -and $null -eq $s.Current) 'model switch clears old observation'
Add-ContextObservation $s (Info 900) 1 'fixture'
Add-ContextObservation $s (Info 100 2000 200) 2 'fixture'
Check ($s.Points.Count -eq 1 -and (Get-ContextTrend $s $turns).Percent -eq 5) 'window switch isolates trend'
Add-ContextObservation $s (Info 80 2000 1) 3 'fixture'
Check ($s.Points.Count -eq 1) 'counter reset isolates trend'
Set-ContextObservationIdentity $s 'different-model' 'other-provider'
Check ($null -eq $s.Current) 'provider switch clears observation'
Add-ContextObservation $s (Info 900) 1 'fixture'
Reset-ContextObservations $s
Check ($null -eq (Get-ContextTrend $s $turns).Percent -and $s.Points.Count -eq 0) 'compaction without new usage is unknown'
Add-ContextObservation $s (Info 900) 1 'old-snapshot'
Check ($null -eq $s.Current -and $s.Points.Count -eq 0) 'pre-compaction duplicate cannot republish old context'
for ($i=1; $i -le 6; $i++) { Add-ContextObservation $s (Info (900-10*$i) 1000 (1000*$i)) $i 'fixture' }
$trend=Get-ContextTrend $s $turns
Check ($trend.Growth -eq -10 -and $null -eq $trend.Rounds) 'negative growth retained, no forecast'
$turns[7]=@{Status='completed'}
Add-ContextObservation $s (Info 830 1000 7000) 7 'fixture'
$s.Points.Remove(6)
Check ($null -eq (Get-ContextTrend $s $turns).Growth) 'whole completed turn without usage cannot be skipped'
Add-ContextObservation $s $null 6 'missing'
Check ($null -eq $s.Current -and $s.Points.Count -eq 0) 'missing new usage never reuses old input'
# Exhaustive traditional-score bands are exercised by Test-SessionScoreAvailability.ps1.
# This suite verifies that context diagnostics stay independent through the analyzer.
$missingTotal = New-ContextObservationState
Set-ContextObservationIdentity $missingTotal 'fixture-model' 'fixture-provider'
Add-ContextObservation $missingTotal (Info 100 1000 $null) 1 'missing-total'
Check ($null -eq $missingTotal.Current -and $missingTotal.Points.Count -eq 0) 'missing cumulative total invalidates context observation'

# Card input is independent of window and cumulative counters; capacity/trend remain unknown.
foreach ($missing in @('window','total')) {
    $raw=New-ContextObservationState
    $info=if ($missing -eq 'window') { Info 164949 $null 200000 100000 } else { Info 164949 258000 $null 100000 }
    Add-ContextObservation $raw $info 1 '2025-01-01T00:00:00Z'
    Check ($raw.Request.Input -eq 164949 -and $null -eq $raw.Current -and $null -eq (Get-ContextTrend $raw @{}).Percent) 'raw native input remains available when capacity metadata is missing'
    Reset-ContextObservations $raw
    Add-ContextObservation $raw $info 1 '2025-01-01T00:00:01Z'
    Check ($null -eq $raw.Request) 'duplicate pre-boundary raw usage cannot reappear'
}
foreach ($bad in @(-1,1.5,[double]::NaN,[double]::PositiveInfinity,9007199254740992)) {
    $raw=New-ContextObservationState
    Add-ContextObservation $raw (Info $bad) 1 'fixture'
    Check ($null -eq $raw.Request) 'invalid raw input cannot become card data'
    Check ($null -eq $raw.Current -and $null -eq (Get-ContextTrend $raw @{}).Percent -and $raw.Points.Count -eq 0) 'invalid raw input cannot become capacity or trend data'
}
$raw=New-ContextObservationState
Add-ContextObservation $raw (Info 0 $null $null) 1 'zero'
Check ($null -ne $raw.Request -and $raw.Request.Input -eq 0) 'valid zero needs no window or cumulative total'
Set-ContextObservationIdentity $raw 'other-model' 'provider'
Check ($null -eq $raw.Request) 'model change clears raw card observation'
Add-ContextObservation $raw (Info 123) 1 'new'
Add-ContextObservation $raw $null 2 'missing'
Check ($null -eq $raw.Request) 'missing new usage clears prior card observation'

# Exercise actual streaming/turn binding using a synthetic CODEX_HOME and reports only.
$fixtureRoot = Join-Path $root ('.planning/session-context-tests/' + [guid]::NewGuid().ToString('N'))
$fixtureHome = Join-Path $fixtureRoot '.codex'
$sessions = Join-Path $fixtureHome 'sessions'
[IO.Directory]::CreateDirectory($sessions) | Out-Null
$fictionalId = '00000000-0000-0000-0000-000000000080'
$fixturePath = Join-Path $sessions ('fictional-' + $fictionalId + '.jsonl')
$records = @(@{timestamp='2025-01-01T00:00:00Z';type='session_meta';payload=@{id=$fictionalId;model_provider='fixture'}})
for ($i=1; $i -le 6; $i++) {
    $time = '2025-01-01T00:{0:D2}:00Z' -f $i
    $records += @{timestamp=$time;type='turn_context';payload=@{turn_id="fixture-$i";model='fixture-model'}}
    $records += @{timestamp=$time;type='event_msg';payload=@{type='token_count';info=(Info (100+10*$i) 1000 (1000*$i) 90)}}
    $records += @{timestamp=$time;type='event_msg';payload=@{type='task_complete';turn_id="fixture-$i"}}
}
$utf8 = New-Object Text.UTF8Encoding($false)
function Write-FixtureRecords($Items) {
    [IO.File]::WriteAllText($fixturePath, (($Items | ForEach-Object { $_ | ConvertTo-Json -Depth 12 -Compress }) -join "`n")+"`n", $utf8)
}
function Get-FixtureHash([string]$Path) {
    $sha = [Security.Cryptography.SHA256]::Create()
    try { return [BitConverter]::ToString($sha.ComputeHash([IO.File]::ReadAllBytes($Path))) }
    finally { $sha.Dispose() }
}
$isolatedAnalyzer = Join-Path $fixtureRoot 'isolated-analyzer.ps1'
$source = [IO.File]::ReadAllText($analyzer)
$isolated = $source.Replace('$env:USERPROFILE', ("'" + $fixtureRoot.Replace("'", "''") + "'"))
[IO.File]::WriteAllText($isolatedAnalyzer, $isolated, (New-Object Text.UTF8Encoding($true)))
try {
    Write-FixtureRecords $records
    $sourceHash = Get-FixtureHash $fixturePath
    $null = . $isolatedAnalyzer -TaskId $fictionalId -ReportPath (Join-Path $fixtureRoot 'trend.md')
    Check ($contextPercent -eq 16 -and $contextGrowth -eq 10 -and $null -eq $roundsToObservation) 'streaming parser binds six final turn observations without a target forecast'
    Check ($handoffLevel -eq 'continue' -and $totalScore -eq 0) 'streaming forecast does not change the traditional score'
    $report=[IO.File]::ReadAllText((Join-Path $fixtureRoot 'trend.md'))
    Check ($report.Contains('文件大小分') -and $report.Contains('压缩次数分') -and $report.Contains('= 0/10')) 'report contains the scoring model and contribution equation'
    Check ($report.Contains('100,000') -and $report.Contains('150,000') -and $report.Contains('N × (C - R) > H')) 'report rejects absolute must-handoff rule and explains break-even'
    Check ($report.Contains('未知') -and $report.Contains('安全断点') -and $report.Contains('400 MiB')) 'report does not infer stage or cost benefit'
    Check ((Get-FixtureHash $fixturePath) -eq $sourceHash) 'source log unchanged after report generation'
    $records += @{timestamp='2025-01-01T00:07:00Z';type='compacted';payload=@{}}
    Write-FixtureRecords $records
    $null = . $isolatedAnalyzer -TaskId $fictionalId -ReportPath (Join-Path $fixtureRoot 'compacted.md')
    Check ($null -eq $contextPercent -and $handoffLevel -eq 'continue' -and $totalScore -eq 0) 'streaming compaction invalidates old observation'
    $records += @{timestamp='2025-01-01T00:08:00Z';type='event_msg';payload=@{type='token_count';info=(Info 0 1000 8000)}}
    Write-FixtureRecords $records
    $null = . $isolatedAnalyzer -TaskId $fictionalId -ReportPath (Join-Path $fixtureRoot 'zero.md')
    Check ($contextPercent -eq 0 -and $handoffLevel -eq 'continue' -and $totalScore -eq 0 -and $null -eq $contextGrowth -and $contextState.Points.Count -eq 0) 'streaming zero is valid but cannot attach to a completed turn'
    $records += @{timestamp='2025-01-01T00:09:00Z';type='event_msg';payload=@{type='token_count';info=$null}}
    Write-FixtureRecords $records
    $null = . $isolatedAnalyzer -TaskId $fictionalId -ReportPath (Join-Path $fixtureRoot 'missing.md')
    Check ($null -eq $contextPercent -and $handoffLevel -eq 'continue' -and $totalScore -eq 0) 'streaming missing new usage cannot reuse zero or older input'
    $records += @{timestamp='2025-01-01T00:10:00Z';type='event_msg';payload=@{type='token_count';info=(Info 900 1000 10000)}}
    Write-FixtureRecords $records
    [IO.File]::AppendAllText($fixturePath, '{"timestamp":"2025-01-01T00:11:00Z","type":"event_msg","payload":{', $utf8)
    $null = . $isolatedAnalyzer -TaskId $fictionalId -ReportPath (Join-Path $fixtureRoot 'truncated.md')
    Check ($null -eq $contextPercent -and $handoffLevel -eq 'continue' -and $totalScore -eq 0 -and $parseWarnings -gt 0) 'streaming truncated before payload.type invalidates context'
    $records = @(
        @{timestamp='2025-01-01T00:00:00Z';type='session_meta';payload=@{id=$fictionalId;model_provider='fixture'}},
        @{timestamp='2025-01-01T00:01:00Z';type='turn_context';payload=@{turn_id='high';model='fixture-model'}},
        @{timestamp='2025-01-01T00:01:01Z';type='event_msg';payload=@{type='token_count';info=(Info 950 1000 1000)}},
        @{timestamp='2025-01-01T00:01:02Z';type='event_msg';payload=@{type='task_complete';turn_id='high'}}
    )
    Write-FixtureRecords $records
    foreach ($locale in @('zh-CN','en-US')) {
        $reportPath = Join-Path $fixtureRoot ($locale+'-partial.md')
        $null = . $isolatedAnalyzer -TaskId $fictionalId -ReportPath $reportPath -Language $locale
        $partial = [IO.File]::ReadAllText($reportPath)
        Check ($sizeScore -eq 0 -and $compressionScore -eq 0 -and $totalScore -eq 0 -and $scoreBasis -eq 'traditional') 'high occupancy is diagnostic only; no score inflation'
        Check ($partial.Contains((Get-UiText 'ScoreEquation' @(0,0,0))) -and $partial.Contains((Get-UiText 'Unavailable'))) 'bilingual report retains traditional equation and unknown diagnostic values'
        Check (-not $partial.Contains('20%')) 'visible report has no arbitrary observation target'
        Check ($partial.Contains((Get-UiText 'ScoreCalibration')) -and $partial.Contains((Get-UiText 'CostGate'))) 'bilingual report retains empirical and savings limitations'
    }
} finally {
    # Retain the isolated fixtures and reports as reproducible local evidence.
}
Write-Output "Context observation regression: PASS ($script:checks checks; synthetic only)"
