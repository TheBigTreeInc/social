/** TAVI-STORE-DETAIL-171 — trustworthy product information before any install.
 * No purchase, entitlement, preview or price is inferred from untrusted metadata.
 * TaviX and Tavi Assets retain their existing approval and installation authority.
 */
import {uiEscape as esc} from './components.js';
import {assetArtwork} from './asset-market.js';

function metadata(items){
 return `<dl class="tavi-product-facts">${items.filter(([,value])=>value!==null&&value!==undefined&&value!=='').map(([name,value])=>`<div><dt>${esc(name)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>`;
}
function header(title,type,cover){
 return `<div class="tavi-product-header"><div class="tavi-product-cover">${cover}</div><div class="tavi-product-identity"><span class="tavi-product-kind">${esc(type)}</span><h2>${esc(title)}</h2></div><span class="tavi-product-sparkle" aria-hidden="true">✦</span></div>`;
}
function back(){return `<button type="button" class="tavi-product-back" data-marketplace-back aria-label="Back to Store results">← Back to Store</button>`;}
export function renderAppProductDetail({manifest,kind='App',icon='',installedVersion=null,source='',status='',actions='',license='',platform='windows',alternativeVersion=null}={}){
 if(!manifest)return '';
 const permissions=Array.isArray(manifest.permissions)?manifest.permissions:[];
 const platforms=Array.isArray(manifest.platforms)?manifest.platforms:['web','windows','android'];
 const compatible=platforms.includes(platform);
 const badge=status==='update-available'?'Update available':installedVersion?`Installed · v${esc(installedVersion)}`:'Available for installation';
 return `<article class="tavi-product-detail tavi-product-app${kind.toLowerCase()=='game'?' tavi-product-game':''}" aria-label="${esc(manifest.name)} details">
 ${back()}${header(manifest.name,kind,icon||'<span aria-hidden="true">▣</span>')}
 <div class="tavi-product-status"><strong>${badge}</strong><span>Gold checkout is not offered for TaviX applications.</span></div>
 <section class="tavi-product-overview"><h3>About this ${esc(kind.toLowerCase())}</h3><p>${esc(manifest.summary||'The publisher has not provided a description.')}</p></section>
 <div class="tavi-product-actions">${actions}</div>
 ${alternativeVersion?`<p class="tavi-product-notice">An alternative source offers version ${esc(alternativeVersion)}. Switching sources requires separate approval.</p>`:''}
 <details class="tavi-product-information"><summary><strong>App information</strong><span>Version, permissions & more</span></summary>${metadata([
  ['Publisher',manifest.publisher],['Version',manifest.version],['Source',source],
  ['Platforms',platforms.join(', ')],['This device',compatible?'Supported':'Not supported'],
  ['Permissions',permissions.join(', ')||'None requested'],['License',license||'Not provided by publisher']
 ])}</details>
 <section class="tavi-product-previews"><h3>Preview</h3><p>Publisher screenshots have not been provided. This cover uses the package icon where available.</p></section>
 <p class="tavi-product-safety">Installation uses Tavi's existing publisher and permission approval. Tavi does not share your sign-in credentials with applications.</p>
 </article>`;
}
export function renderAssetProductDetail(item,{ready=false}={}){
 if(!item)return '';
 const installed=Boolean(item.installedVersion);
 const verifiedFree=item.priceGold===0&&!item.remote;
 const verifiedPaid=Number.isSafeInteger(item.priceGold)&&item.priceGold>0&&item.priceVerified===true;
 const price=verifiedFree?'Free':verifiedPaid?`${item.priceGold} Gold`:'Price not verified';
 const canInstall=verifiedFree&&item.installable&&ready&&!installed;
 const action=installed?'<span class="tavi-product-installed">Installed on this device</span>':canInstall?
  `<button type="button" data-action="install-free-asset-pack" data-asset-install-id="${esc(item.id)}">Install free pack</button>`:
  `<span class="tavi-product-unavailable">${item.remote?'Verified purchase/download unavailable':!ready?'Assets storage unavailable':'Installation unavailable'}</span>`;
 return `<article class="tavi-product-detail tavi-product-asset" aria-label="${esc(item.title)} details">
 ${back()}${header(item.title,'Asset pack',assetArtwork(item))}
 <div class="tavi-product-status"><strong>${esc(price)}</strong><span>${installed?`Installed version ${esc(item.installedVersion)}`:'No Gold is charged by this page without a verified offer and an explicit approval.'}</span></div>
 <section class="tavi-product-overview"><h3>About this pack</h3><p>${esc(item.description||'No description supplied by the catalog.')}</p></section>
 <div class="tavi-product-actions">${action}</div>
 <details class="tavi-product-information"><summary><strong>Pack information</strong><span>Version, source & more</span></summary>${metadata([
  ['Category',item.category],['Version',item.version||'Not listed'],['Source',item.source],
  ['Pack ID',item.id],['Price',price],['Availability',installed?'Installed':canInstall?'Verified free pack':item.remote?'Catalog listing only':'Unavailable'],
  ['Storage','Per signed-in account on this device']
 ])}</details>
 <section class="tavi-product-previews"><h3>Artwork preview</h3><div class="tavi-product-artwork">${assetArtwork(item)}</div><p>${item.remote?'No verified preview images supplied. Artwork is an illustrative placeholder.':'Illustrative catalog cover. The packaged contents are described above.'}</p></section>
 <p class="tavi-product-safety">Paid content requires a trusted Tavi Assets offer, server-side Gold price and entitlement, and a separate confirmation before Wallet funds can be used. This screen does not debit Gold.</p>
 </article>`;
}
