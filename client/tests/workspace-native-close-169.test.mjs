import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createNativeWorkspaceManager} from '../src/extensions/workspace-native-host.js';

const source=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const id='org.example.klondike',scope='server:account-a';
const entry={manifest:{id,name:'Klondike Solitaire',version:'0.1.0',kind:'game'},source:'tavi:bundled'};
function fixture(){
 const windows=new Map(), listeners=new Map(), hosts=[],notifications=[],embeds=[];
 const prefs=new Map(),storage={getItem:k=>prefs.get(k)||null,setItem:(k,v)=>prefs.set(k,v)};
 class Window{
  constructor(label){this.label=label;windows.set(label,this);}
  static async getByLabel(label){return windows.get(label)||null;}
  once(){} async show(){} async setFocus(){}
  async close(){windows.delete(this.label);}
  async onCloseRequested(){throw Error('native close must not be intercepted by JS');}
  async nativeX(){windows.delete(this.label);await listeners.get('tavi-workspace-native-destroyed')({payload:{label:this.label}});}
 }
 const store={enabled:()=>true,source:()=>entry.source,version:()=>entry.manifest.version,revision:()=> 'rev1',permissions:()=>[]};
 const manager=createNativeWorkspaceManager({desktop:true,WebviewWindow:Window,
  listen:async(name,fn)=>{listeners.set(name,fn);},emitTo:async()=>{},
  createHost:()=>{const host={disposeCount:0,mount(){},dispose(){this.disposeCount++;},publishUIContext(){}};hosts.push(host);return host;},
  getHostOptions:()=>({}),getInstallation:()=>({entry,connected:true,verified:true,accountScope:scope,store,source:entry.source}),
  assetUrl:()=> 'https://tauri.localhost/app.html',onEmbed:app=>embeds.push(app),notify:m=>notifications.push(m),storage});
 return {manager,windows,listeners,hosts,notifications,embeds};
}
test('Tauri 2 native X was intercepted by onCloseRequested; 0.169 removes it instead of granting allow-destroy',()=>{
 const host=source('../src/extensions/workspace-native-host.js');
 assert.doesNotMatch(host,/\.onCloseRequested\s*\(/);
 const acl=JSON.parse(source('../src-tauri/capabilities/default.json'));
 const childAcl=JSON.parse(source('../src-tauri/capabilities/workspace.json'));
 for(const a of [acl,childAcl]){assert.ok(a.permissions.includes('core:window:allow-close'));assert.ok(!a.permissions.includes('core:window:allow-destroy'));}
 const rust=source('../src-tauri/src/lib.rs');
 assert.match(rust,/\.on_window_event\(/);
 assert.match(rust,/tauri::WindowEvent::Destroyed/);
 assert.match(rust,/tavi-workspace-native-destroyed/);
});
test('X or Alt+F4 dispatches post-destruction cleanup and leaves detached preference intact',async()=>{
 const h=fixture();await h.manager.open(entry);const old=[...h.windows.values()][0];
 assert.equal(h.manager.sessionCount(),1);
 await old.nativeX();
 assert.equal(h.manager.sessionCount(),0);assert.equal(h.hosts[0].disposeCount,1);
 assert.deepEqual(h.embeds,[]);
 await h.manager.open(entry);assert.equal(h.manager.sessionCount(),1);
 await h.manager.closeAll();assert.equal(h.manager.sessionCount(),0);
});
test('a forged native-destroyed event cannot dispose a relay while the window still exists',async()=>{
 const h=fixture();await h.manager.open(entry);const label=[...h.windows.keys()][0];
 const destroyed=h.listeners.get('tavi-workspace-native-destroyed');
 await destroyed({payload:{label}});
 await destroyed({payload:{label:'main'}});
 await destroyed({payload:{label:'workspace-'+'a'.repeat(32)}});
 assert.equal(h.manager.sessionCount(),1);assert.equal(h.hosts[0].disposeCount,0);
 await h.manager.closeAll();assert.equal(h.hosts[0].disposeCount,1);
});
