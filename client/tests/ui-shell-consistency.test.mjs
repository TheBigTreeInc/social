import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {wireExclusiveMenus} from '../src/ui/menu-controller.js';

const read=async path=>readFile(new URL(path,import.meta.url),'utf8');
class MenuFixture {
 constructor(){this.open=false;this.listeners=new Map();this.focused=false;}
 addEventListener(event,listener){this.listeners.set(event,listener);}
 emit(type,data={}){this.listeners.get(type)?.(data);}
 querySelector(selector){return selector==='summary'?{focus:()=>{this.focused=true;}}:null;}
}

test('classic menu dropdowns are mutually exclusive and Escape returns focus',()=>{
 const [file,contacts,actions]=[new MenuFixture(),new MenuFixture(),new MenuFixture()];
 wireExclusiveMenus([file,contacts,actions]);
 file.open=true;file.emit('toggle');
 assert.deepEqual([file.open,contacts.open,actions.open],[true,false,false]);
 contacts.open=true;contacts.emit('toggle');
 assert.deepEqual([file.open,contacts.open,actions.open],[false,true,false]);
 actions.open=true;actions.emit('toggle');
 assert.deepEqual([file.open,contacts.open,actions.open],[false,false,true]);
 let stopped=false;
 actions.emit('keydown',{key:'Escape',stopPropagation:()=>{stopped=true;}});
 assert.equal(actions.open,false);
 assert.equal(actions.focused,true);
 assert.equal(stopped,true);
 file.open=true;file.emit('toggle');
 file.emit('keydown',{key:'Enter',stopPropagation:()=>{throw Error('Unexpected handling');}});
 assert.equal(file.open,true,'normal keyboard activation must remain available');
});

test('Home and Messages render the same combined alphabetic roster without second empty online/offline groups',async()=>{
 const main=await read('../src/main.js');
 const pane=main.split('function contactPane(homeMode=false)')[1].split('function activePeer()')[0];
 assert.equal((pane.match(/compactContactGroups\(recent,online,offline,accepted\.length\)/g)||[]).length,1);
 assert.doesNotMatch(pane,/rosterGroup\('online'|rosterGroup\('offline'/);
 assert.match(pane,/homeMode\?homeMinimized\(true\):''/);
 assert.match(main,/const sortContacts=list=>\[\.\.\.list\]\.sort/);
 assert.match(main,/wireExclusiveMenus\(document\.querySelectorAll\('\.menubar \.menu-drop'\)\)/);
});

test('Atrium extension has one host Home route, plus contextual App Store link, without duplicate host Home button',async()=>{
 const main=await read('../src/main.js');
 const extension=main.split('function extensionPanel()')[1].split('function attachExtensionFrame(')[0];
 const dashboard=main.split('function dashboard()')[1].split('function companion()')[0];
 assert.match(extension,/class="tavi-extension-toolbar"/);
 assert.match(extension,/CORE_WALLET_ID\?'home':'app-store'/);
 assert.doesNotMatch(extension,/data-action="home"/);
 assert.doesNotMatch(extension,/data-action="app-store"/);
 assert.match(dashboard,/hostToolbar\(/);
 assert.match(extension,/id="tavi-extension-surface"/);
 assert.match(main,/frame\.setAttribute\('sandbox','allow-scripts'\)/);
});
