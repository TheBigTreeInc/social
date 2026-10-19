import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const src=async path=>readFile(new URL(path,import.meta.url),'utf8');
test('classic roster keeps identity, optional top-right pet, activity and action-only toolbar',async()=>{
 const main=await src('../src/main.js');
 const roster=main.match(/function contactPane\(homeMode=false\)\{[\s\S]*?\nfunction activePeer\(/)?.[0]||'';
 const toolbar=roster.match(/<div class="roster-toolbar tavi-action-toolbar"[\s\S]*?<\/div>/)?.[0]||'';
 assert.match(roster,/class="roster-profile tavi-identity-strip"/);
 assert.match(roster,/state\.companion\?\.enabled\?/);
 assert.match(roster,/data-action="companion" class="tavi-profile-pet"/);
 assert.match(roster,/petSprite\(petById\(state\.companion\.petId\)/);
 assert.match(roster,/data-action="inbox" class="tavi-profile-activity"/);
 for(const action of ['add-friend','portrait','refresh','settings'])assert.match(toolbar,new RegExp(`data-action="${action}"`));
 for(const action of ['games','messenger','companion','inbox'])assert.doesNotMatch(toolbar,new RegExp(`data-action="${action}"`));
 assert.match(main,/class="tavi-home-dock"/);
});
test('game catalog is a compact player view, diagnostics are not player content',async()=>{
 const main=await src('../src/main.js');
 const games=main.match(/function gameSettings\(\)\{[\s\S]*?\n\}/)?.[0]||'';
 for(const name of ['Your games','Play with friends','Discover games','Invitations'])assert.ok(games.includes(name));
 assert.match(games,/state\.atriumGames\.map/);
 assert.match(games,/Not playable yet/);
 assert.doesNotMatch(games,/Watch a component|Game discovery is temporarily unavailable.*game-backend|developer/);
 assert.match(main,/function developerPanel\(\)/);
 assert.match(main,/Integrations/);
 assert.match(main,/Atrium discovery/);
});
