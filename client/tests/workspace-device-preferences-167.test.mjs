import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadWorkspaceLocalPackage} from '../src/extensions/workspace-local-package.js';
import {deviceWindowDefault,setDeviceWindowDefault,desktopLaunchPresentation,rememberPresentation,forgetPresentation,allowDetached,savedPresentation} from '../src/extensions/workspace-presentation.js';
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
const scope='looprd:https://example.test/account-a';
const id='org.example.klondike';
const m={id,version:'1.0.0'};
test('native desktop defaults: game separate, ordinary app embedded; scoped per account on device',()=>{
 const storage=memory();
 assert.equal(deviceWindowDefault(storage,scope,'game'),'detached');
 assert.equal(deviceWindowDefault(storage,scope,'app'),'embedded');
 assert.equal(desktopLaunchPresentation(storage,scope,id,m,{kind:'game',detachable:true}),'detached');
 assert.equal(desktopLaunchPresentation(storage,scope,id,m,{kind:'game',detachable:false}),'embedded');
 setDeviceWindowDefault(storage,scope,'game','embedded');
 assert.equal(desktopLaunchPresentation(storage,scope,id,m,{kind:'game',detachable:true}),'embedded');
 assert.equal(deviceWindowDefault(storage,'looprd:other-account','game'),'detached');
 assert.throws(()=>setDeviceWindowDefault(storage,scope,'game','floating-panel'));
 assert.throws(()=>deviceWindowDefault(storage,scope,'wallet'));
});
test('per-app choice can override category default and return to device policy',()=>{
 const storage=memory();
 rememberPresentation(storage,scope,id,'embedded');
 assert.equal(desktopLaunchPresentation(storage,scope,id,m,{kind:'game',detachable:true}),'embedded');
 rememberPresentation(storage,scope,id,'detached');
 assert.equal(desktopLaunchPresentation(storage,scope,id,m,{kind:'app',detachable:true}),'detached');
 assert.equal(forgetPresentation(storage,scope,id),true);
 assert.equal(desktopLaunchPresentation(storage,scope,id,m,{kind:'app',detachable:true}),'embedded');
 assert.equal(savedPresentation(storage,scope,id),null);
});
test('explicit embedded-only manifest cannot be overruled and local source must match',()=>{
 const storage=memory(),entry={local:true,manifest:m};
 assert.equal(desktopLaunchPresentation(storage,scope,id,{presentation:{supported:['embedded']}},{kind:'game',detachable:true}),'embedded');
 const store={enabled:()=>true,source:()=> 'tavi:local',version:()=>m.version};
 assert.equal(allowDetached({desktop:true,verified:true,entry,store,scope,source:'tavi:local'}),true);
 assert.equal(allowDetached({desktop:true,verified:true,entry,store,scope,source:'other'}),false);
 assert.equal(allowDetached({desktop:false,verified:true,entry,store,scope,source:'tavi:local'}),false);
 assert.equal(allowDetached({desktop:true,verified:false,entry,store,scope,source:'tavi:local'}),false);
});
test('local native window uses same-origin reviewed local archive, not a token-bearing URL',()=>{
 const source=readFileSync(new URL('../src/workspace.js',import.meta.url),'utf8');
 const manager=readFileSync(new URL('../src/extensions/workspace-native-host.js',import.meta.url),'utf8');
 assert.match(source,/loadWorkspaceLocalPackage\(\{scope,id,revision\}\)/);
 assert.match(readFileSync(new URL('../src/extensions/workspace-local-package.js',import.meta.url),'utf8'),/record\.revision!==revision/);
 assert.match(source,/frame\.setAttribute\('sandbox','allow-scripts'\)/);
 assert.match(manager,/local:true,scope:s\.scope,revision:s\.revision/);
 assert.doesNotMatch(manager,/app:\{[^}]+token:/);
});
test('settings exposes real device-local dropdowns and does not promise App Store window already works',()=>{
 const ui=readFileSync(new URL('../src/ui/settings-view.js',import.meta.url),'utf8');
 const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(ui,/data-window-default/);
 assert.match(ui,/data-window-app/);
 assert.match(ui,/App Store currently stays in Tavi/);
 assert.match(source,/desktopLaunchPresentation\(/);
 assert.match(source,/remember:false/);
});

test('local window loads only matching installed account/revision and strips incidental fields',async()=>{
 const revision='a'.repeat(64), seen=[];
 const read=async(account,id)=>{seen.push([account,id]);return {schema:'tavi.local-package/v1',revision,manifest:{id:'org.example.klondike'},assets:{'ui/index.html':new Uint8Array([60,62])},archive:new Uint8Array([1]),token:'unexpected-secret'};};
 const payload=await loadWorkspaceLocalPackage({id:'org.example.klondike',scope,revision},{read});
 assert.deepEqual(seen,[[scope,'org.example.klondike']]);
 assert.deepEqual(Object.keys(payload).sort(),['assets','manifest','schema']);
 assert.equal(payload.archive,undefined);assert.equal(payload.token,undefined);
 await assert.rejects(loadWorkspaceLocalPackage({id:'org.example.klondike',scope,revision:'b'.repeat(64)},{read}),/changed/);
 await assert.rejects(loadWorkspaceLocalPackage({id:'org.example.klondike',scope:'',revision},{read}),/Invalid/);
 await assert.rejects(loadWorkspaceLocalPackage({id:'org.example.klondike',scope,revision},{read:async()=>null}),/missing/);
});
