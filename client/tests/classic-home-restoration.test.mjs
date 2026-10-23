import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=async p=>readFile(new URL(p,import.meta.url),'utf8');
test('Home is a buddy list with account and companion top corners, not a duplicate inbox',async()=>{
 const main=await read('../src/main.js');
 const css=await read('../src/ui/components.css');
 const home=main.split('function homeScreen()')[1].split('function dashboard()')[0];
 assert.match(home,/homeContactPane\(\)/);
 const identity=main.split('function homeIdentity()')[1].split('function homeContactPane()')[0];
 const buddies=main.split('function homeContactPane()')[1].split('function messageThreadRow')[0];
 assert.match(identity,/tavi-home-self-portrait/);
 assert.match(identity,/tavi-home-companion/);
 assert.match(buddies,/homeBuddyGroup\('online'/);
 assert.match(buddies,/homeBuddyGroup\('offline'/);
 assert.doesNotMatch(buddies,/messageInbox\(\)|menuBar\(\)/);
 assert.match(css,/\.tavi-unified-home \.tavi-home/);
});
test('all main messenger views use one host-owned navigation policy',async()=>{
 const main=await read('../src/main.js');
 assert.match(main,/if\(nativeDesktop&&chatting\)return[^\n]*hostToolbar\('Messages'/);
 assert.match(main,/if\(state.panel==='home'\)return[^\n]*homeToolbar\(\)/);
 assert.match(main,/tavi-chat-focus/);
 assert.match(main,/tavi-utility-focus/);
});
