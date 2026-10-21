import test from 'node:test';
import assert from 'node:assert/strict';
import {buildGithubEvidence,parseGithubCiArgs,REQUIRED_PUSH_WORKFLOWS} from '../../tools/github-ci-evidence.mjs';
const sha='2ef64c34a7774c970924fd3fe5fc7006da0e4d4a';
const make=(name,conclusion='success',extra={})=>({id:99,head_sha:sha,name,event:'push',status:'completed',conclusion,html_url:'https://github.com/TheBigTreeInc/social/actions/runs/99',created_at:'2026-10-20T17:20:28Z',...extra});
test('exact SHA CI evidence faithfully reports the real v0.3.74 browser UI failure instead of not_github',()=>{
 const list=REQUIRED_PUSH_WORKFLOWS.map(name=>make(name,name==='Tavi browser UI QA'?'failure':'success'));
 list.push(make('Tavi browser UI QA','success',{head_sha:'0'.repeat(40),created_at:'2026-10-20T20:30:00Z'}));
 list.push(make('Publish verified Tavi release','success',{event:'workflow_run'}));
 const report=buildGithubEvidence(sha,list,'2026-10-20T20:00:00Z');
 assert.equal(report.schema,'tavi.exact-commit-ci-evidence/v1');
 assert.equal(report.result,'failed');
 assert.deepEqual(report.counts,{passed:7,failed:1,pending:0,missing:0});
 assert.equal(report.required_push_workflows.find(x=>x.name==='Tavi browser UI QA').status,'failed');
 assert.equal(report.release_workflows.length,1);
});
test('CI evidence never counts a later different SHA, missing or in-progress workflows as passed',()=>{
 assert.equal(buildGithubEvidence(sha,[]).result,'missing');
 const list=REQUIRED_PUSH_WORKFLOWS.map(name=>make(name));
 list[1]={...list[1],status:'in_progress',conclusion:null};
 assert.equal(buildGithubEvidence(sha,list).result,'pending');
 assert.equal(buildGithubEvidence(sha,list.map(item=>({...item,head_sha:'b'.repeat(40)}))).counts.missing,8);
});
test('CI evidence requires an explicit commit SHA and safe repository name; output is opt-in',()=>{
 assert.deepEqual(parseGithubCiArgs(['--sha',sha]),{sha,repo:'TheBigTreeInc/social',output:''});
 assert.throws(()=>parseGithubCiArgs(['--sha','a'.repeat(64)]),/40-character/);
 assert.throws(()=>parseGithubCiArgs(['--sha',sha,'--repo','https://secrets.example/evil']),/Invalid owner/);
});
