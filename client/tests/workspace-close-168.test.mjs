import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createNativeWorkspaceManager} from '../src/extensions/workspace-native-host.js';
import {savedPresentation} from '../src/extensions/workspace-presentation.js';

const src=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const id='org.example.klondike',scope='looprd:account-a';
const manifest={id,name:'Klondike Solitaire',version:'1.0.0',kind:'game',presentation:{supported:['embedded','detached']}};
const entry={manifest,source:'tavi:bundled'};
function harness(){
 const listeners=new Map(),windows=new Map(),calls=[],prefs=new Map(),embeds=[],notices=[];
 const storage={getItem:key=>prefs.get(key)??null,setItem:(key,value)=>prefs.set(key,value)};
 let failClose=false,disposed=0;
 class MockWindow{
  constructor(label,config){this.label=label;this.config=config;this.closed=false;windows.set(label,this);}
  static async getByLabel(label){return windows.get(label)||null;}
  once(){} async show(){} async setFocus(){}
  async onCloseRequested(){throw Error("regression: JS close listener intercepts native X");}
  async close(){
   if(failClose)throw Error('ACL missing');
   this.closed=true;windows.delete(this.label);
  }
  async nativeClose(){this.closed=true;windows.delete(this.label);await listeners.get('tavi-workspace-native-destroyed')({payload:{label:this.label}});}
 }
 const store={enabled:()=>true,source:()=> 'tavi:bundled',version:()=>manifest.version,revision:()=> 'revision-a',permissions:()=> ['ui.panel']};
 const manager=createNativeWorkspaceManager({desktop:true,WebviewWindow:MockWindow,
  listen:async(name,fn)=>listeners.set(name,fn),emitTo:async(...args)=>{calls.push(args);},
  createHost:()=>({mount(){},dispose(){disposed++;},publishUIContext(){}}),getHostOptions:()=>({}),
  getInstallation:()=>({connected:true,verified:true,accountScope:scope,entry,store,source:'tavi:bundled'}),
  assetUrl:()=> 'https://tauri.localhost/app.html',onEmbed:value=>embeds.push(value),notify:message=>notices.push(message),storage});
 return {manager,listeners,windows,calls,storage,embeds,notices,setFail:value=>{failClose=value;},disposed:()=>disposed};
}
async function grant(h){
 const [label]=h.windows.keys();
 await h.listeners.get('tavi-workspace-ready')({payload:{label,challenge:'12345678-1234-1234-1234-123456789abc'}});
 return {label,nonce:h.calls.find(c=>c[1]==='tavi-workspace-grant')[2].nonce};
}

test('both trusted window shells have close permission without adding destroy or filesystem privileges',()=>{
 for(const file of ['default.json','workspace.json']){
  const acl=JSON.parse(src(`../src-tauri/capabilities/${file}`));
  assert.ok(acl.permissions.includes('core:window:allow-close'),file);
  assert.ok(!acl.permissions.includes('core:window:allow-destroy'),file);
  assert.ok(!acl.permissions.some(p=>p.includes('fs:')),file);
 }
});
test('detached window exposes explicit Close action through its own native window, without forcing embed',()=>{
 const workspace=src('../src/workspace.js');
 assert.match(workspace,/closeButton\.textContent='Close window'/);
 assert.match(workspace,/windowHandle\.close\(\)/);
 assert.match(workspace,/TAVI_WINDOW_CLOSE_STALLED/);
 assert.match(workspace,/tavi-workspace-close-failed/);
});
test('Return to Tavi closes the native view before changing mode and reembedding',async()=>{
 const h=harness();await h.manager.open(entry);const {label,nonce}=await grant(h);
 await h.listeners.get('tavi-workspace-embed')({payload:{label,nonce}});
 assert.equal(h.windows.size,0);assert.equal(h.manager.sessionCount(),0);
 assert.deepEqual(h.embeds,[id]);assert.equal(h.disposed(),1);
 assert.equal(savedPresentation(h.storage,scope,id),'embedded');
});
test('failed native close keeps bridge and last mode, reports failure to game and main UI',async()=>{
 const h=harness();await h.manager.open(entry);const {label,nonce}=await grant(h);
 h.setFail(true);
 await h.listeners.get('tavi-workspace-embed')({payload:{label,nonce}});
 assert.equal(h.manager.sessionCount(),1);assert.equal(h.disposed(),0);assert.equal(h.windows.size,1);
 assert.deepEqual(h.embeds,[]);assert.equal(savedPresentation(h.storage,scope,id),'detached');
 assert.ok(h.notices.some(n=>n.includes('Could not close')));
 assert.ok(h.calls.some(c=>c[1]==='tavi-workspace-close-failed'&&c[2].nonce===nonce));
 h.setFail(false);await h.manager.closeAll();assert.equal(h.windows.size,0);
});
test('title-bar X / Alt+F4 close drops the detached relay without reopening embedded app',async()=>{
 const h=harness();await h.manager.open(entry);const handle=[...h.windows.values()][0];
 await handle.nativeClose();
 assert.equal(h.manager.sessionCount(),0);assert.equal(h.disposed(),1);
 assert.deepEqual(h.embeds,[]);assert.equal(savedPresentation(h.storage,scope,id),'detached');
 await h.manager.open(entry);assert.equal(h.manager.sessionCount(),1);
 await h.manager.closeAll();assert.equal(h.manager.sessionCount(),0);
});
