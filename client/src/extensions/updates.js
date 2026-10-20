// Stateless installed-versus-published extension metadata comparison.
// The revision is a publisher-provided SHA-256 identity for the *published*
// release; a remote iframe is still hosted, not an immutable local install.
import {compareVersions} from './contract.js';
export function releaseRevision(entry){return entry?.release?.revision || null;}
export function extensionUpdateStatus(entry,store){
 const id=entry?.manifest?.id;
 if(!id||!store)return 'not-installed';
 if(typeof store.installed==='function' && !store.installed(id))return 'not-installed';
 if(store.source(id)!==(entry.repositoryUrl || 'tavi:bundled'))return 'source-changed';
 const installed=store.version(id),published=entry.manifest.version;
 if(!installed)return 'unknown';
 let comparison;
 try{comparison=compareVersions(published,installed);}catch{return 'unknown';}
 if(comparison>0)return 'update-available';
 if(comparison<0)return 'published-older';
 if(store.metadata?.(id) && store.metadata(id)!==JSON.stringify(entry.manifest))return 'update-available';
 if(store.permissions && store.permissions(id).join('\0')!==entry.manifest.permissions.join('\0'))return 'update-available';
 const hosted=entry.remote?.entrypoint || null;
 if(hosted && store.entrypoint?.(id)!==hosted)return 'update-available';
 if(!hosted && store.entrypoint?.(id))return 'update-available';
 // Legacy records do not have a digest. Once one is published for the same
 // version, require an explicit review to pin the new identity.
 const oldRevision=store.revision?.(id) || null,current=releaseRevision(entry);
 if(current && oldRevision!==current)return 'update-available';
 if(!current && oldRevision)return 'unknown';
 return 'current';
}
export function extensionUpdateSummary(entries,store,{staleSources=new Set()}={}){
 const statuses=entries.map(entry=>({id:entry.manifest.id,status:staleSources.has(entry.repositoryUrl)?'unavailable':extensionUpdateStatus(entry,store)}));
 const available=statuses.filter(x=>x.status==='update-available');
 const missing=(store?.listInstalled?.()||[]).filter(item=>!entries.some(e=>e.manifest.id===item.id));
 return {count:available.length,available,missing,statuses};
}
