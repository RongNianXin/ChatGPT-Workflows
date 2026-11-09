import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { classifyNavigationChanges, inspectRepositoryValidationScope, manualPath, metadataPath,
  manifestPath, versionPaths, recordPaths, navigationRecord } from './Inspect-RepositoryValidationScope.mjs';
import { scenarioCatalog, validateOperatorManual } from './Test-OperatorManualReferences.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const oldManual = '# Manual\n\n## 目录\n1. [场景七](#scenario-general)\n\n## 快速上手\nBody and permissions unchanged\n';
const newManual = oldManual.replace('1. [场景七](#scenario-general)', '1. [场景七](#scenario-general)\n   - [Gen1：长任务](#scenario-goal)');
let count = 0;
const check = (name, fn) => { fn(); count++; console.log('PASS: '+name); };
const change = (p, before, after) => ({path:p,before:Buffer.from(before),after:Buffer.from(after),mode:'100644'});
const base = () => [change(manualPath,oldManual,newManual)];
const classify = changes => classifyNavigationChanges(changes, p => changes.find(c=>c.path===p)?.after ?? Buffer.from(newManual));
check('navigation-only candidate qualifies', () => assert.equal(classify(base()).profile,'Navigation'));
check('no changes do not certify a release', () => assert.equal(classify([]).profile,'Full'));
for (const [name,p,before,after] of [
  ['runtime code','.github/scripts/Takeover-Handoff.mjs','old','new'],
  ['checker code','.github/scripts/Test-OperatorManualReferences.mjs','old','new'],
  ['unknown document','notes.md','old','new'],
  ['permission entry','AGENTS.md','old','new'],
  ['retrospective prose','总指挥工作流/第二代总指挥的工作模式/06-复盘与优化规则.md','old','new'],
  ['rule body',versionPaths[2],'版本：2026-11-06.1\nAllowed','版本：2026-11-06.2\nAll rights']
]) check(name+' requires full checks',()=>assert.equal(classify([...base(),change(p,before,after)]).profile,'Full'));
check('manual body change requires full checks',()=>assert.equal(classify([change(manualPath,oldManual,newManual.replace('Body','Modified body'))]).profile,'Full'));
check('manual prefix change requires full checks',()=>assert.equal(classify([change(manualPath,oldManual,newManual.replace('# Manual','# Other'))]).profile,'Full'));
for (const payload of ['<script>bad</script>','执行其他操作','```text\n1. [Gen](#goal)\n```','1. [Gen](https://example.invalid)']) {
  check('non-directory content cannot qualify: '+payload.slice(0,15),()=>assert.equal(classify([change(manualPath,oldManual,newManual.replace('## 快速上手',payload+'\n## 快速上手'))]).profile,'Full'));
}
check('ambiguous directory boundary requires full checks',()=>assert.equal(classify([change(manualPath,oldManual,newManual+'## 目录\n')]).profile,'Full'));
for (const mode of ['100755','120000','160000']) check('non-regular file mode '+mode,()=>assert.equal(classify([{...base()[0],mode}]).profile,'Full'));
check('deletion requires full checks',()=>assert.equal(classify([{...base()[0],after:null}]).profile,'Full'));
check('new file requires full checks',()=>assert.equal(classify([{...base()[0],before:null}]).profile,'Full'));
check('version-only metadata is allowed',()=>assert.equal(classify([...base(),change(versionPaths[0],'版本：2026-11-06.1\nSame','版本：2026-11-06.2\nSame')]).profile,'Navigation'));
for (const p of recordPaths) {
  const old='# Record\n\nOld content\n', entry='\n## 2026-11-06：操作手册导航维护\n\n'+navigationRecord+'\n';
  check('fixed navigation record is allowed: '+p,()=>assert.equal(classify([...base(),change(p,old,old.replace('\n','\n'+entry))]).profile,'Navigation'));
  check('record cannot hide a policy addition: '+p,()=>assert.equal(classify([...base(),change(p,old,old.replace('\n','\n'+entry+'Grant all rights\n'))]).profile,'Full'));
}
const priorMeta={schema_version:1,manual_sha256:sha(Buffer.from(oldManual)),sections:[{anchor:'same'}]};
const nextMeta={...priorMeta,manual_sha256:sha(Buffer.from(newManual))};
check('bound manual metadata is allowed',()=>assert.equal(classify([...base(),change(metadataPath,JSON.stringify(priorMeta),JSON.stringify(nextMeta))]).profile,'Navigation'));
check('wrong manual metadata digest requires full checks',()=>assert.equal(classify([...base(),change(metadataPath,JSON.stringify(priorMeta),JSON.stringify({...nextMeta,manual_sha256:'a'.repeat(64)}))]).profile,'Full'));
check('changed metadata sections require full checks',()=>assert.equal(classify([...base(),change(metadataPath,JSON.stringify(priorMeta),JSON.stringify({...nextMeta,sections:[]}))]).profile,'Full'));
const priorManifest={schema_version:1,rule_version:'2026-11-06.1',rules:[{path_ref:'01-操作者操作手册.md',sha256:sha(Buffer.from(oldManual)).toUpperCase()}]};
const nextManifest={...priorManifest,rule_version:'2026-11-06.2',rules:[{...priorManifest.rules[0],sha256:sha(Buffer.from(newManual)).toUpperCase()}]};
const withManifest = next => [...base(),change(manifestPath,JSON.stringify(priorManifest),JSON.stringify(next))];
check('bound manifest digest update is allowed',()=>assert.equal(classify(withManifest(nextManifest)).profile,'Navigation'));
check('incorrect manifest digest requires full checks',()=>assert.equal(classify(withManifest({...nextManifest,rules:[{...nextManifest.rules[0],sha256:'a'.repeat(64)}]})).profile,'Full'));
check('manifest policy change requires full checks',()=>assert.equal(classify(withManifest({...nextManifest,scope:'other'})).profile,'Full'));
check('manifest member addition requires full checks',()=>assert.equal(classify(withManifest({...nextManifest,rules:[...nextManifest.rules,{path_ref:'other',sha256:'a'.repeat(64)}]})).profile,'Full'));
check('malformed metadata requires full checks',()=>assert.equal(classify([...base(),change(metadataPath,'{}','{')]).profile,'Full'));
const realManual=fs.readFileSync(path.join(root,manualPath),'utf8');
const realMetadata=JSON.parse(fs.readFileSync(path.join(root,metadataPath),'utf8'));
const tocStart=realManual.indexOf('## 目录\n'),tocEnd=realManual.indexOf('## 快速上手\n');
const realToc=realManual.slice(tocStart,tocEnd);
const goalLine=realToc.split('\n').find(line=>line.includes('](#scenario-goal-mode)'));
assert.ok(goalLine,'real named Gen1 entry required');
for (const [name,edit] of [
  ['missing',toc=>toc.replace(goalLine+'\n','')],
  ['duplicate',toc=>toc.replace(goalLine,goalLine+'\n'+goalLine)],
  ['insufficient indentation',toc=>toc.replace(goalLine,goalLine.trimStart())],
  ['broken link',toc=>toc.replace('#scenario-goal-mode','#missing-target')],
  ['wrong title',toc=>toc.replace(goalLine,goalLine.replace('长任务 Goal 模式','旧标题'))]
]) check('selected navigation still rejects actual manual '+name,()=>{
  const altered=realManual.slice(0,tocStart)+edit(realToc)+realManual.slice(tocEnd);
  assert.equal(classifyNavigationChanges([change(manualPath,realManual,altered)],()=>Buffer.from(altered)).profile,'Navigation');
  assert.equal(validateOperatorManual(altered,scenarioCatalog(altered),{...realMetadata,manual_sha256:sha(Buffer.from(altered))}).status,'FAIL');
});

