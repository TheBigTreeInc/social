/** Tavi Assets 0.1.7 consumer-contract/v1 — Tavi-owned authorization boundary.
 * This is NOT an asset manager, pack installer, catalogue or entitlement issuer.
 * The real service is owned by Tavi Assets; unavailable services fail closed.
 */
export const ASSETS_FEATURE = 'tavi.assets/v1';
const SHAPES = Object.freeze({
 'assets.packs.list': [[], ['type','tags','offset','limit']],
 'assets.objects.discover': [[], ['kind','tags','offset','limit']],
 'assets.composition.resolve': [['components'], []],
 'assets.describe': [['packId'], []],
 'assets.objects.list': [['packId'], ['kind','rarity','tags','offset','limit']],
 'assets.objects.get': [['packId','objectId'], []],
 'assets.collections.list': [['packId'], ['kind']],
 'assets.collections.get': [['packId','collectionId'], []],
 'assets.preferences.get': [['packId'], []],
 'assets.preferences.set': [['packId','capability','variant'], []],
 'assets.resolve': [['packId','capability'], []]
});
const RESULT_SCHEMAS = Object.freeze({
 'assets.packs.list':'tavi.assets.pack-list/v1',
 'assets.objects.discover':'tavi.assets.discovery/v1',
 'assets.composition.resolve':'tavi.assets.composition/v1',
 'assets.describe':'tavi.assets.pack-info/v1',
 'assets.objects.list':'tavi.assets.object-list/v1',
 'assets.objects.get':'tavi.assets.object/v1',
 'assets.collections.list':'tavi.assets.collection-list/v1',
 'assets.collections.get':'tavi.assets.collection/v1',
 'assets.preferences.get':'tavi.assets.preferences/v1',
 'assets.preferences.set':'tavi.assets.preferences/v1',
 'assets.resolve':'tavi.assets.resource/v1'
});
const PACK = /^[a-z0-9][a-z0-9._-]{0,126}$/;
const IDENTIFIER = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const own=(obj,k)=>Object.prototype.hasOwnProperty.call(obj,k);
const record=x=>!!x&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const safeId=(s,re)=>typeof s==='string'&&re.test(s);
function normalizedGrants(projection){
 if(!record(projection)||projection.schema!=='tavix.asset-grants/v1'||projection.scope!=='host-session'||
    !safeId(projection.manifestSha256,/^[a-f0-9]{64}$/)||!Array.isArray(projection.grants)||projection.grants.length>16)return null;
 const byPack=new Map();
 for(const grant of projection.grants){
  if(!record(grant)||Object.keys(grant).sort().join(',')!=='canCustomize,capabilities,packId'||
   !safeId(grant.packId,PACK)||byPack.has(grant.packId)||!Array.isArray(grant.capabilities)||
   grant.capabilities.length<1||grant.capabilities.length>32||
   grant.capabilities.some(c=>!safeId(c,IDENTIFIER))||new Set(grant.capabilities).size!==grant.capabilities.length||
   typeof grant.canCustomize!=='boolean')return null;
  byPack.set(grant.packId,{capabilities:new Set(grant.capabilities),canCustomize:grant.canCustomize});
 }
 return {byPack};
}
const hasCapability=(grants,packId,capability)=>grants.byPack.get(packId)?.capabilities.has(capability)===true;

