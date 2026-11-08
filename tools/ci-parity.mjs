#!/usr/bin/env node
// ZipRunner project-owned prebuild CI parity. Runs exact CI command entry points
// against disposable browser fixtures; never contacts real user servers or publishes.
import {spawnSync} from 'node:child_process';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const profile=process.argv[2]==='--profile'?process.argv[3]:'prebuild';
if(profile!=='prebuild'){console.error('Unsupported CI parity profile');process.exit(2);}
const plan=JSON.parse(readFileSync(resolve(root,'ci-parity-plan.json'),'utf8'));
if(plan.schema!=='tavi.ci-parity-plan/v1'||!Array.isArray(plan.checks))throw Error('Invalid CI parity plan');
const dir=resolve(root,'qa-artifacts','ci-parity');
mkdirSync(dir,{recursive:true});
const report={schema:'tavi.ci-parity-report/v1',version:plan.version,profile,startedAt:new Date().toISOString(),checks:[],remoteOnly:plan.remoteOnly.map(check=>({...check,status:'not_executed'})),operatorAcceptance:'pending',release:'not_authorized'};
const save=()=>writeFileSync(resolve(dir,'report.json'),JSON.stringify({...report,completedAt:new Date().toISOString()},null,2)+'\n');
for(const check of plan.checks){
 if(!check.required||!Array.isArray(check.argv)||!check.argv.length)throw Error(`Invalid required parity check ${check.id}`);
 const [command,...args]=check.argv;
 console.log(`CI_PARITY_START ${check.id}: ${check.argv.join(' ')}`);
 const started=Date.now();
 const child=spawnSync(process.platform==='win32'&&command==='npm'?'npm.cmd':command,args,{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024,timeout:check.timeoutSeconds*1000,shell:process.platform==='win32'&&command==='npm'});
 const status=child.error?(child.error.code==='ENOENT'?'blocked':'failed'):child.status===0?'passed':'failed';
 const evidence={id:check.id,status,exitCode:child.status,elapsedMs:Date.now()-started,command:check.argv,githubWorkflows:check.githubWorkflows,reason:child.error?.message||null};
 report.checks.push(evidence);
 writeFileSync(resolve(dir,`${check.id}.log`),`${child.stdout||''}\n${child.stderr||''}\n${child.error||''}`);
 save();
 console.log(`CI_PARITY_${status.toUpperCase()} ${check.id} (${evidence.elapsedMs}ms)`);
 if(status!=='passed'){console.error(`CI parity blocked at ${check.id}; see ${dir}. Required checks never become skip/pass.`);process.exit(1);}
}
console.log('CI_PARITY_PASS all locally supported required checks');
