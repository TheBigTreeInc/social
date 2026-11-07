// Tavi Settings directory: a navigation registry, never a way for untrusted
// extension HTML to execute inside the trusted host settings document.
// Entries are declarative, installed/approved and account-scoped.
import {validateExtensionManifest} from '../extensions/contract.js';

/** Installed TaviX apps may contribute a Settings link using settings.app.
 * A link opens the app in its normal isolated panel, with launchContext=settings.
 * Settings are not copied from games or mixed into host-owned configuration.
 */
export function extensionSettingsEntries(catalog,store,{platform}={}){
 if(!store||!Array.isArray(catalog))return [];
 const entries=[];
 const seen=new Set();
 for(const entry of catalog){
  const catalogManifest=entry?.manifest;
  if(!catalogManifest||seen.has(catalogManifest.id)||!store.enabled(catalogManifest.id))continue;
  // Use the manifest explicitly approved at installation, never new repository
  // metadata presented under an unchanged version. Publisher edits must not
  // add a Settings entry without a new operator-approved install/update.
  let manifest;
  try{
   manifest=JSON.parse(store.metadata(catalogManifest.id));
   if(!validateExtensionManifest(manifest).compatible||manifest.id!==catalogManifest.id||
       manifest.version!==catalogManifest.version||manifest.publisher!==catalogManifest.publisher)continue;
  }catch{continue;}
  if(platform&&manifest.platforms&&!manifest.platforms.includes(platform))continue;
  const source=entry.local?'tavi:local':entry.repositoryUrl||'tavi:bundled';
  // Only the exact approved source may contribute a settings shortcut.
  if(store.source(manifest.id)!==source)continue;
  const link=manifest.contributions.find(c=>c.slot==='settings.app'&&c.action==='openPanel');
  if(!link)continue;
  seen.add(manifest.id);
  entries.push(Object.freeze({id:manifest.id,name:manifest.name,label:link.label}));
 }
 return entries.sort((a,b)=>a.name.localeCompare(b.name));
}
