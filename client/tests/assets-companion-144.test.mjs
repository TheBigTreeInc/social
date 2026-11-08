import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createTaviAssetsRuntime} from '../src/assets/runtime.js';
import {SCENE_MANIFEST,SCENE_FILE_BASE64} from '../src/assets/sample-scenes.js';
import {SAMPLE_MANIFEST} from '../src/assets/sample-cards.js';
import {MemoryAssetStorage} from '../src/assets/vendor/tavi-assets-0.1.9/storage.mjs';
import {createAssetPermissionController} from '../src/assets/permissions.js';
import {createExtensionHost} from '../src/extensions/host.js';
import {REVIEWED_COMPANION} from '../src/extensions/reviewed-companion.js';
import {createTaviXSDK} from '../extension-sdk/index.js';

const scope='tavi.extensions.install/v1:test:account1';
const account2='tavi.extensions.install/v1:test:account2';
const sceneGrant={packId:SCENE_MANIFEST.id,capabilities:['scene.meadow.background'],canCustomize:false};
const context={scope,extensionId:REVIEWED_COMPANION.id,grants:[sceneGrant]};
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
function runtimeWithMemory(){
 const stores=new Map();
 const storageFactory=({scope:account})=>{
  if(!stores.has(account))stores.set(account,new MemoryAssetStorage());return stores.get(account);
 };
 return {runtime:createTaviAssetsRuntime({storageFactory}),stores,storageFactory};
}

test('the original Companion 0.6.43 Hollow Meadow scene installs through Assets 0.1.9 with verified PNG and per-account persistence',async()=>{
 const {runtime,storageFactory}=runtimeWithMemory();
 const source=Buffer.from(SCENE_FILE_BASE64,'base64');
 assert.equal(digest(source),SCENE_MANIFEST.files['art/hollow-meadow-test.png']);
 assert.equal(await runtime.connect(scope),true);
 assert.deepEqual(await runtime.installScenes(scope),{packId:SCENE_MANIFEST.id,version:SCENE_MANIFEST.version,changed:true});
 assert.equal((await runtime.installScenes(scope)).changed,false);
 assert.deepEqual(await runtime.listInstalled(scope),{[SCENE_MANIFEST.id]:SCENE_MANIFEST.version});
 const resolved=await runtime.request('assets.resolve',{packId:SCENE_MANIFEST.id,capability:'scene.meadow.background'},context);
 assert.equal(resolved.contentType,'image/png');assert.equal(resolved.encoding,'base64');
 assert.equal(digest(Buffer.from(resolved.data,'base64')),digest(source));
 const restarted=createTaviAssetsRuntime({storageFactory});
 assert.equal(await restarted.connect(scope),true);
 assert.equal((await restarted.listInstalled(scope))[SCENE_MANIFEST.id],SCENE_MANIFEST.version);
 assert.equal(await restarted.connect(account2),true);
 assert.deepEqual(await restarted.listInstalled(account2),{});
});

test('metadata and object discovery hide resources outside a session-scoped grant, before pagination',async()=>{
 const {runtime,stores}=runtimeWithMemory();await runtime.connect(scope);await runtime.installSample(scope);
 // Add two valid object metadata rows to the already validated reference pack.
 // Only card.back is granted; card.front must never appear in ANY discover/list/get result.
 await stores.get(scope).transact(s=>{s.installed[SAMPLE_MANIFEST.id].manifest.objects={
  'a.front':{kind:'card',name:'Private front',tags:['test'],resources:['card.front.ace-spades']},
  'z.back':{kind:'card',name:'Granted back',tags:['test'],resources:['card.back']}
 };});
 const trusted={scope,extensionId:'org.tavi.testconsumer',grants:[{packId:SAMPLE_MANIFEST.id,capabilities:['card.back'],canCustomize:false}]};
 const rows=await runtime.request('assets.objects.list',{packId:SAMPLE_MANIFEST.id,limit:1,offset:0},trusted);
 assert.equal(rows.total,1);assert.equal(rows.items[0].id,'z.back');assert.equal(rows.nextOffset,null);
 const discovered=await runtime.request('assets.objects.discover',{kind:'card',limit:1},trusted);
 assert.equal(discovered.total,1);assert.equal(discovered.items[0].object.id,'z.back');
 const info=await runtime.request('assets.describe',{packId:SAMPLE_MANIFEST.id},trusted);
 assert.equal(info.objectCount,1);
 await assert.rejects(runtime.request('assets.objects.get',{packId:SAMPLE_MANIFEST.id,objectId:'a.front'},trusted),/Unknown or unauthorized/);
 await assert.rejects(runtime.request('assets.resolve',{packId:SAMPLE_MANIFEST.id,capability:'card.front.ace-spades'},trusted),/access denied/);
});

