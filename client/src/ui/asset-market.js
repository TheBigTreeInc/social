/** First-party Tavi Assets discovery and account-local management surface.
 * Only the bundled, byte-verified pack is currently installable. Online catalog
 * metadata must come from a trusted Assets source, not an extension iframe.
 */
import {uiEscape} from './components.js';
import {SAMPLE_MANIFEST} from '../assets/sample-cards.js';
import {SCENE_MANIFEST} from '../assets/sample-scenes.js';

const safe=value=>uiEscape(value??'');
export const BUNDLED_ASSET_ITEM=Object.freeze({
 id:SAMPLE_MANIFEST.id,title:'Classic Playing Cards',category:'Cards & decks',
 description:'A free starter pack for compatible card games. Includes a card front and green or blue backs.',
 version:SAMPLE_MANIFEST.version,priceGold:0,source:'Bundled with Tavi'
});

export const BUNDLED_SCENE_ITEM=Object.freeze({id:SCENE_MANIFEST.id,title:'Hollow Meadow',category:'Companion scenes',
 description:'Painted meadow for Companion 0.6.43. Free, stored on this device for this account.',
 version:SCENE_MANIFEST.version,priceGold:0,source:'Bundled with Tavi'});
export function assetMarketEntries({installedVersions={},onlineEntries=[]}={}){
 // Remote entries are metadata-only: never turn an unverified catalog listing
 // into a local installer or paid entitlement. The bundled revision is pinned.
 const entries=[BUNDLED_ASSET_ITEM,BUNDLED_SCENE_ITEM];
 for(const entry of onlineEntries){
  if(!entry||[BUNDLED_ASSET_ITEM.id,BUNDLED_SCENE_ITEM.id].includes(entry.id)||typeof entry.id!=='string'||!/^([a-z0-9][a-z0-9._-]{0,126})$/.test(entry.id))continue;
  if(typeof entry.title!=='string'||entry.title.length>160||typeof entry.category!=='string'||entry.category.length>80)continue;
  entries.push({id:entry.id,title:entry.title,category:entry.category,description:String(entry.summary||'').slice(0,400),
   version:String(entry.version||''),priceGold:null,source:'Online catalog',remote:true});
 }
 return entries.map(e=>({...e,installedVersion:installedVersions[e.id]||null,installable:[BUNDLED_ASSET_ITEM.id,BUNDLED_SCENE_ITEM.id].includes(e.id)&&!installedVersions[e.id]}));
}
const cardArt=`<div class="tavi-asset-card-art" aria-hidden="true"><span class="tavi-asset-playing-card"><b>A</b><span>♠</span></span><span class="tavi-asset-playing-card tavi-asset-playing-back"></span></div>`;
function assetCard(item,ready){
 const installed=item.installedVersion;
 return `<article class="tavi-asset-product" data-asset-item data-asset-search="${safe(`${item.title} ${item.description} ${item.category}`.toLowerCase())}" data-asset-category="${safe(item.category)}" data-asset-installed="${!!installed}">
  ${item.remote?'<div class="tavi-asset-remote-art" aria-hidden="true">✦</div>':item.id===BUNDLED_SCENE_ITEM.id?'<div class="tavi-asset-remote-art" aria-hidden="true">🌿</div>':cardArt}
  <div class="tavi-asset-product-body"><span class="tavi-asset-category">${safe(item.category)}</span><h3>${safe(item.title)}</h3><p>${safe(item.description)}</p><small>${safe(item.source)} · v${safe(item.version||'—')}</small>
   <div class="tavi-asset-product-foot"><strong>${item.priceGold===0?'Free':item.priceGold===null?'Not for sale':`${item.priceGold} Gold`}</strong>
    ${installed?'<span class="tavi-asset-owned">Installed</span>':item.installable&&ready?`<button type="button" data-action="install-free-asset-pack" data-asset-install-id="${safe(item.id)}">Install</button>`:item.remote?'<span class="tavi-asset-not-ready">Awaiting verified package</span>':'<span class="tavi-asset-not-ready">Unavailable</span>'}</div></div></article>`;
}

