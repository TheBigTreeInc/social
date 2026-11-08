/** Tavi Assets 0.1.4 consumer-contract/v1 — Tavi-owned authorization boundary.
 * This is NOT an asset manager, pack installer, catalogue or entitlement issuer.
 * The real service is owned by Tavi Assets; unavailable services fail closed.
 */
export const ASSETS_FEATURE = 'tavi.assets/v1';
const SHAPES = Object.freeze({
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
function normalizedGrants(grants){
 if(!record(grants)||!Array.isArray(grants.packs)||!Array.isArray(grants.capabilities)||
    grants.packs.length>64||grants.capabilities.length>256||
    grants.packs.some(id=>!safeId(id,PACK))||grants.capabilities.some(id=>!safeId(id,IDENTIFIER)))return null;
 return {packs:new Set(grants.packs),capabilities:new Set(grants.capabilities),canCustomize:grants.canCustomize===true};
}
export function assetsAvailable(service,grants){
 try{return !!service&&typeof service.ready==='function'&&service.ready()===true&&
   typeof service.request==='function'&&!!normalizedGrants(grants)&&grants.packs.length>0;}
 catch{return false;}
}
function checkedParams(method,input){
 const shape=SHAPES[method];
 if(!shape||!record(input))throw Error('Unsupported host assets request');
 const [required,optional]=shape;
 if(required.some(k=>!own(input,k))||Object.keys(input).some(k=>!required.includes(k)&&!optional.includes(k)))throw Error('Invalid or unauthorized host request fields');
 if(!safeId(input.packId,PACK))throw Error('Invalid packId');
 for(const key of ['objectId','collectionId','capability','variant','kind','rarity']){
  if(own(input,key)&&!safeId(input[key],IDENTIFIER))throw Error(`Invalid ${key}`);
 }
 if(own(input,'tags')&&(!Array.isArray(input.tags)||input.tags.length>32||input.tags.some(tag=>!safeId(tag,IDENTIFIER))))throw Error('Invalid asset tags');
 if(own(input,'offset')&&(!Number.isSafeInteger(input.offset)||input.offset<0))throw Error('Invalid asset offset');
 if(own(input,'limit')&&(!Number.isSafeInteger(input.limit)||input.limit<1||input.limit>100))throw Error('Invalid asset limit');
 return {...input};
}
function checkedResult(method,packId,result){
 if(!record(result)||result.schema!==RESULT_SCHEMAS[method]||result.packId!==packId)throw Error('Invalid Tavi Assets service response');
 // Restrict the wire to bounded, JSON-only data. The service must independently
 // reject unsafe media and never include filesystem paths or privileged URLs.
 let wire;
 try{wire=JSON.stringify(result);}catch{throw Error('Invalid Tavi Assets service response');}
 if(!wire||wire.length>3_000_000)throw Error('Asset response exceeds host transport limit');
 if(method==='assets.resolve'){
  if(result.encoding!=='base64'||typeof result.data!=='string'||result.data.length>2_796_204||
     !/^[A-Za-z0-9+/]*={0,2}$/.test(result.data)||
     !Number.isInteger(result.data.length/4)||
     typeof result.contentType!=='string'||! /^(image\/(png|jpeg|webp|svg\+xml)|audio\/(ogg|wav|mpeg))$/.test(result.contentType))
   throw Error('Invalid or oversized asset resource');
 }
 return result;
}
/** Only first-party Tavi bootstrap may supply service and grants. The iframe
 * cannot set either; each request re-evaluates session and current grants.
 */
export async function dispatchAssetsRequest({service,grantForSession,approveCustomization=()=>false,isActive=()=>true,session,method,params}){
 const grants=typeof grantForSession==='function'?grantForSession(session):null;
 if(!assetsAvailable(service,grants))throw Error('Tavi Assets feature unavailable');
 if(!isActive())throw Error('Tavi Assets session expired');
 const clean=checkedParams(method,params),grant=normalizedGrants(grants);
 if(!grant.packs.has(clean.packId))throw Error('Host asset access denied');
 if((method==='assets.resolve'||method==='assets.preferences.set')&&!grant.capabilities.has(clean.capability))throw Error('Host asset capability denied');
 if(method==='assets.preferences.set'&&(!grant.canCustomize||await approveCustomization(session,clean)!==true))throw Error('Host asset customization denied');
 if(!isActive())throw Error('Tavi Assets session expired');
 const caller=Object.freeze({extensionId:session.id,scope:session.scope,source:session.source,
  packs:Object.freeze([...grant.packs]),capabilities:Object.freeze([...grant.capabilities]),canCustomize:grant.canCustomize});
 // The trusted engine is responsible for verifying pack installation and any
 // entitlements. Neither the manifest nor the extension message grants ownership.
 const result=await service.request(method,Object.freeze(clean),caller);
 return checkedResult(method,clean.packId,result);
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
