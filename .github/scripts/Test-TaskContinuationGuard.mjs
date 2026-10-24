import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { atomic, handleHook, prepare, runTask } from '../../实用小工具/Codex任务续执行守卫/guard.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const root = path.join(repo, '.planning/continuation-guard-tests', crypto.randomUUID());
fs.mkdirSync(root, { recursive: true });
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const json = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const checker = path.join(root, 'checker.cjs');
fs.writeFileSync(checker, `const fs=require('fs'); const p=require('path');
const f=p.join(process.cwd(),'result.json');
const log=process.env.TASK_GUARD_RUN_DIR&&p.join(process.env.TASK_GUARD_RUN_DIR,'cli.jsonl');
const answers=log&&fs.existsSync(log)?fs.readFileSync(log,'utf8').split('\\n').filter(Boolean).map(x=>JSON.parse(x)).filter(x=>x.type==='item.completed'&&x.item?.type==='agent_message'):[];
const value=answers.at(-1)?.item.text==='5'?{status:'PASS',reason:'independent arithmetic check: 2+3=5',progressKey:'answer-correct',pendingOperations:[]}:fs.existsSync(f)?JSON.parse(fs.readFileSync(f,'utf8')):{status:'ACTIONABLE_FAIL',reason:'目标产物缺失或当前答案不正确',progressKey:'missing',pendingOperations:[]};
console.log(JSON.stringify(value)); process.exit({PASS:0,ACTIONABLE_FAIL:10,WAIT:20,BLOCKED:21}[value.status]??30);
`);
const results = [];
function fixture(name) {
  const workspace = path.join(root, name); fs.mkdirSync(workspace);
  const contractFile = path.join(workspace, 'task.json');
  atomic(contractFile, { version: 1, workItem: `${name}-${path.basename(root)}`, cwd: '.', maxMinutes: 1, maxContinuations: 3, maxNoProgress: 2,
    checker: { executable: process.execPath, entry: checker, args: [checker], timeoutSeconds: 2, readOnly: true, network: 'none', idempotent: true, spawnsChildren: false,
      pins: [process.execPath, checker].map(file => ({ path: file, sha256: digest(file) })) } });
  return { workspace, contractFile, directory: path.join(root, `${name}-run`) };
}
const value = (status, progressKey = 'v1') => ({ status, reason: status === 'PASS' ? '产物已核验' : '尚待完成', progressKey, pendingOperations: [] });
function event(f, turn = 't1', active = false, message = '结束') {
  return { session_id: 'synthetic-session', cwd: f.workspace, turn_id: turn, hook_event_name: 'Stop', stop_hook_active: active, last_assistant_message: message };
}
function test(name, action) { action(); results.push({ name, pass: true }); }
async function asyncTest(name, action) { await action(); results.push({ name, pass: true }); }
test('未完成自动block；重复事件不追加预算；真正通过后停止续作', () => {
  const f = fixture('pending'); prepare(f.contractFile, f.directory);
  const a = handleHook(f.directory, event(f)); assert.equal(a.decision, 'block');
  assert.deepEqual(handleHook(f.directory, event(f)), a); assert.equal(json(path.join(f.directory, 'state.json')).continuations, 1);
  atomic(path.join(f.workspace, 'result.json'), value('PASS'));
  assert.deepEqual(handleHook(f.directory, event(f, 't2', true)), {});
  assert.equal(json(path.join(f.directory, 'state.json')).status, 'VERIFIED');
});
for (const state of ['WAIT', 'BLOCKED']) test(`${state}保留未完成且不复活`, () => {
  const f = fixture(state.toLowerCase()); prepare(f.contractFile, f.directory); atomic(path.join(f.workspace, 'result.json'), value(state));
  assert.equal(handleHook(f.directory, event(f)).continue, false);
  atomic(path.join(f.workspace, 'result.json'), value('PASS'));
  assert.equal(handleHook(f.directory, event(f, 't2')).continue, false);
  assert.equal(json(path.join(f.directory, 'state.json')).status, state);
});
test('同失败连续无进展上限', () => {
  const f = fixture('stalled'); prepare(f.contractFile, f.directory);
  handleHook(f.directory, event(f)); handleHook(f.directory, event(f, 't2', true));
  assert.equal(handleHook(f.directory, event(f, 't3', true)).continue, false);
  assert.equal(json(path.join(f.directory, 'state.json')).status, 'STALLED');
});
test('次数上限不随进展刷新', () => {
  const f = fixture('count'); const c=json(f.contractFile); c.maxContinuations=1; atomic(f.contractFile,c); prepare(f.contractFile, f.directory);
  handleHook(f.directory,event(f)); atomic(path.join(f.workspace,'result.json'),value('ACTIONABLE_FAIL','changed'));
  assert.equal(handleHook(f.directory,event(f,'t2',true)).continue,false);
  assert.equal(json(path.join(f.directory,'state.json')).status,'LIMIT');
});
test('截止时间、取消与在途工具不重放', () => {
  const f=fixture('deadline'); prepare(f.contractFile,f.directory);
  const s=json(path.join(f.directory,'state.json')); s.deadline=Date.now()-1; atomic(path.join(f.directory,'state.json'),s);
  assert.equal(handleHook(f.directory,event(f)).stopReason,'LIMIT');
  const g=fixture('cancel'); prepare(g.contractFile,g.directory); fs.writeFileSync(path.join(g.directory,'cancel'),'');
  assert.equal(handleHook(g.directory,event(g)).stopReason,'CANCELLED');
  const h=fixture('running'); prepare(h.contractFile,h.directory); atomic(path.join(h.workspace,'result.json'),value('PASS'));
  const pre={...event(h),hook_event_name:'PreToolUse',tool_use_id:'original-command'};
  handleHook(h.directory,pre); const blocked=handleHook(h.directory,event(h));
  assert.equal(blocked.decision,'block'); assert.match(blocked.reason,/不要重跑/);
  assert.equal(json(path.join(h.directory,'state.json')).checkCount,0);
  handleHook(h.directory,{...pre,hook_event_name:'PostToolUse',tool_response:'Process exited with code 0'});
  assert.deepEqual(handleHook(h.directory,event(h,'t2',true)),{});
});
test('未知/伪通过/验收器异常与篡改不能通过', () => {
  for (const [name,data] of [['unknown',value('unknown')],['inflight',{...value('PASS'),pendingOperations:['a']}],['bad',{}]]) {
    const f=fixture(name); prepare(f.contractFile,f.directory); atomic(path.join(f.workspace,'result.json'),data);
    assert.equal(handleHook(f.directory,event(f)).stopReason,'CHECKER_ERROR');
  }
  const f=fixture('tamper'); prepare(f.contractFile,f.directory); fs.appendFileSync(path.join(f.directory,'contract.json'),' ');
  assert.throws(()=>handleHook(f.directory,event(f)),/契约被修改/);
});
test('跨会话、重复prepare、锁竞争均拒绝', () => {
  const f=fixture('identity'); prepare(f.contractFile,f.directory); handleHook(f.directory,event(f));
  assert.throws(()=>handleHook(f.directory,{...event(f),session_id:'other'}),/会话不符/);
  assert.throws(()=>prepare(f.contractFile,f.directory));
  fs.writeFileSync(path.join(f.directory,'event.lock'),''); assert.throws(()=>handleHook(f.directory,event(f)));
});
test('后台会话返回不等于完成；回读原会话终态后才可验收', () => {
  const f=fixture('background'); prepare(f.contractFile,f.directory); atomic(path.join(f.workspace,'result.json'),value('PASS'));
  const pre={...event(f),hook_event_name:'PreToolUse',tool_use_id:'command',tool_name:'exec_command'};
  handleHook(f.directory,pre);
  handleHook(f.directory,{...pre,hook_event_name:'PostToolUse',tool_response:'Process running with session ID 42'});
  assert.equal(handleHook(f.directory,event(f)).decision,'block');
  assert.equal(json(path.join(f.directory,'state.json')).checkCount,0);
  const poll={...event(f),hook_event_name:'PreToolUse',tool_use_id:'poll',tool_name:'write_stdin',tool_input:{session_id:42}};
  handleHook(f.directory,poll);
  handleHook(f.directory,{...poll,hook_event_name:'PostToolUse',tool_response:'Session ID: 42\nstill working'});
  assert.equal(handleHook(f.directory,event(f,'t2',true)).decision,'block');
  handleHook(f.directory,{...poll,hook_event_name:'PostToolUse',tool_response:'Process exited with code 0'});
  assert.deepEqual(handleHook(f.directory,event(f,'t3',true)),{});
  assert.deepEqual(json(path.join(f.directory,'state.json')).activeTools,{});
});
test('命令结果未知仍在途；权限拒绝不继续碰运气', () => {
  for (const denied of [false,true]) {
    const f=fixture(denied?'host-denied':'unknown-command'); prepare(f.contractFile,f.directory);
    const pre={...event(f),hook_event_name:'PreToolUse',tool_use_id:'cmd',tool_name:'Bash'};
    handleHook(f.directory,pre);
    handleHook(f.directory,{...pre,hook_event_name:'PostToolUse',tool_response:denied?'rejected: blocked by policy':'unrecognized response'});
    const result=handleHook(f.directory,event(f));
    assert.equal(json(path.join(f.directory,'state.json')).checkCount,0);
    assert.equal(denied?result.stopReason:result.decision,denied?'BLOCKED':'block');
  }
});
test('取消优先于先前VERIFIED；相同续作事件保守停止', () => {
  const f=fixture('late-cancel'); prepare(f.contractFile,f.directory); atomic(path.join(f.workspace,'result.json'),value('PASS'));
  handleHook(f.directory,event(f)); fs.writeFileSync(path.join(f.directory,'cancel'),'');
  assert.equal(handleHook(f.directory,event(f,'t2')).stopReason,'CANCELLED');
  const g=fixture('same-stop'); prepare(g.contractFile,g.directory);
  handleHook(g.directory,event(g)); const repeated=event(g,'t1',true,'unchanged');
  handleHook(g.directory,repeated);
  assert.equal(handleHook(g.directory,repeated).stopReason,'STALLED');
  assert.equal(json(path.join(g.directory,'state.json')).continuations,2);
});
test('早先PASS不能代签后续活动或其他钩子要求的继续工作', () => {
  const f=fixture('pass-then-change'); prepare(f.contractFile,f.directory); atomic(path.join(f.workspace,'result.json'),value('PASS'));
  handleHook(f.directory,event(f));
  const pre={...event(f),hook_event_name:'PreToolUse',tool_use_id:'changed',tool_name:'exec_command'};
  handleHook(f.directory,pre); assert.equal(json(path.join(f.directory,'state.json')).status,'RUNNING');
  handleHook(f.directory,{...pre,hook_event_name:'PostToolUse',tool_response:'Process exited with code 0'});
  atomic(path.join(f.workspace,'result.json'),value('ACTIONABLE_FAIL','changed'));
  assert.equal(handleHook(f.directory,event(f,'t2',true)).decision,'block');
  const g=fixture('pass-then-stop'); prepare(g.contractFile,g.directory); atomic(path.join(g.workspace,'result.json'),value('PASS'));
  handleHook(g.directory,event(g)); atomic(path.join(g.workspace,'result.json'),value('ACTIONABLE_FAIL','other-hook-work'));
  assert.equal(handleHook(g.directory,event(g,'t2',true)).decision,'block');
});
test('固定真正的检查入口；拒绝任务内控制文件；检查脚本变化不能通过', () => {
  const f=fixture('no-entry-pin'); const c=json(f.contractFile); c.checker.pins=c.checker.pins.slice(0,1); atomic(f.contractFile,c);
  assert.throws(()=>prepare(f.contractFile,f.directory),/脚本入口未固定/);
  const g=fixture('inside-worktree'); const inside=path.join(g.workspace,'check.cjs'); fs.copyFileSync(checker,inside);
  const d=json(g.contractFile); d.checker.entry=inside; d.checker.args=[inside]; d.checker.pins=[process.execPath,inside].map(file=>({path:file,sha256:digest(file)})); atomic(g.contractFile,d);
  assert.throws(()=>prepare(g.contractFile,g.directory),/工作树之外/);
  const h=fixture('checker-change'); const outside=path.join(root,'pinned.cjs'); fs.copyFileSync(checker,outside);
  const e=json(h.contractFile); e.checker.entry=outside; e.checker.args=[outside]; e.checker.pins=[process.execPath,outside].map(file=>({path:file,sha256:digest(file)})); atomic(h.contractFile,e);
  prepare(h.contractFile,h.directory); fs.appendFileSync(outside,'\n// changed');
  assert.equal(handleHook(h.directory,event(h)).stopReason,'CHECKER_ERROR');
  const i=fixture('inside-controls'); assert.throws(()=>prepare(i.contractFile,path.join(i.workspace,'run')),/工作树之外/);
});

