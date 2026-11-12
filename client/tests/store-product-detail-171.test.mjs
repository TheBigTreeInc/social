import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {renderAppProductDetail,renderAssetProductDetail} from '../src/ui/store-detail.js';
import {assetMarketEntries,BUNDLED_ASSET_ITEM} from '../src/ui/asset-market.js';
import {renderStorefront} from '../src/ui/storefront.js';

const app={id:'org.tavi.sample.game',name:'Card Game',summary:'A social card game',publisher:'sample',version:'1.0.0',permissions:['ui.panel','storage.private'],platforms:['windows','android']};
test('app product provides publisher, permissions, version, platform, free of invented Gold price',()=>{
 const html=renderAppProductDetail({manifest:app,kind:'Game',source:'TaviX repository',actions:'<button data-extension-install="org.tavi.sample.game">Install</button>'});
 assert.match(html,/Back to Store/);assert.match(html,/A social card game/);assert.match(html,/sample/);
 assert.match(html,/Windows|windows/);assert.match(html,/storage.private/);assert.match(html,/No Gold|Gold checkout/);
 assert.match(html,/data-extension-install/);assert.match(html,/screenshots have not been provided/);
 assert.doesNotMatch(html,/5 Gold|Buy now|data-action="purchase/);
});
test('untrusted app text is escaped on the detail view',()=>{
 const html=renderAppProductDetail({manifest:{...app,name:'<img src=x onerror=alert(1)>',summary:'<script>alert(1)</script>',publisher:'<bad>'}});
 assert.match(html,/&lt;script&gt;/);assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<script>|<img src=x/);
});
test('bundled asset details allow only the existing guarded free-install action',()=>{
 const item=assetMarketEntries().find(i=>i.id===BUNDLED_ASSET_ITEM.id);
 const html=renderAssetProductDetail(item,{ready:true});
 assert.match(html,/Classic Playing Cards/);assert.match(html,/Pack information/);
 assert.match(html,/Free/);assert.match(html,/data-action="install-free-asset-pack"/);
 assert.doesNotMatch(html,/Buy now|data-action="gold-purchase"/);
 assert.doesNotMatch(renderAssetProductDetail(item,{ready:false}),/data-action="install-free-asset-pack"/);
});
test('remote assets cannot request Gold or install based on unverified catalog prices',()=>{
 const [item]=assetMarketEntries({onlineEntries:[{id:'org.example.remote',title:'Remote pack',category:'Themes',summary:'Available soon',version:'0.2.0',priceGold:50}]}).filter(i=>i.remote);
 assert.equal(item.priceGold,null);
 const html=renderAssetProductDetail(item,{ready:true});
 assert.match(html,/Price not verified/);assert.match(html,/Verified purchase\/download unavailable/);
 assert.doesNotMatch(html,/50 Gold|data-action="install-free-asset-pack"|data-action="purchase/);
});
test('untrusted asset metadata is escaped and no action injected',()=>{
 const [item]=assetMarketEntries({onlineEntries:[{id:'org.example.remote',title:'<img src=x>',category:'<script>',summary:'<script>alert(1)</script>',version:'0.2.0'}]}).filter(i=>i.remote);
 const html=renderAssetProductDetail(item);
 assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>|<img src=x>/);
});
test('store hides catalog content on details and retains category navigation after back',()=>{
 const asset=assetMarketEntries()[0];
 const detail=renderAssetProductDetail(asset,{ready:true});
 const html=renderStorefront({assets:[asset],detailHtml:detail,appCard:()=>''});
 assert.match(html,/data-marketplace-back/);assert.doesNotMatch(html,/tavi-storefront-hero/);
 assert.doesNotMatch(html,/data-store-view="assets"/);
 assert.doesNotMatch(html,/tavi-storefront-grid/);
});
test('main store binds app and asset product detail controls without bypassing consent',async()=>{
 const source=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(source,/renderAssetProductDetail\(selectedAsset/);
 assert.match(source,/data-asset-details/);
 assert.match(source,/marketplaceSelectedAsset/);
 assert.match(source,/renderAppProductDetail/);
 assert.match(source,/pendingAssetAction=\{kind:'install'/);
 assert.match(source,/extensionInstallApproval=/);
});
