import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateAssetCatalog,validateAssetCatalogSource,fetchAssetCatalog} from '../src/assets/catalog.js';
import {BUNDLED_ASSET_ITEM,assetMarketEntries,renderAssetMarket,renderAssetApproval,wireAssetMarket} from '../src/ui/asset-market.js';
const example={schema:'tavi.assets.catalog/v1',items:[{id:'org.tavi.cards.art',title:'Painter Cards',summary:'Artwork pack',category:'Cards & decks',priceGold:100,versions:[{version:'0.1.0',source:'a'},{version:'0.2.0',source:'b'}]}]};
const source='https://assets.example/catalog.json';
test('Assets catalog source requires explicit approved HTTPS build configuration',()=>{
 assert.equal(validateAssetCatalogSource(''),null);
 assert.equal(validateAssetCatalogSource(source),source);
 for(const url of ['http://assets.example/catalog.json','https://a:p@assets.example/catalog.json','https://assets.example/#frag','https://assets.example:9090/catalog.json'])assert.throws(()=>validateAssetCatalogSource(url));
});
test('Assets 0.1.7 catalog metadata validated and kept non-authoritative',async()=>{
 const listed=validateAssetCatalog(example);
 assert.equal(listed[0].version,'0.2.0');
 assert.equal(Object.hasOwn(listed[0],'priceGold'),false,'display cannot authorize a payment');
 const calls=[];
 const result=await fetchAssetCatalog(source,{fetcher:async(url,options)=>{calls.push({url,options});return {ok:true,headers:{get:()=>null},text:async()=>JSON.stringify(example)};}});
 assert.equal(result.state,'available');assert.equal(calls[0].url,source);
 assert.deepEqual({credentials:calls[0].options.credentials,redirect:calls[0].options.redirect},{credentials:'omit',redirect:'error'});
 assert.deepEqual(await fetchAssetCatalog(''),{state:'not-configured',items:[]});
 await assert.rejects(fetchAssetCatalog(source,{fetcher:async()=>({ok:true,headers:{get:()=>null},text:async()=>'*'.repeat(120001)})}),/too large/);
 for(const mutated of [
  x=>x.items.push({...x.items[0]}),x=>x.items[0].title='<script>'.repeat(60),
  x=>x.items[0].id='../../secrets',x=>x.items[0].versions[0].version='latest',
  x=>x.schema='tavi.repository/v1'
 ]){const invalid=structuredClone(example);mutated(invalid);assert.throws(()=>validateAssetCatalog(invalid));}
});
test('store discovery renders real bundled catalog and distinguishes unavailable online service',()=>{
 const blank=renderAssetMarket({assetsAvailable:true});
 assert.match(blank,/Classic Playing Cards/);
 assert.match(blank,/Online catalog not connected yet/);
 assert.match(blank,/data-action="install-free-asset-pack"/);
 assert.match(blank,/data-asset-market-section="permissions"/);
 assert.match(blank,/data-asset-filter="installed"/);
 const installed=renderAssetMarket({assetsAvailable:true,assetsInstalled:[[BUNDLED_ASSET_ITEM.id,BUNDLED_ASSET_ITEM.version]]});
 assert.match(installed,/Available offline for this account/);
 assert.doesNotMatch(installed,/data-action="install-free-asset-pack"/);
 const unready=renderAssetMarket({assetsAvailable:false});assert.doesNotMatch(unready,/data-action="install-free-asset-pack"/);
});
test('remote catalog entries are metadata-only; untrusted markup is escaped',()=>{
 const rows=assetMarketEntries({onlineEntries:[{id:'org.tavi.test',title:'<img src=x onerror=alert(1)>',summary:'<script>bad</script>',category:'Themes',version:'1.0.0'}]});
 assert.equal(rows.length,2);assert.equal(rows[1].installable,false);
 const html=renderAssetMarket({assetsAvailable:true,onlineState:'available',onlineItems:[{id:'org.tavi.test',title:'<img src=x onerror=alert(1)>',summary:'<script>bad</script>',category:'Themes',version:'1.0.0'}]});
 assert.match(html,/&lt;script&gt;bad&lt;\/script&gt;/);
 assert.doesNotMatch(html,/<script>bad<\/script>/);
 assert.doesNotMatch(html,/<img\b/);
 assert.match(html,/Awaiting verified package/);
 assert.equal((html.match(/data-action="install-free-asset-pack"/g)||[]).length,1);
});
test('store permissions reuse host grant buttons only for verified compatible packs',()=>{
 const row={id:'org.example.game',name:'My Game',verified:true,dependencies:[{packId:BUNDLED_ASSET_ITEM.id,read:false,customize:false,canCustomize:true,compatible:true,version:'0.1.1'}]};
 let html=renderAssetMarket({assetRequests:[row]});
 assert.match(html,/data-asset-consent="org.example.game"/);
 assert.match(html,/data-asset-kind="read"/);
 assert.match(html,/Allow read/);
 html=renderAssetMarket({assetRequests:[{...row,verified:false}]});
 assert.doesNotMatch(html,/data-asset-consent=/);
 html=renderAssetMarket({assetRequests:[{...row,dependencies:[{...row.dependencies[0],compatible:false}]}]});
 assert.doesNotMatch(html,/data-asset-consent=/);
 html=renderAssetMarket({assetRequests:[{...row,dependencies:[{...row.dependencies[0],read:true}]}]});
 assert.match(html,/data-asset-kind="customize"/);
 assert.match(html,/Revoke read/);
});
test('host approval is a responsive in-app modal, no browser confirm',async()=>{
 const dialog=renderAssetApproval({kind:'install',packId:BUNDLED_ASSET_ITEM.id});
 assert.match(dialog,/aria-modal="true"/);
 assert.match(dialog,/Install free card pack\?/);
 assert.match(dialog,/0 Gold/);
 assert.match(dialog,/data-asset-approval-cancel/);
 assert.match(dialog,/data-asset-approval-accept/);
 assert.equal(renderAssetApproval(), '');
 const grant=renderAssetApproval({kind:'grant',action:'read',appId:'<unsafe>',packId:'org.tavi.cards.standard'});
 assert.match(grant,/&lt;unsafe&gt;/);assert.doesNotMatch(grant,/<unsafe>/);
 const main=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(main,/pendingAssetAction=\{kind:'install'/);
 assert.match(main,/pendingAssetAction=\{kind:'grant'/);
 assert.doesNotMatch(main,/confirm\('Install the free Tavi Assets sample/);
 assert.doesNotMatch(main,/confirm\(`Allow \$\{session.id\} to/);
 assert.match(main,/renderAssetApproval\(pendingAssetAction\|\|\{\}\)/);
 assert.match(main,/pending\.scope!==extensionStoreScope/);
});
test('marketplace tab and filter wiring preserves navigation and accessibility state',()=>{
 const handlers=new Map(),listeners=(name)=>({dataset:{},attrs:{},hidden:false,addEventListener(type,callback){handlers.set(name+':'+type,callback);},setAttribute(key,value){this.attrs[key]=value;}});
 const search=listeners('search'),all=listeners('all'),installed=listeners('installed'),item=listeners('item'),discover=listeners('discover'),installedPane=listeners('installedPane');
 all.dataset.assetFilter='all';installed.dataset.assetFilter='installed';item.dataset.assetSearch='classic playing cards cards & decks';item.dataset.assetCategory='Cards & decks';item.dataset.assetInstalled='true';
 discover.dataset.assetMarketSection='discover';installedPane.dataset.assetMarketSection='installed';
 const panes=[listeners('pane1'),listeners('pane2')];panes[0].dataset.assetMarketPane='discover';panes[1].dataset.assetMarketPane='installed';
 const root={querySelector(selector){return selector==='#tavi-asset-search'?search:selector==='.tavi-asset-search-empty'?{hidden:true}:null;},querySelectorAll(selector){return {'[data-asset-filter]':[all,installed],'[data-asset-item]':[item],'[data-asset-market-section]':[discover,installedPane],'[data-asset-market-pane]':panes}[selector]||[];}};
 wireAssetMarket(root);
 handlers.get('installed:click')();assert.equal(installed.attrs['aria-pressed'],'true');assert.equal(item.hidden,false);
 handlers.get('installedPane:click')();assert.equal(panes[0].hidden,true);assert.equal(panes[1].hidden,false);
 search.value='not a match';handlers.get('search:input')();assert.equal(item.hidden,true);
});
