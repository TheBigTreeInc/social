/** Host-side TaviX 0.1.11 Assets grants and explicit account/device consent.
 * This local consent document is NOT a grant. Every iframe request derives a
 * new ephemeral host-session projection against the currently verified install,
 * account, installed pack versions and declaration subset.
 * LoopRD remains authoritative for future paid entitlements.
 */
import {validateAssetDependencies,validateAssetGrantProjection,assetVersionCompare} from '../extensions/asset-dependencies.js';
const PREFIX='tavi.assets.consents/v1:';
const SHA=/^[a-f0-9]{64}$/;
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const isCompatible=(ver,dep)=>typeof ver==='string'&&assetVersionCompare(ver,dep.compatibility.min)>=0&&assetVersionCompare(ver,dep.compatibility.maxExclusive)<0;
const digest=async value=>{
 const sha=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
 return Array.from(new Uint8Array(sha),byte=>byte.toString(16).padStart(2,'0')).join('');
};
export function createAssetPermissionController({storage,installation,runtime,verified=()=>true}={}){
 if(!storage||typeof installation!=='function'||!runtime)throw Error('Asset permission controller needs trusted host dependencies');
 const hashes=new Map();
 const remember=async manifest=>{const text=JSON.stringify(manifest);const value=await digest(text);hashes.set(text,value);return value;};
 const records=scope=>{
  if(typeof scope!=='string'||!scope)return {};
  try{
   const value=JSON.parse(storage.getItem(PREFIX+scope)||'{}');
   return plain(value)&&Object.keys(value).length<=100?value:{};
  }catch{return {};}
 };
 const status=(session)=>{
  const item=installation(session);
  if(!item||!verified(session)||item.id!==session.id||item.scope!==session.scope||item.source!==session.source||
   item.metadata!==JSON.stringify(item.manifest)||item.version!==item.manifest.version||
   !Array.isArray(item.permissions)||JSON.stringify(item.permissions)!==JSON.stringify(item.manifest.permissions))return null;
  try{validateAssetDependencies(item.manifest);}catch{return null;}
  const sha=hashes.get(item.metadata);
  const consent=records(session.scope)[session.id];
  if(!sha||!SHA.test(sha)||!plain(consent)||consent.manifestSha256!==sha||
   consent.metadata!==item.metadata||consent.version!==item.version||consent.source!==item.source||
   consent.revision!==item.revision||!plain(consent.packs))return null;
  return {item,sha,consent};
 };
 const grantForSession=session=>{
  const current=status(session);
  if(!current||!runtime.ready())return null;
  const {item,sha,consent}=current;
  const versions=runtime.installedVersions(),deps=validateAssetDependencies(item.manifest);
  const grants=[];
  for(const dep of deps){
   if(!plain(consent.packs[dep.packId])||!consent.packs[dep.packId].read||
    !isCompatible(versions[dep.packId],dep))continue;
   const packConsent=consent.packs[dep.packId];
   grants.push({packId:dep.packId,capabilities:[...dep.capabilities],canCustomize:packConsent.customize===true&&dep.requestCustomization===true});
  }
  const projected={schema:'tavix.asset-grants/v1',extensionId:item.id,extensionVersion:item.version,
   manifestSha256:sha,scope:'host-session',grants};
  try{return validateAssetGrantProjection(item.manifest,sha,projected);}catch{return null;}
 };
 const consentFor=(scope,id,packId)=>{
  const data=records(scope)[id];return plain(data)&&plain(data.packs)?data.packs[packId]??null:null;
 };
 const changeConsent=async({session,packId,kind,enabled})=>{
  if(!['read','customize'].includes(kind)||typeof enabled!=='boolean')throw Error('Invalid Assets consent operation');
  const item=installation(session);
  if(!item||!verified(session)||item.id!==session.id||item.scope!==session.scope||item.source!==session.source||
   item.metadata!==JSON.stringify(item.manifest)||item.version!==item.manifest.version||
   JSON.stringify(item.permissions)!==JSON.stringify(item.manifest.permissions))throw Error('App must be installed and verified before approving assets');
  const dep=validateAssetDependencies(item.manifest).find(d=>d.packId===packId);
  if(!dep||(kind==='customize'&&!dep.requestCustomization))throw Error('App did not request this pack capability');
  if(enabled&&(!runtime.ready()||!isCompatible(runtime.installedVersions()[packId],dep)))throw Error('Required asset pack is not installed or has an incompatible version');
  const metadata=item.metadata,sha=await remember(item.manifest);
  // Verify the application, account and revision again after the async digest.
  const now=installation(session);
  if(!verified(session)||!now||now.metadata!==metadata||now.source!==item.source||now.revision!==item.revision||now.scope!==session.scope)throw Error('App changed while approving assets');
  const data=records(session.scope),existing=data[session.id];
  const same=plain(existing)&&existing.manifestSha256===sha&&existing.metadata===metadata&&existing.source===item.source&&existing.revision===item.revision;
  const packs=same&&plain(existing.packs)?{...existing.packs}:{};
  const prior=plain(packs[packId])?packs[packId]:{};
  const next={read:kind==='read'?enabled:prior.read===true,customize:kind==='customize'?enabled:prior.customize===true};
  if(kind==='read'&&!enabled)next.customize=false;
  if(kind==='customize'&&enabled)next.read=true;
  packs[packId]=next;
  data[session.id]={metadata,manifestSha256:sha,version:item.version,revision:item.revision,source:item.source,packs};
  storage.setItem(PREFIX+session.scope,JSON.stringify(data));
  return next;
 };
 return Object.freeze({remember,grantForSession,consentFor,changeConsent});
}
