import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {menuApplications,drawerApplications} from '../src/launcher.js';
import {DEFAULT_APP_FAVORITES,readAppFavorites,favoriteApplications,favoritesStorageKey} from '../src/ui/app-favorites.js';
const read=path=>readFile(new URL(path,import.meta.url),'utf8');

test('Apps hides Chats and Games root navigation but retains actual app routes',()=>{
 const all=menuApplications({}),drawer=drawerApplications(all);
 assert.equal(all.some(app=>app.action==='contacts'),true,'the original route remains available');
 assert.equal(all.some(app=>app.action==='games'),true);
 assert.equal(drawer.some(app=>app.action==='contacts'),false);
 assert.equal(drawer.some(app=>app.action==='games'),false);
 assert.equal(drawer.filter(app=>app.action==='app-store').length,1);
 for(const action of ['wallet','inbox','companion','portrait','people-directory','settings'])
  assert(drawer.some(app=>app.action===action),`${action} must stay reachable`);
 const extension={kind:'extension',id:'org.example.game',action:'games',label:'Installed game'};
 assert(drawerApplications([...all,extension]).includes(extension),"don't hide installed TaviX games");
});

test('Favorites no longer defaults to redundant bottom navigation items and legacy preferences remain safe',()=>{
 assert(!DEFAULT_APP_FAVORITES.includes('builtin:contacts'));
 assert(!DEFAULT_APP_FAVORITES.includes('builtin:games'));
 const storage={getItem:()=>JSON.stringify({schema:'tavi.apps.favorites/v1',ids:['builtin:contacts','builtin:games','builtin:inbox','builtin:app-store']})};
 const saved=readAppFavorites(storage,'account');
 assert.deepEqual(saved,['builtin:contacts','builtin:games','builtin:inbox','builtin:app-store']);
 const visible=favoriteApplications(drawerApplications(menuApplications({})),saved);
 assert.deepEqual(visible.map(app=>app.label),['Notifications','Tavi Store']);
 assert.equal(favoritesStorageKey('account').startsWith('tavi.apps.'),true);
});

test('Apps has one Store tile and no duplicate oversized Store action',async()=>{
 const src=await read('../src/main.js');
 const menu=src.split('function mainMenu(){')[1].split('\nfunction homeScreen()')[0];
 assert.match(menu,/drawerApplications\(launcherApps\(\)\)/);
 assert.doesNotMatch(menu,/tavi-explore-apps/);
 assert.match(menu,/tavi-app-page-tabs/);
 assert.match(menu,/tavi-app-context-hint/);
});

test('native Apps paints the scrollbar gutter and bottom region with one continuous theme surface',async()=>{
 const src=await read('../src/ui/launcher-root.css');
 const entry=await read('../src/main.js');
 assert.match(entry,/import '\.\/ui\/launcher-root\.css'/);
 assert.match(src,/\.tavi-root-tab:has\(\.tavi-menu-panel\) \.aux-content/);
 assert.match(src,/scrollbar-gutter:auto/);
 assert.match(src,/min-height:100%/);
 assert.match(src,/\.tavi-mobile-tabs/);
 assert.doesNotMatch(src,/\.tavi-chat-history|\.tavi-games-browser/);
});
