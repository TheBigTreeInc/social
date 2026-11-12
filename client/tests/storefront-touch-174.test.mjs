import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assetCard,assetMarketEntries} from '../src/ui/asset-market.js';
import {renderStorefront} from '../src/ui/storefront.js';
import {storePullDistance,wireStorePullToRefresh,STORE_PULL_THRESHOLD} from '../src/ui/store-pull-refresh.js';

const text=(path)=>readFile(new URL(path,import.meta.url),'utf8');
function fakePull(onRefresh){
 const listeners=new Map(),indicator={hidden:true,textContent:''};
 const target={closest:()=>null};
 const surface={contains:node=>node===target,querySelector:()=>indicator};
 const scroller={scrollTop:0,addEventListener(name,cb){listeners.set(name,cb);},removeEventListener(name){listeners.delete(name);}};
 const unsubscribe=wireStorePullToRefresh({surface,scroller,onRefresh});
 const send=(name,props={})=>{
  const pt={clientX:0,clientY:props.y??0};
  listeners.get(name)?.({target,button:0,pointerType:'mouse',clientX:0,clientY:pt.clientY,touches:[pt],...props});
 };
 return {listeners,indicator,target,scroller,send,unsubscribe};
}
test('desktop pull begins only at top and refreshes once after a vertical threshold',async()=>{
 let n=0;
 const g=fakePull(()=>{n++;});
 g.send('pointerdown');g.send('pointermove',{y:STORE_PULL_THRESHOLD+5});
 assert.equal(g.indicator.hidden,false);assert.match(g.indicator.textContent,/Release/);
 g.send('pointerup');
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(n,1);
 g.send('pointerdown');g.send('pointermove',{y:20});g.send('pointerup');
 await new Promise(resolve=>setImmediate(resolve));assert.equal(n,1);
 g.scroller.scrollTop=20;g.send('pointerdown');g.send('pointermove',{y:100});g.send('pointerup');
 await new Promise(resolve=>setImmediate(resolve));assert.equal(n,1);
 g.unsubscribe();assert.equal(g.listeners.size,0);
});
test('touch gesture rejects horizontal movement and inputs and supports touch refresh',async()=>{
 let n=0;
 const g=fakePull(()=>{n++;});
 assert.equal(storePullDistance(0,0,100,30),0);
 assert.equal(storePullDistance(0,0,0,90),90);
 const interactive={closest:()=>({})};
 g.send('touchstart',{target:interactive,touches:[{clientX:0,clientY:0}]});
 g.send('touchmove',{touches:[{clientX:0,clientY:90}]});g.send('touchend');
 await new Promise(resolve=>setImmediate(resolve));assert.equal(n,0);
 g.send('touchstart',{touches:[{clientX:0,clientY:0}]});
 g.send('touchmove',{touches:[{clientX:0,clientY:90}]});g.send('touchend');
 await new Promise(resolve=>setImmediate(resolve));assert.equal(n,1);
 g.unsubscribe();
});
test('installed and uninstalled asset tiles open details; direct Install only for verified free local packs',()=>{
 const items=assetMarketEntries({onlineEntries:[{id:'org.remote.one',title:'Unverified Gold pack',category:'Themes',summary:'Preview only',version:'1.0.0'}]});
 const local=assetCard(items[0],true,{detailOnly:true});
 assert.match(local,/class="tavi-asset-card-open" data-asset-details=/);
 assert.match(local,/data-action="install-free-asset-pack"/);
 assert.match(local,/aria-label="Install Classic Playing Cards free"/);
 const remote=assetCard(items[2],true,{detailOnly:true});
 assert.match(remote,/Price unverified/);
 assert.match(remote,/data-asset-details="org.remote.one"/);
 assert.doesNotMatch(remote,/data-asset-install-id|data-action="install-free-asset-pack"/);
 const installed=assetCard({...items[0],installedVersion:'1.0.0',installable:false},true,{detailOnly:true});
 assert.match(installed,/Installed/);assert.doesNotMatch(installed,/data-asset-install-id/);
});
test('store header contains profile, no top reload; categories all visible by grid; footer retains accessible refresh',async()=>{
 const html=renderStorefront({});
 const header=html.split('</header>')[0];
 assert.match(header,/tavi-storefront-profile/);
 assert.doesNotMatch(header,/data-action="store-refresh"/);
 assert.match(html,/data-store-pull-status/);
 assert.match(html,/data-action="store-refresh"/);
 const css=await text('../src/ui/storefront.css');
 assert.match(css,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
 assert.match(css,/\.tavi-storefront-profile\{[^}]*border:0;box-shadow:none/s);
});
test('application tile uses artwork/title details surface and direct action through original approval flow',async()=>{
 const main=await text('../src/main.js');
 const card=main.slice(main.indexOf('function marketplaceCard('),main.indexOf('function marketplaceDetail('));
 assert.match(card,/class="tavi-store-card-open" data-extension-details=/);
 assert.match(card,/\$\{marketplaceItemActions\(entry\)\}/);
 assert.doesNotMatch(card,/>View details<\/button>/);
 assert.match(main,/extensionInstallApproval=id;render\(\);return;/);
 assert.match(main,/pendingAssetAction=\{kind:'install',packId:requestedPack,scope\}/);
 assert.match(main,/if\(name==='store-refresh'\)\{void refreshUnifiedStore\(\)/);
 assert.match(main,/wireStorePullToRefresh\(\{surface:storeSurface,scroller:storeScroller,onRefresh:refreshUnifiedStore\}\)/);
});