// Controllable owned child processes test launcher exits without starting models.
const fakeCli=path.join(root,'fake-cli.mjs');
fs.writeFileSync(fakeCli, `import fs from 'node:fs'; import path from 'node:path';
import {handleHook} from ${JSON.stringify(new URL('../../实用小工具/Codex任务续执行守卫/guard.mjs',import.meta.url).href)};
const dir=process.env.TEST_GUARD_DIR, mode=process.env.TEST_GUARD_MODE;
const contract=JSON.parse(fs.readFileSync(path.join(dir,'contract.json'),'utf8'));
if (mode.startsWith('verified')) handleHook(dir,{session_id:'owned-test',turn_id:'one',cwd:contract.cwd,hook_event_name:'Stop',stop_hook_active:false,last_assistant_message:'done'});
if (mode==='verified-cancel') fs.writeFileSync(path.join(dir,'cancel'),'');
if (mode==='verified-error') fs.writeFileSync(path.join(dir,'hook-error.json'),JSON.stringify({reason:'synthetic hook failure'}));
if (mode==='verified-bad-error') fs.writeFileSync(path.join(dir,'hook-error.json'),'{');
if (mode==='verified-tool') handleHook(dir,{session_id:'owned-test',turn_id:'one',cwd:contract.cwd,hook_event_name:'PreToolUse',tool_use_id:'later-tool',tool_name:'Bash'});
if (mode==='deadline') { const f=path.join(dir,'state.json'); const state=JSON.parse(fs.readFileSync(f,'utf8')); state.deadline=Date.now()-1; fs.writeFileSync(f,JSON.stringify(state)); }
if (mode==='wait-cancel') { setTimeout(()=>fs.writeFileSync(path.join(dir,'cancel'),''),50); setInterval(()=>{},1000); }
else process.exit(mode==='nonzero'?7:0);
`);
for (const [mode,expected] of [['no-stop','UNVERIFIED'],['nonzero','CLI_ERROR'],['verified','VERIFIED'],['verified-cancel','CANCELLED'],['verified-error','GUARD_ERROR'],['verified-bad-error','GUARD_ERROR'],['verified-tool','UNVERIFIED'],['deadline','LIMIT'],['wait-cancel','CANCELLED']]) {
  await asyncTest(`启动器核账：${mode} → ${expected}`,async()=>{
    const f=fixture(`exit-${mode}`); atomic(path.join(f.workspace,'result.json'),value('PASS'));
    const result=await runTask({contractFile:f.contractFile,directory:f.directory,prompt:'isolated fixture',codex:{file:process.execPath,prefix:[fakeCli]},env:{...process.env,TEST_GUARD_DIR:f.directory,TEST_GUARD_MODE:mode}});
    assert.equal(result.status,expected); assert.equal(result.verified,expected==='VERIFIED');
    assert.notEqual(json(path.join(f.directory,'state.json')).cliExit.code,undefined);
  });
}
await asyncTest('唯一登记独立于run-dir父目录；重复启动不创建第二运行',async()=>{
  const f=fixture('same-work-item');
  await runTask({contractFile:f.contractFile,directory:f.directory,prompt:'fixture',codex:{file:process.execPath,prefix:[fakeCli]},env:{...process.env,TEST_GUARD_DIR:f.directory,TEST_GUARD_MODE:'no-stop'}});
  const otherParent=path.join(root,'different-parent'); fs.mkdirSync(otherParent); const other=path.join(otherParent,'second-run');
  await assert.rejects(runTask({contractFile:f.contractFile,directory:other,prompt:'must not run',codex:{file:process.execPath,prefix:[fakeCli]}}),/工作项已登记/);
  assert.equal(fs.existsSync(other),false);
});
await asyncTest('同工作项并发更换父目录仍受同一owner锁保护',async()=>{
  const f=fixture('concurrent'); const otherParent=path.join(root,'concurrent-parent'); fs.mkdirSync(otherParent); const other=path.join(otherParent,'second-run');
  const first=runTask({contractFile:f.contractFile,directory:f.directory,prompt:'owned fixture',codex:{file:process.execPath,prefix:[fakeCli]},env:{...process.env,TEST_GUARD_DIR:f.directory,TEST_GUARD_MODE:'wait-cancel'}});
  try {
    await assert.rejects(runTask({contractFile:f.contractFile,directory:other,prompt:'must not start',codex:{file:process.execPath,prefix:[fakeCli]}}),/本工作项已有锁/);
    assert.equal(fs.existsSync(other),false);
  } finally { fs.writeFileSync(path.join(f.directory,'cancel'),''); assert.equal((await first).status,'CANCELLED'); }
});

