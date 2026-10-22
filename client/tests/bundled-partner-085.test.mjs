import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,cp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {syncInternalExtensions} from '../../tools/sync-internal-extensions.mjs';
import {inspectReviewedBundle,importReviewedExtension} from '../../tools/import-reviewed-extension.mjs';
import {menuApplications,BUNDLED_COMPANION_ID} from '../src/launcher.js';
import {validateCatalog} from '../src/extensions/contract.js';
const root=new URL('../../',import.meta.url);
const source=fileURLToPath(new URL('../../extensions/org.tavi.community.companion/',import.meta.url));
async function fixture(){
 const tmp=await mkdtemp(join(tmpdir(),'tavi-partner-test-'));
 await cp(new URL('../../extensions/',import.meta.url),join(tmp,'extensions'),{recursive:true});
 await cp(new URL('../public/tavi-extensions/',import.meta.url),join(tmp,'client/public/tavi-extensions'),{recursive:true});
 return tmp;
}
test('offline Companion 0.6.11 is a reviewed optional bundled partner, not a first-party impersonation',async()=>{
 const registry=JSON.parse(await readFile(new URL('../../extensions/registry.json',import.meta.url)));
 const entry=registry.extensions.find(e=>e.id===BUNDLED_COMPANION_ID);
 assert.equal(entry?.mode,'optional');assert.equal(entry?.distribution,'bundled-partner');
 assert.equal(entry.publisher,'tavi-community');assert.equal(entry.version,'0.6.11');
 const reviewed=await inspectReviewedBundle(source);
 assert.equal(reviewed.sha256,entry.sha256);
 assert.equal(reviewed.files.length,18);
 const catalog=JSON.parse(await readFile(new URL('../public/tavi-extensions/catalog.v1.json',import.meta.url)));
 assert.equal(validateCatalog(catalog).length,3);
 assert(catalog.extensions.some(e=>e.manifest.id===BUNDLED_COMPANION_ID));
 await syncInternalExtensions({check:true});
});
test('reviewed importer dry-run executes full registry sync but does not change the checkout; apply is idempotent',async()=>{
 const tmp=await fixture();
 try{
  const before=await readFile(join(tmp,'extensions','registry.json'));
  let r=await importReviewedExtension(source,{root:tmp,publisher:'tavi-community'});
  assert.equal(r.applied,false);
  assert.deepEqual(await readFile(join(tmp,'extensions','registry.json')),before);
  r=await importReviewedExtension(source,{root:tmp,publisher:'tavi-community',apply:true});
  assert.equal(r.unchanged,true);
  assert.deepEqual(await readFile(join(tmp,'extensions','registry.json')),before);
  await assert.rejects(importReviewedExtension(source,{root:tmp,publisher:'tavi'}),/publisher approval/);
  const altered=join(tmp,'altered');await cp(source,altered,{recursive:true});
  await writeFile(join(altered,'ui','icon.svg'),'<svg>tampered</svg>');
  await assert.rejects(importReviewedExtension(altered,{root:tmp,publisher:'tavi-community'}),/Same-version partner content changed/);
  await syncInternalExtensions({root:tmp,check:true});
 }finally{await rm(tmp,{recursive:true,force:true});}
});
test('partner source tampering, publisher spoofing and privileged mode remain invalid',async()=>{
 const tmp=await fixture();
 try{
  const p=join(tmp,'extensions',BUNDLED_COMPANION_ID,'ui','index.html');
  await writeFile(p,'<html>tampered</html>');
  await assert.rejects(syncInternalExtensions({root:tmp,check:true}),/integrity changed|stale or absent/);
  const published=join(tmp,'client/public/tavi-extensions',BUNDLED_COMPANION_ID,'ui','index.html');
  const before=await readFile(published);
  await assert.rejects(syncInternalExtensions({root:tmp}),/integrity changed/);
  assert.deepEqual(await readFile(published),before,'failed sync must not overwrite the reviewed public snapshot');
  await cp(source,join(tmp,'extensions',BUNDLED_COMPANION_ID),{recursive:true,force:true});
  const rpath=join(tmp,'extensions','registry.json');const registry=JSON.parse(await readFile(rpath));
  const record=registry.extensions.find(e=>e.id===BUNDLED_COMPANION_ID);
  record.mode='core';await writeFile(rpath,JSON.stringify(registry));
  await assert.rejects(syncInternalExtensions({root:tmp,check:true}),/privileged ID|provenance/);
  record.mode='optional';record.publisher='tavi';await writeFile(rpath,JSON.stringify(registry));
  await assert.rejects(syncInternalExtensions({root:tmp,check:true}),/provenance/);
 }finally{await rm(tmp,{recursive:true,force:true});}
});
test('host-owned My pet opens installed Companion and has Home, while portrait remains separate',async()=>{
 const main=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(main,/if\(name==='companion'\)\{if\(extensionEnabled\(BUNDLED_COMPANION_ID\)\)\{await openInstalledExtension\(BUNDLED_COMPANION_ID\)/);
 assert.match(main,/extensionReturnsHome\(manifest.id\)/);
 assert.match(main,/sandbox','allow-scripts'/);
 assert.doesNotMatch(main,/sandbox','allow-scripts allow-same-origin'/);
 const catalog=JSON.parse(await readFile(new URL('../public/tavi-extensions/catalog.v1.json',import.meta.url))).extensions;
 const store={enabled:id=>id===BUNDLED_COMPANION_ID,source:()=> 'tavi:bundled',version:()=> '0.6.11',installed:()=>true,metadata:()=>null,permissions:()=>['ui.panel','ui.toast','storage.private'],revision:()=>null,entrypoint:()=>null};
 const apps=menuApplications({catalog,store,platform:'android',petEnabled:false});
 assert.equal(apps.filter(x=>x.label==='Companion').length,1);
 assert.equal(apps.filter(x=>x.kind==='extension'&&x.id===BUNDLED_COMPANION_ID).length,0);
 assert.equal(apps.filter(x=>x.action==='portrait').length,1);
});