const parent=path.join(root,'.codex-manual-cache','validation-scope-tests');
fs.mkdirSync(parent,{recursive:true});
execFileSync('git',['-C',root,'check-ignore','--quiet','--',parent]);
const fixture=fs.mkdtempSync(path.join(parent,'case-'));
const hooks=path.join(fixture,'.empty-hooks');fs.mkdirSync(hooks);
const git=args=>execFileSync('git',['-c','core.hooksPath='+hooks,'-c','commit.gpgSign=false','-c','core.autocrlf=false','-C',fixture,...args],{windowsHide:true,encoding:'utf8',timeout:15000});
git(['init','--quiet','--initial-branch=main','--template=']);
const write=(p,t)=>{fs.mkdirSync(path.dirname(path.join(fixture,p)),{recursive:true});fs.writeFileSync(path.join(fixture,p),t);};
write(manualPath,oldManual);write('runtime.mjs','old\n');
git(['add','--',manualPath,'runtime.mjs']);git(['-c','user.name=Synthetic Test','-c','user.email=test@example.invalid','commit','--quiet','-m','baseline']);
write(manualPath,newManual);
check('real unstaged Git navigation change qualifies',()=>assert.equal(inspectRepositoryValidationScope(fixture).profile,'Navigation'));
git(['add','--',manualPath]);
check('real staged Git navigation change qualifies',()=>assert.equal(inspectRepositoryValidationScope(fixture).profile,'Navigation'));
write('untracked.txt','not in candidate');
check('untracked candidate exclusion is explicit',()=>assert.equal(inspectRepositoryValidationScope(fixture).untracked_excluded,1));
check('explicit new file input upgrades to full',()=>assert.equal(inspectRepositoryValidationScope(fixture,{additionalPaths:['untracked.txt']}).profile,'Full'));
write(manualPath,newManual.replace('Gen1','Gen2'));
check('different staged and working edits block candidate certification',()=>assert.equal(inspectRepositoryValidationScope(fixture).profile,'Blocked'));
write(manualPath,oldManual);
check('worktree cannot hide a staged change',()=>assert.equal(inspectRepositoryValidationScope(fixture).profile,'Blocked'));
write(manualPath,newManual);git(['add','--',manualPath]);write('runtime.mjs','changed\n');
check('mixed staged and working candidates block even on disjoint files',()=>assert.equal(inspectRepositoryValidationScope(fixture).profile,'Blocked'));
git(['add','--','runtime.mjs']);
check('unknown real runtime change upgrades to full',()=>assert.equal(inspectRepositoryValidationScope(fixture).profile,'Full'));
write('runtime.mjs','old\n');git(['update-index','--assume-unchanged','--','runtime.mjs']);
check('index flag blocks uncertifiable runtime edits',()=>assert.equal(inspectRepositoryValidationScope(fixture).profile,'Blocked'));
write(manualPath,newManual.replace('Gen1','Gen2'));
check('unrelated hidden flag cannot bypass staged/worktree mismatch',()=>assert.equal(inspectRepositoryValidationScope(fixture).profile,'Blocked'));
git(['update-index','--no-assume-unchanged','--','runtime.mjs']);
check('unavailable repository requires full',()=>assert.equal(inspectRepositoryValidationScope(path.join(fixture,'missing')).profile,'Full'));

