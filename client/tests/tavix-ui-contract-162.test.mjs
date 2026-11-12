import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {uiContext,workspaceContext,UI_FEATURE} from '../src/extensions/ui-context.js';
import {applyTaviUI} from '../extension-sdk/ui.js';
import {validatePresentation,desiredPresentation,rememberPresentation,allowDetached} from '../src/extensions/workspace-presentation.js';
import {createExtensionHost} from '../src/extensions/host.js';
import {createTaviXSDK} from '../extension-sdk/index.js';
const raw=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const store={enabled:()=>true,source:()=> 'tavi:bundled',version:()=> '1.0.0'};
const entry={manifest:{id:'org.example.studio',version:'1.0.0',presentation:{schema:'tavix.presentation/v1',preferred:'native-window',supported:['embedded','native-window']}}};

test('UI discovery distinguishes phones, tablets and desktop without privileged authority',()=>{
 const phone=uiContext({platform:'android',width:393,height:873,theme:'dark'});
 assert.equal(phone.schema,UI_FEATURE);assert.equal(phone.device,'phone');assert.equal(phone.theme,'dark');
 assert.deepEqual(phone.chat,{orientation:'portrait',placement:'center'});
 assert.deepEqual(phone.games.orientations,['portrait','landscape']);
 const tabletPortrait=uiContext({platform:'android',width:820,height:1180});
 assert.equal(tabletPortrait.device,'tablet');assert.equal(tabletPortrait.chat.placement,'center');
 const tabletLandscape=uiContext({platform:'android',width:1180,height:820});
 assert.equal(tabletLandscape.chat.placement,'left');
 assert.equal(uiContext({platform:'android',width:1180,height:820,chatAlignment:'center'}).chat.placement,'center');
 const desktop=uiContext({platform:'windows',width:355,height:630,presentation:'detached'});
 assert.equal(desktop.device,'desktop');assert.equal(desktop.presentation,'native-window');assert.equal(desktop.viewport,null);
});

test('canonical presentation vocabulary has a deployed detached compatibility path',()=>{
 assert.equal(workspaceContext({desktop:true,mode:'detached'}).presentation.current,'native-window');
 assert.deepEqual(workspaceContext({desktop:false}).presentation.supported,['embedded']);
 assert.deepEqual(validatePresentation(entry.manifest.presentation),entry.manifest.presentation);
 const s={items:new Map(),getItem(k){return this.items.get(k)||null},setItem(k,v){this.items.set(k,v)}};
 assert.equal(desiredPresentation(s,'host:account',entry.manifest.id,entry.manifest),'detached');
 rememberPresentation(s,'host:account',entry.manifest.id,'native-window');
 assert.equal(desiredPresentation(s,'host:account',entry.manifest.id,entry.manifest),'detached');
 assert.equal(allowDetached({desktop:true,verified:true,entry,store,scope:'host:account',source:'tavi:bundled'}),true);
 assert.throws(()=>validatePresentation({schema:'tavix.presentation/v1',preferred:'detached',supported:['embedded','detached','native-window']}));
});

test('app-side token applicator ignores any untrusted token payload and only uses declared fields',()=>{
 const root={dataset:{}};
 applyTaviUI(root,uiContext({platform:'android',width:1180,height:820,theme:'dark'}));
 assert.deepEqual(root.dataset,{taviTheme:'dark',taviDevice:'tablet',taviOrientation:'landscape',taviChatPlacement:'left'});
 assert.throws(()=>applyTaviUI(root,{theme:'dark'}));
 const css=raw('../extension-sdk/ui.css');
 for(const selector of ['.tavix-app-header','.tavix-panel','.tavix-tab','.tavix-dialog','.tavix-button','[data-tavi-theme='])assert.ok(css.includes(selector),selector);
 assert.doesNotMatch(css,/\.tavi-(?:single-workspace|shell-bar|mobile-tabs)/);
});

test('host advertises read-only UI capability and publishes sanitized theme event',()=>{
 let receive,send=[],shown=[];
 const frame={contentWindow:{postMessage:message=>send.push(message)}};
 const host=createExtensionHost({windowRef:{addEventListener:(_t,fn)=>receive=fn,removeEventListener(){}},storage:{getItem:()=>null},notify:()=>{},close:()=>{},uiInfo:()=>uiContext({platform:'windows',width:355,height:630,theme:'dark'})});
 host.mount(frame,{id:'org.example.studio',scope:'host:account',permissions:['ui.panel']});
 const req=(id,method)=>receive({source:frame.contentWindow,origin:'null',data:{channel:'tavi.extension/v1',direction:'request',id,method}});
 req(1,'host.info');assert.ok(send.pop().result.features.includes(UI_FEATURE));
 req(2,'ui.info');assert.equal(send.pop().result.theme,'dark');
 assert.equal(host.publishUIContext(),true);
 assert.deepEqual([send[0].direction,send[0].event,send[0].payload.schema],['event','ui.contextChanged',UI_FEATURE]);
 host.unmount();assert.equal(host.publishUIContext(),false);
});

test('SDK UI discovery calls existing isolated request channel and keeps host navigation owned',async()=>{
 const listeners=new Map(),messages=[];
 const source={addEventListener:(_t,fn)=>listeners.set('message',fn),removeEventListener:()=>{}};
 const parent={postMessage:message=>{messages.push(message);queueMicrotask(()=>listeners.get('message')({source:parent,data:{channel:'tavi.extension/v1',direction:'response',id:message.id,ok:true,result:uiContext()}}));}};
 const sdk=createTaviXSDK(parent,source);
 assert.equal((await sdk.uiContext()).schema,UI_FEATURE);assert.equal(messages[0].method,'ui.info');
 assert.equal(typeof sdk.navigation.back,'function');assert.equal(typeof sdk.navigation.close,'function');
 sdk.dispose();
});

test('startup recovery is a classic script loaded before the main module, not an empty native surface',()=>{
 const html=raw('../index.html'),bootstrap=raw('../public/boot-guard.js');
 assert.ok(html.indexOf('boot-guard.js')<html.indexOf('/src/main.js'));
 assert.match(bootstrap,/TAVI_STARTUP_RUNTIME_ERROR/);assert.match(bootstrap,/TAVI_STARTUP_MODULE_TIMEOUT/);
 assert.match(bootstrap,/Tavi could not start/);
 assert.doesNotMatch(bootstrap,/localStorage|sessionStorage|Bearer|token/);
 assert.match(raw('../src/main.js'),/window\.taviBootComplete\?\.\(\)/);
});
