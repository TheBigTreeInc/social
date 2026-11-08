/** Tavi-owned integration of the unmodified Tavi Assets 0.1.7 portable engine.
 * This is the privileged first-party bridge, NOT a TaviX importable SDK.
 * Pack bytes and preferences remain owned/validated by AssetService.
 */
import {AssetService} from './vendor/tavi-assets-0.1.7/service.mjs';
import {manifestRevision} from './vendor/tavi-assets-0.1.7/validation.mjs';
import {createIndexedAssetStorage} from './indexeddb-storage.js';
import {SAMPLE_MANIFEST,SAMPLE_FILES} from './sample-cards.js';
const allowed=(caller,pack,capability=null,customize=false)=>{
 const grant=caller?.grants?.find(g=>g.packId===pack);
 if(!grant||(capability!==null&&!grant.capabilities.includes(capability))||(customize&&!grant.canCustomize))throw Error('Host asset access denied');
 return grant;
};
const filterResources=(object,grant)=>({...object,resources:Array.isArray(object.resources)?object.resources.filter(c=>grant.capabilities.includes(c)):[]});
const filterRows=(rows,offset=0,limit=100)=>({items:rows.slice(offset,offset+limit),total:rows.length,nextOffset:offset+limit<rows.length?offset+limit:null});
const matchesTags=(tags,selected)=>selected.every(t=>tags.includes(t));
export function createTaviAssetsRuntime({indexedDB,storageFactory=createIndexedAssetStorage}={}){
 let scope=null,service=null,available=false,versions={},epoch=0;
 const ready=()=>available&&!!scope&&!!service;
 const installedVersions=()=>ready()?{...versions}:{};
 const connect=async accountScope=>{
  const ticket=++epoch; available=false;scope=null;service=null;versions={};
  if(!accountScope)return false;
  try{
   const storage=storageFactory({indexedDB,scope:accountScope});
   const authorizer=async({packId,version,origin,manifestSha256})=>
    origin==='tavi:bundled:sample-pack'&&packId===SAMPLE_MANIFEST.id&&version===SAMPLE_MANIFEST.version&&
    manifestSha256===await manifestRevision(SAMPLE_MANIFEST);
   const candidate=new AssetService({storage,authorizeInstall:authorizer});
   const installed=await candidate.listInstalled();
   if(ticket!==epoch)return false;
   scope=accountScope;service=candidate;versions=installed;available=true;return true;
  }catch{
   if(ticket===epoch){scope=null;service=null;versions={};available=false;}
   return false;
  }
 };
 const requireScope=accountScope=>{if(!ready()||scope!==accountScope)throw Error('Tavi Assets runtime unavailable for account');};
 const listInstalled=async accountScope=>{requireScope(accountScope);return installedVersions();};
 const installSample=async accountScope=>{
  requireScope(accountScope);
  const bound=service,ticket=epoch;
  const files=Object.fromEntries(Object.entries(SAMPLE_FILES).map(([name,data])=>[name,new TextEncoder().encode(data)]));
  const result=await bound.install({manifest:SAMPLE_MANIFEST,files,origin:'tavi:bundled:sample-pack'});
  const latest=await bound.listInstalled();
  if(ticket!==epoch||scope!==accountScope||service!==bound)throw Error('Tavi Assets account changed during installation');
  // Do not advertise new grants before the committed version index is loaded.
  versions=latest;return result;
 };
 const request=async(method,params,caller)=>{
  requireScope(caller?.scope);
  if(!Array.isArray(caller.grants)||caller.grants.length===0||
   caller.grants.some(g=>!Object.hasOwn(versions,g.packId)))throw Error('Host asset grant revoked');
  const bound=service;
  const pack=params.packId;
  const packGrant=pack===undefined?null:allowed(caller,pack);
  switch(method){
   case 'assets.packs.list':{
    const rows=[];
    for(const grant of caller.grants){
     const item=await bound.describe(grant.packId);
     if((params.type!==undefined&&item.type!==params.type)||!matchesTags(item.tags,params.tags??[]))continue;
     rows.push({...item,capabilities:item.capabilities.filter(c=>grant.capabilities.includes(c))});
    }
    rows.sort((a,b)=>a.packId.localeCompare(b.packId));
    return {schema:'tavi.assets.pack-list/v1',...filterRows(rows,params.offset??0,params.limit??50)};
   }
   case 'assets.objects.discover':{
    // Fetch all available metadata then filter each resource by its OWN pack grant.
    // Never apply pagination before the permission-filtered result is assembled.
    const rows=[];
    for(const grant of caller.grants){
     const manifest=await bound.getManifest(grant.packId);
     const items=Object.entries(manifest.objects??{}).filter(([,obj])=>(params.kind===undefined||obj.kind===params.kind)&&matchesTags(obj.tags??[],params.tags??[])).sort(([a],[b])=>a.localeCompare(b));
     for(const [objectId,object] of items)rows.push({packId:grant.packId,version:manifest.version,object:filterResources({id:objectId,...object},grant)});
    }
    rows.sort((a,b)=>a.packId.localeCompare(b.packId)||a.object.id.localeCompare(b.object.id));
    return {schema:'tavi.assets.discovery/v1',...filterRows(rows,params.offset??0,params.limit??100)};
   }
   case 'assets.composition.resolve':{
    const items=[];let size=0;
    for(const {slot,packId,capability} of params.components){
     allowed(caller,packId,capability);
     const row=await bound.resolve(packId,capability,caller.extensionId);
     size+=row.data.length;if(size>5_500_000)throw Error('Asset composition exceeds limit');
     items.push({slot,...row});
    }
    return {schema:'tavi.assets.composition/v1',items};
   }
   case 'assets.describe':{
    const item=await bound.describe(pack);
    return {...item,capabilities:item.capabilities.filter(c=>packGrant.capabilities.includes(c))};
   }
   case 'assets.objects.list':{
    const result=await bound.listObjects(pack,params);
    return {...result,items:result.items.map(item=>filterResources(item,packGrant))};
   }
   case 'assets.objects.get':{
    const result=await bound.getObject(pack,params.objectId);
    return {...result,object:filterResources(result.object,packGrant)};
   }
   case 'assets.collections.list':return bound.listCollections(pack,params);
   case 'assets.collections.get':return bound.getCollection(pack,params.collectionId);
   case 'assets.preferences.get':{
    const result=await bound.preferences(pack,caller.extensionId);
    return {...result,items:result.items.filter(item=>packGrant.capabilities.includes(item.capability))};
   }
   case 'assets.preferences.set':{
    allowed(caller,pack,params.capability,true);
    await bound.setApplicationPreference(caller.extensionId,pack,params.capability,params.variant);
    const result=await bound.preferences(pack,caller.extensionId);
    return {...result,items:result.items.filter(item=>packGrant.capabilities.includes(item.capability))};
   }
   case 'assets.resolve':{
    allowed(caller,pack,params.capability);
    return bound.resolve(pack,params.capability,caller.extensionId);
   }
   default:throw Error('Unsupported Tavi Assets operation');
  }
 };
 return Object.freeze({ready,connect,installedVersions,listInstalled,installSample,request});
}
