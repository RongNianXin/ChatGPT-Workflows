[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$path = Join-Path $root '实用小工具/Codex会话交接评估/check-codex-session.ps1'
$tokens = $null; $errors = $null
$ast = [Management.Automation.Language.Parser]::ParseFile($path, [ref]$tokens, [ref]$errors)
if ($errors.Count) { throw 'Analyzer syntax failed' }
$definition = $ast.Find({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Get-HandoffAssessmentScore'}, $true)
. ([scriptblock]::Create($definition.Extent.Text))
$checks = 0
function Check($Value, $Label) {
    if (-not $Value) { throw "Regression: $Label" }
    $script:checks++
}
# Compare every threshold boundary with the restored legacy bands.
foreach ($size in @(0,29.999,30,49.999,50,99.999,100,199.999,200,399.999,400,1000)) {
    foreach ($count in @(0,3,4,6,7,9,10,14,15,19,20,99)) {
        $expectedSize = @(@(30,50,100,200,400) | Where-Object { $size -ge $_ }).Count
        $expectedCompact = @(@(4,7,10,15,20) | Where-Object { $count -ge $_ }).Count
        $expected = $expectedSize + $expectedCompact
        $r = Get-HandoffAssessmentScore -SizeMiB $size -CompactCount $count
        Check ($r.SizeScore -eq $expectedSize -and $r.CompressionScore -eq $expectedCompact -and $r.TotalScore -eq $expected) 'legacy component bands and total'
        $level = if ($expected -ge 8) { 'required' } elseif ($expected -ge 3) { 'recommended' } else { 'continue' }
        Check ($r.Level -eq $level -and $r.Basis -eq 'traditional') 'fixed three/eight boundaries and explicit basis'
    }
}
foreach ($size in @(-1,[double]::NaN,[double]::PositiveInfinity)) {
    $r = Get-HandoffAssessmentScore -SizeMiB $size -CompactCount 0
    Check ($null -eq $r.TotalScore -and $r.Level -eq 'unknown') 'invalid size cannot create score'
}
$r = Get-HandoffAssessmentScore -SizeMiB 0 -CompactCount -1
Check ($null -eq $r.TotalScore) 'negative count cannot create score'
Check (-not $definition.Extent.Text.Contains('$ContextPercent') -and -not $definition.Extent.Text.Contains('$ForecastPercent')) 'context and forecast are not scoring inputs'
Write-Output "Traditional score regression: PASS ($checks checks; synthetic only)"
