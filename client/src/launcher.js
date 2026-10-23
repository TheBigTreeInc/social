import {CORE_WALLET_ID} from './extensions/host.js';
/** The Tavi app drawer is local UI. It does not register/install third-party code.
 * Extensions only appear after explicit installation and while their pinned source
 * and version match the currently loaded catalog. Every tile has an icon fallback.
 */
import {extensionAssetUrl,validateExtensionManifest} from './extensions/contract.js';
import {extensionSource} from './extensions/repositories.js';
import {extensionUpdateStatus} from './extensions/updates.js';

export const BUILTIN_APPS=Object.freeze([
  {action:'contacts', label:'Messages', symbol:'messages', tone:'forest'},
  {action:'games', label:'Games', symbol:'games', tone:'violet'},
  {action:'wallet', label:'Wallet', symbol:'wallet', tone:'gold'},
  {action:'inbox', label:'Notifications', symbol:'bell', tone:'gold'},
  {action:'companion', label:'Companion', symbol:'paw', tone:'leaf'},
  {action:'portrait', label:'My portrait', symbol:'portrait', tone:'plum'},
  {action:'app-store', label:'App Store', symbol:'store', tone:'teal'},
  {action:'add-friend', label:'Add friend', symbol:'person-plus', tone:'blue'},
  {action:'settings', label:'Settings', symbol:'settings', tone:'slate'}
]);
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
     symbol:entry.manifest.id==='inc.thebigtree.tavi.atrium'?'atrium':'extension',tone:'forest'}));
}
export function menuApplications({catalog=[],store=null,platform='web',petEnabled=false}={}){
 return [...BUILTIN_APPS.filter(a=>!a.requiresPet||petEnabled||Boolean(store?.enabled(BUNDLED_COMPANION_ID))).map(a=>({...a,kind:'builtin'})),
    ...launchableExtensions({catalog,store,platform})];
}
// Icons must be relative, manifest-validated assets. Never resolve a URL or
// pass credentials supplied directly by an untrusted extension manifest.
export function extensionIconUrl(entry,baseUrl){
 const icon=entry?.manifest?.icon;
 if(!icon)return null;
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
