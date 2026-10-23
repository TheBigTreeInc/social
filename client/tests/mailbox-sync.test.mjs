import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reconcileConversationSummary} from '../src/message-state.js';
import {LooprdSocial} from '../src/protocol.js';

const summary=(readId=0,unread=2,latest={id:12,authorId:'acct_2',text:'Hello!',at:1000000})=>
 ({peer:'acct_2',readId,unread,latest});
test('new session displays server unread but does not emit historical OS notification',()=>{
 const actual=reconcileConversationSummary(summary(),'acct_1',null);
 assert.equal(actual.unread,2);assert.equal(actual.notification,null);
 assert.equal(actual.cursor.notified,12);assert.equal(actual.cursor.read,0);
});
test('later message notifies at most once; read on second device suppresses badge and alert',()=>{
 const first=reconcileConversationSummary(summary(),'acct_1',null);
 const next=reconcileConversationSummary(summary(0,3,{id:13,authorId:'acct_2',text:'Again!',at:1000002}),'acct_1',first.cursor);
 assert.equal(next.unread,3);assert.deepEqual(next.notification,{id:13,text:'Again!'});
 assert.equal(reconcileConversationSummary(summary(0,3,{id:13,authorId:'acct_2',text:'Again!',at:1000002}),'acct_1',next.cursor).notification,null);
 const otherDevice=reconcileConversationSummary(summary(13,0,{id:13,authorId:'acct_2',text:'Again!',at:1000002}),'acct_1',next.cursor);
 assert.equal(otherDevice.unread,0);assert.equal(otherDevice.notification,null);assert.equal(otherDevice.cursor.read,13);
});
test('local marker migration never regresses the read cursor or displays a false unread',()=>{
 const result=reconcileConversationSummary(summary(5,7),'acct_1',{read:12,notified:12});
 assert.equal(result.unread,0);assert.equal(result.cursor.read,12);
 assert.equal(reconcileConversationSummary(summary(12,0),'acct_1',result.cursor).unread,0);
});
test('latest outbound messages do not trigger inbound notification',()=>{
 const first=reconcileConversationSummary(summary(0,0,{id:12,authorId:'acct_1',text:'Me',at:1000000}),'acct_1',{read:0,notified:11});
 assert.equal(first.notification,null);
});
test('malformed or forged metadata cannot become a mailbox item',()=>{
 for(const item of [
  {...summary(),peer:'../../other'},
  {...summary(),readId:-1},
  {...summary(),unread:9999},
  {...summary(),latest:{...summary().latest,id:'11'}},
  {...summary(),latest:{...summary().latest,authorId:'user_fake'}}
 ])assert.throws(()=>reconcileConversationSummary(item,'acct_1',null));
});
test('SDK sends read acknowledgements only to the authenticated Social endpoint',async()=>{
 const payloads=[];
 const fake=async(url,options)=>{payloads.push({url,body:JSON.parse(options.body)});return {status:200,ok:true,json:async()=>({ok:true,readId:10,conversations:[],schema:'tavi.dm-summaries/v1'})};};
 const api=new LooprdSocial('https://social.example.org','s'.repeat(32),fake);
 await api.conversations();await api.markDirectRead('acct_2',10);
 assert.deepEqual(payloads.map(x=>x.body.op),['dm_conversations','dm_mark_read']);
 assert.equal(payloads[1].body.upToId,10);
 assert.equal(payloads[1].body.peer,'acct_2');
 assert.ok(payloads.every(x=>x.url==='https://social.example.org/looprd/looprd-social/v1/social'));
 assert.ok(payloads.every(x=>x.body.token==='s'.repeat(32)));
});
test('roster prefers single mailbox summary and does not render a permanent chat panel',()=>{
 const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 for(const feature of ['synchronizeMailbox','conversationSummaries','pushRead','reconcileConversationSummary','conversationThreads(state.contacts,state.conversationSummaries,state.unread)',"homeBuddyGroup('online'","homeBuddyGroup('offline'"])assert.ok(source.includes(feature),feature);
 assert.match(source,/state\.summarySupported=false/);
 assert.match(source,/state\.notifyPrefs\.preview\?/);
 assert.match(source,/if\(peerVisible\(state.peer\)\)markRead/);
});