export function assetsAvailable(service,grants){
 try{return !!service&&typeof service.ready==='function'&&service.ready()===true&&
   typeof service.request==='function'&&!!normalizedGrants(grants)&&grants.grants.length>0;}
 catch{return false;}
}
function checkedParams(method,input){
 const shape=SHAPES[method];
 if(!shape||!record(input))throw Error('Unsupported host assets request');
 const [required,optional]=shape;
 if(required.some(k=>!own(input,k))||Object.keys(input).some(k=>!required.includes(k)&&!optional.includes(k)))throw Error('Invalid or unauthorized host request fields');
 if(own(input,'packId')&&!safeId(input.packId,PACK))throw Error('Invalid packId');
 for(const key of ['objectId','collectionId','capability','variant','kind','rarity','type']){
  if(own(input,key)&&!safeId(input[key],IDENTIFIER))throw Error(`Invalid ${key}`);
 }
 if(own(input,'tags')&&(!Array.isArray(input.tags)||input.tags.length>32||input.tags.some(tag=>!safeId(tag,IDENTIFIER))))throw Error('Invalid asset tags');
 if(own(input,'offset')&&(!Number.isSafeInteger(input.offset)||input.offset<0))throw Error('Invalid asset offset');
 if(own(input,'limit')&&(!Number.isSafeInteger(input.limit)||input.limit<1||input.limit>100))throw Error('Invalid asset limit');
 if(method==='assets.composition.resolve'){
  if(!Array.isArray(input.components)||input.components.length===0||input.components.length>12)throw Error('Invalid composition components');
  const slots=new Set();
  for(const component of input.components){
   if(!record(component)||Object.keys(component).sort().join(',')!=='capability,packId,slot'||
      !safeId(component.packId,PACK)||!safeId(component.capability,IDENTIFIER)||!safeId(component.slot,IDENTIFIER)||
      slots.has(component.slot))throw Error('Invalid composition component');
   slots.add(component.slot);
  }
 }

 return {...input};
}
function safeResource(result){
 if(result.encoding!=='base64'||typeof result.data!=='string'||result.data.length>2_796_204||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(result.data)||result.data.length%4!==0||
    typeof result.contentType!=='string'||! /^(image\/(png|jpeg|webp|svg\+xml)|audio\/(ogg|wav|mpeg))$/.test(result.contentType))
  throw Error('Invalid or oversized asset resource');
}
function checkedResult(method,params,result,grants){
 if(!record(result)||result.schema!==RESULT_SCHEMAS[method]||
    (params.packId!==undefined&&result.packId!==params.packId))throw Error('Invalid Tavi Assets service response');
 // The engine itself validates installed packs, entitlement and media data.
 // Recheck the cross-pack response so even a buggy adapter cannot return
 // metadata/resources from an ungranted pack.
 if(method==='assets.packs.list'||method==='assets.objects.discover'||method==='assets.composition.resolve'){
  if(!Array.isArray(result.items)||result.items.length>100)throw Error('Invalid cross-pack assets response');
  for(const item of result.items){
   if(!record(item)||!grants.byPack.has(item.packId))throw Error('Cross-pack asset access denied');
   if(method==='assets.packs.list'&&(!Array.isArray(item.capabilities)||item.capabilities.some(c=>!hasCapability(grants,item.packId,c))))throw Error('Unapproved asset capability returned');
   if(method==='assets.objects.discover'&&Array.isArray(item.object?.resources)&&item.object.resources.some(c=>!hasCapability(grants,item.packId,c)))throw Error('Unapproved asset object capability returned');
   if(method==='assets.composition.resolve'){
    const requested=params.components.find(c=>c.slot===item.slot&&c.packId===item.packId&&c.capability===item.capability);
    if(!requested||!hasCapability(grants,item.packId,item.capability))throw Error('Unapproved composition resource');
    safeResource(item);
   }
  }
  if(method==='assets.composition.resolve'&&result.items.length!==params.components.length)throw Error('Incomplete asset composition');
 }
 // A buggy or compromised Assets adapter must not leak capabilities through
 // single-pack metadata either; enforce each pack's own approved subset.
 if(params.packId!==undefined){
  const safeCaps=grants.byPack.get(params.packId)?.capabilities;
  if(!safeCaps)throw Error('Asset grant revoked');
  const matchCaps=values=>Array.isArray(values)&&values.every(cap=>safeCaps.has(cap));
  if(method==='assets.describe'&&!matchCaps(result.capabilities))throw Error('Unapproved asset pack capabilities returned');
  if(method==='assets.objects.list'&&(!Array.isArray(result.items)||result.items.some(item=>!record(item)||!matchCaps(item.resources??[]))))throw Error('Unapproved asset object returned');
  if(method==='assets.objects.get'&&(!record(result.object)||!matchCaps(result.object.resources??[])))throw Error('Unapproved asset object returned');
  if((method==='assets.preferences.get'||method==='assets.preferences.set')&&
     (!Array.isArray(result.items)||result.items.some(item=>!record(item)||!safeCaps.has(item.capability))))throw Error('Unapproved asset preference returned');
 }
 // Check the total size before the shape of any large inline media.
 if(method==='assets.resolve'&&typeof result.data==='string'&&result.data.length>2_796_204)throw Error('Asset response exceeds host transport limit');
 if(method==='assets.resolve')safeResource(result);
 // Restrict the wire to bounded, JSON-only data. Never expose file paths or
 // privileged URLs from an untrusted extension via a custom host transport.
 let wire;
 try{wire=JSON.stringify(result);}catch{throw Error('Invalid Tavi Assets service response');}
 if(!wire||wire.length>5_800_000)throw Error('Asset response exceeds host transport limit');
 return result;
}
/** Only first-party Tavi bootstrap may supply service and grants. The iframe
 * cannot set either; each request re-evaluates session and current grants.
 */