test('dependency-status reports only approved readiness; grant revoke and source mismatch fail closed',async()=>{
 const {runtime}=runtimeWithMemory();await runtime.connect(scope);await runtime.installScenes(scope);
 const manifest=JSON.parse(await readFile(new URL('../public/tavi-extensions/org.tavi.community.companion/manifest.json',import.meta.url),'utf8'));
 assert.equal(manifest.version,'0.6.43');
 const session={id:manifest.id,scope,source:'tavi:bundled'};
 let enabled=true;
 const installation=c=>enabled&&c.id===manifest.id&&c.source==='tavi:bundled'&&c.scope===scope?{
  id:manifest.id,version:manifest.version,scope,source:'tavi:bundled',manifest,metadata:JSON.stringify(manifest),
  permissions:manifest.permissions,revision:'e'.repeat(64)}:null;
 const memory=new Map(),storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};
 const controller=createAssetPermissionController({storage,installation,runtime,verified:()=>true});
 await controller.remember(manifest);
 let status=await controller.dependencyStatus(session);
 assert.equal(status.schema,'tavi.assets.dependency-status/v1');
 assert.equal(status.features[0].optional[0].available,false);
 assert.equal(status.features[0].optional[0].selected,null);
 await controller.changeConsent({session,packId:SCENE_MANIFEST.id,kind:'read',enabled:true});
 status=await controller.dependencyStatus(session);
 assert.equal(status.features[0].optional[0].available,true);
 assert.equal(status.features[0].optional[0].selected.version,'0.1.0');
 assert.deepEqual(controller.grantForSession(session).grants,[sceneGrant]);
 await controller.changeConsent({session,packId:SCENE_MANIFEST.id,kind:'read',enabled:false});
 assert.equal((await controller.dependencyStatus(session)).features[0].optional[0].available,false);
 enabled=false;
 await assert.rejects(controller.dependencyStatus(session),/Verified asset dependency session unavailable/);
});

test('reviewed Companion cloud bridge enforces pinned bundle and does not reveal host tokens',async()=>{
 const received=[];const handlers=new Map();
 const child={postMessage:data=>received.push(data)};
 const host=createExtensionHost({windowRef:{addEventListener:(n,fn)=>handlers.set(n,fn),removeEventListener:n=>handlers.delete(n)},
  storage:{getItem:()=>null,setItem:()=>{}},notify:()=>{},close:()=>{},
  isReviewedCompanionSession:s=>s.id===REVIEWED_COMPANION.id&&s.reviewedBundle===REVIEWED_COMPANION.sha256,
  companionApi:async(method)=>method==='companion.get'?{ok:true,schema:'tavi.companion.cloud/v1',epoch:'X'.repeat(24),revision:0,snapshot:null}:null});
 const frame={contentWindow:child};
 const permissions=['ui.panel','storage.private','assets.read'];
 host.mount(frame,{id:REVIEWED_COMPANION.id,scope,source:'tavi:bundled',reviewedBundle:REVIEWED_COMPANION.sha256,permissions});
 const send=(id,method,extra={})=>handlers.get('message')({source:child,origin:'null',data:{channel:'tavi.extension/v1',direction:'request',id,method,...extra}});
 send(2_000_000_000,'companion.get');await new Promise(setImmediate);
 assert.equal(received.at(-1).ok,true);assert.equal(received.at(-1).result.snapshot,null);
 assert.equal(JSON.stringify(received).includes('Bearer'),false);
 send(2_000_000_001,'companion.put',{snapshot:'{}',revision:0,epoch:'short'});
 assert.equal(received.at(-1).ok,false);
 host.mount(frame,{id:'org.tavi.untrusted',scope,source:'tavi:bundled',permissions});
 send(2_000_000_002,'companion.get');assert.equal(received.at(-1).ok,false);
 host.dispose();
});

test('Assets SDK negotiates dependency status only when host advertises feature',async()=>{
 const calls=[];
 const {createTaviAssetsClient}=await import('../extension-sdk/assets-client.js');
 let hostFeatures=['tavi.assets/v1'];
 const sdk=createTaviAssetsClient({info:async()=>({features:hostFeatures}),request:async(method,params)=>{calls.push({method,params});return {schema:'tavi.assets.dependency-status/v1',features:[]};}});
 await sdk.connect();assert.throws(()=>sdk.dependencyStatus(),/unavailable/);
 hostFeatures=['tavi.assets/v1','tavi.assets.dependencies/v1'];await sdk.connect();
 assert.equal((await sdk.dependencyStatus()).schema,'tavi.assets.dependency-status/v1');
 assert.deepEqual(calls,[{method:'assets.dependencies.status',params:{}}]);
});
