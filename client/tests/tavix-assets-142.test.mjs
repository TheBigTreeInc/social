import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createExtensionHost} from '../src/extensions/host.js';
import {createTaviXSDK} from '../extension-sdk/index.js';
import {validateExtensionManifest} from '../src/extensions/contract.js';
import {validateAssetDependencies,validateAssetGrantProjection} from '../src/extensions/asset-dependencies.js';
import {createAssetPermissionController} from '../src/assets/permissions.js';
import {createTaviAssetsRuntime} from '../src/assets/runtime.js';
import {createIndexedAssetStorage} from '../src/assets/indexeddb-storage.js';
import {MemoryAssetStorage} from '../src/assets/vendor/tavi-assets-0.1.7/storage.mjs';
import {SAMPLE_MANIFEST} from '../src/assets/sample-cards.js';
import {renderSettings} from '../src/ui/settings-view.js';

const fixture=JSON.parse(await readFile(new URL('./fixtures/tavix-0.1.11-asset-consumer.json',import.meta.url),'utf8'));
const clone=x=>structuredClone(x);
const scope='tavi.extensions.install/v1:https%3A%2F%2Ftest.example:account-one';
const otherScope='tavi.extensions.install/v1:https%3A%2F%2Ftest.example:account-two';
const source='tavi:local';
function harness(){
 const scopes=new Map();
 const storageFactory=({scope})=>{
  if(!scopes.has(scope))scopes.set(scope,new MemoryAssetStorage());
  return scopes.get(scope);
 };
 const storage=new Map();
 const consentStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
 const runtime=createTaviAssetsRuntime({indexedDB:null,storageFactory});
 let verified=true,enabled=true,installed=fixture,revision='e'.repeat(64),appSource=source;
 const installation=session=>enabled&&session.id===installed.id?{
  id:installed.id,version:installed.version,scope:session.scope,source:appSource,
  manifest:installed,metadata:JSON.stringify(installed),permissions:installed.permissions,revision}:null;
 const controller=createAssetPermissionController({storage:consentStorage,runtime,installation,verified:()=>verified});
 const session={id:fixture.id,scope,source};
 return {storage,scopes,runtime,controller,session,mutate:({manifest,revision:r,enabled:e,source:s,verified:v}={})=>{
  if(manifest)installed=manifest;if(r!==undefined)revision=r;if(e!==undefined)enabled=e;if(s!==undefined)appSource=s;if(v!==undefined)verified=v;
 }};
}
const sampleDep=()=>clone(fixture.assetDependencies[0]);

test('TaviX 0.1.11 actual asset-consumer fixture validates in Social without privilege escalation',()=>{
 assert.equal(validateExtensionManifest(fixture).compatible,true);
 assert.equal(validateAssetDependencies(fixture)[0].packId,SAMPLE_MANIFEST.id);
 for(const mutate of [
  m=>{m.assetDependencies[0].compatibility.maxExclusive='0.1.0';},
  m=>{m.assetDependencies[0].capabilities.push('card.back');},
  m=>{m.assetDependencies[0].capabilities=['../../secrets'];},
  m=>{m.assetDependencies.push(clone(m.assetDependencies[0]));},
  m=>{m.permissions=m.permissions.filter(p=>p!=='assets.read');},
  m=>{m.permissions=m.permissions.filter(p=>p!=='assets.preferences.write');},
  m=>{m.assetDependencies[0].customGrant='yes';},
  m=>{m.assetDependencies[0].optional='yes';},
  m=>{m.assetDependencies[0].requestCustomization=false;},
  m=>{m.assetDependencies[0].compatibility.min='999999999999999999999.0.0';},
 ]){
  const bad=clone(fixture);mutate(bad);
  assert.throws(()=>validateExtensionManifest(bad),/Invalid|missing|must agree|require|Duplicate/i);
 }
 const noDeps=clone(fixture);delete noDeps.assetDependencies;noDeps.permissions=['ui.panel'];
 assert.equal(validateExtensionManifest(noDeps).compatible,true,'legacy no-assets apps remain valid');
});

