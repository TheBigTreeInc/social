import test from 'node:test';
import assert from 'node:assert/strict';
import {validateExtensionManifest} from '../src/extensions/contract.js';
import {validatePresentation,desiredPresentation,rememberPresentation,savedPresentation,allowDetached} from '../src/extensions/workspace-presentation.js';
import {createWorkspaceProxy,validateWorkspaceMessage,safeWorkspaceLabel,workspaceSessionStillValid} from '../src/extensions/workspace-relay.js';
import {createNativeWorkspaceManager} from '../src/extensions/workspace-native-host.js';
import {createExtensionHost} from '../src/extensions/host.js';
import {readFileSync} from 'node:fs';
import {assertTaviXHostInfo} from '../src/extensions/sdk.js';

const manifest={schema:'tavi.extension/v1',id:'org.example.studio',version:'1.0.0',name:'Studio',summary:'Asset pack editing',publisher:'example',kind:'app',hostApi:{min:'1.0.0',maxExclusive:'2.0.0'},entrypoints:{panel:'index.html'},permissions:['ui.panel','ui.toast'],contributions:[],presentation:{schema:'tavix.presentation/v1',preferred:'detached',supported:['embedded','detached'],minimumSize:{width:420,height:480},preferredSize:{width:1000,height:720},responsive:true}};
const store={enabled:id=>id===manifest.id,source:()=> 'tavi:bundled',version:()=>manifest.version,revision:()=> 'pinned-revision',permissions:()=>manifest.permissions};
const entry={manifest,source:'tavi:bundled'};
const storage=()=>{const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}};

