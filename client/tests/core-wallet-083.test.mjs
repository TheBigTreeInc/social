import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {coreWalletFromBundle,filterOptionalApps,goldStatusLabel} from '../src/wallet/core-ui.js';
import {menuApplications} from '../src/launcher.js';
import {CORE_WALLET_ID} from '../src/extensions/host.js';

const catalog=JSON.parse(await readFile(new URL('../public/tavi-extensions/catalog.v1.json',import.meta.url),'utf8')).extensions;

test('Wallet is first-party bundled core, not optional user-installable app',()=>{
 const entry=coreWalletFromBundle(catalog);
 assert.equal(entry.manifest.id,CORE_WALLET_ID);
 assert.equal(entry.manifest.publisher,'tavi');
 assert.equal(filterOptionalApps(catalog).length,catalog.length-1);
 assert(!filterOptionalApps(catalog).some(e=>e.manifest.id===CORE_WALLET_ID));
 assert.throws(()=>coreWalletFromBundle([{...entry,repositoryUrl:'https://untrusted.test/catalog'}]),/unavailable or invalid/);
 assert.throws(()=>coreWalletFromBundle([{...entry,remote:{entrypoint:'https://untrusted.test/iframe'}}]),/unavailable or invalid/);
 assert.throws(()=>coreWalletFromBundle([]),/unavailable or invalid/);
});

test('Wallet launcher remains available without an extension installation record',()=>{
 const store={installed:()=>false,enabled:()=>false};
 const choices=menuApplications({catalog,store,platform:'android'});
 assert.equal(choices.filter(e=>e.action==='wallet').length,1);
 assert.equal(choices.filter(e=>e.kind==='extension'&&e.id===CORE_WALLET_ID).length,0);
});

test('Gold label is taken from server, never synthesized from free refill rule',()=>{
 const data={schema:'tavi.wallet/v1',balances:[{currencyId:'gold',amount:'160',playOnly:'100',availableForShopping:'60'}]};
 assert.deepEqual(goldStatusLabel(data),{amount:'160',raw:'160'});
 assert.deepEqual(goldStatusLabel({...data,balances:[{currencyId:'gold',amount:'0'}]}),{amount:'0',raw:'0'});
 assert.equal(goldStatusLabel({...data,balances:[]}),null);
 assert.equal(goldStatusLabel({...data,balances:[{currencyId:'gold',amount:'10 Gold'}]}),null);
 assert.equal(goldStatusLabel({...data,balances:[{currencyId:'gold',amount:-1}]}),null);
 assert.equal(goldStatusLabel({schema:'incorrect',balances:data.balances}),null);
 assert.equal(goldStatusLabel({...data,balances:[{currencyId:'gold',amount:'1000000000000000000000'}]}).amount,'1,000,000,000,000,000,000,000');
});

test('Tavi profile Gold click opens permanent core Wallet rather than App Store',async()=>{
 const source=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(source,/class="tavi-gold-balance" data-action="wallet"/);
 assert.match(source,/if\(name==='wallet'\)\{await openCoreWallet\(\);return;\}/);
 assert.doesNotMatch(source,/Install Wallet from the App Store once/);
 assert.match(source,/coreWalletFromBundle\(bundled\)/);
 assert.match(source,/verifyBundledExtension\(coreWalletEntry/);
 assert.match(source,/source:entry.manifest.id===CORE_WALLET_ID\?'tavi:bundled'/);
 assert.doesNotMatch(source,/data-extension-install="\$\{esc\(CORE_WALLET_ID\)/);
});
