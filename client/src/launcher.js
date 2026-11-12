import {CORE_WALLET_ID} from './extensions/host.js';
/** The Tavi app drawer is local UI. It does not register/install third-party code.
 * Extensions only appear after explicit installation and while their pinned source
 * and version match the currently loaded catalog. Every tile has an icon fallback.
 */
import {extensionAssetUrl,validateExtensionManifest} from './extensions/contract.js';
import {extensionSource} from './extensions/repositories.js';
import {extensionUpdateStatus} from './extensions/updates.js';
import {resolveTavixClassification} from './extensions/classification.js';

export const BUILTIN_APPS=Object.freeze([
  {action:'contacts', label:'Messages', symbol:'messages', tone:'forest'},
  {action:'games', label:'Games', symbol:'games', tone:'violet'},
  {action:'wallet', label:'Wallet', symbol:'wallet', tone:'gold'},
  {action:'inbox', label:'Notifications', symbol:'bell', tone:'gold'},
  {action:'companion', label:'Companion', symbol:'paw', tone:'leaf'},
  {action:'portrait', label:'My portrait', symbol:'portrait', tone:'plum'},
  {action:'app-store', label:'Tavi Store', symbol:'store', tone:'teal'},
  {action:'people-directory', label:'Contacts', symbol:'people', tone:'blue'},
  {action:'settings', label:'Settings', symbol:'settings', tone:'slate'}
]);
/** Apps is an installed-application launcher, not a duplicate of the persistent
 * Chats and Games navigation. Preserve the builtins for their original routes. */
const ROOT_NAV_ACTIONS=new Set(['contacts','games']);
export function drawerApplications(apps){
 return apps.filter(app=>!(app.kind==='builtin'&&ROOT_NAV_ACTIONS.has(app.action)));
}
export const BUNDLED_COMPANION_ID='org.tavi.community.companion';
export {appGlyph,uiGlyph} from './ui/glyphs.js';
export function launchableExtensions({catalog,store,platform}){
 if(!store)return [];
 return catalog.filter(entry=>{
  const m=entry?.manifest;
  if(!m||m.id===CORE_WALLET_ID||m.id===BUNDLED_COMPANION_ID||!store.enabled(m.id)||extensionUpdateStatus(entry,store)!=='current')return false;
  if(m.platforms&&!m.platforms.includes(platform))return false;
  if(!m.contributions.some(c=>c.slot==='app.launcher'))return false;
  try{return validateExtensionManifest(m).compatible;}catch{return false;}
 }).map(entry=>({kind:'extension',id:entry.manifest.id,label:entry.manifest.name,entry,
     symbol:entry.manifest.id==='inc.thebigtree.tavi.atrium'?'atrium':resolveTavixClassification(entry.manifest).type==='game'?'games':'extension',tone:'forest'}));
}
/** Verified, currently installed TaviX game inventory for *Tavi's own UI*.
 * Never infer from names, URLs, game APIs or unapproved repository changes.
 * The restricted Atrium host projection consumes this same filtered inventory.
 */
export function installedGameExtensions({catalog=[],store=null,platform='web',staleSources=new Set()}={}){
 if(!store)return [];
 // Classification is independent of an optional app.launcher contribution:
 // some games are intentionally opened only from Games or Atrium.
 return catalog.filter(entry=>{
  const manifest=entry?.manifest;
  if(!manifest||manifest.id===CORE_WALLET_ID||!store.enabled(manifest.id)||
     extensionUpdateStatus(entry,store)!=='current'||
     (manifest.platforms&&!manifest.platforms.includes(platform)))return false;
  if(entry.repositoryUrl&&staleSources.has(entry.repositoryUrl))return false;
  try{
   const approvedText=store.metadata?.(manifest.id);
   if(typeof approvedText!=='string'||approvedText!==JSON.stringify(manifest))return false;
   const approved=JSON.parse(approvedText);
   if(!validateExtensionManifest(approved).compatible)return false;
   const classification=resolveTavixClassification(approved);
   if(classification.type!=='game'||store.classification?.(manifest.id)===null)return false;
   const storedClassification=store.classification?.(manifest.id);
   if(storedClassification&&JSON.stringify(storedClassification)!==JSON.stringify(classification))return false;
   return true;
  }catch{return false;}
 }).map(entry=>({kind:'extension',id:entry.manifest.id,label:entry.manifest.name,entry,symbol:'games',tone:'forest',classification:resolveTavixClassification(entry.manifest)}));
}

export function menuApplications({catalog=[],store=null,platform='web',petEnabled=false}={}){
 return [...BUILTIN_APPS.filter(a=>!a.requiresPet||petEnabled||Boolean(store?.enabled(BUNDLED_COMPANION_ID))).map(a=>({...a,kind:'builtin'})),
    ...launchableExtensions({catalog,store,platform})];
}
// Icons must be relative, manifest-validated assets. Never resolve a URL or
// pass credentials supplied directly by an untrusted extension manifest.
export function extensionIconUrl(entry,baseUrl){
 const icon=entry?.manifest?.icon;
 if(!icon||entry?.local)return null;
 validateExtensionManifest(entry.manifest);
 if(entry.remote){
  const entrypoint=new URL(entry.remote.entrypoint);
  const path=entry.manifest.entrypoints.panel;
  if(!entrypoint.pathname.endsWith('/'+path))throw Error('Extension entrypoint does not match manifest');
  const assetBase=new URL(entrypoint.href.slice(0,-path.length));
  const url=new URL(icon,assetBase);
  if(url.origin!==entrypoint.origin||!url.pathname.startsWith(assetBase.pathname))throw Error('Extension icon escaped application bundle');
  return url.href;
 }
 return extensionAssetUrl(entry.manifest.id,icon,baseUrl);
}
