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
// All paths are fixed markup literals: no source-derived SVG attributes.
export const BUNDLED_COMPANION_ID='org.tavi.community.companion';
const SHAPES=Object.freeze({
 'messages':'<path d="M5 7h22v15H14l-7 5v-5H5z"/><path d="M10 12h12M10 17h8"/>',
 'games':'<path d="M10 11h12c3 0 5 3 6 9l1 4c.5 3-2.5 4.1-4.5 2l-4.5-4h-8l-4.5 4C5.5 28.1 2.5 27 3 24l1-4c1-6 3-9 6-9z"/><path d="M9 15v7m-3.5-3.5h7M23 16h.01M26 19h.01"/>',
 'wallet':'<rect x="4" y="7" width="24" height="21" rx="4"/><path d="M4 13h24M19 18h9v7h-9z"/><circle cx="23" cy="21.5" r="1"/>',
 'bell':'<path d="M7 23h18l-2.5-4v-6a6.5 6.5 0 0 0-13 0v6z"/><path d="M13 27c.6 3 5.4 3 6 0"/>',
 'paw':'<ellipse cx="16" cy="23" rx="7" ry="5"/><ellipse cx="7" cy="13" rx="2" ry="3"/><ellipse cx="13" cy="9" rx="2" ry="3"/><ellipse cx="20" cy="9" rx="2" ry="3"/><ellipse cx="26" cy="13" rx="2" ry="3"/>',
 'portrait':'<circle cx="16" cy="12" r="5"/><path d="M6 27c.7-7 5-10 10-10s9.3 3 10 10z"/>',
 'store':'<path d="M7 12h18v16H7zM5 12l3-8h16l3 8-3 4-4-4-4 4-4-4-4 4z"/><path d="M14 28V19h6v9"/>',
 'person-plus':'<circle cx="13" cy="11" r="5"/><path d="M4 27c0-6 4-10 9-10 3 0 5 1 7 3M25 20v9m-4.5-4.5h9"/>',
 'settings':'<circle cx="16" cy="16" r="5"/><path d="m13 3 1 4h4l1-4 4 2-2 4 3 3 4-1 1 5-4 1-1 4 3 3-4 4-3-3-4 1-1 4-5-1 1-4-4-2-3 2-3-4 3-3-1-4-4-1 1-5 4 1 3-3-2-4z"/>',
 'extension':'<path d="M12 4h8v5a4 4 0 1 1 0 8v10H5V17h5a4 4 0 1 0 0-8V4h2z"/>',
 'atrium':'<path d="M5 26V12l11-7 11 7v14M11 26V14h10v12M7 9h18"/><circle cx="16" cy="18" r="2"/>',
 'notepad':'<rect x="7" y="4" width="18" height="24" rx="3"/><path d="M12 10h9M12 16h9M12 22h6"/>'
});
export function appGlyph(name){
 const shape=SHAPES[name]||SHAPES.extension;
 return `<svg class="tavi-app-glyph" aria-hidden="true" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round">${shape}</svg>`;
}
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