export async function dispatchAssetsRequest({service,grantForSession,approveCustomization=()=>false,isActive=()=>true,session,method,params}){
 const project=()=>typeof grantForSession==='function'?grantForSession(session):null;
 const projection=project();
 if(!assetsAvailable(service,projection))throw Error('Tavi Assets feature unavailable');
 if(!isActive()||projection.extensionId!==session.id)throw Error('Tavi Assets session expired');
 const clean=checkedParams(method,params),grant=normalizedGrants(projection);
 if(clean.packId!==undefined&&!grant.byPack.has(clean.packId))throw Error('Host asset access denied');
 if(method==='assets.composition.resolve'&&clean.components.some(x=>!hasCapability(grant,x.packId,x.capability)))throw Error('Host asset composition denied');
 if((method==='assets.resolve'||method==='assets.preferences.set')&&!hasCapability(grant,clean.packId,clean.capability))throw Error('Host asset capability denied');
 if(method==='assets.preferences.set'&&(!grant.byPack.get(clean.packId)?.canCustomize||
    await approveCustomization(session,clean)!==true))throw Error('Host asset customization denied');
 if(!isActive())throw Error('Tavi Assets session expired');
 const current=project();
 if(!assetsAvailable(service,current)||JSON.stringify(current)!==JSON.stringify(projection))throw Error('Tavi Assets grant changed');
 const caller=Object.freeze({extensionId:session.id,scope:session.scope,source:session.source,
  grants:Object.freeze([...grant.byPack].map(([packId,g])=>Object.freeze({packId,
    capabilities:Object.freeze([...g.capabilities]),canCustomize:g.canCustomize})))});
 // No pack installation, entitlement, filesystem or wallet methods are reachable
 // through this consumer-facing bridge. Only the trusted service may perform those.
 const result=await service.request(method,Object.freeze(clean),caller);
 if(!isActive()||!assetsAvailable(service,project())||JSON.stringify(project())!==JSON.stringify(projection))
  throw Error('Tavi Assets grant or session revoked');
 return checkedResult(method,clean,result,grant);
}
/** Runtime slot for a future first-party, imported Assets engine.
 * No global registration, extension-supplied implementation or Python process.
 */
export function createAssetsRuntimeSlot(){
 let runtime=null;
 return Object.freeze({
  ready:()=>!!runtime&&runtime.ready()===true,
  request:(method,params,caller)=>{
   if(!runtime||runtime.ready()!==true)throw Error('Tavi Assets engine not connected');
   return runtime.request(method,params,caller);
  },
  // Only Tavi's compiled bootstrap has access to the slot; never export it on window.
  attach:engine=>{
   if(runtime)throw Error('Tavi Assets engine already connected');
   if(!engine||typeof engine.ready!=='function'||typeof engine.request!=='function')throw Error('Invalid Tavi Assets engine');
   runtime=engine;
  }
 });
}
