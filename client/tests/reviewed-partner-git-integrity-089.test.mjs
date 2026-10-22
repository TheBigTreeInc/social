import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const root=resolve(fileURLToPath(new URL('../../',import.meta.url)));
const sha=b=>createHash('sha256').update(b).digest('hex');

test('reviewed Companion JS keeps original mixed line endings in both source and static mirror', async()=>{
 const attrs=await readFile(resolve(root,'.gitattributes'),'utf8');
 const catalog=JSON.parse(await readFile(resolve(root,'client/public/tavi-extensions/catalog.v1.json'),'utf8'));
 const companion=catalog.extensions.find(x=>x.manifest.id==='org.tavi.community.companion');
 assert.ok(companion);
 for(const name of ['studio-main.js','world-main.js']){
  const path='ui/'+name;
  const rule='extensions/org.tavi.community.companion/'+path+' -text';
  const mirrored='client/public/tavi-extensions/org.tavi.community.companion/'+path+' -text';
  assert.ok(attrs.includes(rule),`missing binary Git rule: ${rule}`);
  assert.ok(attrs.includes(mirrored),`missing binary Git rule: ${mirrored}`);
  const source=await readFile(resolve(root,'extensions/org.tavi.community.companion',path));
  const output=await readFile(resolve(root,'client/public/tavi-extensions/org.tavi.community.companion',path));
  assert.ok(source.includes(Buffer.from('\r\n')),'fixture must include the publisher-approved mixed CRLF');
  assert.deepEqual(source,output);
  const entry=companion.files.find(x=>x.path===path);
  assert.equal(sha(source),entry.sha256);
  assert.notEqual(sha(Buffer.from(source.toString('utf8').replaceAll('\r\n','\n'))),entry.sha256,
   'Git LF conversion must be detected as a changed reviewed publisher asset');
 }
});
