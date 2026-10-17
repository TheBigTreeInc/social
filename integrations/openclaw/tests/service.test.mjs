import {test} from 'node:test';import assert from 'node:assert/strict';
import {allowedPeers,replyText,createAgentConsumer,agentPrompt} from '../tavi-openclaw-service.mjs';
test('allowlist accepts account ids only',()=>assert.deepEqual([...allowedPeers('acct_1, invalid, acct_222')],['acct_1','acct_222']));
test('agent reply only uses recognized text payload',()=>{assert.equal(replyText({result:{payloads:[{text:'hello'}]}}),'hello');assert.throws(()=>replyText({oops:1}));assert.equal(replyText({result:{payloads:[]}}),null);});
test('inbound allowlist and same-contact outgoing reply',async()=>{const sent=[];const consumer=createAgentConsumer({api:{directSend:async(...args)=>sent.push(args)},peers:new Set(['acct_2']),runAgent:async()=>({result:{payloads:[{text:'response'}]}})});await consumer({peer:'acct_3',text:'no'});await consumer({peer:'acct_2',text:'yes'});assert.deepEqual(sent,[['acct_2','response']]);});
test('agent failure never sends and is propagated for retry',async()=>{const sent=[];const consumer=createAgentConsumer({api:{directSend:async x=>sent.push(x)},peers:new Set(['acct_2']),runAgent:async()=>{throw Error('agent unavailable');}});await assert.rejects(consumer({peer:'acct_2',text:'hello'}));assert.equal(sent.length,0);});

test('consumer forwards sender metadata to OpenClaw while preserving account-id routing',async()=>{
 const messages=[];const sent=[];
 const consumer=createAgentConsumer({api:{directSend:async(...args)=>sent.push(args)},peers:new Set(['acct_1']),runAgent:async msg=>{messages.push(msg);return {result:{payloads:[{text:'Hello Dorbian'}]}};}});
 await consumer({peer:'acct_1',peerName:'Dorbian',peerUsername:'dorbian',text:'my name?'});
 assert.equal(messages[0].peerName,'Dorbian');
 assert.equal(messages[0].peerUsername,'dorbian');
 assert.deepEqual(sent,[['acct_1','Hello Dorbian']]);
});

test('OpenClaw receives chosen identity rather than generic application name',()=>{
 const prompt=agentPrompt({peer:'acct_1',peerName:'Dorbian',peerUsername:'dorbian',text:'what is my name?'});
 assert.match(prompt, /"displayName":"Dorbian"/);
 assert.match(prompt, /"username":"dorbian"/);
 assert.match(prompt, /"accountId":"acct_1"/);
 assert.match(prompt, /Address this person using their display name/);
});
