import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {replyText,replyChunks,parseAgentHelp,invokeAgent,createAgentConsumer} from '../tavi-openclaw-service.mjs';
import {reconcileInbox,readCheckpoint} from '../tavi-watch.mjs';

test('long replies are not silently lost, split into bounded numbered DMs', async()=>{
 const long='x'.repeat(2150);
 assert.equal(replyText({result:{payloads:[{text:long}]}}),long);
 const chunks=replyChunks(long);
 assert.equal(chunks.length,3);
 chunks.forEach((value,i)=>{assert(value.startsWith(`(${i+1}/3) `));assert([...value].length<=1000);});
 assert.equal(chunks.map(x=>x.replace(/^\(\d+\/\d+\) /,'')).join(''),long);
 const sent=[];
 const consumer=createAgentConsumer({api:{directSend:async(...args)=>sent.push(args)},peers:new Set(['acct_2']),runAgent:async()=>({payloads:[{text:long}]}),sleep:async()=>{}});
 assert.equal(await consumer({peer:'acct_2',id:1,text:'hello'}),true);
 assert.equal(sent.length,3);
});
test('Unicode and forbidden controls never cause truncated or invalid sends',()=>{
 const value='💚'.repeat(1100);
 assert.equal(replyChunks(value).length,2);
 assert(replyChunks(value).every(s=>[...s].length<=1000));
 assert.throws(()=>replyChunks('a'.repeat(24*900+1)),/exceeds/);
 assert.throws(()=>replyChunks('hello\u0001world'),/unsupported control/);
 assert.deepEqual(replyChunks('short'),['short']);
});
test('delivery errors prevent read acknowledgement and cursor advance',async()=>{
 const sent=[];
 const api={origin:'https://example.org',me:async()=>({profile:{profileId:'acct_1'}}),contacts:async()=>({contacts:[{id:'acct_2',status:'accepted'}]}),directFeed:async()=>({messages:[{id:9,authorId:'acct_2',text:'hi'}]}),directSend:async(peer,text)=>{sent.push(text);if(sent.length===2)throw Error('send failed');},markDirectRead:async()=>assert.fail('should not mark read')};
 const consumer=createAgentConsumer({api,peers:new Set(['acct_2']),runAgent:async()=>({payloads:[{text:'x'.repeat(1200)}]}),sleep:async()=>{}});
 const cp={schema:'tavi.openclaw.inbox/v1',origin:api.origin,selfId:'acct_1',peers:{acct_2:0}};
 await assert.rejects(reconcileInbox({api,checkpoint:cp,onMessage:consumer}),/send failed/);
 assert.equal(cp.peers.acct_2,0);
});
test('receipts can fail and retry without resending a delivered answer',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'tavi-receipt-test-'));const path=join(dir,'cp.json');
 try{
  let sends=0,receipts=0;
  const api={origin:'https://example.org',me:async()=>({profile:{profileId:'acct_1'}}),contacts:async()=>({contacts:[{id:'acct_2',status:'accepted'}]}),directFeed:async()=>({messages:[{id:9,authorId:'acct_2',text:'hi'}]}),directSend:async()=>{sends++;},markDirectRead:async()=>{receipts++;if(receipts===1)throw Error('temporarily down');}};
  const cp={schema:'tavi.openclaw.inbox/v1',origin:api.origin,selfId:'acct_1',peers:{acct_2:0}};
  const consumer=createAgentConsumer({api,peers:new Set(['acct_2']),runAgent:async()=>({payloads:[{text:'ok'}]})});
  await assert.rejects(reconcileInbox({api,checkpoint:cp,onMessage:consumer,path}),/temporarily down/);
  assert.equal(sends,1);assert.equal(cp.peers.acct_2,9);assert.equal(cp.pendingReads.acct_2,9);
  await reconcileInbox({api,checkpoint:await readCheckpoint(path),onMessage:consumer,path});
  assert.equal(sends,1);assert.equal(receipts,2);
  assert.deepEqual((await readCheckpoint(path)).pendingReads,{});
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('unapproved contact does not trigger read receipts',async()=>{
 let reads=0,calls=0;
 const api={origin:'https://example.org',me:async()=>({profile:{profileId:'acct_1'}}),contacts:async()=>({contacts:[{id:'acct_2',status:'accepted'}]}),directFeed:async()=>({messages:[{id:2,authorId:'acct_2',text:'hello'}]}),markDirectRead:async()=>{reads++;}};
 const consumer=createAgentConsumer({api,peers:new Set(['acct_3']),runAgent:async()=>{calls++;}});
 await reconcileInbox({api,checkpoint:{schema:'tavi.openclaw.inbox/v1',origin:api.origin,selfId:'acct_1',peers:{acct_2:0}},onMessage:consumer});
 assert.equal(reads,0);assert.equal(calls,0);
});
test('CLI help discriminates safe modern stdin from legacy @file before agent launch',()=>{
 assert.deepEqual(parseAgentHelp('  --message-file <path>  --message <text> --timeout <seconds>'),{mode:'stdin',timeout:true});
 assert.deepEqual(parseAgentHelp(' --message <text>'),{mode:'at-file',timeout:false});
 assert.throws(()=>parseAgentHelp('Usage: agent'),/prompt flags/);
});
for(const mode of ['modern','legacy'])test(`agent CLI ${mode} compatibility without leaking prompt into argv`,async()=>{
 const dir=await mkdtemp(join(tmpdir(),'tavi-openclaw-cli-test-'));
 try{
  const script=join(dir,'cli.cjs'),capture=join(dir,'capture.json');
  await writeFile(script,`const fs=require('node:fs');const a=process.argv.slice(2);if(a.includes('--help')){process.stdout.write(${JSON.stringify(mode==='modern'?'--message-file <path> --message <text> --timeout <seconds>':'--message <text>')});process.exit(0);};let text;if(a.includes('--message-file'))text=fs.readFileSync(0,'utf8');else text=fs.readFileSync(a[a.indexOf('--message')+1].slice(1),'utf8');fs.writeFileSync(${JSON.stringify(capture)},JSON.stringify({args:a,prompt:text}));process.stdout.write(JSON.stringify({result:{payloads:[{text:'reply'}]}}));`);
  const result=await invokeAgent({peer:'acct_2',peerName:'Tester',text:'Private hello'}, {binary:process.execPath,binaryPrefix:[script],timeoutMs:60000});
  assert.equal(replyText(result),'reply');
  const saved=JSON.parse(await readFile(capture,'utf8'));
  assert.match(saved.prompt,/Private hello/);
  assert(!saved.args.some(x=>x.includes('Private hello')));
  if(mode==='legacy')assert(saved.args.includes('--message'));
  else assert(saved.args.includes('--message-file'));
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('chunked DMs respect LoopRD cooldown and only retry an explicit rejection',async()=>{
 let calls=0;const sleeps=[];const sent=[];
 const api={directSend:async(peer,text)=>{calls++;if(calls===1)throw Error('Please slow down');sent.push(text);}};
 const consumer=createAgentConsumer({api,peers:new Set(['acct_2']),runAgent:async()=>({payloads:[{text:'b'.repeat(1200)}]}),sleep:async ms=>sleeps.push(ms)});
 await consumer({peer:'acct_2',id:7,text:'hello'});
 assert.equal(calls,3);assert.deepEqual(sleeps,[1250,1250]);assert.equal(sent.length,2);
});

test('revoked contacts have stale pending receipts cleared rather than blocking the bridge',async()=>{
 let reads=0;const api={origin:'https://example.org',me:async()=>({profile:{profileId:'acct_1'}}),contacts:async()=>({contacts:[]}),markDirectRead:async()=>reads++};
 const cp={schema:'tavi.openclaw.inbox/v1',origin:api.origin,selfId:'acct_1',peers:{acct_2:9},pendingReads:{acct_2:9}};
 await reconcileInbox({api,checkpoint:cp,onMessage:async()=>assert.fail('must not call')});
 assert.equal(reads,0);assert.deepEqual(cp.pendingReads,{});
});
