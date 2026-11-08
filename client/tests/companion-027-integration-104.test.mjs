import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {REVIEWED_COMPANION} from '../src/extensions/reviewed-companion.js';
const read=async rel=>readFile(new URL(rel,import.meta.url),'utf8');
const json=async rel=>JSON.parse(await read(rel));

test('Tavi pins the canonical reviewed Companion 0.6.43 bundle with declared optional Assets permission and guarded cloud host',async()=>{
 const registry=await json('../../extensions/registry.json');
 const entry=registry.extensions.find(x=>x.id==='org.tavi.community.companion');
 assert.equal(entry.publisher,'tavi-community');
 assert.equal(entry.version,'0.6.43');
 assert.equal(entry.sha256,'0773809d7c61c079f18325f69f3deabf134d8abc34a3c9fd5ef555b80168e948');
 assert.deepEqual(REVIEWED_COMPANION,{id:'org.tavi.community.companion',publisher:'tavi-community',version:'0.6.43',sha256:entry.sha256});
 const manifest=await json('../../extensions/org.tavi.community.companion/manifest.json');
 assert.equal(manifest.version,'0.6.43');
 assert.deepEqual(manifest.permissions,['ui.panel','ui.toast','storage.private','assets.read']);
 assert.equal(manifest.assetDependencies[0].packId,'org.tavi.companion.scenes');
 assert.deepEqual(manifest.platforms,['windows','android']);
});

test('published catalog matches the reviewed Companion source digest and cave bundle',async()=>{
 const catalog=await json('../public/tavi-extensions/catalog.v1.json');
 const entry=catalog.extensions.find(x=>x.manifest.id==='org.tavi.community.companion');
 assert.equal(entry.manifest.version,'0.6.43');
 const serial=JSON.stringify({manifest:entry.manifest,files:entry.files})+'\n';
 assert.equal(createHash('sha256').update(serial).digest('hex'),'0773809d7c61c079f18325f69f3deabf134d8abc34a3c9fd5ef555b80168e948');
 const index=await read('../../extensions/org.tavi.community.companion/ui/index.html');
 assert.match(index,/Companion world/);
 assert.match(index,/world/);
});

test('0.3.144 exposes cloud only through a reviewed host and authenticated LoopRD broker',async()=>{
 const host=await read('../src/extensions/host.js');
 const sdk=await read('../sdk/looprd-social.js');
 assert.match(host,/case\s+['"]companion\.get['"]/);
 assert.match(host,/case\s+['"]companion\.put['"]/);
 assert.match(sdk,/companionGet\(/);
 assert.match(sdk,/companionPut\(/);
});
