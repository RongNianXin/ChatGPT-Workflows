[CmdletBinding()]
param([Parameter(Mandatory)][string]$TaskId, [Parameter(Mandatory)][string]$ReportPath,
    [ValidateSet('zh-CN','en-US')][string]$Language = 'zh-CN', [string]$MetadataPath)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object Text.UTF8Encoding($false)
try {
    # This wrapper is copied beside the isolated analyzer, never run against the original.
    $script = Join-Path $PSScriptRoot 'isolated-analyzer.ps1'
    $output = . $script -TaskId $TaskId -ReportPath $ReportPath -Language $Language | Out-String -Width 180
    if ($MetadataPath) {
        # The analyzer owns the score and the warning level; this wrapper only passes them through.
        $score = if ($null -ne $totalScore) { [int]$totalScore } else { $null }
        $level = if ($handoffLevel -in @('continue','recommended','required')) { [string]$handoffLevel } else { 'unknown' }
        $contextPercent = if ($null -ne $contextPercent) { [double]$contextPercent } else { $null }
        $metadata = @{name=$taskNameInfo.TaskName;found=$taskNameInfo.IndexFound;warnings=$taskNameInfo.ParseWarnings;score=$score;level=$level;contextPercent=$contextPercent;contextInputTokens=$(if ($null -ne $contextState.Request) { $contextState.Request.Input } else { $null });contextObservedAt=$(if ($null -ne $contextState.Request) { $contextState.Request.Timestamp } else { $null });assessmentVersion=$assessmentVersion;contextGrowth=$contextGrowth;roundsToObservation=$roundsToObservation;scoreBasis=$scoreBasis}
        [IO.File]::WriteAllText($MetadataPath, ($metadata | ConvertTo-Json), (New-Object Text.UTF8Encoding($false)))
    }
    [Console]::Out.Write($output)
    exit 0
} catch {
    [Console]::Error.WriteLine($_.Exception.Message)
    exit 1
}
