$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')).Path
$planningRoot = Join-Path $repoRoot '.planning'
$testRoot = Join-Path $planningRoot ('sessiondesk-startup-' + [Guid]::NewGuid().ToString('N'))
$moduleRoot = Join-Path $testRoot 'Codex会话交接评估'
$windowsRoot = Join-Path $moduleRoot 'windows-local'
$sourceModule = Join-Path $repoRoot '实用小工具/Codex会话交接评估'
$sourceWindows = Join-Path $sourceModule 'windows-local'
$utf8 = New-Object Text.UTF8Encoding($false)
$checks = [Collections.Generic.List[string]]::new()
$serviceProcesses = [Collections.Generic.List[Diagnostics.Process]]::new()
$heldLock = $null
$testPassed = $false
$primaryFailure = $null
$cleanupProblems = [Collections.Generic.List[string]]::new()

function Assert-StartupCheck([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw $Message }
}

function Start-DeskProcess([string]$ScriptPath, [string]$Instance, [string]$OutputPath) {
    $arguments = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + $ScriptPath + '" -NoBrowser -Synthetic -Instance ' + $Instance
    $started = Start-Process -FilePath $script:powershellPath -ArgumentList $arguments -PassThru -WindowStyle Hidden `
        -RedirectStandardOutput $OutputPath -RedirectStandardError ($OutputPath + '.err')
    $script:serviceProcesses.Add($started)
    # Windows PowerShell 5.1 needs the handle retained before redirected children exit.
    [void]$started.Handle
    return $started
}

function Wait-DeskConnection([Diagnostics.Process]$Process, [string]$ConnectionPath) {
    for ($attempt = 0; $attempt -lt 300; $attempt++) {
        $Process.Refresh()
        if ($Process.HasExited) {
            $errorPath = Join-Path (Split-Path $ConnectionPath -Parent) 'startup-error.txt'
            $detail = if ([IO.File]::Exists($errorPath)) { [IO.File]::ReadAllText($errorPath) } else { 'no startup error file' }
            throw "Synthetic desk exited before startup: $detail"
        }
        if ([IO.File]::Exists($ConnectionPath)) {
            $connection = [IO.File]::ReadAllText($ConnectionPath) | ConvertFrom-Json
            if ([int]$connection.pid -eq $Process.Id) { return $connection }
        }
        Start-Sleep -Milliseconds 100
    }
    throw 'Synthetic desk startup timed out.'
}

function Invoke-DeskRequest($Connection, [string]$Route, [string]$Token, [string]$Method = 'GET') {
    $uri = [Uri]$Connection.url
    $address = "http://127.0.0.1:$($Connection.port)$Route"
    if ($Method -eq 'POST') {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $address -Method Post `
            -Headers @{'X-SessionDesk' = $Token} -ContentType 'application/json' -Body '{}' -TimeoutSec 5
        return [int]$response.StatusCode
    }
    $request = [Net.HttpWebRequest]::Create("http://127.0.0.1:$($Connection.port)$Route")
    $request.Method = $Method
    $request.Proxy = $null
    $request.Timeout = 3000
    $request.ReadWriteTimeout = 3000
    $request.Headers['X-SessionDesk'] = $Token
    try {
        $response = [Net.HttpWebResponse]$request.GetResponse()
        try { return [int]$response.StatusCode } finally { $response.Dispose() }
    } catch [Net.WebException] {
        if ($null -ne $_.Exception.Response) {
            $response = [Net.HttpWebResponse]$_.Exception.Response
            try { return [int]$response.StatusCode } finally { $response.Dispose() }
        }
        throw
    }
}

