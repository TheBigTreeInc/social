import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createExtensionHost} from '../src/extensions/host.js';
import {createAssetsRuntimeSlot,ASSETS_FEATURE,dispatchAssetsRequest} from '../src/assets/host-bridge.js';
import {createTaviXSDK} from '../extension-sdk/index.js';
import {renderSettings,settingsPageTitle} from '../src/ui/settings-view.js';

const packId='org.tavi.example.cards';
const makeGrant=(canCustomize=false)=>({schema:'tavix.asset-grants/v1',extensionId:'org.tavi.klondike',extensionVersion:'0.1.0',manifestSha256:'a'.repeat(64),scope:'host-session',grants:[{packId,capabilities:['card.back','card.front'],canCustomize}]});
const grant=makeGrant();
function harness({service=null,grants=()=>null,approve=()=>false}={}){
 const hostListeners=new Map(),childListeners=new Map();
 const source={addEventListener:(name,fn)=>childListeners.set(name,fn),removeEventListener:name=>childListeners.delete(name)};
 const frame={contentWindow:{postMessage:data=>childListeners.get('message')?.({source:parent,origin:'https://tavi.example',data})}};
 const parent={postMessage:data=>hostListeners.get('message')?.({source:frame.contentWindow,origin:'null',data})};
 const host=createExtensionHost({windowRef:{addEventListener:(k,fn)=>hostListeners.set(k,fn),removeEventListener:k=>hostListeners.delete(k)},storage:{getItem:()=>null,setItem:()=>{}},notify:()=>{},close:()=>{},assetService:service,assetGrants:grants,approveAssetCustomization:approve});
 host.mount(frame,{id:'org.tavi.klondike',scope:'social-account',source:'tavi:local',permissions:['ui.panel','assets.read','assets.preferences.write']});
 const sdk=createTaviXSDK(parent,source);
 return {host,sdk,source,parent,frame,hostListeners};
}
const response=(method,params)=>({schema:({'assets.describe':'tavi.assets.pack-info/v1','assets.objects.list':'tavi.assets.object-list/v1','assets.objects.get':'tavi.assets.object/v1','assets.collections.list':'tavi.assets.collection-list/v1','assets.collections.get':'tavi.assets.collection/v1','assets.preferences.get':'tavi.assets.preferences/v1','assets.preferences.set':'tavi.assets.preferences/v1','assets.resolve':'tavi.assets.resource/v1'})[method],packId:params.packId,...(method==='assets.describe'?{capabilities:['card.back','card.front']}:{}),...(method==='assets.preferences.get'||method==='assets.preferences.set'?{items:[{capability:'card.back'}]}:{}),...(method==='assets.objects.list'?{items:[]}:{}),...(method==='assets.objects.get'?{object:{id:params.objectId,resources:[]}}:{}),...(method==='assets.resolve'?{encoding:'base64',data:'AA==',contentType:'image/png',capability:params.capability}: {})});
const active=()=>({ready:()=>true,request:(method,params)=>response(method,params)});

