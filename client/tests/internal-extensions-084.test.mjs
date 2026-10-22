import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,copyFile,writeFile,rm,cp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {syncInternalExtensions} from '../../tools/sync-internal-extensions.mjs';
import {validateCatalog} from '../src/extensions/contract.js';

const fixture=async()=>{
 const root=await mkdtemp(join(tmpdir(),'tavi-internal-'));
 const current=new URL('../../extensions/',import.meta.url),pub=new URL('../public/tavi-extensions/',import.meta.url);
 const registry=JSON.parse(await readFile(new URL('registry.json',current)));
 await mkdir(join(root,'extensions'),{recursive:true});
 await mkdir(join(root,'client','public','tavi-extensions'),{recursive:true});
 await writeFile(join(root,'extensions','registry.json'),JSON.stringify(registry));
 for(const {id} of registry.extensions){
  await cp(new URL(`${id}/`,current),join(root,'extensions',id),{recursive:true});
  await cp(new URL(`${id}/`,pub),join(root,'client','public','tavi-extensions',id),{recursive:true});
 }
 const currentCatalog=await readFile(new URL('catalog.v1.json',pub));
 await writeFile(join(root,'client','public','tavi-extensions','catalog.v1.json'),currentCatalog);
 return root;
};
test('canonical Tavi-owned extension registry is a strict source of truth, not Atrium or native host screens',async()=>{
 const registry=JSON.parse(await readFile(new URL('../../extensions/registry.json',import.meta.url)));
 assert.equal(registry.schema,'tavi.internal-extensions/v1');
 assert.deepEqual(registry.extensions.map(e=>e.id).sort(),['org.tavi.community.companion','org.tavi.core.wallet','org.tavi.examples.notepad']);
 assert.equal(registry.extensions.find(e=>e.id==='org.tavi.core.wallet').mode,'core');
 assert.equal(registry.extensions.find(e=>e.id==='org.tavi.examples.notepad').mode,'optional');
 assert(!registry.extensions.some(e=>e.id.includes('atrium')));
 const bundled=JSON.parse(await readFile(new URL('../public/tavi-extensions/catalog.v1.json',import.meta.url)));
 assert.equal(validateCatalog(bundled).length,3);
 assert.deepEqual((await syncInternalExtensions({check:true})).ids,['org.tavi.examples.notepad','org.tavi.core.wallet','org.tavi.community.companion']);
});
test('published static mirror is regenerated deterministically and rejects out-of-band asset edits',async()=>{
 const root=await fixture();
 try{
  await syncInternalExtensions({root,check:true});
  const target=join(root,'client','public','tavi-extensions','org.tavi.core.wallet','ui','index.html');
  await writeFile(target,'<html>manually modified mirror</html>');
  await assert.rejects(syncInternalExtensions({root,check:true}),/stale or absent/);
  await syncInternalExtensions({root});
  await syncInternalExtensions({root,check:true});
 }finally{await rm(root,{recursive:true,force:true});}
});
test('bundled sources cannot turn Wallet optional, become a remote publisher, or silently add an undeclared extension',async()=>{
 const root=await fixture();
 try{
  const file=join(root,'extensions','registry.json');
  const registry=JSON.parse(await readFile(file));
  registry.extensions.find(x=>x.id==='org.tavi.core.wallet').mode='optional';
  await writeFile(file,JSON.stringify(registry));
  await assert.rejects(syncInternalExtensions({root,check:true}),/permanent core/);
  registry.extensions.find(x=>x.id==='org.tavi.core.wallet').mode='core';
  await writeFile(file,JSON.stringify(registry));
  const manifest=join(root,'extensions','org.tavi.core.wallet','manifest.json');
  const original=await readFile(manifest);
  const m=JSON.parse(original);m.publisher='another-publisher';
  await writeFile(manifest,JSON.stringify(m));
  await assert.rejects(syncInternalExtensions({root,check:true}),/identity/);
  await writeFile(manifest,original);
  await mkdir(join(root,'client','public','tavi-extensions','org.unowned.ext'));
  await assert.rejects(syncInternalExtensions({root,check:true}),/Unexpected published extension entries/);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('extension LoopRD source/docs are not exposed in the static Tavi client',async()=>{
 const root=await fixture();
 try{
  await mkdir(join(root,'extensions','org.tavi.core.wallet','looprd'),{recursive:true});
  await writeFile(join(root,'extensions','org.tavi.core.wallet','looprd','README.adoc'),'Server-side only\n');
  await syncInternalExtensions({root,check:true});
  const publisher=await readFile(join(root,'client','public','tavi-extensions','catalog.v1.json'),'utf8');
  assert(!publisher.includes('looprd/'));
 }finally{await rm(root,{recursive:true,force:true});}
});
