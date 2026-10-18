import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {isValidMatchRoom,matchWindowLabel} from '../src/match-windows.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>readFile(resolve(root,file),'utf8');
const room='e'.repeat(64);
test('match labels are stable and accept only opaque room IDs',()=>{
 assert.equal(isValidMatchRoom(room),true);
 assert.equal(matchWindowLabel(room),'match-'+room);
 for(const input of ['','match_123','f'.repeat(63),'F'.repeat(64),'../chat','http://host/path','f'.repeat(65)]){
  assert.equal(isValidMatchRoom(input),false);
  assert.throws(()=>matchWindowLabel(input));
 }
});
test('match webview has minimum capabilities and no Social tokens',async()=>{
 const match=await read('src/match.js');const main=await read('src/main.js');const vite=await read('vite.config.mjs');
 const caps=JSON.parse(await read('src-tauri/capabilities/matches.json'));
 assert.deepEqual(caps.windows,['match-*']);
 assert.deepEqual(caps.permissions,['core:default','core:event:allow-listen','core:event:allow-emit-to']);
 assert.match(vite,/match:resolve\(root,'match.html'\)/);
 assert.match(match,/emitTo\('main','social-match-request'/);
 assert.doesNotMatch(match,/localStorage|sessionStorage|\.token|password|fetch\(/);
 assert.match(main,/listen\('social-match-request'/);
 assert.match(main,/matchWindowLabel\(roomId\)!==label/);
 assert.match(main,/state\.gameRooms\.some\(r=>r\.roomId===roomId\)/);
 assert.match(main,/api\.gameRoomFeed\(roomId\)/);
 assert.match(main,/api\.gameRoomSend\(roomId,text\.trim\(\)\)/);
 assert.match(main,/if\(api!==state\.api\)/);
 assert.match(main,/new WebviewWindow\(label,\{url:`match.html\?room=/);
 assert.doesNotMatch(main,/new WebviewWindow\(label,\{url:`match.html\?room=\$\{roomId\}.*token/i);
});
test('match view forgets private messages on authorization failure',async()=>{
 const code=await read('src/match.js');
 assert.match(code,/active=null;lastError=e\.message/);
 assert.match(code,/await request\(\)/);
 assert.match(code,/if\(result\.label!==label\|\|result\.roomId!==roomId\)return/);
 assert.match(code,/if\(refreshing\)return/);
});
