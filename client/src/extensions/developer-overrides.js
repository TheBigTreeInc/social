/** Developer-owned, per-account TaviX shadow index. No trusted first-party grants.
 * Packages remain in the existing SHA-verified IndexedDB archive store.
 * A shadow never alters the published extension installation or bundled code.
 */
export const DEV_OVERRIDE_PREFIX='tavi.developer-overrides/v1:';
const ID=/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+){2,}$/;
const SHA=/^[a-f0-9]{64}$/;
const MAX_OVERRIDES=20;
export function isProtectedDeveloperIdentity(manifest,store){
 const id=manifest?.id;
 return typeof id==='string'&&(id.startsWith('org.tavi.core.')||
  id==='org.tavi.community.companion'||id==='inc.thebigtree.ziprunner.review'||
  manifest.permissions?.includes('ziprunner.review')||
  (store?.installed?.(id)===true&&store.source(id)!=='tavi:local'));
}
export function readDeveloperOverrides(storage,scope){
 if(!scope)return [];
 let parsed;try{parsed=JSON.parse(storage.getItem(DEV_OVERRIDE_PREFIX+scope)||'[]');}catch{return [];}
 if(!Array.isArray(parsed)||parsed.length>MAX_OVERRIDES)return [];
 const ids=new Set();
 return parsed.filter(row=>{
  if(!row||typeof row!=='object'||typeof row.id!=='string'||!ID.test(row.id)||
   typeof row.revision!=='string'||!SHA.test(row.revision)||ids.has(row.id))return false;
  ids.add(row.id);return true;
 }).map(row=>({id:row.id,revision:row.revision}));
}
export function pinDeveloperOverride(storage,scope,id,revision){
 if(!scope||!ID.test(id)||!SHA.test(revision))throw Error('Invalid developer overlay identity');
 const records=readDeveloperOverrides(storage,scope).filter(r=>r.id!==id);
 if(records.length>=MAX_OVERRIDES)throw Error('Too many local developer previews');
 records.push({id,revision});storage.setItem(DEV_OVERRIDE_PREFIX+scope,JSON.stringify(records));
}
export function unpinDeveloperOverride(storage,scope,id){
 if(!scope)return;
 storage.setItem(DEV_OVERRIDE_PREFIX+scope,JSON.stringify(readDeveloperOverrides(storage,scope).filter(r=>r.id!==id)));
}
export function devPreviewHostPermissions(permissions){
 // Never grant ZipRunner review, wallet, Companion or Atrium-specific host access
 // just because a developer ZIP claims an identity or privileged permission.
 return Array.isArray(permissions)?permissions.filter(x=>['ui.panel','ui.toast','storage.private'].includes(x)):[];
}
export const devPreviewStorageScope=(accountScope,revision)=>`${accountScope}:dev-preview:${revision}`;
