import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {renderStorefront} from '../src/ui/storefront.js';
import {renderAppProductDetail,renderAssetProductDetail} from '../src/ui/store-detail.js';
import {assetMarketEntries} from '../src/ui/asset-market.js';

const product={name:'Companion',summary:'Create a companion world',publisher:'tavi-community',version:'0.6.40',platforms:['windows','android'],permissions:['storage.private']};
test('store offers playful native category navigation without invented ratings or popularity',()=>{
 const html=renderStorefront({rows:[],assets:[],view:'discover'});
 assert.match(html,/Find something fun!/);
 assert.match(html,/class="tavi-storefront-hero-art" aria-hidden="true"/);
 for(const category of ['Discover','Apps','Games','Assets'])assert.match(html,new RegExp(`>${category}</span>`));
 assert.match(html,/data-store-view="assets"/);
 assert.doesNotMatch(html,/Trending now|4\.5 stars|Most downloaded|Sponsored/);
});
test('app detail keeps real publisher facts and consent actions, with collapsible technical information',()=>{
 const html=renderAppProductDetail({manifest:product,kind:'Game',actions:'<button data-extension-open="org.example">Open</button>'});
 assert.match(html,/<details class="tavi-product-information">/);
 assert.match(html,/<summary><strong>App information<\/strong>/);
 assert.match(html,/storage\.private/);
 assert.match(html,/Create a companion world/);
 assert.match(html,/data-extension-open/);
 assert.match(html,/screenshots have not been provided/);
 assert.doesNotMatch(html,/Buy now|data-action="purchase/);
});
test('asset detail keeps confirmed price integrity and existing installation consent',()=>{
 const pack=assetMarketEntries()[0];
 const html=renderAssetProductDetail(pack,{ready:true});
 assert.match(html,/<details class="tavi-product-information">/);
 assert.match(html,/Pack information/);
 assert.match(html,/Free/);
 assert.match(html,/data-action="install-free-asset-pack"/);
 assert.doesNotMatch(html,/data-action="purchase/);
});
test('delight CSS retains high-contrast tokens, keyboard focus, touch targets and reduced-motion support',async()=>{
 const css=await readFile(new URL('../src/ui/storefront.css',import.meta.url),'utf8');
 assert.match(css,/Segoe UI Variable/);
 assert.match(css,/focus-visible/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/min-height:4[48]px/);
 assert.match(css,/tavi-product-information summary/);
 assert.match(css,/color-mix/);
});