function Stop-SyntheticDesk([Diagnostics.Process]$Process, $Connection, [string]$ConnectionPath) {
    $token = ([Uri]$Connection.url).Fragment.TrimStart('#')
    Assert-StartupCheck ((Invoke-DeskRequest $Connection '/api/shutdown' $token 'POST') -eq 200) 'Synthetic desk did not accept shutdown.'
    if (-not $Process.WaitForExit(15000)) { throw 'Synthetic desk did not exit after shutdown.' }
    $Process.Refresh()
    Assert-StartupCheck ($Process.ExitCode -eq 0) 'Synthetic desk shutdown returned a failure exit code.'
    Assert-StartupCheck (-not [IO.File]::Exists($ConnectionPath)) 'Shutdown left a connection file behind.'
    $lockPath = Join-Path (Split-Path $ConnectionPath -Parent) 'server.lock'
    $lock = [IO.File]::Open($lockPath, 'OpenOrCreate', 'ReadWrite', 'None')
    $lock.Dispose()
}

function Copy-DeskFixture([string]$Destination, [switch]$OmitMetadataReader) {
    New-Item -ItemType Directory -Path (Join-Path $Destination 'windows-local') -Force | Out-Null
    New-Item -ItemType Directory -Path (Split-Path $Destination -Parent) -Force | Out-Null
    foreach ($name in @('Start-SessionDesk.ps1', 'Invoke-IsolatedAnalyzer.ps1', 'desk.html')) {
        Copy-Item -LiteralPath (Join-Path $sourceWindows $name) -Destination (Join-Path $Destination 'windows-local')
    }
    Copy-Item -LiteralPath (Join-Path $sourceModule 'check-codex-session.ps1') -Destination $Destination
    if (-not $OmitMetadataReader) {
        Copy-Item -LiteralPath (Join-Path $sourceWindows 'Read-DeskMetadata.ps1') -Destination (Join-Path $Destination 'windows-local')
    }
}