// Exercise the real PowerShell entry's selection without starting unrelated long suites.
for(const name of ['Test-Repository.ps1','Inspect-RepositoryValidationScope.mjs']) write('.github/scripts/'+name,fs.readFileSync(path.join(root,'.github/scripts',name)));
git(['add','--','.github/scripts/Test-Repository.ps1','.github/scripts/Inspect-RepositoryValidationScope.mjs']);
// Establish the installed entry as baseline while preserving a navigation candidate.
write(manualPath,oldManual);git(['add','--',manualPath,'runtime.mjs']);git(['-c','user.name=Synthetic Test','-c','user.email=test@example.invalid','commit','--quiet','-m','installed entry']);write(manualPath,newManual);
const plan=mode=>{
  const r=spawnSync('pwsh',['-NoProfile','-File',path.join(fixture,'.github/scripts/Test-Repository.ps1'),'-Mode',mode,'-PlanOnly'],{encoding:'utf8',windowsHide:true,timeout:30000});
  assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);
};
check('real PowerShell Auto selects navigation with PlanOnly',()=>assert.equal(plan('Auto').profile,'Navigation'));
check('real PowerShell default/full keeps complete selection',()=>assert.equal(plan('Full').profile,'Full'));
write('runtime.mjs','changed\n');
check('real PowerShell Auto upgrades code edits to full',()=>assert.equal(plan('Auto').profile,'Full'));
git(['add','--',manualPath]);write(manualPath,newManual.replace('Gen1','Gen2'));
for (const flag of ['assume-unchanged','skip-worktree']) {
  git(['update-index','--'+flag,'--','runtime.mjs']);
  for (const mode of ['Auto','Full']) check('real PowerShell '+mode+' blocks mismatch with '+flag,()=>{
    const result=spawnSync('pwsh',['-NoProfile','-File',path.join(fixture,'.github/scripts/Test-Repository.ps1'),'-Mode',mode,'-PlanOnly'],{encoding:'utf8',windowsHide:true,timeout:30000});
    assert.notEqual(result.status,0);assert.match(result.stderr,/Index flags|Index and worktree/);
  });
  git(['update-index','--no-'+flag,'--','runtime.mjs']);
}
const entry=fs.readFileSync(path.join(root,'.github/scripts/Test-Repository.ps1'),'utf8');
check('CI still calls default full entry',()=>{
  const ci=fs.readFileSync(path.join(root,'.github/workflows/repository-quality.yml'),'utf8');
  assert.match(ci,/run: \.\/\.github\/scripts\/Test-Repository\.ps1\s*$/m);assert.doesNotMatch(ci,/-Mode Auto/);
});
check('navigation selection binds final bytes',()=>assert.match(entry,/finalSelection\.candidate_sha256 -ne \$validationSelection\.candidate_sha256/));
check('full suite and navigation suite both run the scope tests',()=>assert.equal((entry.match(/Test-RepositoryValidationScope\.mjs/g)||[]).length,2));
// Integration harness for branch wiring: use the real entry/selector, explicitly replace
// the leaf checks with recording stubs. Actual leaf validators are tested separately.
const leafNames=['Test-RepositoryValidationScope.mjs','Test-OperatorManualReferences.mjs',
  'Test-WorkflowRefreshContract.mjs','Test-Inspect-RuleRefresh.mjs','Test-OperatorManualExternalEntries.mjs','Inspect-RuleRefresh.mjs'];
