/** TAVI-STORE-001 — one first-party discovery surface, separate authority domains.
 * All markup is composed from host-rendered, escaped catalog metadata. Neither
 * TaviX repository entries nor Assets catalog records grant install permissions.
 */
import {uiEscape as esc} from './components.js';
import {resolveTavixClassification} from '../extensions/classification.js';
import {CORE_WALLET_ID} from '../extensions/host.js';
import {assetCard} from './asset-market.js';

const INTERNAL_IDS=new Set([CORE_WALLET_ID,'inc.thebigtree.ziprunner.review']);
export function privateStoreEntry(entry){
 const manifest=entry?.manifest;
 if(!manifest||typeof manifest.id!=='string')return false;
 return INTERNAL_IDS.has(manifest.id)||manifest.id.startsWith('org.tavi.core.')||
  manifest.id.startsWith('org.tavi.examples.')||
  manifest.permissions?.some(permission=>['ziprunner.review','assets.registry.admin/v1'].includes(permission))===true;
}
export function storeKind(entry){
 try{return resolveTavixClassification(entry.manifest).type==='game'?'games':'apps';}
 catch{return 'apps';}
}
export function storeProjection(rows=[],assets=[],view='discover'){
 const safeRows=rows.filter(row=>row?.entry?.manifest?.id);
 const publicRows=safeRows.filter(row=>!privateStoreEntry(row.entry));
 const privateRows=safeRows.filter(row=>privateStoreEntry(row.entry));
 switch(view){
  case 'apps':return {apps:publicRows.filter(row=>storeKind(row.entry)==='apps'),assets:[]};
  case 'games':return {apps:publicRows.filter(row=>storeKind(row.entry)==='games'),assets:[]};
  case 'assets':return {apps:[],assets};
  case 'library':return {apps:safeRows.filter(row=>row.installed),assets:assets.filter(item=>item.installedVersion)};
  case 'private':return {apps:privateRows,assets:[]};
  default:return {apps:publicRows,assets};
 }
}
const categoryTabs=[['discover','✨','Discover'],['apps','🧩','Apps'],['games','🎮','Games'],['assets','🎨','Assets']];
function tabs(view){return `<nav class="tavi-storefront-tabs" aria-label="Store categories">${categoryTabs.map(([id,art,label])=>`<button type="button" data-store-view="${id}" aria-current="${view===id?'page':'false'}"><span aria-hidden="true" class="tavi-storefront-tab-art">${art}</span><span>${label}</span></button>`).join('')}</nav>`;}
function tiles(rows,assets,{appCard,assetsAvailable}){
 return `<div class="tavi-storefront-grid">${rows.map(row=>appCard(row)).join('')}${assets.map(item=>`<div class="tavi-storefront-asset" data-store-item data-store-kind="assets" data-marketplace-installed="${Boolean(item.installedVersion)}" data-marketplace-update="false" data-marketplace-search="${esc(`${item.title} ${item.description} ${item.category}`.toLocaleLowerCase())}">${assetCard(item,assetsAvailable,{detailOnly:true})}</div>`).join('')}</div>`;
}
function section(title,subtitle,rows,assets,options){
 if(!rows.length&&!assets.length)return '';
 return `<section class="tavi-storefront-section" aria-label="${esc(title)}"><header><h3>${esc(title)}</h3><p>${esc(subtitle)}</p></header>${tiles(rows,assets,options)}</section>`;
}
export function renderStorefront({rows=[],assets=[],assetsAvailable=false,onlineState='not-configured',view='discover',query='',filter='all',displayName='Your account',portrait='',offers=0,checked='',status='',error='',detailHtml='',appCard=()=>''}={}){
 const projection=storeProjection(rows,assets,view);
 const options={appCard,assetsAvailable};
 const isDiscover=view==='discover',isLibrary=view==='library',isPrivate=view==='private';
 const account=`<button type="button" class="tavi-storefront-profile" data-store-view="library" aria-label="Open my library and private apps" title="My library">${portrait||'<span aria-hidden="true">👤</span>'}</button>`;
 const search=isLibrary||isPrivate?'':`<label class="tavi-storefront-search"><span class="sr-only">Search the Tavi Store</span><input id="tavi-store-search" type="search" placeholder="What sounds fun today?" maxlength="100" autocomplete="off" value="${esc(query.slice(0,100))}"></label>`;
 const listing=detailHtml?`<div class="tavi-storefront-details">${detailHtml}</div>`:isDiscover?
  `<section class="tavi-storefront-hero" aria-label="Discover Tavi"><div class="tavi-storefront-hero-copy"><span class="tavi-storefront-eyebrow">YOUR TAVI, YOUR WORLD</span><h3>Find something fun!</h3><p>Games, little discoveries and new ways to make Tavi yours.</p><button type="button" data-store-view="assets">Explore packs <span aria-hidden="true">↗</span></button></div><div class="tavi-storefront-hero-art" aria-hidden="true"><span>🎮</span><span>✨</span><span>🎨</span></div></section>
  ${section('Apps & games','Find something new to enjoy',projection.apps,[],options)}
  ${section('Make it yours','Fun extras, scenery and card packs',[],projection.assets,options)}`:
  section(isLibrary?'Installed on this device':isPrivate?'Private & system apps':view==='assets'?'Explore assets':view==='games'?'Explore games':'Explore apps',
   isLibrary?'Apps and packs available to this signed-in account on this device':isPrivate?'These tools are not listed in public discovery':view==='assets'?'Content managed by Tavi Assets':'Applications provided through TaviX',projection.apps,projection.assets,options);
 const libraryNav=isLibrary?`<div class="tavi-storefront-library-nav"><button type="button" data-store-view="private">Private &amp; system apps</button><button type="button" data-action="settings-assets">Asset permissions</button><button type="button" data-action="settings-sources">App sources</button></div>`:'';
 const privateNav=isPrivate?`<p class="tavi-storefront-note">System applications stay out of Store discovery. Launch permissions and existing host security checks still apply.</p>`:'';
 const footer=onlineState==='available'?'Assets catalog connected. Remote packs need verified installers.': 'Bundled assets work offline. Additional packs need an approved Assets catalog.';
 return `<section class="utility tavi-app-store tavi-marketplace tavi-storefront" aria-label="Tavi Store">
  <header class="tavi-storefront-header"><div><span class="tavi-storefront-eyebrow">DISCOVER · PLAY · CREATE</span><h2>${isLibrary?'My library':isPrivate?'Private apps':'Find your fun'} <span aria-hidden="true" class="tavi-storefront-title-star">✦</span></h2></div>${account}</header>
  <div class="tavi-store-pull-indicator" data-store-pull-status role="status" aria-live="polite" hidden></div>
  ${detailHtml?'':isLibrary||isPrivate?`<div class="tavi-storefront-account"><strong>${esc(displayName)}</strong><span>${isPrivate?'Private area':'My library'}</span><button type="button" data-store-view="${isPrivate?'library':'discover'}">${isPrivate?'Back to library':'Explore Store'}</button></div>`:tabs(view)}
  ${detailHtml?'':search}${detailHtml?'':isLibrary?`<nav class="tavi-marketplace-filters" aria-label="Library filters"><button type="button" data-marketplace-filter="all" aria-pressed="${filter==='all'}">Installed</button><button type="button" data-marketplace-filter="updates" aria-pressed="${filter==='updates'}">Updates${offers?` (${offers})`:''}</button></nav>`:''}
  ${error?`<p role="alert" class="notice">${esc(error)}</p>`:''}
  ${listing}${detailHtml?'':libraryNav}${detailHtml?'':privateNav}
  <p class="tavi-marketplace-empty" id="tavi-marketplace-empty" hidden>No matching items in this section.</p>
  ${!detailHtml&&!projection.apps.length&&!projection.assets.length?'<p class="tavi-storefront-note">Nothing to display yet. New approved content will appear here when available.</p>':''}
  <footer class="tavi-storefront-footer"><p role="status">${esc(status)}${checked?` · Checked ${esc(checked)}`:''}</p><p>${esc(footer)}</p><button type="button" class="tavi-storefront-footer-refresh" data-action="store-refresh">Refresh catalog</button></footer>
 </section>`;
}
