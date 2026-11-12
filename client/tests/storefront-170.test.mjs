import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {privateStoreEntry,storeKind,storeProjection,renderStorefront} from '../src/ui/storefront.js';
import {BUNDLED_ASSET_ITEM,assetMarketEntries} from '../src/ui/asset-market.js';
const make=(id,name,classification,installed=false,permissions=[])=>({installed,entry:{manifest:{id,name,summary:`About ${name}`,permissions,classification}}});
const rows=[make('org.tavi.examples.notepad','Private Notepad',undefined),make('org.tavi.core.wallet','Wallet'),
 make('inc.thebigtree.ziprunner.review','ZipRunner review',undefined,true,['ziprunner.review']),
 make('inc.thebigtree.assetstudio','Tavi Asset Studio',undefined,true,['assets.registry.admin/v1']),
 make('org.tavi.community.companion','Companion',undefined,true),make('inc.example.klondike','Klondike',{type:'game',categories:['solitaire']},true)];
const assets=assetMarketEntries({installedVersions:{[BUNDLED_ASSET_ITEM.id]:BUNDLED_ASSET_ITEM.version}});
const card=row=>`<article data-store-item data-store-kind="${storeKind(row.entry)}" data-marketplace-search="${row.entry.manifest.name.toLowerCase()}" data-marketplace-installed="${row.installed}" data-marketplace-update="false"><strong>${row.entry.manifest.name}</strong></article>`;
test('only curated public apps and games appear in discovery; privileged tools stay private',()=>{
 for(const row of rows.slice(0,4))assert.equal(privateStoreEntry(row.entry),true);
 const discovery=storeProjection(rows,assets,'discover');
 assert.deepEqual(discovery.apps.map(r=>r.entry.manifest.name),['Companion','Klondike']);
 assert.equal(discovery.assets.length,2);
 assert.deepEqual(storeProjection(rows,assets,'games').apps.map(r=>r.entry.manifest.name),['Klondike']);
 assert.deepEqual(storeProjection(rows,assets,'apps').apps.map(r=>r.entry.manifest.name),['Companion']);
 assert.deepEqual(storeProjection(rows,assets,'private').apps.map(r=>r.entry.manifest.name),['Private Notepad','Wallet','ZipRunner review','Tavi Asset Studio']);
});
test('one storefront renders both catalog sources with details and authorized free-pack installation',()=>{
 const html=renderStorefront({rows,assets,assetsAvailable:true,appCard:card,portrait:'<span class="avatar">T</span>'});
 assert.match(html,/Tavi Store/);assert.match(html,/Klondike/);assert.match(html,/Companion/);
 assert.match(html,/Classic Playing Cards/);assert.match(html,/Hollow Meadow/);
 assert.match(html,/data-asset-details="org.tavi.companion.scenes"/);assert.match(html,/data-action="install-free-asset-pack"/);
 assert.match(html,/data-store-view="library"/);assert.match(html,/data-store-view="assets"/);
 assert.doesNotMatch(html,/ZipRunner review|Private Notepad|Tavi Asset Studio|>Wallet</);
});
test('library and private area retain installed records without publishing system apps',()=>{
 const library=renderStorefront({rows,assets,appCard:card,view:'library',displayName:'Account & Me'});
 assert.match(library,/ZipRunner review/);assert.match(library,/Private &amp; system apps/);
 assert.match(library,/Classic Playing Cards/);assert.doesNotMatch(library,/Hollow Meadow/);
 assert.match(library,/Account &amp; Me/);assert.doesNotMatch(library,/Account & Me/);
 const privatePage=renderStorefront({rows,assets,appCard:card,view:'private'});
 assert.match(privatePage,/ZipRunner review/);assert.doesNotMatch(privatePage,/>Klondike</);
});
test('malicious marketplace/asset metadata is always escaped and remote assets stay metadata-only',()=>{
 const unsafe=make('org.example.unsafe','<script>alert(1)</script>');
 const items=assetMarketEntries({onlineEntries:[{id:'org.test.custom',title:'<svg onload=alert(1)>',category:'Themes',summary:'<script>alert(2)</script>',version:'1.0.0'}]});
 const html=renderStorefront({rows:[unsafe],assets:items,assetsAvailable:true,appCard:row=>`<div data-store-item>${row.entry.manifest.name.replaceAll('<','&lt;').replaceAll('>','&gt;')}</div>`});
 assert.match(html,/&lt;svg/);assert.doesNotMatch(html,/<svg onload/);
 assert.match(html,/Price unverified/);assert.match(html,/data-asset-details="org.test.custom"/);
 assert.equal((html.match(/data-action="install-free-asset-pack"/g)||[]).length,2);
 assert.doesNotMatch(html,/data-asset-install-id="org.test.custom"/);
});
test('Social storefront uses the installed app/asset engines and does not weaken approval flows',async()=>{
 const source=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(source,/assetMarketEntries\(\{installedVersions:assetsEngine\.installedVersions\(\),onlineEntries:assetCatalogItems\}\)/);
 assert.match(source,/renderStorefront\(\{rows,assets/);
 assert.match(source,/data-store-view/);
 assert.match(source,/pendingAssetAction=\{kind:'install'/);
 assert.match(source,/extensionInstallApproval=/);
 assert.match(source,/state\.panel='app-store'/);
 assert.match(source,/refreshAssetsCatalog\(\)/);
});
