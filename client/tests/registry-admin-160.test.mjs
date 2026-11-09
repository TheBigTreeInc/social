import test from 'node:test';
import assert from 'node:assert/strict';
import {createExtensionHost} from '../src/extensions/host.js';
import {createTaviXSDK} from '../src/extensions/sdk.js';
import {validateRegistryAdminRequest,REGISTRY_ADMIN_FEATURE} from '../src/extensions/registry-admin-host.js';
import {trustedAssetStudioInstall,APPROVED_ASSET_STUDIO_RELEASES} from '../src/extensions/registry-admin-trust.js';
import {validateExtensionManifest} from '../src/extensions/contract.js';
function harness({trusted=false,ready=false,approved=false,id='org.tavi.tools.asset-studio',source='https://trusted.example/index.json',permissions=['ui.panel',REGISTRY_ADMIN_FEATURE]}={}){
 const hostListeners=new Map(),childListeners=new Map(),calls=[];
 const child={addEventListener:(name,fn)=>childListeners.set(name,fn),removeEventListener:name=>childListeners.delete(name)};
 const frame={contentWindow:{postMessage:data=>childListeners.get('message')?.({source:parent,origin:'https://tavi.example',data})}};
 const parent={postMessage:data=>hostListeners.get('message')?.({source:frame.contentWindow,origin:'null',data})};
 const host=createExtensionHost({windowRef:{addEventListener:(name,fn)=>hostListeners.set(name,fn),removeEventListener:name=>hostListeners.delete(name)},
  storage:{getItem:()=>null,setItem:()=>{}},notify:()=>{},close:()=>{},
  isTrustedAssetStudioSession:()=>trusted,registryAdminReady:()=>ready,
  registryAdminApi:async(operation,params,confirm)=>{calls.push({operation,params,confirm});
    if(operation==='records.get')return {recordId:params.recordId,packId:'org.tavi.cards',version:'1.0.0',revision:2,manifestSha256:'f'.repeat(64)};
    return {schema:'tavix.registry-admin.status/v1',apiVersion:'1.0.0',allowedOperations:['status','publish'],maxUploadBytes:16777216,maxChunkBytes:262144};},
  approveRegistryAdmin:()=>approved});
 host.mount(frame,{id,source,scope:'account-a',revision:'a'.repeat(64),permissions});
 const sdk=createTaviXSDK(parent,child);
 return {host,sdk,calls,close(){sdk.dispose();host.dispose();},revoke(){trusted=false;},disable(){ready=false;},accept(){approved=true;}};
}
test('TaviX registry admin permission is a request, not a grant',()=>{
 const manifest={schema:'tavi.extension/v1',id:'org.tavi.tools.asset-studio',version:'0.1.0',name:'Asset Studio',summary:'Review asset packs',publisher:'tavi',kind:'app',hostApi:{min:'1.0.0',maxExclusive:'2.0.0'},entrypoints:{panel:'ui/index.html'},contributions:[],permissions:['ui.panel',REGISTRY_ADMIN_FEATURE],platforms:['web','windows','android']};
 assert.equal(validateExtensionManifest(manifest).compatible,true);
 assert.deepEqual(APPROVED_ASSET_STUDIO_RELEASES,[]);
 assert.equal(trustedAssetStudioInstall({id:manifest.id,version:'0.1.0',source:'https://trusted.example/index.json',revision:'a'.repeat(64),publisher:'tavi',permissions:manifest.permissions,accountAdmin:true,enabled:true,verified:true,scope:'a',accountScope:'a'}),false);
});
test('unapproved copies and ordinary users cannot see or invoke registry admin',async()=>{
 for(const opts of [{trusted:false,ready:true},{trusted:true,ready:false},{trusted:false,ready:false},{id:'org.evil.copy',trusted:false,ready:true}]){
  const h=harness(opts);const info=await h.sdk.info();assert(!info.features.includes(REGISTRY_ADMIN_FEATURE));
  assert(!(await h.sdk.capabilities()).includes(REGISTRY_ADMIN_FEATURE));
  await assert.rejects(h.sdk.registryAdmin.status(),/permission_denied/);
  assert.equal(h.calls.length,0);h.close();
 }
});
test('approved exact revision gets a narrow host API and cannot inject auth or endpoint fields',async()=>{
 const h=harness({trusted:true,ready:true});
 assert((await h.sdk.info()).features.includes(REGISTRY_ADMIN_FEATURE));
 assert((await h.sdk.capabilities()).includes(REGISTRY_ADMIN_FEATURE));
 const status=await h.sdk.registryAdmin.status();assert.equal(status.apiVersion,'1.0.0');
 await assert.rejects(h.sdk.registryAdmin.publish({recordId:'a'.repeat(24),expectedRevision:2,idempotencyKey:'b'.repeat(24),confirmed:true}),/invalid_request/);
 await assert.rejects(h.sdk.registryAdmin.stage.begin({fileName:'../evil.tavia',byteLength:1,sha256:'f'.repeat(64),idempotencyKey:'a'.repeat(24)}),/invalid_request/);
 await assert.rejects(h.sdk.registryAdmin.records.get({recordId:'a'.repeat(24),url:'https://evil.example'}),/invalid_request/);
 await assert.rejects(h.sdk.registryAdmin.price.propose({recordId:'a'.repeat(24),expectedRevision:2,priceGold:-1,idempotencyKey:'b'.repeat(24)}),/invalid_request/);
 h.revoke();await assert.rejects(h.sdk.registryAdmin.status(),/permission_denied/);
 h.close();
});
test('mutations require fresh canonical record + trusted confirmation, recheck revocation',async()=>{
 const h=harness({trusted:true,ready:true});
 const input={recordId:'a'.repeat(24),expectedRevision:2,idempotencyKey:'b'.repeat(24)};
 await assert.rejects(h.sdk.registryAdmin.publish(input),/confirmation_declined/);
 assert.equal(h.calls.length,1);assert.equal(h.calls[0].operation,'records.get');
 h.accept();await h.sdk.registryAdmin.publish(input);assert.deepEqual(h.calls.map(x=>x.operation),['records.get','records.get','publish']);
 assert.equal(h.calls.at(-1).confirm,true);
 h.close();
});
test('request parser agrees with TaviX v1 strict operation shape and does not allow extra fields',()=>{
 assert.equal(validateRegistryAdminRequest('assets.registry.admin.price.propose',
  {recordId:'a'.repeat(24),expectedRevision:2,priceGold:0,idempotencyKey:'b'.repeat(24)}),'price.propose');
 assert.throws(()=>validateRegistryAdminRequest('assets.registry.admin.records.get',{recordId:'a'.repeat(24),token:'stolen'}),/invalid_request/);
 assert.throws(()=>validateRegistryAdminRequest('assets.registry.admin.status',{actor:'acct_1'}),/invalid_request/);
});
