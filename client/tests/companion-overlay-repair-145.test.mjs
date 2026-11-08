import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,cp,writeFile,readFile,lstat,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {inspectReviewedBundle} from '../../tools/import-reviewed-extension.mjs';
import {pruneCompanionLegacyOverlay} from '../../tools/prune-companion-legacy-overlay.mjs';
import {syncInternalExtensions} from '../../tools/sync-internal-extensions.mjs';

const id='org.tavi.community.companion';
const old='<!doctype html><html lang="en"><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=cat-study.html"><title>Character studio</title><p><a href="cat-study.html">Open character studio</a></p></html>';
const paths=[`extensions/${id}/ui/collection.html`,
 `client/public/tavi-extensions/${id}/ui/collection.html`,
 `client/public/tavi-extensions/${id}/ui/collection.html.bytes`];

async function fixture(){
 const root=await mkdtemp(join(tmpdir(),'tavi-145-overlay-'));
 await cp(new URL('../../extensions/',import.meta.url),join(root,'extensions'),{recursive:true});
 await mkdir(join(root,'client/public'),{recursive:true});
 await cp(new URL('../public/tavi-extensions/',import.meta.url),join(root,'client/public/tavi-extensions'),{recursive:true});
 return root;
}
async function putLegacy(root){for(const p of paths)await writeFile(join(root,p),old);}

test('ZipRunner 0.3.143 -> 0.3.144 overlay reproduces the exact Windows reviewer hash and is repaired',async()=>{
 const root=await fixture();
 try{
  await putLegacy(root);
  assert.equal((await inspectReviewedBundle(join(root,'extensions',id))).sha256,
   'cb804632192ae7fe72b98bf6455a8e061bd88b587c98a77863f856c137f93c8a');
  await assert.rejects(syncInternalExtensions({root,check:true}),/integrity changed/);
  assert.deepEqual(await pruneCompanionLegacyOverlay({root}),{removed:3,obsolete:3});
  assert.equal((await inspectReviewedBundle(join(root,'extensions',id))).sha256,
   '0773809d7c61c079f18325f69f3deabf134d8abc34a3c9fd5ef555b80168e948');
  await syncInternalExtensions({root,check:true});
  assert.equal((await pruneCompanionLegacyOverlay({root})).removed,0,'repair is idempotent');
 }finally{await rm(root,{recursive:true,force:true});}
});

test('cleanup never removes modified or unsafe files, nor any adjacent operator data',async()=>{
 const root=await fixture();
 try{
  await putLegacy(root);
  await writeFile(join(root,paths[2]),'operator-edited content');
  const privateFile=join(root,'client/public/tavi-extensions',id,'ui','operator-data.txt');
  await writeFile(privateFile,'protected');
  await assert.rejects(pruneCompanionLegacyOverlay({root}),/Refusing to remove modified legacy source/);
  for(const p of paths)assert((await lstat(join(root,p))).isFile(),'preflight must be all-or-nothing');
  assert.equal(await readFile(privateFile,'utf8'),'protected');
  await writeFile(join(root,paths[2]),old);
  await assert.rejects(pruneCompanionLegacyOverlay({root,check:true}),/Stale Companion/);
  assert((await lstat(join(root,paths[0]))).isFile());
  const registryFile=join(root,'extensions/registry.json');
  const registry=JSON.parse(await readFile(registryFile,'utf8'));
  registry.extensions.find(e=>e.id===id).sha256='0'.repeat(64);
  await writeFile(registryFile,JSON.stringify(registry));
  await assert.rejects(pruneCompanionLegacyOverlay({root}),/review pin\/version changed/);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('clean extracted candidate has no obsolete partner files and passes checked sync',async()=>{
 assert.equal((await pruneCompanionLegacyOverlay({check:true})).removed,0);
 await syncInternalExtensions({check:true});
});

test('the already-loaded 0.3.143 build command invokes the overlay cleanup through npm verify',async()=>{
 const pkg=JSON.parse(await readFile(new URL('../../package.json',import.meta.url),'utf8'));
 const project=JSON.parse(await readFile(new URL('../../project.zr',import.meta.url),'utf8'));
 assert.match(pkg.scripts.verify,/^node tools\/prune-companion-legacy-overlay\.mjs && npm run test/);
 assert.deepEqual(project.build,[
  'node tools/prune-companion-legacy-overlay.mjs','npm run verify','node tools/auto-build.mjs'
 ]);
});
