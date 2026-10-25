import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {homeToolbar,mobileTabs} from '../src/ui/shell.js';
import {uiHeader} from '../src/ui/components.js';
const read=async rel=>readFile(new URL(rel,import.meta.url),'utf8');

test('Home and Settings use the same shared header structure and accessible SVG actions',()=>{
 const home=homeToolbar();
 const focused=uiHeader({title:'Settings',backAction:'back',home:true,variant:'shell'});
 for(const html of [home,focused]){
  assert.match(html,/class="tavi-ui-header tavi-focus-toolbar tavi-shell-bar"/);
  assert.match(html,/tavi-ui-glyph/);
  assert.match(html,/tavi-ui-header__title/);
 }
 for(const action of ['inbox','settings'])assert.match(home,new RegExp(`data-action="${action}"`));
 assert.match(focused,/data-action="home"/);
 assert.doesNotMatch(home,/File|Contacts|Actions|Tools|Help<\/summary>/);
});

test('one reusable four-tab navigation and deliberately distinct Home and Messages views',async()=>{
 const main=await read('../src/main.js');
 const home=main.split('function homeScreen()')[1].split('function dashboard()')[0];
 const identity=main.split('function homeIdentity()')[1].split('function homeContactPane()')[0];
 const inbox=main.split('function messageInbox()')[1].split('function activePeer()')[0];
 assert.match(main,/homeToolbar\(\)\}\$\{homeScreen\(\)\}\$\{mobileTabs\('home'/);
 assert.match(main,/if\(nativeDesktop&&chatting\)return[^\n]*mobileTabs\('messenger'/);
 assert.match(main,/mobileTabs\(state.panel/);
 assert.match(home,/homeContactPane\(\)/);
 assert.match(identity,/companionPortraitButton\(\)/);
 assert.match(identity,/data-action="wallet"/);
 assert.match(inbox,/message-search/);
 assert.doesNotMatch(inbox,/companionPortraitButton|wallet/);
 const tabs=mobileTabs('home',{unread:4});
 for(const label of ['Home','Chats','Games','Apps'])assert.match(tabs,new RegExp(`>${label}<`));
 assert.match(tabs,/aria-label="4 unread"/);
});
test('central roster styles cover light/dark, desktop and touch without changing extension iframe',async()=>{
 const css=await read('../src/ui/components.css');
 for(const value of ['.tavi-unified-home > .tavi-home','.tavi-unified-home .tavi-roster-merged .buddy','.tavi-single-workspace > .tavi-mobile-tabs','var(--tavi-color-text)','var(--tavi-color-surface)'])assert.ok(css.includes(value),value);
 assert.match(css,/\.tavi-unified-home \.tavi-home-roster/);
 assert.match(css,/\.tavi-single-workspace > \.tavi-mobile-tabs \{display:flex/);
 assert.doesNotMatch(css,/\.tavi-extension-frame iframe|iframe\.contentDocument|\.tavi-community-companion/);
 const main=await read('../src/main.js');
 assert.match(main,/frame\.setAttribute\('sandbox','allow-scripts'\)/);
 assert.match(main,/const CLIENT_VERSION='0.3.109'/);
});
