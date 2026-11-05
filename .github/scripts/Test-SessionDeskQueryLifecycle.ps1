param([string]$Source = (Join-Path $PSScriptRoot '../../实用小工具/Codex会话交接评估/windows-local/Start-SessionDesk.ps1'))
# Evaluate the real functions with owned, in-memory process substitutes.
# No live desk, model query or operating-system process is started.
$ErrorActionPreference = 'Stop'
try {
    $parseErrors=$null;$tokens=$null
    $sourceBytes=[IO.File]::ReadAllBytes($Source)
    $text=[Text.UTF8Encoding]::new($false,$true).GetString($sourceBytes).TrimStart([char]0xFEFF)
    $ast=[Management.Automation.Language.Parser]::ParseInput($text,[ref]$tokens,[ref]$parseErrors)
    if($parseErrors.Count){throw 'Source parse failed'}
    foreach($name in @('Stop-DeskQueryProcess','Update-Job')){
        $fn=$ast.Find({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $name},$true)
        if(-not $fn){throw "Missing function $name"}
        Invoke-Expression $fn.Extent.Text
    }
    function Persist-Job($Job) {}
    function Write-StartupError($Message) { $script:diagnostic=$Message }
    function Assert-Check($Condition,$Message) { if(-not $Condition){throw $Message} }
    function New-FakeProcess([bool]$Exited,[string]$Mode='normal'){
        $p=[pscustomobject]@{HasExited=$Exited;ExitCode=0;Mode=$Mode;KillCalls=0;Waits=[Collections.Generic.List[int]]::new();Disposed=$false}
        $p | Add-Member ScriptMethod Kill {
            $this.KillCalls++
            if($this.Mode -eq 'kill-error'){throw 'SYNTHETIC_KILL_ERROR'}
            if($this.Mode -ne 'no-exit'){$this.HasExited=$true}
        }
        $p | Add-Member ScriptMethod WaitForExit {
            param([int]$Milliseconds)
            if($Milliseconds -le 0){throw 'UNBOUNDED_WAIT'}
            $this.Waits.Add($Milliseconds)
            return ($this.Mode -ne 'no-exit')
        }
        $p | Add-Member ScriptMethod Dispose {$this.Disposed=$true}
        return $p
    }
    function New-Job($Process,[bool]$Expired=$false){
        $out=[Threading.Tasks.TaskCompletionSource[string]]::new();$out.SetResult('output')
        $err=[Threading.Tasks.TaskCompletionSource[string]]::new();$err.SetResult('')
        return @{state='running';process=$Process;started=[DateTime]::UtcNow.AddSeconds($(if($Expired){-121}else{0}));timedOut=$false;stdout=$out.Task;stderr=$err.Task;language='zh-CN'}
    }
    $checks=[Collections.Generic.List[string]]::new()
    foreach($mode in @('no-exit','kill-error')){
        $p=New-FakeProcess $false $mode;$job=New-Job $p $true;$failed=$false
        try{Update-Job $job|Out-Null}catch{$failed=$true}
        Assert-Check (-not $failed -and $job.state -eq 'running' -and $job.timedOut -and $job.error -and -not $p.Disposed) "Failed stop lost active ownership: $mode"
        if($mode -eq 'no-exit'){Assert-Check ($p.Waits.Count -eq 1 -and $p.Waits[0] -eq 5000) 'Wait was not bounded'}
        $checks.Add("failed-stop-$mode")
    }
    $idle=$ast.Find({param($n) $n -is [Management.Automation.Language.IfStatementAst] -and $n.Extent.Text.StartsWith('if (-not $waiting.AsyncWaitHandle.WaitOne(250))')},$true)
    if(-not $idle){throw 'Missing actual idle polling branch'}
    $handle=[pscustomobject]@{}
    $handle | Add-Member ScriptMethod WaitOne {param($Milliseconds) return $false}
    $waiting=@{AsyncWaitHandle=$handle}
    $p=New-FakeProcess $false 'no-exit';$job=New-Job $p $true;$jobs=@{test=$job}
    & ([scriptblock]::Create('for($once=0;$once -lt 2;$once++){' + $idle.Extent.Text + '}'))
    Assert-Check ($job.state -eq 'running' -and $job.error -and $p.KillCalls -eq 1 -and -not $p.Disposed) 'Idle polling exited or repeatedly retried a failed stop'
    $checks.Add('idle-loop-preserves-service-and-bounds-retries')
    $p=New-FakeProcess $false;$job=New-Job $p $true;Update-Job $job|Out-Null
    Assert-Check ($job.state -eq 'failed' -and $job.timedOut -and $p.Disposed) 'Timed-out query was accepted'
    $checks.Add('timeout-stop-confirmed')
    $p=New-FakeProcess $true;$job=New-Job $p;Update-Job $job|Out-Null
    Assert-Check ($job.state -eq 'done' -and $job.output -eq 'output' -and $p.Disposed) 'Normal completion changed'
    $checks.Add('normal-completion')
    $p=New-FakeProcess $true 'no-exit';$job=New-Job $p;Update-Job $job|Out-Null
    Assert-Check ($job.state -eq 'failed') 'Completion wait failure was accepted'
    $checks.Add('completion-wait-failure')
    foreach($stream in @('stdout','stderr')){
        $p=New-FakeProcess $true;$job=New-Job $p
        $pending=[Threading.Tasks.TaskCompletionSource[string]]::new()
        # A completed process can still have a redirected pipe held elsewhere.
        $fake=[pscustomobject]@{Waits=[Collections.Generic.List[int]]::new()}
        $fake | Add-Member ScriptMethod Wait {param([int]$Milliseconds) $this.Waits.Add($Milliseconds);return $false}
        $job[$stream]=$fake;Update-Job $job|Out-Null
        Assert-Check ($job.state -eq 'failed' -and $fake.Waits[0] -eq 5000) "Unclosed $stream was accepted"
        $checks.Add("bounded-$stream")
    }
    $shutdown=$ast.Find({param($n) $n -is [Management.Automation.Language.IfStatementAst] -and $n.Extent.Text.StartsWith("if (`$request.HttpMethod -eq 'POST' -and `$route -eq '/api/shutdown')")},$true)
    if(-not $shutdown){throw 'Missing actual shutdown route'}
    function Send-Json($Context,$Value) { $script:sent=$Value }
    foreach($mode in @('normal','no-exit','kill-error')){
        $p=New-FakeProcess $false $mode;$job=New-Job $p
        $jobs=@{test=$job};$request=@{HttpMethod='POST'};$route='/api/shutdown';$context=$null;$script:sent=$null;$failed=$false
        try{& ([scriptblock]::Create('for($once=0;$once -lt 1;$once++){' + $shutdown.Extent.Text + '}'))}catch{$failed=$true}
        if($mode -eq 'normal'){Assert-Check ($script:sent.stopped -and $p.Disposed -and $job.state -eq 'failed') 'Shutdown did not confirm owned query exit'}
        else{Assert-Check ($failed -and $null -eq $script:sent -and -not $p.Disposed -and $job.state -eq 'running') 'Shutdown falsely confirmed exit'}
        $checks.Add("shutdown-$mode")
    }
    $outer=$ast.EndBlock.Statements | Where-Object {$_ -is [Management.Automation.Language.TryStatementAst] -and $_.Finally} | Select-Object -Last 1
    if(-not $outer){throw 'Missing actual finally'}
    $artifactRoot=Join-Path $PSScriptRoot '../../.codex-manual-cache/query-lifecycle-tests'
    $fixture=Join-Path $artifactRoot ('query-cleanup-fixture-'+[guid]::NewGuid().ToString('N'))
    [void][IO.Directory]::CreateDirectory($fixture)
    $connectionPath=Join-Path $fixture 'connection.json';$connectionUrl='synthetic'
    [IO.File]::WriteAllText($connectionPath,(@{pid=$PID;url=$connectionUrl}|ConvertTo-Json))
    $p=New-FakeProcess $false 'no-exit';$jobs=@{test=(New-Job $p)}
    $listener=$null;$lock=$null;$lockOwned=$true;$deskPrimaryFailure=[Exception]::new('ORIGINAL_FAILURE')
    $script:diagnostic=$null;$failure=$null
    $body=$outer.Finally.Extent.Text
    try{& ([scriptblock]::Create($body.Substring(1,$body.Length-2)))}catch{$failure=$_.Exception}
    $aggregate=$failure
    while($aggregate -and $aggregate -isnot [AggregateException]){$aggregate=$aggregate.InnerException}
    Assert-Check ($aggregate -and $aggregate.InnerExceptions.Count -eq 2) 'Original and cleanup errors were not retained'
    Assert-Check ($aggregate.InnerExceptions[0].Message -eq 'ORIGINAL_FAILURE') 'Original failure lost'
    Assert-Check ((Test-Path -LiteralPath $connectionPath) -and $script:diagnostic -and -not $p.Disposed) 'Cleanup failure lost evidence'
    $checks.Add('finally-retains-primary-cleanup-and-connection')
    $sha=[Security.Cryptography.SHA256]::Create()
    try {
        $sourceHash=[BitConverter]::ToString($sha.ComputeHash($sourceBytes)).Replace('-','').ToLowerInvariant()
        $currentHash=[BitConverter]::ToString($sha.ComputeHash([IO.File]::ReadAllBytes($Source))).Replace('-','').ToLowerInvariant()
        Assert-Check ($currentHash -eq $sourceHash) 'Product source changed during the check'
    }
    finally {$sha.Dispose()}
    $result=@{status='PASS';checks=@($checks);count=$checks.Count;source_sha256=$sourceHash;scope='Actual AST functions/routes/finally with in-memory Process and Task substitutes; no service, network or model';fixture_retained=$true}
    $result|ConvertTo-Json -Depth 6 -Compress
    exit 0
}catch{[Console]::Error.WriteLine($_.Exception.ToString());exit 1}
