import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readStateKey,loadChatReadState,saveChatReadState,reconcileDirectFeed,acknowledgeDirectFeed,chatPollPeers} from '../src/message-state.js';
const msg=(id,authorId,text='hello')=>({id,authorId,text});
function memory(){const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)};}
test('first sync seeds a baseline without retroactive notification',()=>{
 const a=reconcileDirectFeed([msg(1,'acct_3'),msg(3,'acct_4')],'acct_3',null);
 assert.deepEqual(a,{cursor:{read:3,notified:3},unread:0,notification:null,latest:3});
});
test('new inbound DM yields one notification and unread until the conversation is viewed',()=>{
 const messages=[msg(9,'acct_3'),msg(10,'acct_4','Hi'),msg(11,'acct_4','How are you?')];
 const a=reconcileDirectFeed(messages,'acct_3',{read:9,notified:9});
 assert.equal(a.unread,2);assert.deepEqual(a.notification,{id:11,text:'How are you?'});
 const b=reconcileDirectFeed(messages,'acct_3',a.cursor);assert.equal(b.unread,2);assert.equal(b.notification,null);
 const c=reconcileDirectFeed(messages,'acct_3',a.cursor,{visible:true});assert.equal(c.unread,0);assert.equal(c.notification,null);
 assert.deepEqual(c.cursor,{read:11,notified:11});
});
test('outbound only never notifies; read marker is monotonic',()=>{
 const a=reconcileDirectFeed([msg(7,'acct_3')],'acct_3',{read:5,notified:5});
 assert.equal(a.unread,0);assert.equal(a.notification,null);
 assert.deepEqual(acknowledgeDirectFeed([msg(2,'acct_4')],{read:7,notified:7}),{read:7,notified:7});
});
test('read markers are scoped by server and user and persist without message content',()=>{
 const store=memory(),key=readStateKey('https://a.example','acct_3');
 assert.notEqual(key,readStateKey('https://b.example','acct_3'));
 assert.notEqual(key,readStateKey('https://a.example','acct_9'));
 saveChatReadState(store,key,{'acct_4':{read:42,notified:43},'malicious':{read:10}});
 assert.deepEqual(loadChatReadState(store,key),{'acct_4':{read:42,notified:43}});
 assert.equal(store.getItem(key).includes('hello'),false);
});
test('bounded rotating scan covers contacts without request bursts',()=>{
 const users=Array.from({length:29},(_,i)=>({id:'acct_'+(i+1),status:'accepted'}));
 let offset=0,seen=new Set();for(let i=0;i<3;i++){const pass=chatPollPeers(users,offset);offset=pass.nextOffset;assert.ok(pass.peers.length<=12);pass.peers.forEach(p=>seen.add(p.id));}
 assert.equal(seen.size,29);
 assert.deepEqual(chatPollPeers(users.slice(0,2)).peers,users.slice(0,2));
});
test('notification options default to private previews and are account scoped',async()=>{
 const {notificationPrefsKey,loadNotificationPrefs,saveNotificationPrefs}=await import('../src/message-state.js');
 const store=memory(),key=notificationPrefsKey('https://example.test','acct_3');
 assert.deepEqual(loadNotificationPrefs(store,key),{messages:true,preview:false,requests:true});
 saveNotificationPrefs(store,key,{messages:false,preview:true,requests:false});
 assert.deepEqual(loadNotificationPrefs(store,key),{messages:false,preview:true,requests:false});
 assert.notEqual(key,notificationPrefsKey('https://example.test','acct_4'));
});
