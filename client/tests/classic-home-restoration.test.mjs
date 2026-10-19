import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=async p=>readFile(new URL(p,import.meta.url),'utf8');
test('Home restores classic information-rich roster above the unchanged sketch dock',async()=>{
 const main=await read('../src/main.js');
 const css=await read('../src/style.css');
 const home=main.match(/function homeScreen\(\)\{[\s\S]*?\n\}/)?.[0]||'';
 const roster=main.match(/function contactPane\(homeMode=false\)\{[\s\S]*?\nfunction activePeer\(/)?.[0]||'';
 assert.match(home,/contactPane\(true\)/);
 assert.match(home,/class="tavi-home-dock"/);
 assert.match(home,/class="tavi-home-menu" data-action="main-menu"/);
 assert.doesNotMatch(home,/homeConversations\(\)|homeProfile\(\)/);
 for(const bit of ['menuBar()','roster-profile','roster-toolbar','roster-search','roster-scroll',"rosterGroup('online'","rosterGroup('offline'","Community Lobby","compactGames()",'window-status'])
  assert.ok(roster.includes(bit),`classic roster missing ${bit}`);
 assert.match(roster,/homeMode\?homeMinimized\(true\):''/);
 assert.match(css,/\.tavi-classic-home>\.tavi-home-roster/);
 assert.match(css,/\.tavi-roster-activity-list button/);
});
test('No global Games/Menu/Messages dock in chat or game surfaces',async()=>{
 const main=await read('../src/main.js');
 assert.equal((main.match(/<nav class="tavi-home-dock"/g)||[]).length,1);
 assert.match(main,/if\(nativeDesktop&&chatting\)/);
 assert.match(main,/tavi-chat-focus/);
 assert.match(main,/tavi-utility-focus/);
});
