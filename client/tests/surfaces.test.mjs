import test from 'node:test';
import assert from 'node:assert/strict';
import {createSurfaceRegistry,safeSurfaceId} from '../src/surfaces.js';

test('minimized chat and game share one transient, token-free Home registry',()=>{
 const registry=createSurfaceRegistry();
 assert.equal(registry.minimizeChat('acct_47','Friend'),'chat:acct_47');
 assert.equal(registry.minimizeGame('life','Life'),'game:life');
 assert.deepEqual(registry.list().map(x=>x.id),['chat:acct_47','game:life']);
 assert(!JSON.stringify(registry.list()).includes('token'));
 registry.activate('chat:acct_47');
 assert.equal(registry.list().length,1);
 registry.clear();assert.equal(registry.list().length,0);
});
test('minimize identifiers are constrained to trusted game and account IDs',()=>{
 for(const value of ['../secret','http://host','bob','acct_a','x<script>','']){
  assert(!safeSurfaceId('chat',value));
  if(['../secret','http://host','x<script>',''].includes(value))assert(!safeSurfaceId('game',value));
 }
 assert(safeSurfaceId('chat','lobby'));
 assert(safeSurfaceId('chat','acct_1'));
 assert(safeSurfaceId('game','life'));
 assert.throws(()=>createSurfaceRegistry().minimize('game','../bad','Oops'));
});
test('source keeps only a minimal game toolbar and an authenticated main-owned minimize broker',async()=>{
 const {readFile}=await import('node:fs/promises');
 const read=path=>readFile(new URL(path,import.meta.url),'utf8');
 const main=await read('../src/main.js');const nativeGame=await read('../src/game.js');
 const nativeChat=await read('../src/chat.js');const style=await read('../src/style.css');
 const caps=JSON.parse(await read('../src-tauri/capabilities/default.json'));
 assert.match(main,/showEmbeddedGame\(game\)/);
 assert.match(main,/document\.body\.append\(root\)/);
 assert.match(main,/root\.hidden=true;surfaces\.minimizeGame/);
 assert.match(main,/homeToolbar\(\)/);
 assert.match(main,/mobileTabs\('home'/);
 assert.match(main,/tavi-modern-chat/);
 assert.match(main,/function resumeSurface\(surfaceId\)/);
 assert.match(nativeGame,/tavi-surface-minimize/);
 assert.match(nativeChat,/tavi-surface-minimize/);
 assert.doesNotMatch(nativeGame,/Show chat|Hide chat|Community chat|<footer>/);
 assert.match(style,/\.tavi-embedded-game\{position:fixed/);
 assert(caps.permissions.includes('core:window:allow-hide'));
 assert(caps.permissions.includes('core:window:allow-show'));
 for(const value of ['core:window:allow-on-moved','core:window:allow-create'])assert(!caps.permissions.includes(value));
});
