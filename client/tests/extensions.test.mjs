import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash,webcrypto} from 'node:crypto';
import {validateExtensionManifest,validateCatalog,extensionAssetUrl,compareVersions} from '../src/extensions/contract.js';
import {createExtensionStore,extensionStorageScope,verifyBundledExtension} from '../src/extensions/store.js';
import {createExtensionHost} from '../src/extensions/host.js';
import {registerExtension} from '../../tools/register-tavi-extension.mjs';
const root=new URL('../public/tavi-extensions/catalog.v1.json',import.meta.url);
const catalog=JSON.parse(await readFile(root,'utf8'));
const entry=catalog.extensions[0];
const memory=()=>{
 const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
};
test('real catalog/manifest accepted and v1 SDK API range checked',()=>{
 assert.equal(validateCatalog(catalog).length,2);
 assert.equal(validateExtensionManifest(entry.manifest).compatible,true);
 assert.equal(compareVersions('1.0.1','1.0.0'),1);
 const future=structuredClone(entry.manifest);future.hostApi.min='2.0.0';future.hostApi.maxExclusive='3.0.0';
 assert.equal(validateExtensionManifest(future).compatible,false);
 for(const mod of [m=>m.permissions.push('social.messages.read'),m=>m.entrypoints.panel='https://evil.example/p.js',m=>m.contributions.push({slot:'profile.trailingWidget',id:'p',label:'Widget',action:'openPanel'})]){
  const invalid=structuredClone(entry.manifest);mod(invalid);assert.throws(()=>validateExtensionManifest(invalid));
 }
 assert.throws(()=>extensionAssetUrl(entry.manifest.id,'../secrets.js','https://tavi.test/'));
});
test('scoped install/grants persist but never move to different account/server',()=>{
 const storage=memory();const one=extensionStorageScope('https://social.example','alice');
 const two=extensionStorageScope('https://social.example','bob');
 const three=extensionStorageScope('https://another.example','alice');
 const a=createExtensionStore({storage,scope:one});a.install(entry.manifest);
 assert(a.enabled(entry.manifest.id));
 assert(!createExtensionStore({storage,scope:two}).installed(entry.manifest.id));
 assert(!createExtensionStore({storage,scope:three}).installed(entry.manifest.id));
 const smaller=structuredClone(entry.manifest);smaller.permissions=['ui.panel'];
 a.disable(entry.manifest.id);assert(!a.enabled(entry.manifest.id));a.enable(smaller);
 const expanded=structuredClone(entry.manifest);expanded.permissions.push('ui.panel');expanded.permissions=[...new Set(expanded.permissions)];
 // Attempt a capability not consented when originally installed.
 const b=createExtensionStore({storage,scope:one});b.uninstall(entry.manifest.id);b.install(smaller);
 assert.throws(()=>b.enable(entry.manifest),/permission/i);
 b.uninstall(entry.manifest.id);assert(!b.installed(entry.manifest.id));
});
test('tampering with locally bundled assets blocks extension launch',async()=>{
 const original=await readFile(new URL('../public/tavi-extensions/org.tavi.examples.notepad/ui/index.html',import.meta.url));
 const okFetch=async(url)=>({ok:true,arrayBuffer:async()=>readFile(new URL(url.replace('https://tavi.test/','../public/'),import.meta.url))});
 assert(await verifyBundledExtension(entry,{baseUrl:'https://tavi.test/',fetcher:okFetch,cryptoRef:webcrypto}));
 const wrong=async()=>({ok:true,arrayBuffer:async()=>Buffer.from('malicious')});
 await assert.rejects(verifyBundledExtension(entry,{baseUrl:'https://tavi.test/',fetcher:wrong,cryptoRef:webcrypto}),/changed/);
});
test('isolated host rejects foreign frames, invalid permissions and reads only namespace',()=>{
 const listeners=new Map(),windowRef={addEventListener:(k,fn)=>listeners.set(k,fn),removeEventListener:k=>listeners.delete(k)};
 const sent=[],frame={contentWindow:{postMessage:data=>sent.push(data)}};
 const storage=memory(),notice=[],closed=[];
 const host=createExtensionHost({windowRef,storage,notify:s=>notice.push(s),close:()=>closed.push(true)});
 host.mount(frame,{id:'org.tavi.examples.notepad',permissions:['storage.private','ui.toast','ui.panel'],scope:'account-a'});
 const dispatch=(method,rest={},source=frame.contentWindow,origin='null')=>listeners.get('message')({source,origin,data:{channel:'tavi.extension/v1',direction:'request',id:sent.length+1,method,...rest}});
 dispatch('storage.set',{key:'notes',value:'private'});assert.equal(sent.at(-1).ok,true);
 dispatch('storage.get',{key:'notes'});assert.equal(sent.at(-1).result,'private');
 const count=sent.length;dispatch('storage.get',{key:'notes'},{});assert.equal(sent.length,count);
 dispatch('storage.get',{key:'notes'},frame.contentWindow,'https://tavi.test');assert.equal(sent.length,count);
 dispatch('social.token');assert.equal(sent.at(-1).ok,false);
 dispatch('ui.toast',{message:'hello'});assert.deepEqual(notice,['hello']);
 dispatch('ui.close');assert.deepEqual(closed,[true]);
 host.unmount();assert.equal(storage.getItem('account-a:org.tavi.examples.notepad:notes'),'private');host.dispose();
});
test('publisher importer builds identical validated catalog without touching live source',async()=>{
 const tmp=await mkdtemp(join(tmpdir(),'tavi-extension-'));
 try{
  const source=join(tmp,'source'),target=join(tmp,'registry');await mkdir(source,{recursive:true});await mkdir(join(source,'ui'));
  await writeFile(join(source,'manifest.json'),JSON.stringify(entry.manifest));
  await writeFile(join(source,'ui/index.html'),'<html>ok</html>');
  await writeFile(join(source,'ui/icon.svg'),'<svg xmlns="http://www.w3.org/2000/svg"></svg>');
  const registered=await registerExtension(source,{target});
  assert.equal(registered.manifest.id,entry.manifest.id);
  const digest=createHash('sha256').update('<html>ok</html>').digest('hex');
  assert.equal(registered.files.find(f=>f.path==='ui/index.html').sha256,digest);
  const iconless=structuredClone(entry.manifest);delete iconless.icon;await writeFile(join(source,'manifest.json'),JSON.stringify(iconless));
  const otherTarget=join(tmp,'fresh-registry');await mkdir(otherTarget);
  await assert.rejects(registerExtension(source,{target:otherTarget}),/require an icon/);
  const invalid=structuredClone(entry.manifest);invalid.permissions.push('social.messages.read');await writeFile(join(source,'manifest.json'),JSON.stringify(invalid));
  await assert.rejects(registerExtension(source,{target}),/permission/);
 }finally{await rm(tmp,{recursive:true,force:true});}
});
test('messenger exposes a persistent Home return from extension panel and curated app store',async()=>{
 const code=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(code,/data-action="home"/);
 assert.match(code,/data-action="app-store"/);
 assert.match(code,/sandbox','allow-scripts'/);
 assert.doesNotMatch(code,/sandbox','allow-scripts allow-same-origin'/);
});

// A Windows autocrlf checkout must not corrupt authenticated bundled asset bytes.
test('bundled extension source keeps SHA-256 bytes on Windows Git checkouts',async()=>{
 const attrs=await readFile(new URL('../../.gitattributes',import.meta.url),'utf8');
 for(const ext of ['html','css','js','json','svg'])assert(attrs.includes(`client/public/tavi-extensions/**/*.${ext} text eol=lf`));
 for(const asset of entry.files){
  const path=new URL(`../public/tavi-extensions/${entry.manifest.id}/${asset.path}`,import.meta.url);
  const bytes=await readFile(path);
  assert(!bytes.includes(Buffer.from('\r\n')),'SHA-pinned text files must retain LF line endings');
  assert.equal(bytes.length,asset.size,`size differs for ${asset.path}`);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256,`digest differs for ${asset.path}`);
 }
});
