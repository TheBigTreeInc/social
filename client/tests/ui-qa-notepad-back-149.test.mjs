import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const qa=readFileSync(new URL('../tools/ui-qa.mjs',import.meta.url),'utf8');
const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');

test('Notepad QA follows actual Settings-origin App Store navigation and returns Home',()=>{
 const stage=qa.split("stage='return from Notepad via contextual Back';")[1].split("await noOverflow(page,")[0];
 assert.match(stage,/await visible\(page,'\.tavi-app-store'\)/);
 assert.match(stage,/await visible\(page,'\.tavi-material-settings'\)/);
 assert.doesNotMatch(stage,/await visible\(page,'\.tavi-menu-panel'\)/);
 assert.match(stage,/\.tavi-mobile-tabs \[data-action="home"\]/);
 assert.match(stage,/await visible\(page,'\.tavi-home-messenger \.tavi-home-identity'\)/);
});

test('host Back preserves the App Store return origin without relaxing its navigation gates',()=>{
 assert.match(main,/appStoreReturnPanel=state\.panel==='menu'\?'menu':state\.panel==='settings'\?'settings':'home'/);
 assert.match(main,/if\(state\.panel==='app-store'&&appStoreReturnPanel==='settings'\)/);
 assert.match(main,/if\(state\.panel==='app-store'&&appStoreReturnPanel==='menu'\)/);
 assert.match(main,/state\.settingsPage='extensions'/);
});
