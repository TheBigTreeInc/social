import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {REVIEWED_COMPANION} from '../src/extensions/reviewed-companion.js';
const read=async rel=>readFile(new URL(rel,import.meta.url),'utf8');
const json=async rel=>JSON.parse(await read(rel));

test('Tavi pins the canonical reviewed Companion 0.6.27 bundle without permission expansion',async()=>{
 const registry=await json('../../extensions/registry.json');
 const entry=registry.extensions.find(x=>x.id==='org.tavi.community.companion');
 assert.equal(entry.publisher,'tavi-community');
 assert.equal(entry.version,'0.6.27');
 assert.equal(entry.sha256,'f1bf1db6276641f7b19c8ca6bcfd814e8aedc8a903d022bff6fbd0662d280844');
 assert.deepEqual(REVIEWED_COMPANION,{id:'org.tavi.community.companion',publisher:'tavi-community',version:'0.6.27',sha256:entry.sha256});
 const manifest=await json('../../extensions/org.tavi.community.companion/manifest.json');
 assert.equal(manifest.version,'0.6.27');
 assert.deepEqual(manifest.permissions,['ui.panel','ui.toast','storage.private']);
 assert.deepEqual(manifest.platforms,['web','windows','android']);
});

test('published catalog matches the reviewed Companion source digest and cave bundle',async()=>{
 const catalog=await json('../public/tavi-extensions/catalog.v1.json');
 const entry=catalog.extensions.find(x=>x.manifest.id==='org.tavi.community.companion');
 assert.equal(entry.manifest.version,'0.6.27');
 const serial=JSON.stringify({manifest:entry.manifest,files:entry.files})+'\n';
 assert.equal(createHash('sha256').update(serial).digest('hex'),'f1bf1db6276641f7b19c8ca6bcfd814e8aedc8a903d022bff6fbd0662d280844');
 const index=await read('../../extensions/org.tavi.community.companion/ui/index.html');
 assert.match(index,/A CAVE TO EXPLORE/);
 assert.match(index,/world-main\.js/);
});

test('0.3.105 does not pretend the newer Companion cloud backend already exists',async()=>{
 const host=await read('../src/extensions/host.js');
 const sdk=await read('../sdk/looprd-social.js');
 assert.doesNotMatch(host,/case\s+['"]companion\.get['"]/);
 assert.doesNotMatch(host,/case\s+['"]companion\.put['"]/);
 assert.doesNotMatch(sdk,/companionGet\(/);
 assert.doesNotMatch(sdk,/companionPut\(/);
});
