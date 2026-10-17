import test from 'node:test';
import assert from 'node:assert/strict';
import {reportEndpoint,reportPayload,sendBugReport} from '../src/bug-report.js';
test('uses LoopRD infrastructure endpoint and rejects URL credentials',()=>{
 assert.equal(reportEndpoint('https://api.thebigtree.life/'),'https://api.thebigtree.life/looprd/looprd-social/v1/_bugreports');
 assert.throws(()=>reportEndpoint('https://user:secret@api.thebigtree.life/'));
 assert.throws(()=>reportEndpoint('https://api.thebigtree.life/?token=secret'));
});
test('sanitizes untrusted diagnostic field names',()=>{
 const p=reportPayload({version:'0.3.39',platform:'Android',stage:'password=test',code:'Bearer something'});
 assert.equal(p.errorCode,'LOGIN_FAILED');assert.equal(p.diagnostics.stage,'login');
 assert.ok(!JSON.stringify(p).includes('Bearer something'));
});
test('consented report returns a LoopRD issue ID without user credentials',async()=>{
 let sent;const value=await sendBugReport({origin:'https://api.thebigtree.life/',version:'0.3.39',platform:'Android',stage:'login',code:'LOGIN_FAILED',fetcher:async(url,opts)=>{sent={url,opts};return {status:202,json:async()=>({id:'issue-example',deduplicated:false})}}});
 assert.equal(value.id,'issue-example');assert.equal(JSON.parse(sent.opts.body).apiVersion,'looprd-bugreport/v1');
 assert.equal(sent.opts.headers.Authorization,'Bearer tavi_guest_v1');
 assert.ok(!sent.opts.body.includes('password'));
});
test('report rejection is a visible failure, not recursive reporting',async()=>{
 await assert.rejects(sendBugReport({origin:'https://api.thebigtree.life/',version:'0.3.39',platform:'Android',fetcher:async()=>({status:404})}),/does not support/);
});