// Local model simulator: real codex-cli must consume Stop's continuation and
// produce a verifiably correct answer. No OpenAI/Magpie model endpoint or saved auth is used.
const cliIndex=process.argv.indexOf('--codex-js');
if(cliIndex>=0) {
  const cli=path.resolve(process.argv[cliIndex+1]);
  const apiCalls=[];
  const server=http.createServer(async(req,res)=>{
    let body=''; for await(const chunk of req) body+=chunk;
    const payload=JSON.parse(body); apiCalls.push(payload);
    atomic(path.join(root,'requests.json'),apiCalls);
    const phase=apiCalls.length;
    const item={type:'message',id:`msg_${phase}`,role:'assistant',phase:'final_answer',content:[{type:'output_text',text:phase===1?'4':'5'}]};
    res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache'});
    const emit=(type,extra)=>res.write(`event: ${type}\ndata: ${JSON.stringify({type,...extra})}\n\n`);
    emit('response.created',{response:{id:`resp_${phase}`,status:'in_progress',output:[]}});
    emit('response.output_item.added',{output_index:0,item});
    emit('response.output_item.done',{output_index:0,item});
    emit('response.completed',{response:{id:`resp_${phase}`,status:'completed',output:[item],usage:{input_tokens:50,output_tokens:10,total_tokens:60}}});
    res.end();
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${server.address().port}/v1`;
  const env={...process.env,CODEX_HOME:path.join(root,'isolated-home'),RUST_LOG:'codex_hooks=debug,codex_core::hook_runtime=debug'}; fs.mkdirSync(env.CODEX_HOME);
  for(const key of Object.keys(env)) if(/^(OPENAI|CODEX_API|MAGPIE|ANTHROPIC)/i.test(key)) delete env[key];
  const config=[`model_provider="guard_mock"`,`model="gpt-5.4"`,`model_providers.guard_mock={name="local fixture",base_url="${url}",wire_api="responses",requires_openai_auth=false}`,`mcp_servers={}`,`features.unified_exec=true`];
  try {
    const baseline=fixture('cli-baseline');
    const args=[cli,'--no-daemon','-a','never',...config.flatMap(c=>['-c',c]),'exec','--ephemeral','--json','--skip-git-repo-check','-C',baseline.workspace,'stop now'];
    const baselineLog=fs.openSync(path.join(root,'baseline.jsonl'),'w');
    const baselineCode=await new Promise(resolve=>{
      const proc=spawn(process.execPath,args,{env,windowsHide:true,stdio:['ignore',baselineLog,baselineLog]});
      const timeout=setTimeout(()=>proc.kill(),45000);
      proc.on('close',code=>{clearTimeout(timeout);resolve(code);});
    }); fs.closeSync(baselineLog);
    assert.equal(baselineCode,0,`baseline failed; see ${root}`);
    assert.equal(apiCalls.length,1); assert.equal(fs.existsSync(path.join(baseline.workspace,'result.json')),false);
    results.push({name:'红色基线：真实CLI退出0，但目标产物缺失',pass:true});
    apiCalls.length=0;
    // A pre-existing user-layer Stop hook must still run after CLI injection.
    const marker=path.join(root,'existing-hook.txt');
    const markerScript=path.join(root,'existing-hook.cjs');
    fs.writeFileSync(markerScript,`require('fs').appendFileSync(${JSON.stringify(marker)},'observed\\n'); console.log('{}');`);
    const oldCommand=`node "${markerScript}"`;
    fs.writeFileSync(path.join(env.CODEX_HOME,'config.toml'),`[hooks]\nStop = [{ hooks = [{ type = "command", command = ${JSON.stringify(oldCommand)}, timeout = 3 }] }]\n`);
    const f=fixture('cli-guarded');
    const result=await runTask({contractFile:f.contractFile,directory:f.directory,prompt:'Compute 2+3. Output the integer only. This is an isolated local host lifecycle fixture; no tools or other tasks are needed.',codex:{file:process.execPath,prefix:[cli]},extraConfig:config,env});
    assert.equal(result.verified,true,`guard result=${JSON.stringify(result)}; see ${root}`);
    assert.equal(result.continuations,1); assert.ok(result.stopCount>=2); assert.equal(apiCalls.length,2);
    const executed=fs.readFileSync(path.join(f.directory,'cli.jsonl'),'utf8').trim().split('\n').map(JSON.parse).filter(x=>x.type==='item.completed'&&x.item?.type==='command_execution'&&x.item.exit_code===0);
    assert.equal(executed.length,0);
    assert.ok(JSON.stringify(apiCalls[1]).includes('独立验收尚未通过'),'host did not consume hook prompt');
    results.push({name:'真实CLI：错误答案final→独立算术验收失败→同回合自动续作→正确答案→验收通过；业务命令0次',pass:true,requests:apiCalls.length});
    assert.ok(fs.existsSync(marker)&&fs.readFileSync(marker,'utf8').includes('observed'),'existing Stop hook was overridden');
    results.push({name:'真实CLI兼容：已有用户层Stop钩子与本次守卫均被执行',pass:true});
  } finally { await new Promise(resolve=>server.close(resolve)); }
}
atomic(path.join(root,'result.json'),{pass:true,results,coverage:cliIndex>=0?'unit-and-real-cli-mock-provider':'unit-only'});
console.log(JSON.stringify({pass:true,checks:results.length,evidence:path.relative(repo,path.join(root,'result.json'))}));
