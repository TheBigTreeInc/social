import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const src=async path=>readFile(new URL(path,import.meta.url),'utf8');
test('Home keeps account portrait left and reviewed Companion right without duplicate shell actions',async()=>{
 const main=await src('../src/main.js');
 const home=main.split('function homeIdentity()')[1].split('function homeContactPane()')[0];
 assert.match(home,/tavi-home-self-portrait/);
 assert.match(home,/companionPortraitButton\(\)/);
 assert.match(home,/data-action="wallet"/);
 assert.match(main,/data-action="companion" class="tavi-profile-pet tavi-companion-portrait"/);
 assert.match(main,/readCompanionPreview\(localStorage,extensionStoreScope\)/);
 assert.match(main,/homeToolbar\(\)/);
 assert.match(main,/mobileTabs\('home'/);
 assert.doesNotMatch(home,/data-action="inbox"|tavi-profile-updates/);
});
test('game catalog is a compact player view, diagnostics are not player content',async()=>{
 const main=await src('../src/main.js');
 const start=main.indexOf('function gameSettings()');
 const end=main.indexOf('function companion()');
 const games=start>=0&&end>start?main.slice(start,end):'';
 for(const name of ['Your games','Play with friends','Discover games','Invitations'])assert.ok(games.includes(name));
 assert.match(games,/state\.atriumGames\.map/);
 assert.match(games,/Not playable yet/);
 assert.doesNotMatch(games,/Watch a component|Game discovery is temporarily unavailable.*game-backend|developer/);
 assert.match(main,/function developerPanel\(\)/);
 assert.match(main,/Atrium discovery/);
});