test('host-only projection is pack-scoped, cannot carry capabilities from another pack',()=>{
 const sha='a'.repeat(64);
 const projection={schema:'tavix.asset-grants/v1',extensionId:fixture.id,extensionVersion:fixture.version,manifestSha256:sha,scope:'host-session',
  grants:[{packId:SAMPLE_MANIFEST.id,capabilities:['card.back'],canCustomize:false}]};
 assert.equal(validateAssetGrantProjection(fixture,sha,projection),projection);
 for(const mutate of [
  p=>{p.grants[0].packId='org.tavi.private';},
  p=>{p.grants[0].capabilities.push('wallet.balance');},
  p=>{p.grants.push({...p.grants[0]});},
  p=>{p.scope='global';},
  p=>{p.manifestSha256='b'.repeat(64);},
  p=>{p.grants[0].capabilities=[];},
  p=>{p.grants[0].canCustomize='true';},
 ]){const bad=clone(projection);mutate(bad);assert.throws(()=>validateAssetGrantProjection(fixture,sha,bad));}
});

test('real portable Assets engine installs free pack by trusted action, persists, isolates accounts',async()=>{
 const b=harness();assert.equal(b.runtime.ready(),false);
 assert.equal(await b.runtime.connect(scope),true);
 assert.deepEqual(await b.runtime.listInstalled(scope),{});
 assert.equal((await b.runtime.installSample(scope)).changed,true);
 assert.deepEqual(await b.runtime.listInstalled(scope),{[SAMPLE_MANIFEST.id]:SAMPLE_MANIFEST.version});
 assert.equal((await b.runtime.installSample(scope)).changed,false,'idempotent install');
 await assert.rejects(b.runtime.request('assets.describe',{packId:SAMPLE_MANIFEST.id},{scope,extensionId:fixture.id,grants:[]}),/revoked|access denied/);
 const trusted={scope,extensionId:fixture.id,grants:[{packId:SAMPLE_MANIFEST.id,capabilities:['card.back'],canCustomize:false}]};
 const item=await b.runtime.request('assets.describe',{packId:SAMPLE_MANIFEST.id},trusted);
 assert.deepEqual(item.capabilities,['card.back']);
 assert.equal((await b.runtime.request('assets.resolve',{packId:SAMPLE_MANIFEST.id,capability:'card.back'},trusted)).contentType,'image/svg+xml');
 await assert.rejects(b.runtime.request('assets.resolve',{packId:SAMPLE_MANIFEST.id,capability:'card.front.ace-spades'},trusted),/access denied/);
 await assert.rejects(b.runtime.request('assets.preferences.set',{packId:SAMPLE_MANIFEST.id,capability:'card.back',variant:'blue'},trusted),/access denied/);
 const restarted=createTaviAssetsRuntime({storageFactory:({scope})=>{if(!b.scopes.has(scope))b.scopes.set(scope,new MemoryAssetStorage());return b.scopes.get(scope);}});
 assert.equal(await restarted.connect(scope),true);
 assert.equal((await restarted.listInstalled(scope))[SAMPLE_MANIFEST.id],SAMPLE_MANIFEST.version);
 assert.equal(await restarted.connect(otherScope),true);
 assert.deepEqual(await restarted.listInstalled(otherScope),{});
});