test('production default does not advertise assets and SDK rejects calls before negotiation',async()=>{
 const b=harness();const info=await b.sdk.info();assert(!info.features.includes(ASSETS_FEATURE));
 await assert.rejects(b.sdk.assets.connect(),/unavailable/);
 await assert.rejects(b.sdk.assets.describe(packId),/connect\(\)/);
 b.sdk.dispose();b.host.dispose();
});
test('Tavi negotiates assets only with active service plus authenticated host grants',async()=>{
 const b=harness({service:active(),grants:()=>grant});
 assert((await b.sdk.info()).features.includes(ASSETS_FEATURE));
 assert.deepEqual(await b.sdk.assets.connect(),{feature:ASSETS_FEATURE,api:'1.0.0'});
 assert.deepEqual(await b.sdk.assets.describe(packId),response('assets.describe',{packId}));
 assert.deepEqual(await b.sdk.assets.listCollections(packId,{kind:'deck'}),response('assets.collections.list',{packId}));
 assert.deepEqual(await b.sdk.assets.resolve(packId,'card.back'),response('assets.resolve',{packId,capability:'card.back'}));
 b.sdk.dispose();b.host.dispose();
});
test('missing, revoked and cross-pack grants cannot reach asset runtime',async()=>{
 let calls=0;let current=grant;
 const service={ready:()=>true,request:(m,p)=>{calls++;return response(m,p);}};
 const b=harness({service,grants:()=>current});
 await b.sdk.assets.connect();
 await assert.rejects(b.sdk.assets.describe('org.tavi.someone.else'),/access denied/);
 current=null;await assert.rejects(b.sdk.assets.describe(packId),/unavailable/);
 assert.equal(calls,0);
 b.sdk.dispose();b.host.dispose();
});
test('untrusted request fields and wrong types are rejected before service invocation',async()=>{
 let calls=0;const service={ready:()=>true,request:(m,p)=>{calls++;return response(m,p);}};
 const b=harness({service,grants:()=>grant});await b.sdk.assets.connect();
 for(const payload of [{packId,callerId:'admin'},{packId,path:'C:\\secret'},{packId,grants:['*']},{packId,limit:101},{packId,tags:['ok','../../bad']},{packId,offset:-1}]){
  await assert.rejects(b.sdk.assets.listObjects(packId,payload),/fields|tags|limit|offset/);
 }
 assert.equal(calls,0);
 b.sdk.dispose();b.host.dispose();
});
test('customization demands both a current grant and explicit host-owned consent',async()=>{
 let writes=0;const service={ready:()=>true,request:(m,p)=>{writes++;return response(m,p);}};
 let activeGrant=makeGrant();const b=harness({service,grants:()=>activeGrant,approve:()=>false});await b.sdk.assets.connect();
 await assert.rejects(b.sdk.assets.select(packId,'card.back','blue'),/customization denied/);
 activeGrant=makeGrant(true);await assert.rejects(b.sdk.assets.select(packId,'card.back','blue'),/customization denied/);
 await assert.rejects(b.sdk.assets.select(packId,'ungranted.capability','blue'),/capability denied/);
 assert.equal(writes,0);b.sdk.dispose();b.host.dispose();
 const allowed=harness({service,grants:()=>makeGrant(true),approve:()=>true});await allowed.sdk.assets.connect();
 assert.equal((await allowed.sdk.assets.select(packId,'card.back','blue')).schema,'tavi.assets.preferences/v1');assert.equal(writes,1);
 allowed.sdk.dispose();allowed.host.dispose();
});
test('malformed responses and executable media cannot cross host boundary',async()=>{
 let bad={schema:'wrong',packId};const service={ready:()=>true,request:()=>bad};
 const b=harness({service,grants:()=>grant});await b.sdk.assets.connect();
 await assert.rejects(b.sdk.assets.describe(packId),/Invalid Tavi Assets service response/);
 bad={...response('assets.resolve',{packId,capability:'card.back'}),contentType:'text/html'};
 await assert.rejects(b.sdk.assets.resolve(packId,'card.back'),/Invalid or oversized asset resource/);
 bad={...response('assets.resolve',{packId,capability:'card.back'}),data:'A'.repeat(3_000_000)};
 await assert.rejects(b.sdk.assets.resolve(packId,'card.back'),/exceeds host transport limit/);
 b.sdk.dispose();b.host.dispose();
});
test('caller context originates from mounted host session, not extension parameters',async()=>{
 let seen;const service={ready:()=>true,request:(m,p,caller)=>{seen=caller;return response(m,p);}};
 const b=harness({service,grants:session=>{assert.deepEqual(session,{id:'org.tavi.klondike',scope:'social-account',source:'tavi:local'});return grant;}});
 await b.sdk.assets.connect();await b.sdk.assets.describe(packId);
 assert.deepEqual(seen,{extensionId:'org.tavi.klondike',scope:'social-account',source:'tavi:local',grants:[{packId,capabilities:['card.back','card.front'],canCustomize:false}]});
 assert(Object.isFrozen(seen));
 b.sdk.dispose();b.host.dispose();
});
test('runtime slot does not invent an Assets engine or accept duplicate attachment',async()=>{
 const slot=createAssetsRuntimeSlot();assert.equal(slot.ready(),false);assert.throws(()=>slot.request('assets.describe',{packId},{}),/not connected/);
 slot.attach(active());assert.equal(slot.ready(),true);assert.throws(()=>slot.attach(active()),/already connected/);
 assert.equal((await slot.request('assets.describe',{packId},{})).schema,'tavi.assets.pack-info/v1');
});
test('Settings integrates Assets Library without inventing installed packs or purchases',async()=>{
 assert.equal(settingsPageTitle('assets'),'Assets Library');
 assert.match(renderSettings({page:'root',assetsAvailable:false}),/data-settings-page="assets"/);
 const pending=renderSettings({page:'assets',assetsAvailable:false});assert.match(pending,/unavailable/);assert.doesNotMatch(pending,/data-action="buy|data-action="install-asset/);
 const available=renderSettings({page:'assets',assetsAvailable:true});assert.match(available,/engine connected/);
 const main=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(main,/assetService:assetsRuntime/);assert.match(main,/assetGrants:activeAssetGrants/);
 assert.doesNotMatch(main,/window\.(?:taviAssets|assetsRuntime)\s*=/);
});