test('optional presentation declaration remains backwards-compatible and strictly validated',()=>{
 assert.equal(validateExtensionManifest(manifest).compatible,true);
 const older={...manifest};delete older.presentation;assert.equal(validateExtensionManifest(older).compatible,true);
 for(const presentation of [{schema:'tavix.presentation/v1',preferred:'detached',supported:['detached']},{schema:'tavix.presentation/v1',preferred:'detached',supported:['embedded'],unknown:true},{...manifest.presentation,preferredSize:{width:0,height:720}}])assert.throws(()=>validatePresentation(presentation));
});
test('last presentation is per-account/device and never a new permission',()=>{
 const s=storage();assert.equal(desiredPresentation(s,'server:account-a',manifest.id,manifest),'detached');
 rememberPresentation(s,'server:account-a',manifest.id,'embedded');
 assert.equal(savedPresentation(s,'server:account-a',manifest.id),'embedded');
 assert.equal(savedPresentation(s,'server:account-b',manifest.id),null);
 assert.throws(()=>rememberPresentation(s,'server:account-a',manifest.id,'admin'));
});
test('detached eligibility excludes unverified, local, mobile and changed installation',()=>{
 const base={desktop:true,verified:true,entry,store,scope:'server:account-a',source:'tavi:bundled'};
 assert.equal(allowDetached(base),true);
 for(const change of [{desktop:false},{verified:false},{entry:{...entry,local:true}},{source:'https://impostor.invalid'},{store:{...store,enabled:()=>false}}])assert.equal(allowDetached({...base,...change}),false);
});
test('workspace message relay rejects spoofed nonce, label, oversized and wrong method',async()=>{
 const session={label:'workspace-'+'a'.repeat(32),nonce:'12345678-1234-1234-1234-123456789abc'};
 const message={channel:'tavi.extension/v1',direction:'request',id:1,method:'host.info'};
 assert.deepEqual(validateWorkspaceMessage({...session,message},session),message);
 assert.equal(validateWorkspaceMessage({...session,nonce:'fake',message},session),null);
 assert.equal(validateWorkspaceMessage({...session,label:'workspace-'+ 'b'.repeat(32),message},session),null);
 assert.equal(validateWorkspaceMessage({...session,message:{...message,method:'x'.repeat(101)}},session),null);
 assert.equal(validateWorkspaceMessage({...session,message:{...message,params:{huge:'x'.repeat(700001)}}},session),null);
 assert.equal(safeWorkspaceLabel(session.label),true);assert.equal(safeWorkspaceLabel('chat-lobby'),false);
});
test('installation identity and auth must remain current across detached requests',()=>{
 const session={id:manifest.id,source:'tavi:bundled',version:manifest.version,revision:'pinned-revision',scope:'server:account-a'};
 const baseline={connected:true,verified:true,entry,store,accountScope:'server:account-a'};
 assert.equal(workspaceSessionStillValid(session,baseline),true);
 for(const changed of [{connected:false},{verified:false},{accountScope:'server:account-b'},{store:{...store,revision:()=> 'changed'}}])assert.equal(workspaceSessionStillValid(session,{...baseline,...changed}),false);
});
test('detached frame responses use scoped native event and opaque iframe only',()=>{
 const label='workspace-'+'a'.repeat(32),nonce='12345678-1234-1234-1234-123456789abc',sent=[];
 const proxy=createWorkspaceProxy({label,nonce,send:(...args)=>{sent.push(args);return Promise.resolve();}});
 const host=createExtensionHost({windowRef:proxy.windowRef,storage:storage(),notify:()=>{},close:()=>{},workspaceInfo:()=>({schema:'tavi.workspace/v1',mode:'detached',supported:['embedded','detached']})});
 host.mount(proxy.frame,{id:manifest.id,scope:'server:account-a',permissions:['ui.panel'],mode:'detached'});
 assert.equal(proxy.receive({label,nonce:'different',message:{channel:'tavi.extension/v1',direction:'request',id:1,method:'host.info'}}),false);
 assert.equal(proxy.receive({label,nonce,message:{channel:'tavi.extension/v1',direction:'request',id:1,method:'host.info'}}),true);
 assert.equal(sent.length,1);assert.equal(sent[0][0],label);assert.equal(sent[0][1],'tavi-workspace-response');
 assert.equal(sent[0][2].message.result.mode,'detached');assertTaviXHostInfo(sent[0][2].message.result);
 host.dispose();
});
test('desktop native manager creates one window, relays to host, returns embedded without token',async()=>{
 const listeners=new Map(),windows=new Map(),sent=[],hosts=[],preferences=storage(),embeds=[];
 class MockWindow{
  constructor(label,config){this.label=label;this.config=config;this.closed=false;windows.set(label,this);}static async getByLabel(label){return windows.get(label)||null;}
  once(){}async show(){}async setFocus(){}async close(){this.closed=true;windows.delete(this.label);}
 }
 const manager=createNativeWorkspaceManager({desktop:true,WebviewWindow:MockWindow,listen:async(name,fn)=>listeners.set(name,fn),emitTo:async(...args)=>{sent.push(args);},createHost:options=>{const host=createExtensionHost({...options,storage:preferences,notify:()=>{},close:()=>{},workspaceInfo:()=>({schema:'tavi.workspace/v1',mode:'detached',supported:['embedded','detached']})});hosts.push(host);return host;},getHostOptions:()=>({storage:preferences,notify:()=>{},close:()=>{}}),getInstallation:()=>({connected:true,verified:true,accountScope:'server:account-a',entry,store,source:'tavi:bundled'}),assetUrl:()=> 'https://tauri.localhost/app.html',onEmbed:id=>embeds.push(id),notify:()=>{},storage:preferences});
 await manager.open(entry);assert.equal(windows.size,1);assert.equal(manager.sessionCount(),1);
 const [label,win]=[...windows][0];assert.equal(win.config.url,'workspace.html');assert.equal(win.config.resizable,true);assert.equal(savedPresentation(preferences,'server:account-a',manifest.id),'detached');
 await manager.open(entry);assert.equal(windows.size,1);assert.equal(manager.sessionCount(),1);
 await listeners.get('tavi-workspace-ready')({payload:{label,challenge:'12345678-1234-1234-1234-123456789abc'}});
 const grant=sent.find(x=>x[1]==='tavi-workspace-grant');assert.ok(grant);assert.equal(grant[2].app.url,'https://tauri.localhost/app.html');assert.equal(JSON.stringify(grant).includes('Bearer'),false);
 await listeners.get('tavi-workspace-request')({payload:{label,nonce:grant[2].nonce,message:{channel:'tavi.extension/v1',direction:'request',id:1,method:'host.info'}}});
 assert.ok(sent.some(x=>x[1]==='tavi-workspace-response'&&x[2].message.result.mode==='detached'));
 await listeners.get('tavi-workspace-embed')({payload:{label,nonce:grant[2].nonce}});
 assert.deepEqual(embeds,[manifest.id]);assert.equal(savedPresentation(preferences,'server:account-a',manifest.id),'embedded');
 await new Promise(resolve=>setImmediate(resolve));assert.equal(manager.sessionCount(),0);
});

test('host includes explicit window menu and threshold drag-to-detach; messenger unchanged',()=>{
 const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(source,/tavi-workspace-menu/);assert.match(source,/Open in separate window/);
 assert.match(source,/data-workspace-drag/);assert.match(source,/setPointerCapture/);
 assert.match(source,/distance>36/);assert.match(source,/state.panel='home'/);
});
