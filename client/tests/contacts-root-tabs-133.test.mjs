import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {BUILTIN_APPS,menuApplications,appGlyph} from '../src/launcher.js';
import {resolvedGlyph} from '../src/ui/glyphs.js';
import {mobileTabs} from '../src/ui/shell.js';
const read=path=>readFile(new URL(path,import.meta.url),'utf8');

test('Contacts is a real launcher destination, while Add friend remains an action',()=>{
 const all=menuApplications({});
 assert.equal(all.some(a=>a.action==='add-friend'),false);
 assert.equal(all.filter(a=>a.action==='people-directory').length,1);
 assert.equal(all.find(a=>a.action==='people-directory').label,'Contacts');
 assert.match(appGlyph(all.find(a=>a.action==='people-directory').symbol),/<svg/);
 assert.equal(resolvedGlyph('people'),'users-round');
 assert.match(mobileTabs('menu'),/data-action="main-menu"[^>]*aria-current="page"/);
});

test('main navigation does not show redundant top-level Apps or Games toolbar',async()=>{
 const src=await read('../src/main.js');
 const region=src.split('function dashboard(){')[1].split('\n// Native floating pet')[0];
 assert.match(region,/const topLevelTab=state\.panel==='menu'\|\|state\.panel==='games'/);
 assert.match(region,/\$\{topLevelTab\?'':hostToolbar\(utilityTitle/);
 assert.match(region,/tavi-root-tab/);
 assert.match(region,/\$\{messageInbox\(\)\}/);
 assert.doesNotMatch(region,/hostToolbar\('Messages'/);
 assert.match(region,/mobileTabs\(state\.panel/);
 assert.match(src,/homeToolbar\(\)/);
});

test('Contacts directory uses only the authenticated Tavi contact list and existing conversation actions',async()=>{
 const src=await read('../src/main.js');
 const directory=src.split('function peopleDirectory(){')[1].split('\nfunction addFriend(){')[0];
 assert.match(directory,/state\.contacts\.filter\(c=>c\.status==='accepted'\)/);
 assert.match(directory,/status==='pending'&&c\.direction==='incoming'/);
 assert.match(directory,/sortContacts/);
 assert.match(directory,/data-peer=/);
 assert.match(directory,/data-action=\\"add-friend\\"|data-action="add-friend"/);
 assert.match(directory,/phone address book/);
 assert.doesNotMatch(directory,/navigator\.contacts|ContactsManager|readPhoneContacts|fetch\(/);
 assert.match(src,/if\(name==='people-directory'\)\{state\.panel='people-directory'/);
});

test('friend request has logical origin and Back/Cancel lead to Contacts',async()=>{
 const src=await read('../src/main.js');
 assert.match(src,/friendReturnPanel=state\.panel==='people-directory'\?'people-directory':'messenger'/);
 assert.match(src,/if\(state\.panel==='add-friend'&&friendReturnPanel==='people-directory'\)/);
 assert.match(src,/if\(state\.panel==='people-directory'\)\{state\.panel='menu'/);
 assert.match(src,/state\.panel=friendReturnPanel==='people-directory'\?'people-directory':'messenger'/);
 assert.match(src,/friendReturnPanel==='people-directory'\?'people-directory':'contacts'/);
 assert.match(src,/state\.api\.requestContact\(handle\)/);
});

test('tab radii override generic utility button selector, on both Games and Apps',async()=>{
 const css=await read('../src/style.css');
 assert.match(css,/\.tavi-utility-focus \.utility\.tavi-menu-panel \.tavi-app-page-tabs button,/);
 assert.match(css,/\.tavi-utility-focus \.utility\.tavi-games-browser \.tavi-games-tabs button\{border-radius:999px!important/);
 assert.match(css,/\.tavi-people-row:focus-visible|\.tavi-people-row:active/);
 assert.match(css,/\.tavi-people-add\{[^}]*min-height:44px/);
});

test('local TaviX install and normal games discovery are still present',async()=>{
 const src=await read('../src/main.js');
 assert.match(src,/canInstallLocalTavix\(state\)\?`<div class="tavi-local-package-toolbar(?: \w[\w-]*)?"/);
 assert.match(src,/data-games-page="discover"/);
 assert.match(src,/data-action="find-atrium"/);
 assert.match(src,/if\(name==='local-tavix-picker'\)/);
 const qa=await read('../tools/ui-qa.mjs');
 assert.match(qa,/stage='Contacts directory and Add friend as action'/);
 assert.match(qa,/stage='return from Games using bottom Home tab'/);
});