function permissionRows(apps){
 if(!apps.length)return '<p class="tavi-asset-empty-state">No installed apps have declared asset dependencies yet.</p>';
 return apps.map(app=>`<section class="tavi-asset-permission-card"><h4>${safe(app.name)}</h4>${!app.verified?'<p>Open this installed app once to verify its package before approving access.</p>':''}
  ${app.dependencies.map(dep=>`<div class="tavi-asset-permission-row"><strong>${safe(dep.packId)}</strong><small>${dep.compatible?'Compatible pack installed':dep.version?'Installed version incompatible':'Pack not installed'} · Read ${dep.read?'approved':'not approved'}</small>
    ${app.verified&&dep.compatible?`<div class="tavi-asset-permission-actions"><button type="button" data-asset-consent="${safe(app.id)}" data-asset-pack="${safe(dep.packId)}" data-asset-kind="read" data-asset-enabled="${!dep.read}">${dep.read?'Revoke read':'Allow read'}</button>
    ${dep.canCustomize&&dep.read?`<button type="button" data-asset-consent="${safe(app.id)}" data-asset-pack="${safe(dep.packId)}" data-asset-kind="customize" data-asset-enabled="${!dep.customize}">${dep.customize?'Revoke customization':'Allow customization'}</button>`:''}</div>`:''}</div>`).join('')}
 </section>`).join('');
}

export function renderAssetMarket({assetsAvailable=false,assetsInstalled=[],assetRequests=[],onlineItems=[],onlineState='not-configured',section='discover',query='',filter='all'}={}){
 const installedVersions=Object.fromEntries(assetsInstalled);
 const items=assetMarketEntries({installedVersions,onlineEntries:onlineItems});
 const categories=[...new Set(items.map(item=>item.category))].sort((a,b)=>a.localeCompare(b));
 const status=onlineState==='available'?'Online catalog connected':onlineState==='error'?'Online catalog temporarily unavailable':'Online catalog not connected yet';
 return `<section class="utility tavi-asset-market" aria-label="Tavi Assets Store">
  <header class="tavi-asset-market-hero"><div><span class="tavi-asset-eyebrow">Tavi Assets</span><h2>Make Tavi your own</h2><p>Shared card designs, themes and companion content — installed once, available to permitted apps.</p></div><span class="tavi-asset-hero-mark" aria-hidden="true">✦</span></header>
  <div class="tavi-asset-market-tabs" role="group" aria-label="Asset Store sections"><button type="button" data-asset-market-section="discover" aria-pressed="${section==='discover'}">Discover</button><button type="button" data-asset-market-section="installed" aria-pressed="${section==='installed'}">Installed (${assetsInstalled.length})</button><button type="button" data-asset-market-section="permissions" aria-pressed="${section==='permissions'}">Permissions${assetRequests.length?` (${assetRequests.length})`:''}</button></div>
  <div data-asset-market-pane="discover" ${section!=='discover'?'hidden':''}><label class="tavi-asset-search-label" for="tavi-asset-search">Search assets</label><input id="tavi-asset-search" type="search" placeholder="Search cards, themes and more" autocomplete="off" maxlength="80" value="${safe(query.slice(0,80))}">
   <div class="tavi-asset-categories" role="group" aria-label="Filter assets"><button type="button" data-asset-filter="all" aria-pressed="${filter==='all'}">All</button>${categories.map(category=>`<button type="button" data-asset-filter="${safe(category)}" aria-pressed="${filter===category}">${safe(category)}</button>`).join('')}<button type="button" data-asset-filter="installed" aria-pressed="${filter==='installed'}">Installed</button></div>
   <div class="tavi-asset-products">${items.map(item=>assetCard(item,assetsAvailable)).join('')}</div><p class="tavi-asset-search-empty" hidden>No assets match that search.</p>
   <p class="tavi-asset-source-note" role="status">${safe(status)}. ${onlineState==='available'?'Remote content needs a separately approved, integrity-verified installer.':'Bundled free cards and Companion scenery work offline. Other packs need an approved catalog and delivery service.'}</p>
  </div>
  <div data-asset-market-pane="installed" ${section!=='installed'?'hidden':''}><h3>On this device</h3>${assetsInstalled.length?`<div class="tavi-asset-installed-list">${assetsInstalled.map(([id,version])=>`<div class="tavi-asset-installed-row"><strong>${safe(id)}</strong><small>v${safe(version)} · Available offline for this account</small></div>`).join('')}</div>`:'<p class="tavi-asset-empty-state">No packs installed yet. Find a free pack in Discover.</p>'}<p class="tavi-asset-source-note">Assets are stored per account on this device, not synced between devices.</p></div>
  <div data-asset-market-pane="permissions" ${section!=='permissions'?'hidden':''}><h3>App access</h3><p class="tavi-asset-source-note">Installed apps must declare dependencies and receive your explicit approval.</p>${permissionRows(assetRequests)}<button type="button" class="tavi-asset-manage-link" data-action="settings-assets">Open Assets Library</button></div>
 </section>`;
}