test('consent is explicit and tied to current verified manifest, source, account, version and installed pack',async()=>{
 const b=harness();await b.runtime.connect(scope);await b.runtime.installSample(scope);
 await b.controller.remember(fixture);
 assert.equal(b.controller.grantForSession(b.session),null,'no implicit grant from declaration');
 await b.controller.changeConsent({session:b.session,packId:SAMPLE_MANIFEST.id,kind:'read',enabled:true});
 let projection=b.controller.grantForSession(b.session);
 assert.deepEqual(projection.grants,[{packId:SAMPLE_MANIFEST.id,capabilities:fixture.assetDependencies[0].capabilities,canCustomize:false}]);
 await b.controller.changeConsent({session:b.session,packId:SAMPLE_MANIFEST.id,kind:'customize',enabled:true});
 projection=b.controller.grantForSession(b.session);assert.equal(projection.grants[0].canCustomize,true);
 await b.controller.changeConsent({session:b.session,packId:SAMPLE_MANIFEST.id,kind:'customize',enabled:false});
 assert.equal(b.controller.grantForSession(b.session).grants[0].canCustomize,false);
 await b.controller.changeConsent({session:b.session,packId:SAMPLE_MANIFEST.id,kind:'read',enabled:false});
 assert.deepEqual(b.controller.grantForSession(b.session).grants,[]);
 await b.controller.changeConsent({session:b.session,packId:SAMPLE_MANIFEST.id,kind:'read',enabled:true});
 b.mutate({enabled:false});assert.equal(b.controller.grantForSession(b.session),null);
 b.mutate({enabled:true,source:'https://other-publisher.example'});assert.equal(b.controller.grantForSession(b.session),null);
 b.mutate({source,revision:'f'.repeat(64)});assert.equal(b.controller.grantForSession(b.session),null);
 b.mutate({revision:'e'.repeat(64),manifest:{...fixture,version:'0.1.1'}});assert.equal(b.controller.grantForSession(b.session),null);
 b.mutate({manifest:fixture,verified:false});assert.equal(b.controller.grantForSession(b.session),null);
 b.mutate({verified:true});assert.equal(b.controller.grantForSession(b.session).grants.length,1);
 assert.equal(b.controller.grantForSession({...b.session,scope:otherScope}),null);
});

test('SDK host.info is not advertised before grant, then actual asset requests succeed and revoke',async()=>{
 const b=harness();await b.runtime.connect(scope);await b.runtime.installSample(scope);await b.controller.remember(fixture);
 const listeners=new Map(),childListeners=new Map();
 const sourceWindow={addEventListener:(n,f)=>childListeners.set(n,f),removeEventListener:n=>childListeners.delete(n)};
 const frame={contentWindow:{postMessage:data=>childListeners.get('message')?.({source:parent,origin:'https://tavi.example',data})}};
 const parent={postMessage:data=>listeners.get('message')?.({source:frame.contentWindow,origin:'null',data})};
 const host=createExtensionHost({windowRef:{addEventListener:(n,f)=>listeners.set(n,f),removeEventListener:n=>listeners.delete(n)},
  storage:{getItem:()=>null,setItem:()=>{}},notify:()=>{},close:()=>{},assetService:b.runtime,
  assetGrants:()=>b.controller.grantForSession(b.session),
  approveAssetCustomization:()=>b.controller.grantForSession(b.session)?.grants.some(g=>g.canCustomize)});
 host.mount(frame,{...b.session,permissions:fixture.permissions});
 const sdk=createTaviXSDK(parent,sourceWindow);
 assert.equal((await sdk.info()).features.includes('tavi.assets/v1'),false);
 await assert.rejects(sdk.assets.connect(),/unavailable/);
 await b.controller.changeConsent({session:b.session,packId:SAMPLE_MANIFEST.id,kind:'read',enabled:true});
 assert.equal((await sdk.info()).features.includes('tavi.assets/v1'),true);
 await sdk.assets.connect();
 assert.equal((await sdk.assets.describe(SAMPLE_MANIFEST.id)).capabilities.length,2);
 assert.equal((await sdk.assets.resolve(SAMPLE_MANIFEST.id,'card.back')).contentType,'image/svg+xml');
 await assert.rejects(sdk.assets.select(SAMPLE_MANIFEST.id,'card.back','blue'),/customization denied/);
 await b.controller.changeConsent({session:b.session,packId:SAMPLE_MANIFEST.id,kind:'customize',enabled:true});
 await sdk.assets.select(SAMPLE_MANIFEST.id,'card.back','blue');
 assert.equal((await sdk.assets.resolve(SAMPLE_MANIFEST.id,'card.back')).selected,'blue');
 await b.controller.changeConsent({session:b.session,packId:SAMPLE_MANIFEST.id,kind:'read',enabled:false});
 await assert.rejects(sdk.assets.describe(SAMPLE_MANIFEST.id),/unavailable/);
 sdk.dispose();host.dispose();
});

