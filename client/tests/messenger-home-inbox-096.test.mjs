import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buddyGroups,conversationThreads,messageVisible} from '../src/ui/messenger-model.js';
import {applyInboxFilter} from '../src/ui/message-inbox.js';
const read=async rel=>readFile(new URL(rel,import.meta.url),'utf8');
const contacts=[{id:'a',username:'Ada',status:'accepted',online:true},{id:'b',username:'Bob',status:'accepted',online:false},{id:'c',username:'Carol',status:'pending',direction:'incoming'}];
test('Home selects buddy groups without reusing chat inbox threads',()=>{
 const groups=buddyGroups(contacts);
 assert.deepEqual(groups.online.map(c=>c.id),['a']);
 assert.deepEqual(groups.offline.map(c=>c.id),['b']);
 assert.deepEqual(groups.incoming.map(c=>c.id),['c']);
});
test('Messages sorts existing conversations by last activity and retains contacts without messages',()=>{
 const list=conversationThreads(contacts,[{peer:'b',latest:{text:'Hi',at:100}},{peer:'a',latest:{text:'Hello',at:90}}],{b:3});
 assert.deepEqual(list.map(x=>x.contact.id),['b','a']);
 assert.equal(list[0].unread,3);
 assert.equal(list[1].unread,0);
});
test('Messages filters on names, unread status, and excludes lobby from Friends',()=>{
 assert.equal(messageVisible({label:'Ada',kind:'direct',unread:2},{query:'ada',filter:'unread'}),true);
 assert.equal(messageVisible({label:'Ada',kind:'direct',unread:0},{filter:'unread'}),false);
 assert.equal(messageVisible({label:'Community Lobby',kind:'lobby',unread:0},{filter:'friends'}),false);
 assert.equal(messageVisible({label:'Ada',kind:'direct',unread:0},{filter:'friends'}),true);
 assert.equal(messageVisible({label:'Ada',kind:'direct',unread:0},{query:'missing'}),false);
});
test('DOM filter toggles visibility in place without re-rendering the page or clearing input',()=>{
 const rows=[{dataset:{messageKind:'lobby',messageName:'community lobby',messageUnread:'0'},hidden:false},
  {dataset:{messageKind:'direct',messageName:'ada',messageUnread:'3'},hidden:false}];
 const empty={hidden:true};
 const root={querySelectorAll:()=>rows,querySelector:()=>empty};
 assert.equal(applyInboxFilter(root,{filter:'unread'}),1);
 assert.deepEqual(rows.map(r=>r.hidden),[true,false]);
 assert.equal(applyInboxFilter(root,{query:'absent'}),0);
 assert.equal(empty.hidden,false);
});
test('Home owns profile, wallet and Companion; Messages does not render either integration',async()=>{
 const main=await read('../src/main.js');
 const home=main.split('function homeIdentity()')[1].split('function homeContactPane()')[0];
 const inbox=main.split('function messageInbox()')[1].split('function activePeer()')[0];
 assert.match(home,/tavi-home-self-portrait/);
 assert.match(home,/companionPortraitButton\(\)/);
 assert.match(home,/data-action="wallet"/);
 assert.match(inbox,/Search conversations/);
 assert.match(inbox,/data-message-filter/);
 assert.doesNotMatch(inbox,/companionPortraitButton|data-action="wallet"|roster-profile/);
 assert.match(main,/homeContactPane\(\)/);
 assert.match(main,/messageInbox\(\)/);
 const css=await read('../src/ui/components.css');
 for(const selector of ['.tavi-home-identity','.tavi-home-companion','.tavi-message-inbox','.tavi-message-filters'])assert.ok(css.includes(selector));
});
