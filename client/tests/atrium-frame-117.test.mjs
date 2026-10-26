import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {extensionFrameIdentity} from '../src/extensions/frame-identity.js';
const entry={manifest:{id:'inc.thebigtree.tavi.atrium',version:'1.0.4'},remote:{entrypoint:'https://example.org/atrium/1.0.4/ui/index.html'},release:{revision:'rev4'}};
const source='https://example.org/repository.json';
const store=(v='1.0.4',revision='rev4',url=entry.remote.entrypoint)=>({enabled:()=>true,source:()=>source,version:()=>v,revision:()=>revision,entrypoint:()=>url});
test('reviewed frame identity varies by installed version, revision and entrypoint',()=>{
 const original=extensionFrameIdentity(entry.manifest.id,entry,store(),source);
 assert.ok(original);
 assert.equal(extensionFrameIdentity(entry.manifest.id,entry,store(),source),original);
 assert.equal(extensionFrameIdentity(entry.manifest.id,entry,store('1.0.2'),source),null);
 assert.equal(extensionFrameIdentity(entry.manifest.id,entry,store('1.0.4','older'),source),null);
 assert.equal(extensionFrameIdentity(entry.manifest.id,entry,store('1.0.4','rev4','https://example.org/old'),source),null);
 assert.equal(extensionFrameIdentity(entry.manifest.id,entry,store(),'https://other.example/repository'),null);
});
test('Games routes installed Atrium through reviewed extension host without discovery credentials',async()=>{
 const code=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(code,/const atriumInstalled=extensionEnabled\(ATRIUM_EXTENSION_ID\)/);
 assert.match(code,/data-extension-open/);
 assert.match(code,/Find Atrium in Apps/);
 assert.match(code,/frame\.dataset\.frameIdentity/);
 assert.match(code,/extensionFrameIdentity\(extensionSelected/);
});