test('device storage unavailability fails closed without a temporary memory store',async()=>{
 const runtime=createTaviAssetsRuntime({indexedDB:null});
 assert.equal(await runtime.connect(scope),false);
 assert.equal(runtime.ready(),false);
 assert.deepEqual(runtime.installedVersions(),{});
 assert.throws(()=>createIndexedAssetStorage({indexedDB:null,scope}),/unavailable/);
});

test('Assets settings exposes real free-pack installation and explicit per-app controls',()=>{
 const view=renderSettings({page:'assets',assetsAvailable:true,
  assetsInstalled:[[SAMPLE_MANIFEST.id,'0.1.1']],assetRequests:[{id:fixture.id,name:fixture.name,verified:true,
   dependencies:[{packId:SAMPLE_MANIFEST.id,version:'0.1.1',optional:false,read:false,customize:false,canCustomize:true,compatible:true}]}]});
 assert.match(view,/data-action="install-free-asset-pack"/);
 assert.match(view,/data-asset-kind="read"/);
 assert.doesNotMatch(view,/data-asset-kind="customize"/);
 const approved=renderSettings({page:'assets',assetsAvailable:true,assetRequests:[{id:fixture.id,name:fixture.name,verified:true,
   dependencies:[{packId:SAMPLE_MANIFEST.id,version:'0.1.1',optional:false,read:true,customize:false,canCustomize:true,compatible:true}]}]});
 assert.match(approved,/data-asset-kind="customize"/);
 assert.doesNotMatch(view,/data-action="buy"/);
});

function fakeIndexedDB(){
 const states=new Map();let created=false;
 const db={
  objectStoreNames:{contains:name=>created&&name==='account-stores'},
  createObjectStore:()=>{created=true;},
  transaction:(_name,mode)=>{
   const tx={oncomplete:null,onerror:null,onabort:null,error:null};
   tx.abort=()=>queueMicrotask(()=>tx.onabort?.());
   tx.objectStore=()=>({
    get:key=>{
     const req={result:null,onerror:null,onsuccess:null};
     queueMicrotask(()=>{
      req.result=states.has(key)?clone(states.get(key)):undefined;
      req.onsuccess?.();
      if(mode==='readonly')queueMicrotask(()=>tx.oncomplete?.());
     });
     return req;
    },
    put:(value,key)=>queueMicrotask(()=>{states.set(key,clone(value));tx.oncomplete?.();})
   });
   return tx;
  }
 };
 return {open:()=>{
  const req={result:db,onupgradeneeded:null,onsuccess:null,onerror:null};
  queueMicrotask(()=>{req.onupgradeneeded?.();req.onsuccess?.();});return req;
 }};
}

test('IndexedDB adapter commits complete snapshots across storage instances and aborts rejected writes',async()=>{
 const idb=fakeIndexedDB();
 const first=createIndexedAssetStorage({indexedDB:idb,scope});
 assert.deepEqual((await first.read()).installed,{});
 await first.transact(state=>{state.installed['org.tavi.cards.standard']={manifest:{version:'0.1.1'},files:{}};return 'ok';});
 const next=createIndexedAssetStorage({indexedDB:idb,scope});
 assert.equal((await next.read()).installed['org.tavi.cards.standard'].manifest.version,'0.1.1');
 await assert.rejects(next.transact(state=>{state.installed={};throw Error('rejected');}),/rejected/);
 assert.equal((await first.read()).installed['org.tavi.cards.standard'].manifest.version,'0.1.1');
 const other=createIndexedAssetStorage({indexedDB:idb,scope:otherScope});
 assert.deepEqual((await other.read()).installed,{});
});
