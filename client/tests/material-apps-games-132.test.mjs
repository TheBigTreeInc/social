import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=path=>readFile(new URL(path,import.meta.url),'utf8');

test('Games offers compact, accessible My games and Discover views without losing existing actions',async()=>{
 const main=await source('../src/main.js');
 const games=main.split('function gameSettings(){')[1].split('\nfunction companion()')[0];
 assert.match(games,/role="tablist" aria-label="Game views"/);
 assert.match(games,/data-games-page="mine"/);
 assert.match(games,/data-games-page="discover"/);
 assert.match(games,/role="tabpanel"/);
 assert.match(games,/No games in progress/);
 assert.match(games,/data-action="inbox"/);
 assert.match(games,/data-select-game-room/);
 assert.match(games,/data-route=/);
 assert.match(games,/data-challenge-game/);
 assert.match(games,/data-launch-game=/);
 assert.match(games,/data-action="refresh"/);
 assert.match(games,/data-discovered-game/);
 assert.doesNotMatch(games,/Connected to Atrium; no published games yet/);
 assert.doesNotMatch(games,/<h2>Games<\/h2>/);
});

test('Games tabs preserve selection across refresh, support arrows, and hide inactive content',async()=>{
 const main=await source('../src/main.js');
 assert.match(main,/let appDrawerPage=0,gameDrawerPage='mine'/);
 assert.match(main,/const selectGamePage=value=>/);
 assert.match(main,/gameDrawerPage=value/);
 assert.match(main,/el\.hidden=el\.id!==`tavi-game-page-\$\{value\}`/);
 assert.match(main,/event\.key==='ArrowRight'/);
 assert.match(main,/gameTabs\.find\(tab=>tab\.dataset\.gamesPage===next\)\?\.focus\(\)/);
 assert.match(main,/if\(name==='games'&&state\.panel!=='games'\)gameDrawerPage='mine'/);
 const css=await source('../src/style.css');
 assert.match(css,/\.tavi-games-page\[hidden\]\{display:none!important;\}/);
 assert.match(css,/\.tavi-games-tabs button:focus-visible/);
});

test('Apps keeps tile behavior, per-account favorites, and Developer Mode gate',async()=>{
 const main=await source('../src/main.js');
 const menu=main.split('function mainMenu(){')[1].split('\nfunction homeScreen()')[0];
 assert.match(menu,/readAppFavorites\(localStorage,extensionStoreScope\)/);
 assert.match(menu,/role="tablist"/);
 assert.match(menu,/role="tabpanel"/);
 assert.match(menu,/launcherTile\(item,favorites\)/);
 assert.match(menu,/data-action="app-store"/);
 assert.match(menu,/canInstallLocalTavix\(state\)\?`<div class="tavi-local-package-toolbar"/);
 assert.match(menu,/data-local-file-picker/);
 assert.doesNotMatch(menu,/data-app-favorite=/);
 assert.match(main,/data-app-context=/);
 const css=await source('../src/style.css');
 assert.match(css,/\.tavi-menu-panel \.tavi-app-page-tabs button\[aria-selected="true"\]/);
 assert.match(css,/\.tavi-menu-panel \.tavi-app-card \.tavi-app-tile:active/);
 assert.match(css,/\.tavi-menu-panel \.tavi-app-pages\{align-items:start;/);
 assert.match(css,/\.tavi-menu-panel \.tavi-launcher-tools \.tavi-explore-apps/);
 assert.match(css,/@media\(max-width:345px\)/);
});

test('Browser QA selects Discover before verifying catalog, and keeps other navigation assertions',async()=>{
 const qa=await source('../tools/ui-qa.mjs');
 const enter=qa.indexOf("stage='Life discovered Games'");
 const discover=qa.indexOf("[data-games-page=\"discover\"]",enter);
 const visible=qa.indexOf("await visible(page,'[data-discovered-game=",enter);
 assert(enter>=0 && discover>enter && visible>discover);
 assert.match(qa,/stage='favorites personalization'/);
 assert.match(qa,/stage='return from Games using bottom Home tab'/);
});
