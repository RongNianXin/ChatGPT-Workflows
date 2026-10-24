[CmdletBinding(DefaultParameterSetName = 'Run')]
param(
    [Parameter(Mandatory = $true, ParameterSetName = 'Run')][string]$Contract,
    [Parameter(Mandatory = $true, ParameterSetName = 'Run')][string]$Prompt,
    [Parameter(Mandatory = $true, ParameterSetName = 'Test')][switch]$SelfTest,
    [string]$CodexJs
)
$ErrorActionPreference = 'Stop'
$nodeCommand = Get-Command node -ErrorAction Stop
if (-not $CodexJs) {
    $codexCommand = Get-Command codex -ErrorAction Stop
    $CodexJs = Join-Path (Split-Path -Parent $codexCommand.Source) 'node_modules/@openai/codex/bin/codex.js'
}
if (-not (Test-Path -LiteralPath $CodexJs -PathType Leaf)) {
    throw '未找到已安装的 npm Codex CLI 入口；请通过 -CodexJs 指定现有 codex.js，不会自动安装或修改登录。'
}
$repository = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if ($SelfTest) {
    & $nodeCommand.Source (Join-Path $repository '.github/scripts/Test-TaskContinuationGuard.mjs') '--codex-js' $CodexJs
    exit $LASTEXITCODE
}
$contractPath = (Resolve-Path -LiteralPath $Contract).Path
$promptPath = (Resolve-Path -LiteralPath $Prompt).Path
$runtimeRoot = Join-Path $repository '.codex-manual-cache/task-continuation-guard'
[void](New-Item -ItemType Directory -Path $runtimeRoot -Force)
$runDirectory = Join-Path $runtimeRoot ([Guid]::NewGuid().ToString())
& $nodeCommand.Source (Join-Path $PSScriptRoot 'guard.mjs') 'run' '--contract' $contractPath '--prompt' $promptPath '--run-dir' $runDirectory '--codex-js' $CodexJs
exit $LASTEXITCODE
