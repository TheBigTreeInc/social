import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {discoverGames,isSafePublishedGameUrl} from '../sdk/looprd-social.js';
const read=p=>readFile(new URL(p,import.meta.url),'utf8');
test('promoted games load from selected server without transmitting Social credentials',async()=>{
 let req;
 const fetcher=async (url,init)=>{req={url,init};return {ok:true,json:async()=>({ok:true,schema:'tavi.game-catalog/v1',games:[{id:'life',name:'Life',type:'web',url:'https://games.example.org/life',embedded:true,external:true}]})}};
 const games=await discoverGames('https://api.example.org',fetcher);
 assert.equal(games[0].id,'life');assert.equal(games[0].embedded,true);
 assert.equal(JSON.parse(req.init.body).op,'game_catalog');assert.equal(JSON.parse(req.init.body).token,undefined);
 assert.match(req.url,/\/looprd\/looprd-social\/v1\/social$/);
});
test('client refuses unsafe promoted URLs',()=>{
 for(const u of ['http://example.org','https://localhost','https://127.0.0.1/a','https://192.168.1.3/','https://172.16.2.5/','https://user:pass@game.example.org','https://game.example.org/#token','javascript:alert(1)'])assert.equal(isSafePublishedGameUrl(u),false,u);
 assert.equal(isSafePublishedGameUrl('https://game.example.org/room?id=3'),true);
});
test('native game shell uses isolated capability and main-window chat broker',async()=>{
 const main=await read('../src/main.js');const player=await read('../src/game.js');const html=await read('../game.html');const vite=await read('../vite.config.mjs');
 const cap=JSON.parse(await read('../src-tauri/capabilities/games.json'));
 assert.match(main,/new WebviewWindow\(label,\{url:'game.html/);
 assert.match(main,/await state\.api\.send/);
 assert.match(player,/emitTo\('main','tavi-game-request'/);
 assert.match(player,/sandbox/);
 assert.doesNotMatch(player,/\.token\b|localStorage|registerSocial|loginSocial/);
 assert.deepEqual(cap.windows,['game-*']);assert(!cap.permissions.includes('core:webview:allow-create-webview-window'));
 assert.match(html,/src="\/src\/game.js"/);assert.match(vite,/game:resolve/);
});
