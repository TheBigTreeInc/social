#!/usr/bin/env node
// Read-only public GitHub Actions evidence for ONE explicit, exact commit SHA.
// No Git push, workflow dispatch, release creation, or local checkout mutation.
import {mkdir,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export const REQUIRED_PUSH_WORKFLOWS=Object.freeze([
 'Verify Social server and client source',
 'Web browser client and JavaScript SDK',
 'Tavi browser UI QA',
 'Windows desktop app',
 'Android phone app',
 'Linux and macOS desktop installers',
 'SDK cross-platform checks',
 'SDK source packages and OpenClaw bridge',
]);
const githubRepo=/^[\w.-]+\/[\w.-]+$/;
const githubSha=/^[a-f0-9]{40}$/i;
export function buildGithubEvidence(sha,runs,at=new Date().toISOString()){
 if(!githubSha.test(sha))throw new TypeError('An exact 40-character commit SHA is required');
 if(!Array.isArray(runs))throw new TypeError('GitHub workflow runs must be an array');
 const exact=runs.filter(r=>r&&r.head_sha===sha&&r.event==='push');
 const statuses=REQUIRED_PUSH_WORKFLOWS.map(name=>{
  const matches=exact.filter(run=>run.name===name).sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))||Number(b.id||0)-Number(a.id||0));
  const latest=matches[0];
  const status=!latest?'missing':latest.status!=='completed'?'pending':latest.conclusion==='success'?'passed':latest.conclusion==='failure'||latest.conclusion==='timed_out'||latest.conclusion==='cancelled'?'failed':'pending';
  return {name,status,...(latest?{run_id:latest.id,conclusion:latest.conclusion||null,url:latest.html_url||null}:{})};
 });
 const counts={passed:statuses.filter(x=>x.status==='passed').length,failed:statuses.filter(x=>x.status==='failed').length,pending:statuses.filter(x=>x.status==='pending').length,missing:statuses.filter(x=>x.status==='missing').length};
 return {schema:'tavi.exact-commit-ci-evidence/v1',sha,checked_at:at,source:'GitHub Actions public workflow runs',result:counts.failed?'failed':counts.missing?'missing':counts.pending?'pending':'passed',counts,required_push_workflows:statuses,release_workflows:runs.filter(r=>r?.head_sha===sha&&r.event==='workflow_run'&&r.name==='Publish verified Tavi release').map(r=>({run_id:r.id,conclusion:r.conclusion||null,url:r.html_url||null}))};
}
export function parseGithubCiArgs(argv){
 let sha='',repo='TheBigTreeInc/social',output='';
 for(let i=0;i<argv.length;i++){
  if(argv[i]==='--sha')sha=argv[++i]||'';
  else if(argv[i]==='--repo')repo=argv[++i]||'';
  else if(argv[i]==='--output')output=argv[++i]||'';
  else throw new TypeError(`Unknown argument: ${argv[i]}`);
 }
 if(!githubSha.test(sha))throw new TypeError('Use --sha with the exact 40-character Git commit ID (not a ZIP checksum)');
 if(!githubRepo.test(repo))throw new TypeError('Invalid owner/repository');
 return {sha,repo,output};
}
async function main(){
 const opts=parseGithubCiArgs(process.argv.slice(2));
 const target=`https://api.github.com/repos/${opts.repo}/actions/runs?head_sha=${opts.sha}&per_page=100`;
 const response=await fetch(target,{headers:{Accept:'application/vnd.github+json','User-Agent':'Tavi-ZipRunner-CI-evidence'},signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error(`GitHub public workflow query failed: HTTP ${response.status}`);
 const result=await response.json();
 if(!Array.isArray(result.workflow_runs)||result.total_count>100)throw Error('Incomplete workflow listing; do not infer exact-commit success');
 const report=buildGithubEvidence(opts.sha,result.workflow_runs);
 const encoded=JSON.stringify(report,null,2)+'\n';
 if(opts.output){const path=resolve(opts.output);await mkdir(dirname(path),{recursive:true});await writeFile(path,encoded);}
 console.log(encoded);
 if(report.result!=='passed')process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 main().catch(error=>{console.error(`TAVI_GITHUB_CI_EVIDENCE_BLOCKED: ${error.message}`);process.exitCode=2;});
}
