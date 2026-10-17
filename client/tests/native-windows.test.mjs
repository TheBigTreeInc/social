import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {isValidChatPeer,chatWindowLabel} from '../src/native-windows.js';
const read = path => readFile(new URL(path,import.meta.url),'utf8');
test('lobby and server-issued contact IDs map deterministically to Tauri labels',()=>{
 assert.equal(chatWindowLabel('lobby'),'chat-lobby');
 assert.equal(chatWindowLabel('acct_1'),'chat-acct_1');
 for(const peer of ['..','foo/bar','http://evil.test','user%2Fadmin','','bob']){
   assert.equal(isValidChatPeer(peer),false);
   assert.throws(()=>chatWindowLabel(peer));
 }
});
test('Windows starts compact and Android keeps its independent single-window layout',async()=>{
 const conf=JSON.parse(await read('../src-tauri/tauri.conf.json'));
 const main=conf.app.windows[0];
 assert(main.width>=320 && main.width<=400,'Native roster must not start as dashboard');
 assert(main.height>=520 && main.height<=720);
 assert(main.maxWidth<=450);
 const android=JSON.parse(await read('../src-tauri/tauri.android.conf.json'));
 assert(android.app.windows[0].height>=750);
});
test('native windows are real separate webviews, not a wide two-column dashboard',async()=>{
 const code=await read('../src/main.js');
 const chat=await read('../src/chat.js');
 const vite=await read('../vite.config.mjs');
 const caps=JSON.parse(await read('../src-tauri/capabilities/default.json'));
 const chatCaps=JSON.parse(await read('../src-tauri/capabilities/conversations.json'));
 assert.match(code,/new WebviewWindow\(label,/);
 assert.match(code,/if\(nativeDesktop\)return/);
 assert.match(code,/if\(nativeDesktop\)\{await openChatWindow\(peer\)/);
 assert.match(code,/if\(name==='messenger'&&nativeDesktop\)/);
 assert.match(chat,/emitTo\('main','social-chat-request'/);
 assert.doesNotMatch(chat,/token\s*:|password\s*:|localStorage/);
 assert.match(vite,/chat\.html/);
 assert(caps.permissions.includes('core:webview:allow-create-webview-window'));
 assert.deepEqual(caps.windows,['main']);
 assert.deepEqual(chatCaps.windows,['chat-*']);
 assert(!chatCaps.permissions.includes('core:webview:allow-create-webview-window'),'Chat must not spawn arbitrary windows');
});