export function renderAssetApproval({kind,packId,appId=null,action=null}={}){
 if(!kind)return '';
 const install=kind==='install';
 const customize=action==='customize';
 const isScene=install&&packId===BUNDLED_SCENE_ITEM.id;
 const label=install?(isScene?'Install Hollow Meadow?':'Install free card pack?'):`${action==='read'?'Allow asset access?':'Allow customization?'}`;
 const description=install?(isScene?'This free scene contains painted Meadow artwork from Companion 0.6.43. It is installed only for this account on this device.':'This free pack contains card fronts and green/blue backs. It is installed only for your signed-in account on this device.'):'The application receives only the capabilities declared in its verified TaviX manifest. You can revoke access later.';
 return `<div class="tavi-install-overlay tavi-asset-approval" role="presentation"><section class="tavi-install-dialog" role="dialog" aria-modal="true" aria-labelledby="tavi-assets-approval-title" aria-describedby="tavi-assets-approval-copy" tabindex="-1">
  <div class="tavi-install-heading"><span class="tavi-asset-dialog-icon" aria-hidden="true">${install?'♠':'✦'}</span><div><h2 id="tavi-assets-approval-title">${safe(label)}</h2><small>${install?'Tavi Assets · Free download':'Tavi · App permissions'}</small></div></div><p id="tavi-assets-approval-copy">${safe(description)}</p>
  <dl><dt>${install?'Pack':'Application'}</dt><dd>${safe(install?(isScene?'Hollow Meadow':'Classic Playing Cards'):appId)}</dd><dt>${install?'Version':'Pack'}</dt><dd>${safe(install?(isScene?BUNDLED_SCENE_ITEM.version:BUNDLED_ASSET_ITEM.version):packId)}</dd><dt>Cost</dt><dd>${install?'Free · 0 Gold':customize?'No purchase; customization permission only':'No Gold spent'}</dd></dl>
  <p class="tavi-install-warning">${install?'No automatic purchases, external downloads or subscription.':'No messages, contacts, Wallet or login credentials are shared.'}</p>
  <div class="tavi-install-buttons"><button type="button" data-asset-approval-cancel>Cancel</button><button type="button" class="tavi-install-approve" data-asset-approval-accept>${install?'Install pack':'Approve access'}</button></div>
 </section></div>`;
}

/** DOM event binding is isolated from the host's messaging and permission logic. */
export function wireAssetMarket(root=document,{onSectionChange=()=>{},onSearchChange=()=>{},onFilterChange=()=>{}}={}){
 const search=root.querySelector('#tavi-asset-search');
 const categories=[...root.querySelectorAll('[data-asset-filter]')];
 const products=[...root.querySelectorAll('[data-asset-item]')];
 let category=categories.find(button=>button.getAttribute?.('aria-pressed')==='true'||button.attrs?.['aria-pressed']==='true')?.dataset.assetFilter||'all';
 const update=()=>{
  const q=(search?.value||'').trim().toLowerCase();let shown=0;
  for(const node of products){const matches=(category==='all'||(category==='installed'?node.dataset.assetInstalled==='true':node.dataset.assetCategory===category))&&node.dataset.assetSearch.includes(q);
   node.hidden=!matches;if(matches)shown++;}
  const empty=root.querySelector('.tavi-asset-search-empty');if(empty)empty.hidden=shown>0;
 };
 search?.addEventListener('input',()=>{update();onSearchChange(search.value);});
 for(const button of categories)button.addEventListener('click',()=>{category=button.dataset.assetFilter;onFilterChange(category);for(const other of categories)other.setAttribute('aria-pressed',String(other===button));update();});
 const tabs=[...root.querySelectorAll('[data-asset-market-section]')];
 update();
 for(const button of tabs)button.addEventListener('click',()=>{onSectionChange(button.dataset.assetMarketSection);for(const other of tabs)other.setAttribute('aria-pressed',String(other===button));
  for(const pane of root.querySelectorAll('[data-asset-market-pane]'))pane.hidden=pane.dataset.assetMarketPane!==button.dataset.assetMarketSection;});
}