for(const name of leafNames) write('.github/scripts/'+name,
  `import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');fs.appendFileSync(path.join(root,'branch.log'),${JSON.stringify(name+'\n')});`+
  (name==='Inspect-RuleRefresh.mjs'?'console.log(JSON.stringify({result:"PASS"}));':''));
const functionNames=['Test-RepositoryPathPortability','Test-MarkdownFiles','Test-BilingualReadmes','Test-PowerShellFiles','Test-CommanderRuleVersion'];
const stubFunctions=functionNames.map(name=>'function '+name+' { Add-Content -LiteralPath (Join-Path $repoRoot "branch.log") -Value "'+name+'" }').join('\n');
write('.github/scripts/Test-Repository.ps1',entry.replace('$validationSelection = @{ profile',stubFunctions+'\n$validationSelection = @{ profile'));
write('runtime.mjs','old\n');write(manualPath,oldManual);
git(['add','--','runtime.mjs',manualPath,'.github/scripts']);git(['-c','user.name=Synthetic Test','-c','user.email=test@example.invalid','commit','--quiet','-m','branch harness']);write(manualPath,newManual);
const executeBranch=()=>spawnSync('pwsh',['-NoProfile','-File',path.join(fixture,'.github/scripts/Test-Repository.ps1'),'-Mode','Auto'],{encoding:'utf8',windowsHide:true,timeout:30000});
check('actual navigation branch invokes all mandatory leaves and no long suites (stub harness)',()=>{
  const result=executeBranch();assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/PASS \(navigation scope only/);
  const called=fs.readFileSync(path.join(fixture,'branch.log'),'utf8').split(/\r?\n/).filter(Boolean);
  assert.deepEqual(called,[...functionNames,...leafNames]);
});
const mutator="import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');const p=path.join(root,"+JSON.stringify(manualPath)+");fs.writeFileSync(p,fs.readFileSync(p,'utf8').replace('Gen1','Gen2'));";
write('.github/scripts/Test-OperatorManualExternalEntries.mjs',mutator);
write(manualPath,oldManual);git(['add','--',manualPath,'.github/scripts/Test-OperatorManualExternalEntries.mjs']);git(['-c','user.name=Synthetic Test','-c','user.email=test@example.invalid','commit','--quiet','-m','mutating leaf harness']);write(manualPath,newManual);
check('actual branch rejects candidate mutation during checks (stub harness)',()=>{
  const result=executeBranch();assert.notEqual(result.status,0);assert.match(result.stderr,/候选改变/);
});
console.log(`Repository validation scope: PASS (${count} cases; real Git/PowerShell selection and stubbed branch wiring; no remote or full-suite execution)`);
