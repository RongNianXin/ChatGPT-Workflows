[CmdletBinding()]
param([switch]$NoBrowser, [switch]$Synthetic, [ValidatePattern('^[a-zA-Z0-9-]{1,40}$')][string]$Instance = 'main')
$ErrorActionPreference = 'Stop'
$utf8 = New-Object Text.UTF8Encoding($false)
$bom = New-Object Text.UTF8Encoding($true)
$data = Join-Path $PSScriptRoot ('.local/' + $Instance)
[IO.Directory]::CreateDirectory($data) | Out-Null
$connectionPath = Join-Path $data 'connection.json'
$lock = $null
$listener = $null
$jobs = @{}
$lockOwned = $false
. (Join-Path $PSScriptRoot 'Read-DeskMetadata.ps1')
$mode=if($Synthetic){'isolated-synthetic'}else{'local-readonly'}

function Get-ProjectTaskOrder($items) {
    # Only an unambiguous topic + number pair changes position. Titles are labels, not authority.
    $pairs=[Collections.Generic.Dictionary[string,object]]::new([StringComparer]::Ordinal)
    $pairKeys=@{}
    foreach($task in $items){
        if([string]$task.name -match '^\s*[【\[]([^】\]]+)[】\]]\s*专项(审查者|执行者)\s*([0-9]+)号\s*$'){
            $key=$Matches[1].Trim()+'|'+$Matches[3]
            if(-not $pairs.ContainsKey($key)){$pairs[$key]=[Collections.Generic.List[object]]::new()}
            $pairs[$key].Add(@{task=$task;role=$Matches[2]});$pairKeys[$task.id]=$key
        }
    }
    $valid=[Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    foreach($key in $pairs.Keys){if($pairs[$key].Count -eq 2 -and $pairs[$key][0].role -ne $pairs[$key][1].role){[void]$valid.Add($key)}}
    $leaders=[Collections.Generic.List[object]]::new();$ordinary=[Collections.Generic.List[object]]::new()
    $orderedPairs=[Collections.Generic.List[string]]::new()
    foreach($task in $items){
        $key=$pairKeys[$task.id]
        if($key -and $valid.Contains($key)){if(-not $orderedPairs.Contains($key)){$orderedPairs.Add($key)}}
        elseif(-not $key -and [string]$task.name -match '总指挥|\bcommander\b'){$leaders.Add($task)}
        else{$ordinary.Add($task)}
    }
    foreach($task in $leaders){$task}
    foreach($task in $ordinary){$task}
    foreach($key in $orderedPairs){foreach($member in $pairs[$key]){$member.task}}
}
function Sync-Metadata {
    $found=Get-DeskMetadata $codexData @($script:taskList | ForEach-Object {$_.id})
    $changed=$false
    foreach($task in $script:taskList){
        $value=$found[$task.id]
        if($task.projectKey -cne $value.projectKey){$task.projectKey=$value.projectKey;$changed=$true}
        foreach($key in @('name','project')){
            $available=[bool]$value[($key+'Found')]
            if($task[($key+'Found')] -ne $available){$task[($key+'Found')]=$available;$changed=$true}
            if($available -and $task[$key] -cne $value[$key]){$task[$key]=$value[$key];$changed=$true}
        }
    }
    if($changed){Save-Tasks}
}
$script:language = 'zh-CN'
$script:requestLanguage = 'zh-CN'
function Error-Text([string]$Message) {
    if ($script:requestLanguage -ne 'en-US') { return $Message }
    $translations = @{
        '请求格式或大小无效。'='Invalid request format or size.'
        '仅允许本机访问。'='Only local access is allowed.'
        '请求来源不匹配。'='Request origin does not match.'
        '连接凭证无效，请双击启动入口重新打开。'='Invalid connection token. Double-click the launcher to reopen.'
        '请输入标准格式的任务 ID。'='Enter a valid task ID in UUID format.'
        '名称和项目最多各 80 个字符，且不含控制字符。'='Name and project may each contain up to 80 characters, without control characters.'
        '此 ID 已保存，请点击对应任务的编辑按钮。'='This ID is already saved. Use Edit on that task.'
        '待编辑任务不存在，请重新加载页面。'='The task being edited no longer exists. Reload the page.'
        '该任务正在查询，请稍后删除。'='This task is running. Wait before deleting it.'
        '不支持的清单操作。'='Unsupported list action.'
        '请先保存该任务。'='Save this task first.'
        '本首版固定隔离验证模式：该 ID 没有虚构输入，不会读取真实会话。'='This build only uses isolated synthetic data. This ID has no fixture; real sessions will not be read.'
        '已有两个查询正在运行，请稍后重试。'='Two queries are already running. Try again shortly.'
        '尚无本次运行的查询。'='No query is available for this service run.'
        '当前查询没有可用报告。'='No report is available for the current query.'
        '接口不存在。'='Endpoint not found.'
        '语言无效。'='Invalid language.'
        '查询进行中，请结束后切换语言。'='Wait for running queries to finish before changing language.'
    }
    if ($translations.ContainsKey($Message)) { return $translations[$Message] }
    return 'The local operation failed. No successful save is confirmed. Check local file access and retry.'
}
function Write-Atomic([string]$Path, [string]$Text) {
    $temp = $Path + '.pending'
    for ($attempt = 0; $attempt -lt 8; $attempt++) {
        try {
            [IO.File]::WriteAllText($temp, $Text, $utf8)
            break
        } catch [IO.IOException] {
            if ($attempt -eq 7) { throw }
            Start-Sleep -Milliseconds (100 * ($attempt + 1))
        }
    }
    for ($attempt = 0; $attempt -lt 8; $attempt++) {
        try {
            if ([IO.File]::Exists($Path)) { [IO.File]::Replace($temp, $Path, $Path + '.bak') }
            else { [IO.File]::Move($temp, $Path) }
            return
        } catch [IO.IOException] {
            if ($attempt -eq 7) { throw }
            Start-Sleep -Milliseconds (100 * ($attempt + 1))
        }
    }
}
function Valid-Id([string]$Id) { return $Id -cmatch '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' }
function Save-Tasks {
    Write-Atomic $tasksPath (@{schema=2;language=$script:language;tasks=@($script:taskList)} | ConvertTo-Json -Depth 5)
}
function Send-Body($Context, [int]$Status, [string]$Text, [string]$Type = 'application/json; charset=utf-8') {
    $response = $Context.Response
    $response.StatusCode = $Status
    $response.ContentType = $Type
    $response.Headers['Cache-Control'] = 'no-store'
    $response.Headers['X-Content-Type-Options'] = 'nosniff'
    $response.Headers['Referrer-Policy'] = 'no-referrer'
    $response.Headers['Content-Security-Policy'] = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
    $bytes = $utf8.GetBytes($Text)
    $response.ContentLength64 = $bytes.Length
    try { $response.OutputStream.Write($bytes, 0, $bytes.Length) } finally { $response.Close() }
}
function Send-Json($Context, $Value, [int]$Status = 200) {
    if ($Status -ge 400 -and $Value.error) { $Value.error = Error-Text $Value.error }
    Send-Body $Context $Status ($Value | ConvertTo-Json -Depth 8 -Compress)
}
function Read-Body($Request) {
    if ($Request.ContentType -notmatch '^application/json' -or $Request.ContentLength64 -lt 0 -or $Request.ContentLength64 -gt 32768) { throw '请求格式或大小无效。' }
    $reader = New-Object IO.StreamReader($Request.InputStream, $utf8)
    try { return ($reader.ReadToEnd() | ConvertFrom-Json) } finally { $reader.Dispose() }
}

function Read-Snapshot([string]$Id) {
    $file=Join-Path $snapshots ($Id+'.json')
    if(-not [IO.File]::Exists($file)){return @()}
    try {
        if((Get-Item -LiteralPath $file).Length -gt 16777216){throw 'Snapshot too large'}
        $saved=[IO.File]::ReadAllText($file)|ConvertFrom-Json
        if($saved.schema -ne 1 -or $saved.id -cne $Id -or $saved.source -cne $snapshotSource){throw 'Snapshot source changed'}
        $items=@($saved.items)
        if($items.Count -gt 2){throw 'Invalid snapshot count'}
        $seen=@{}
        foreach($item in $items){
            if($item.id -cne $Id -or $item.state -ne 'done' -or $item.language -notin @('zh-CN','en-US') -or $seen.ContainsKey($item.language) -or $item.output -isnot [string] -or $item.reportText -isnot [string] -or -not $item.run){throw 'Invalid snapshot'}
            if ($item.level -and $item.level -notin @('continue','recommended','required','unknown')) { throw 'Invalid snapshot level' }
            if ($null -ne $item.score -and ([int]$item.score -lt 0 -or [int]$item.score -gt 10)) { throw 'Invalid snapshot score' }
            [void][DateTime]::Parse([string]$item.finished);$seen[$item.language]=$true
        }
        return $items
    } catch {throw 'History is unavailable for this task; query again. / 该任务历史不可用，请重新查询。'}
}
function Write-Snapshot([string]$Id, $Items) {
    $text=@{schema=1;id=$Id;source=$snapshotSource;items=@($Items)}|ConvertTo-Json -Depth 8 -Compress
    if([Text.Encoding]::UTF8.GetByteCount($text) -gt 16777216){throw 'Snapshot too large'}
    Write-Atomic (Join-Path $snapshots ($Id+'.json')) $text
}
function Persist-Job($Job) {
    try {
        $previous=@();try{$previous=@(Read-Snapshot $Job.id)}catch{}
        $item=@{id=$Job.id;run=$Job.run;language=$Job.language;state='done';output=$Job.output;error='';finished=$Job.finished;reportText=[IO.File]::ReadAllText($Job.report);level=$Job.level;score=$Job.score;contextPercent=$Job.contextPercent;restored=$true}
        Write-Snapshot $Job.id (@($previous|Where-Object {$_.language -ne $Job.language})+@($item))
        $Job.historySaved=$true
    } catch {$Job.historySaved=$false}
}

function Update-Job($Job) {
    if ($Job.state -eq 'running') {
        if (-not $Job.process.HasExited -and (([DateTime]::UtcNow - $Job.started).TotalSeconds -gt 120)) {
            $Job.process.Kill()
            $Job.process.WaitForExit()
            $Job.timedOut = $true
        }
        if ($Job.process.HasExited) {
            $Job.process.WaitForExit()
            $Job.output = $Job.stdout.GetAwaiter().GetResult()
            $errorText = $Job.stderr.GetAwaiter().GetResult()
            $Job.state = if ($Job.process.ExitCode -eq 0 -and -not $Job.timedOut) { 'done' } else { 'failed' }
            $Job.error = if ($Job.timedOut) { '查询超过 120 秒，已终止。' } else { $errorText.Trim() }
            $Job.finished = [DateTime]::UtcNow.ToString('o')
            $Job.process.Dispose()
            if($Job.state -eq 'done'){
                try {
                    $analysisMetadata=[IO.File]::ReadAllText($Job.metadata)|ConvertFrom-Json
                    if ($analysisMetadata.level -in @('continue','recommended','required')) { $Job.level=[string]$analysisMetadata.level }
                    else { $Job.metadataWarning=$true }
                    if ($null -ne $analysisMetadata.score) { $Job.score=[int]$analysisMetadata.score }
                    if ($null -ne $analysisMetadata.contextPercent) { $Job.contextPercent=[double]$analysisMetadata.contextPercent }
                } catch { $Job.metadataWarning=$true }
                Persist-Job $Job
            }
            if ($Job.timedOut -and $Job.language -eq 'en-US') { $Job.error='Query exceeded 120 seconds and was stopped.' }

        }
    }
    return @{id=$Job.id;run=$Job.run;language=$Job.language;state=$Job.state;output=$Job.output;error=$Job.error;finished=$Job.finished;nameChange=$Job.nameChange;metadataWarning=$Job.metadataWarning;level=$Job.level;score=$Job.score;contextPercent=$Job.contextPercent;historySaved=$Job.historySaved;reportAvailable=($Job.state -eq 'done')}
}
try {
    try {
        $lockPath = Join-Path $data 'server.lock'
        for ($attempt = 0; $attempt -lt 6; $attempt++) {
            try {
                $lock = [IO.File]::Open($lockPath, 'OpenOrCreate', 'ReadWrite', 'None')
                $lockOwned=$true
                break
            } catch [IO.IOException] {
                if ($attempt -eq 5) { throw }
                Start-Sleep -Milliseconds (100 * ($attempt + 1))
            }
        }
    }
    catch {
        # An existing instance owns this exact state directory. Never start a second writer.
        if (-not $NoBrowser -and [IO.File]::Exists($connectionPath)) {
            $existing = [IO.File]::ReadAllText($connectionPath) | ConvertFrom-Json
            if ($existing.url -match '^http://127\.0\.0\.1:[0-9]+/#([a-f0-9]{64})$') { Start-Process $existing.url | Out-Null }
        }
        Write-Output 'The local desk is already running.'
        exit 0
    }
    $tasksPath = Join-Path $data 'tasks.json'
    $script:taskList = @()
    if ([IO.File]::Exists($tasksPath)) {
        $saved = [IO.File]::ReadAllText($tasksPath) | ConvertFrom-Json
        if ($saved.schema -notin @(1,2)) { throw '任务清单版本无效。原文件已保留，请勿覆盖。 / Unsupported task-list version. Original file preserved.' }
        if ($saved.schema -eq 2) {
            if ($saved.language -notin @('zh-CN','en-US')) { throw '语言配置无效。 / Invalid language setting.' }
            $script:language=$saved.language
        }
        $seen = @{}
        foreach ($task in @($saved.tasks)) {
            if (-not (Valid-Id $task.id) -or $seen.ContainsKey($task.id) -or $task.name.Length -gt 4096 -or $task.project.Length -gt 4096 -or ([string]$task.name + [string]$task.project) -match '[\x00-\x1f]') { throw '任务清单内容无效。原文件已保留。 / Invalid task list. Original file preserved.' }
            $seen[$task.id]=$true
            $script:taskList += @{id=[string]$task.id;name=[string]$task.name;project=[string]$task.project;previousName=[string]$task.previousName;nameFound=$false;projectFound=$false}
        }
        if ($saved.schema -eq 1) {
            [IO.File]::Copy($tasksPath, (Join-Path $data ('tasks.schema1.'+[guid]::NewGuid().ToString('N')+'.bak')))
            Save-Tasks
        }
    } else { Save-Tasks }

    $profile = Join-Path $data 'fixtures'
    $sessions = Join-Path $profile '.codex/sessions'
    $runtime = Join-Path $data 'runtime'
    $reports = Join-Path $data 'reports'
    $snapshots=Join-Path $data 'snapshots'
    [IO.Directory]::CreateDirectory($snapshots)|Out-Null
    foreach ($directory in @($sessions,$runtime,$reports)) { [IO.Directory]::CreateDirectory($directory) | Out-Null }
    if($Synthetic) {
    # Generate only synthetic session data. The third sample ID deliberately has no log.
    $indexLines = @()
    foreach ($number in @(1,2)) {
        $id = '00000000-0000-0000-0000-' + $number.ToString('000000000000')
        $records = @(
            @{timestamp='2025-01-01T00:00:00Z';type='session_meta';payload=@{id=$id;synthetic_test=$true;originator='fixture';source='fixture';model_provider='fixture'}},
            @{timestamp='2025-01-01T00:00:01Z';type='turn_context';payload=@{turn_id='fictional-turn'}},
            @{timestamp='2025-01-01T00:00:02Z';type='event_msg';payload=@{type='user_message';turn_id='fictional-turn';message='这是隔离的虚构测试输入。'}},
            @{timestamp='2025-01-01T00:00:03Z';type='event_msg';payload=@{type='token_count';info=@{total_token_usage=@{input_tokens=(100*$number);output_tokens=30;total_tokens=(100*$number+30)}}}},
            @{timestamp='2025-01-01T00:00:04Z';type='event_msg';payload=@{type='task_complete';turn_id='fictional-turn'}}
        )
        if ($number -eq 2) {
            for ($compact=1;$compact -le 10;$compact++) { $records += @{timestamp=('2025-01-01T00:00:{0:D2}Z' -f (4+$compact));type='compacted';payload=@{synthetic_test=$true}} }
        }
        $lines = @($records | ForEach-Object { $_ | ConvertTo-Json -Depth 10 -Compress })
        [IO.File]::WriteAllText((Join-Path $sessions ('fictional-' + $id + '.jsonl')), ($lines -join "`n")+"`n", $utf8)
        $indexLines += (@{id=$id;thread_name=('虚构会话 '+$number);updated_at='2025-01-01T00:01:00Z'} | ConvertTo-Json -Compress)
    }
    [IO.File]::WriteAllText((Join-Path $profile '.codex/session_index.jsonl'),($indexLines -join "`n")+"`n",$utf8)
    $fakeProjects=@{'fixture-project'=@{id='fixture-project';name='虚构项目';rootPaths=@()}}
    $assignments=@{}
    foreach($n in @(1,2)){$assignments[('00000000-0000-0000-0000-'+$n.ToString('000000000000'))]=@{projectKind='local';projectId='fixture-project'}}
    [IO.File]::WriteAllText((Join-Path $profile '.codex/.codex-global-state.json'),(@{'thread-project-assignments'=$assignments;'local-projects'=$fakeProjects}|ConvertTo-Json -Depth 6),$utf8)
    }
    $codexData=if($Synthetic){Join-Path $profile '.codex'}elseif($env:CODEX_HOME){[IO.Path]::GetFullPath($env:CODEX_HOME)}else{Join-Path $env:USERPROFILE '.codex'}
    $sourcePath = Join-Path $PSScriptRoot '../check-codex-session.ps1'
    $source = [IO.File]::ReadAllText($sourcePath)
    $snapshotHash=[Security.Cryptography.SHA256]::Create()
    try{$snapshotSource=$mode+'|'+$codexData+'|'+[BitConverter]::ToString($snapshotHash.ComputeHash([IO.File]::ReadAllBytes($sourcePath)))}finally{$snapshotHash.Dispose()}
    if ([regex]::Matches($source,[regex]::Escape('$env:USERPROFILE')).Count -ne 4) { throw '分析器的隔离锚点已变化，停止启动。' }
    if($Synthetic){
    $literal = "'" + $profile.Replace("'","''") + "'"
    $isolated = $source.Replace('$env:USERPROFILE',$literal)
    if ($isolated.Replace($literal,'$env:USERPROFILE') -cne $source) { throw '隔离副本校验失败。' }
    }else{
        $homeLiteral="'"+$codexData.Replace("'","''")+"'"
        $isolated=$source
        foreach($suffix in @('.codex','.codex\sessions','.codex\archived_sessions')){
            $anchor='Join-Path $env:USERPROFILE '+"'"+$suffix+"'"
            if(-not $isolated.Contains($anchor)){throw 'Analyzer data-root anchor changed.'}
            $replacement=if($suffix -eq '.codex'){$homeLiteral}else{'Join-Path '+$homeLiteral+" '"+$suffix.Substring(7)+"'"}
            $isolated=$isolated.Replace($anchor,$replacement)
        }
    }
    [IO.File]::WriteAllText((Join-Path $runtime 'isolated-analyzer.ps1'),$isolated,$bom)
    [IO.File]::WriteAllText((Join-Path $runtime 'Invoke-IsolatedAnalyzer.ps1'),[IO.File]::ReadAllText((Join-Path $PSScriptRoot 'Invoke-IsolatedAnalyzer.ps1')),$bom)
    $powershell = Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe'
    $rng=[Security.Cryptography.RandomNumberGenerator]::Create();$random=New-Object byte[] 32;$rng.GetBytes($random);$rng.Dispose()
    $token=([BitConverter]::ToString($random)).Replace('-','').ToLowerInvariant()
    $probe=New-Object Net.Sockets.TcpListener([Net.IPAddress]::Loopback,0);$probe.Start();$port=$probe.LocalEndpoint.Port;$probe.Stop()
    $base="http://127.0.0.1:$port"
    $listener=New-Object Net.HttpListener;$listener.Prefixes.Add($base+'/');$listener.Start()
    Write-Atomic $connectionPath (@{url=($base+'/#'+$token);port=$port;mode=$mode;pid=$PID} | ConvertTo-Json)
    if (-not $NoBrowser) { Start-Process ($base+'/#'+$token) | Out-Null }
    $stopping=$false
    $waiting=$listener.BeginGetContext($null,$null)
    while (-not $stopping) {
        if (-not $waiting.AsyncWaitHandle.WaitOne(250)) {
            foreach ($job in @($jobs.Values)) { Update-Job $job | Out-Null }
            continue
        }
        $context=$listener.EndGetContext($waiting)
        $waiting=$listener.BeginGetContext($null,$null)
        $request=$context.Request
        $script:requestLanguage = if ($request.Headers['Accept-Language'] -match '^en') { 'en-US' } else { 'zh-CN' }
        try {
            if ($request.UserHostName -ne "127.0.0.1:$port" -or -not [Net.IPAddress]::IsLoopback($request.RemoteEndPoint.Address)) { Send-Json $context @{error='仅允许本机访问。'} 403;continue }
            $origin=$request.Headers['Origin']
            if ($origin -and $origin -ne $base) { Send-Json $context @{error='请求来源不匹配。'} 403;continue }
            $route=$request.Url.AbsolutePath
            if ($route -eq '/' -and $request.HttpMethod -eq 'GET') { Send-Body $context 200 ([IO.File]::ReadAllText((Join-Path $PSScriptRoot 'desk.html'))) 'text/html; charset=utf-8';continue }
            if ($request.Headers['X-SessionDesk'] -cne $token) { Send-Json $context @{error='连接凭证无效，请双击启动入口重新打开。'} 403;continue }
            if ($request.HttpMethod -eq 'GET' -and $route -eq '/api/tasks') { Sync-Metadata;Send-Json $context @{tasks=@($script:taskList);language=$script:language;mode=$mode;version='0.2.0-dev.10'};continue }
            if ($request.HttpMethod -eq 'GET' -and $route -eq '/api/history') {
                $id=$request.QueryString['id']
                if(-not (Valid-Id $id) -or -not @($script:taskList|Where-Object {$_.id -eq $id}).Count){Send-Json $context @{error='请先保存该任务。'} 404;continue}
                try{Send-Json $context @{items=@(Read-Snapshot $id);unavailable=$false}}catch{Send-Json $context @{items=@();unavailable=$true}}
                continue
            }
            if ($request.HttpMethod -eq 'POST' -and $route -eq '/api/settings') {
                $body=Read-Body $request
                if ($body.language -notin @('zh-CN','en-US')) { throw '语言无效。' }
                foreach ($job in @($jobs.Values)) { if ((Update-Job $job).state -eq 'running') { throw '查询进行中，请结束后切换语言。' } }
                $oldLanguage=$script:language;$script:language=$body.language
                try { Save-Tasks } catch { $script:language=$oldLanguage;throw }
                Send-Json $context @{language=$script:language};continue
            }
            if ($request.HttpMethod -eq 'POST' -and $route -eq '/api/tasks') {
                $body=Read-Body $request;$id=([string]$body.id).Trim().ToLowerInvariant()
                if ($body.action -ne 'group' -and -not (Valid-Id $id)) { throw '请输入标准格式的任务 ID。' }
                if ($body.action -in @('add','save')) {
                    $name=''
                    $project=''
                    if ($name.Length -gt 80 -or $project.Length -gt 80 -or ($name+$project) -match '[\x00-\x1f]') { throw '名称和项目最多各 80 个字符，且不含控制字符。' }
                    $existing=@($script:taskList | Where-Object { $_.id -eq $id })
                    if ($body.action -ne 'edit' -and $existing.Count) { throw '此 ID 已保存，请点击对应任务的编辑按钮。' }
                    if ($body.action -eq 'edit' -and -not $existing.Count) { throw '待编辑任务不存在，请重新加载页面。' }
                    $replacement=@{id=$id;name=$name;project=$project;previousName=if($existing.Count){$existing[0].previousName}else{''}}
                    if ($body.action -eq 'edit') { $newList=@($script:taskList | ForEach-Object { if ($_.id -eq $id) {$replacement} else {$_} }) }
                    else { $newList=@($script:taskList)+@($replacement) }
                } elseif ($body.action -eq 'delete') {
                    if ($jobs.ContainsKey($id) -and (Update-Job $jobs[$id]).state -eq 'running') { throw '该任务正在查询，请稍后删除。' }
                    $newList=@($script:taskList | Where-Object { $_.id -ne $id })
                    Write-Snapshot $id @()
                    if ($jobs.ContainsKey($id)) { $jobs.Remove($id) }
                } elseif ($body.action -eq 'move') {
                    $newList=@($script:taskList);$index=-1
                    for($i=0;$i -lt $newList.Count;$i++){if($newList[$i].id -eq $id){$index=$i;break}}
                    if($index -lt 0){throw '请先保存该任务。'}
                    if($body.direction -notin @('up','down')){throw '不支持的清单操作。'}
                    $target=$index+$(if($body.direction -eq 'up'){-1}else{1})
                    if($target -ge 0 -and $target -lt $newList.Count){$swap=$newList[$target];$newList[$target]=$newList[$index];$newList[$index]=$swap}
                } elseif ($body.action -eq 'top') {
                    $newList=@($script:taskList);$index=-1
                    for($i=0;$i -lt $newList.Count;$i++){if($newList[$i].id -eq $id){$index=$i;break}}
                    if($index -lt 0){throw '请先保存该任务。'}
                    if($index -gt 0){$item=$newList[$index];$newList=@($item)+@($newList | Where-Object {$_.id -ne $id})}
                } elseif ($body.action -eq 'group') {
                    Sync-Metadata
                    $groups=[Collections.Generic.Dictionary[string,object]]::new([StringComparer]::Ordinal)
                    $keys=[Collections.Generic.List[string]]::new()
                    foreach($task in $script:taskList){
                        $key=if($task.projectFound -and $task.projectKey){'project:'+$task.projectKey}else{'task:'+$task.id}
                        if(-not $groups.ContainsKey($key)){$groups[$key]=[Collections.Generic.List[object]]::new();$keys.Add($key)}
                        $groups[$key].Add($task)
                    }
                    $newList=@(foreach($key in $keys){Get-ProjectTaskOrder $groups[$key]})
                } else { throw '不支持的清单操作。' }
                $old=$script:taskList;$script:taskList=$newList
                try { Save-Tasks } catch { $script:taskList=$old;throw }
                Send-Json $context @{tasks=@($script:taskList)};continue
            }
            if ($request.HttpMethod -eq 'POST' -and $route -eq '/api/query') {
                $body=Read-Body $request;$id=([string]$body.id).Trim().ToLowerInvariant()
                $queryLanguage=if ($body.language) { [string]$body.language } else { $script:language }
                if ($queryLanguage -notin @('zh-CN','en-US')) { throw '语言无效。' }
                if (-not (Valid-Id $id) -or -not @($script:taskList | Where-Object { $_.id -eq $id }).Count) { throw '请先保存该任务。' }
                if ($Synthetic -and $id -notmatch '^00000000-0000-0000-0000-00000000000[1-3]$') { throw '本首版固定隔离验证模式：该 ID 没有虚构输入，不会读取真实会话。' }
                if ($jobs.ContainsKey($id) -and (Update-Job $jobs[$id]).state -eq 'running') {
                    if ($jobs[$id].language -ne $queryLanguage) { throw '查询进行中，请结束后切换语言。' }
                    Send-Json $context (Update-Job $jobs[$id]);continue
                }
                $active=0;foreach ($job in @($jobs.Values)) { if ((Update-Job $job).state -eq 'running') { $active++ } }
                if ($active -ge 2) { Send-Json $context @{error='已有两个查询正在运行，请稍后重试。'} 409;continue }
                $report=Join-Path $reports ($id+'.md')
                $metadata=Join-Path $reports ($id+'.metadata.json')
                if ([IO.File]::Exists($metadata)) { [IO.File]::Delete($metadata) }
                $info=New-Object Diagnostics.ProcessStartInfo
                $info.FileName=$powershell
                $info.Arguments='-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "'+(Join-Path $runtime 'Invoke-IsolatedAnalyzer.ps1')+'" -TaskId "'+$id+'" -ReportPath "'+$report+'"'
                $info.Arguments+=' -Language "'+$queryLanguage+'" -MetadataPath "'+$metadata+'"'
                $info.UseShellExecute=$false;$info.CreateNoWindow=$true;$info.RedirectStandardOutput=$true;$info.RedirectStandardError=$true
                $info.StandardOutputEncoding=$utf8;$info.StandardErrorEncoding=$utf8
                $process=New-Object Diagnostics.Process;$process.StartInfo=$info;[void]$process.Start()
                $job=@{id=$id;run=[guid]::NewGuid().ToString();state='running';output='';error='';finished=$null;started=[DateTime]::UtcNow;process=$process;stdout=$process.StandardOutput.ReadToEndAsync();stderr=$process.StandardError.ReadToEndAsync();report=$report;timedOut=$false}
                $job.language=$queryLanguage;$job.metadata=$metadata;$job.nameChange=$null;$job.metadataWarning=$false;$job.level='unknown';$job.score=$null;$job.contextPercent=$null
                $jobs[$id]=$job;Send-Json $context (Update-Job $job);continue
            }
            if ($request.HttpMethod -eq 'GET' -and $route -eq '/api/job') {
                $id=$request.QueryString['id'];if (-not (Valid-Id $id) -or -not $jobs.ContainsKey($id)) { Send-Json $context @{error='尚无本次运行的查询。'} 404;continue }
                Send-Json $context (Update-Job $jobs[$id]);continue
            }
            if ($request.HttpMethod -eq 'GET' -and $route -eq '/api/report') {
                $id=$request.QueryString['id'];if (-not (Valid-Id $id) -or -not $jobs.ContainsKey($id) -or (Update-Job $jobs[$id]).state -ne 'done') { Send-Json $context @{error='当前查询没有可用报告。'} 404;continue }
                Send-Json $context @{text=[IO.File]::ReadAllText($jobs[$id].report)};continue
            }
            if ($request.HttpMethod -eq 'POST' -and $route -eq '/api/shutdown') { foreach($job in @($jobs.Values)){Update-Job $job|Out-Null};Send-Json $context @{stopped=$true};$stopping=$true;continue }
            Send-Json $context @{error='接口不存在。'} 404
        } catch { try { Send-Json $context @{error=$_.Exception.Message} 400 } catch {} }
    }
} catch {
    [IO.File]::WriteAllText((Join-Path $data 'startup-error.txt'),$_.Exception.Message,$utf8)
    if (-not $NoBrowser) { Add-Type -AssemblyName System.Windows.Forms;[Windows.Forms.MessageBox]::Show($_.Exception.Message,'本地工作台启动失败') | Out-Null }
    throw
} finally {
    foreach ($job in @($jobs.Values)) { if ($job.state -eq 'running') { try { if (-not $job.process.HasExited) { $job.process.Kill();$job.process.WaitForExit() };$job.process.Dispose() } catch {} } }
    if ($listener) { $listener.Close() }
    if ($lockOwned -and [IO.File]::Exists($connectionPath)) { [IO.File]::Delete($connectionPath) }
    if ($lock) { $lock.Dispose() }
}