try {
    New-Item -ItemType Directory -Path $planningRoot -Force | Out-Null
    if ([IO.Directory]::Exists($testRoot)) { throw 'Refusing to reuse an existing startup-test directory.' }
    Copy-DeskFixture $moduleRoot
    Copy-Item -LiteralPath (Join-Path $sourceModule 'Start-SessionDesk.cmd') -Destination (Join-Path $moduleRoot 'Start-SessionDesk.cmd')
    Copy-Item -LiteralPath (Join-Path $sourceWindows 'Start-SessionDesk.cmd') -Destination (Join-Path $windowsRoot 'Start-SessionDesk.cmd')

    $rootLauncher = [IO.File]::ReadAllText((Join-Path $moduleRoot 'Start-SessionDesk.cmd'))
    $nestedLauncher = [IO.File]::ReadAllText((Join-Path $windowsRoot 'Start-SessionDesk.cmd'))
    Assert-StartupCheck ($rootLauncher.Contains('%~dp0windows-local\Start-SessionDesk.ps1')) 'Root launcher does not target the Windows desk script.'
    Assert-StartupCheck ($nestedLauncher.Contains('%~dp0Start-SessionDesk.ps1')) 'Windows-local launcher does not target its sibling script.'
    $checks.Add('both double-click launchers target the intended script')

    $script:powershellPath = Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe'
    $parserTokens = $null
    $parseErrors = $null
    [void][Management.Automation.Language.Parser]::ParseFile((Join-Path $windowsRoot 'Start-SessionDesk.ps1'), [ref]$parserTokens, [ref]$parseErrors)
    Assert-StartupCheck ($parseErrors.Count -eq 0) 'Session desk PowerShell script has syntax errors.'

    $instance = 'smoke-' + [Guid]::NewGuid().ToString('N').Substring(0, 20)
    $dataRoot = Join-Path $windowsRoot ('.local/' + $instance)
    New-Item -ItemType Directory -Path $dataRoot -Force | Out-Null
    [IO.File]::WriteAllText((Join-Path $dataRoot 'startup-error.txt'), 'old failure', $utf8)
    $connectionPath = Join-Path $dataRoot 'connection.json'
    $process = Start-DeskProcess (Join-Path $windowsRoot 'Start-SessionDesk.ps1') $instance (Join-Path $dataRoot 'test.stdout')
    $connection = Wait-DeskConnection $process $connectionPath
    Assert-StartupCheck ($connection.mode -eq 'isolated-synthetic') 'Startup test entered a non-synthetic mode.'
    Assert-StartupCheck (-not [IO.File]::Exists((Join-Path $dataRoot 'startup-error.txt'))) 'Successful startup left a stale error message.'
    $token = ([Uri]$connection.url).Fragment.TrimStart('#')
    Assert-StartupCheck ((Invoke-DeskRequest $connection '/api/tasks' $token) -eq 200) 'Synthetic local health request failed.'
    Assert-StartupCheck ((Invoke-DeskRequest $connection '/api/tasks' 'invalid-token') -eq 403) 'Invalid connection token was accepted.'
    $checks.Add('first startup, stale-error clearing and connection-token checks')

    $originalConnection = [IO.File]::ReadAllText($connectionPath)
    $duplicate = Start-DeskProcess (Join-Path $windowsRoot 'Start-SessionDesk.ps1') $instance (Join-Path $dataRoot 'duplicate.stdout')
    if (-not $duplicate.WaitForExit(15000)) { throw 'Duplicate startup did not return.' }
    $duplicate.Refresh()
    Assert-StartupCheck ($duplicate.ExitCode -eq 0) 'Duplicate startup returned a failure exit code.'
    $duplicateOutput = [IO.File]::ReadAllText((Join-Path $dataRoot 'duplicate.stdout'))
    if (-not $duplicate.HasExited -or -not $duplicateOutput.Contains('already running')) {
        $duplicateError = [IO.File]::ReadAllText((Join-Path $dataRoot 'duplicate.stdout.err'))
        throw "Duplicate startup did not reuse the healthy service: $duplicateOutput $duplicateError"
    }
    Assert-StartupCheck ([IO.File]::ReadAllText($connectionPath) -ceq $originalConnection) 'Duplicate startup changed the running service identity.'
    $checks.Add('duplicate startup reuses the running service')

    Stop-SyntheticDesk $process $connection $connectionPath
    $checks.Add('shutdown removes its connection and releases its lock')

    $slowInstance = 'slow-' + [Guid]::NewGuid().ToString('N').Substring(0, 20)
    $slowDataRoot = Join-Path $windowsRoot ('.local/' + $slowInstance)
    New-Item -ItemType Directory -Path $slowDataRoot -Force | Out-Null
    $heldLock = [IO.File]::Open((Join-Path $slowDataRoot 'server.lock'), 'OpenOrCreate', 'ReadWrite', 'None')
    $slowConnectionPath = Join-Path $slowDataRoot 'connection.json'
    $slowProcess = Start-DeskProcess (Join-Path $windowsRoot 'Start-SessionDesk.ps1') $slowInstance (Join-Path $slowDataRoot 'slow.stdout')
    Start-Sleep -Milliseconds 2500
    $slowProcess.Refresh()
    Assert-StartupCheck (-not $slowProcess.HasExited -and -not [IO.File]::Exists($slowConnectionPath)) 'Startup did not wait safely for a temporarily held lock.'
    $heldLock.Dispose()
    $heldLock = $null
    $slowConnection = Wait-DeskConnection $slowProcess $slowConnectionPath
    $slowToken = ([Uri]$slowConnection.url).Fragment.TrimStart('#')
    Assert-StartupCheck ((Invoke-DeskRequest $slowConnection '/api/tasks' $slowToken) -eq 200) 'Desk failed after the temporary lock was released.'
    Stop-SyntheticDesk $slowProcess $slowConnection $slowConnectionPath
    $checks.Add('startup survives lock contention longer than the former retry window')

    $badInstance = 'bad-' + [Guid]::NewGuid().ToString('N').Substring(0, 20)
    $badDataRoot = Join-Path $windowsRoot ('.local/' + $badInstance)
    New-Item -ItemType Directory -Path $badDataRoot -Force | Out-Null
    $badConnectionPath = Join-Path $badDataRoot 'connection.json'
    $badConnectionText = @{url=('http://127.0.0.1:1/#'+('a' * 64));port=1;mode='forged';pid=$PID} | ConvertTo-Json
    [IO.File]::WriteAllText($badConnectionPath, $badConnectionText, $utf8)
    $heldLock = [IO.File]::Open((Join-Path $badDataRoot 'server.lock'), 'OpenOrCreate', 'ReadWrite', 'None')
    $badProcess = Start-DeskProcess (Join-Path $windowsRoot 'Start-SessionDesk.ps1') $badInstance (Join-Path $badDataRoot 'bad.stdout')
    if (-not $badProcess.WaitForExit(20000)) { throw 'Invalid locked connection did not fail within the bounded startup wait.' }
    $badProcess.Refresh()
    Assert-StartupCheck ($badProcess.ExitCode -ne 0) 'Invalid locked connection returned a success exit code.'
    $badErrorPath = Join-Path $badDataRoot 'startup-error.txt'
    Assert-StartupCheck ($badProcess.HasExited -and [IO.File]::Exists($badErrorPath)) 'Invalid locked connection was reported as a successful startup.'
    Assert-StartupCheck ([IO.File]::ReadAllText($badConnectionPath) -ceq $badConnectionText) 'Failed startup changed the forged connection evidence.'
    Assert-StartupCheck ([IO.File]::ReadAllText($badErrorPath) -match 'lock is held|锁已被占用') 'Invalid locked connection did not explain the failure.'
    $heldLock.Dispose()
    $heldLock = $null
    $checks.Add('forged connection with a held lock fails closed without overwriting evidence')

    $failureRoot = Join-Path $testRoot 'missing-reader'
    Copy-DeskFixture $failureRoot -OmitMetadataReader
    $failureInstance = 'failure-' + [Guid]::NewGuid().ToString('N').Substring(0, 18)
    $failureDataRoot = Join-Path (Join-Path $failureRoot 'windows-local') ('.local/' + $failureInstance)
    $failure = Start-DeskProcess (Join-Path $failureRoot 'windows-local/Start-SessionDesk.ps1') $failureInstance (Join-Path $testRoot 'early-failure.stdout')
    if (-not $failure.WaitForExit(10000)) { throw 'Expected early startup failure did not exit.' }
    $failure.Refresh()
    Assert-StartupCheck ($failure.ExitCode -ne 0) 'Early startup failure returned a success exit code.'
    $failureMessagePath = Join-Path $failureDataRoot 'startup-error.txt'
    Assert-StartupCheck ($failure.HasExited -and [IO.File]::Exists($failureMessagePath)) 'Early startup failure did not preserve a visible diagnostic.'
    Assert-StartupCheck (-not [string]::IsNullOrWhiteSpace([IO.File]::ReadAllText($failureMessagePath))) 'Early startup diagnostic was empty.'
    $checks.Add('early startup failures leave a readable diagnostic')

    $testPassed = $true
}
catch {
    $primaryFailure = $_
}
finally {
    if ($null -ne $heldLock) {
        try { $heldLock.Dispose() } catch { $cleanupProblems.Add($_.Exception.Message) }
    }
    foreach ($process in $serviceProcesses) {
        try {
            $process.Refresh()
            if (-not $process.HasExited) {
                $process.Kill()
                if (-not $process.WaitForExit(5000)) {
                    $cleanupProblems.Add('An owned test process did not exit within cleanup timeout.')
                }
            }
        } catch { $cleanupProblems.Add($_.Exception.Message) }
        finally {
            try { $process.Dispose() } catch { $cleanupProblems.Add($_.Exception.Message) }
        }
    }
}
Write-Host "Startup evidence retained at: $testRoot"
foreach ($problem in $cleanupProblems) { Write-Warning ('Startup cleanup failed: ' + $problem) -WarningAction Continue }
if ($null -ne $primaryFailure) { throw $primaryFailure }
if ($cleanupProblems.Count -gt 0) { throw 'Startup test cleanup failed; evidence has been retained.' }
Assert-StartupCheck $testPassed 'Startup checks did not finish.'
Write-Host "Session desk startup: PASS ($($checks.Count) checks; synthetic data only)"
foreach ($check in $checks) { Write-Host "PASS: $check" }
