/** Tavi-owned integration of the unmodified Tavi Assets 0.1.9 portable engine.
 * This is the privileged first-party bridge, NOT a TaviX importable SDK.
 * Pack bytes and preferences remain owned/validated by AssetService.
 */
import {AssetService} from './vendor/tavi-assets-0.1.9/service.mjs';
import {manifestRevision} from './vendor/tavi-assets-0.1.9/validation.mjs';
import {createIndexedAssetStorage} from './indexeddb-storage.js';
import {SAMPLE_MANIFEST,SAMPLE_FILES} from './sample-cards.js';
import {SCENE_MANIFEST,SCENE_FILE_BASE64} from './sample-scenes.js';
const allowed=(caller,pack,capability=null,customize=false)=>{
 const grant=caller?.grants?.find(g=>g.packId===pack);
 if(!grant||(capability!==null&&!grant.capabilities.includes(capability))||(customize&&!grant.canCustomize))throw Error('Host asset access denied');
 return grant;
};
const canSee=(object,grant)=>Array.isArray(object?.resources)&&object.resources.some(c=>grant.capabilities.includes(c));
const filterResources=(object,grant)=>({...object,resources:object.resources.filter(c=>grant.capabilities.includes(c))});
const visibleEntries=(manifest,collection,grant)=>collection.entries.filter(e=>canSee(manifest.objects?.[e.objectId],grant));
const describeGranted=(manifest,grant)=>({schema:'tavi.assets.pack-info/v1',packId:manifest.id,version:manifest.version,type:manifest.type,
 display:manifest.display??{},tags:manifest.tags??[],taxonomy:manifest.taxonomy??{},
 capabilities:Object.keys(manifest.resources).filter(c=>grant.capabilities.includes(c)),
 objectCount:Object.values(manifest.objects??{}).filter(o=>canSee(o,grant)).length,
 collectionCount:Object.values(manifest.collections??{}).filter(c=>visibleEntries(manifest,c,grant).length>0).length});
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
    (origin==='tavi:bundled:sample-pack'&&packId===SAMPLE_MANIFEST.id&&version===SAMPLE_MANIFEST.version&&
    manifestSha256===await manifestRevision(SAMPLE_MANIFEST)) ||
    (origin==='tavi:bundled:companion-scenes'&&packId===SCENE_MANIFEST.id&&version===SCENE_MANIFEST.version&&
    manifestSha256===await manifestRevision(SCENE_MANIFEST));
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
 const trustedCapabilities=async(accountScope,packId)=>{requireScope(accountScope);
  if(!Object.hasOwn(versions,packId))return [];return Object.keys((await service.getManifest(packId)).resources);};
 const installScenes=async accountScope=>{
  requireScope(accountScope);
  const bound=service,ticket=epoch;
  // Companion's original hash-listed PNG is embedded in this first-party build.
  const raw=atob(SCENE_FILE_BASE64),bytes=Uint8Array.from(raw,ch=>ch.charCodeAt(0));
  const result=await bound.install({manifest:SCENE_MANIFEST,files:{'art/hollow-meadow-test.png':bytes},origin:'tavi:bundled:companion-scenes'});
  const latest=await bound.listInstalled();
  if(ticket!==epoch||scope!==accountScope||service!==bound)throw Error('Tavi Assets account changed during installation');
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
     rows.push(describeGranted(await bound.getManifest(grant.packId),grant));
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
     for(const [objectId,object] of items)if(canSee(object,grant))rows.push({packId:grant.packId,version:manifest.version,object:filterResources({id:objectId,...object},grant)});
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
    return describeGranted(await bound.getManifest(pack),packGrant);
   }
   case 'assets.objects.list':{
    const manifest=await bound.getManifest(pack);
    const entries=Object.entries(manifest.objects??{}).filter(([,o])=>canSee(o,packGrant)&&
      (params.kind===undefined||o.kind===params.kind)&&(params.rarity===undefined||o.rarity===params.rarity)&&matchesTags(o.tags??[],params.tags??[]))
     .sort(([a],[b])=>a.localeCompare(b)).map(([id,o])=>filterResources({id,...o},packGrant));
    return {schema:'tavi.assets.object-list/v1',packId:pack,version:manifest.version,...filterRows(entries,params.offset??0,params.limit??100)};
   }
   case 'assets.objects.get':{
    const result=await bound.getObject(pack,params.objectId);
    if(!canSee(result.object,packGrant))throw Error('Unknown or unauthorized object');
    return {...result,object:filterResources(result.object,packGrant)};
   }
   case 'assets.collections.list':{
    const manifest=await bound.getManifest(pack);
    return {schema:'tavi.assets.collection-list/v1',packId:pack,version:manifest.version,
      items:Object.entries(manifest.collections??{}).filter(([,c])=>(!params.kind||c.kind===params.kind)&&visibleEntries(manifest,c,packGrant).length)
       .map(([id,c])=>({id,kind:c.kind,name:c.name,tags:c.tags??[],objectCount:visibleEntries(manifest,c,packGrant).length}))};
   }
   case 'assets.collections.get':{
    const manifest=await bound.getManifest(pack);
    const collection=manifest.collections?.[params.collectionId];
    if(!collection)throw Error('Unknown or unauthorized collection');
    const entries=visibleEntries(manifest,collection,packGrant);
    if(!entries.length)throw Error('Unknown or unauthorized collection');
    return {schema:'tavi.assets.collection/v1',packId:pack,version:manifest.version,id:params.collectionId,...collection,entries};
   }
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
 return Object.freeze({ready,connect,installedVersions,listInstalled,installSample,installScenes,trustedCapabilities,request});
}
