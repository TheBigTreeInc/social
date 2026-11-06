import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateRawSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {LOCAL_TAVIX_SOURCE,validateLocalTavix,revalidateLocalTavix,unpackTavixBytes,safeTavixPath} from '../src/extensions/local-package.js';
import {createExtensionStore} from '../src/extensions/store.js';
import {extensionUpdateStatus} from '../src/extensions/updates.js';
import {extensionSource} from '../src/extensions/repositories.js';
import {launchableExtensions} from '../src/launcher.js';
const digest=b=>createHash('sha256').update(b).digest('hex');
const fixtureManifest=(id='org.example.offlinedemo')=>({schema:'tavi.extension/v1',id,version:'1.0.0',name:'Offline Demo',summary:'Demo offline TaviX package',publisher:'example',kind:'app',hostApi:{min:'1.0.0',maxExclusive:'2.0.0'},entrypoints:{panel:'ui/index.html'},contributions:[{slot:'app.launcher',id:'offline-demo',label:'Offline Demo',action:'openPanel'}],permissions:['ui.panel','ui.toast'],platforms:['web','windows','android']});
function makeZip(files,{method=8}={}){
 let pos=0;const chunks=[],directory=[];
 const put=b=>{chunks.push(b);pos+=b.length;};
 for(const [path,content] of Object.entries(files)){
  const name=Buffer.from(path),raw=Buffer.isBuffer(content)?content:Buffer.from(content);
  const compressed=method===8?deflateRawSync(raw):raw,offset=pos;
  const h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50);h.writeUInt16LE(20,4);h.writeUInt16LE(method,8);h.writeUInt32LE(compressed.length,18);h.writeUInt32LE(raw.length,22);h.writeUInt16LE(name.length,26);
  put(h);put(name);put(compressed);
  const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(method,10);c.writeUInt32LE(compressed.length,20);c.writeUInt32LE(raw.length,24);c.writeUInt16LE(name.length,28);c.writeUInt32LE(offset,42);
  directory.push(c,name);
 }
 const dirStart=pos;for(const c of directory)put(c);
 const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(Object.keys(files).length,8);end.writeUInt16LE(Object.keys(files).length,10);end.writeUInt32LE(pos-dirStart,12);end.writeUInt32LE(dirStart,16);put(end);
 return Buffer.concat(chunks);
}
function fixture({id='org.example.offlinedemo',mutateManifest=m=>m,mutateLock=l=>l,method=8,extra={}}={}){
 const manifest=mutateManifest(fixtureManifest(id));
 const files={'manifest.json':JSON.stringify(manifest),'ui/index.html':'<!doctype html><html><head><link rel="stylesheet" href="style.css"></head><body><h1>Offline works</h1><script src="app.js"></script></body></html>','ui/app.js':'document.body.dataset.ready="yes";','ui/style.css':'h1{color:green}',...extra};
 const lock=mutateLock({schema:'tavix.package/v1',standard:'tavix/1.0',applicationId:manifest.id,version:manifest.version,files:Object.entries(files).map(([path,content])=>({path,size:Buffer.byteLength(content),sha256:digest(content)}))});
 return makeZip({...files,'tavix.lock.json':JSON.stringify(lock)},{method});
}
test('accepts official .tavix lockfile, compressed files, SHA and offline assets',async()=>{
 const packageBytes=fixture();const result=await validateLocalTavix(packageBytes);
 assert.equal(result.manifest.id,'org.example.offlinedemo');assert.equal(result.revision,digest(packageBytes));
 assert.deepEqual(Object.keys(result.assets).sort(),['manifest.json','ui/app.js','ui/index.html','ui/style.css']);
 assert.equal((await revalidateLocalTavix(result)).revision,result.revision);
});
test('supports stored ZIP members and requires all lock assets',async()=>{
 assert.equal((await validateLocalTavix(fixture({method:0}))).manifest.version,'1.0.0');
 await assert.rejects(validateLocalTavix(fixture({mutateLock:l=>({...l,files:l.files.slice(1)})})),/Invalid TaviX lockfile/);
});
test('rejects corrupted members and mismatching manifest / lock hash',async()=>{
 await assert.rejects(validateLocalTavix(fixture({mutateLock:l=>({...l,files:l.files.map(f=>f.path==='ui/app.js'?{...f,sha256:'0'.repeat(64)}:f)})})),/SHA-256 mismatch/);
 const record=await validateLocalTavix(fixture());record.assets['ui/app.js'][0]^=1;
 await assert.rejects(revalidateLocalTavix(record),/Stored local asset changed/);
});
test('blocks traversal and executable privilege impersonation',async()=>{
 assert.equal(safeTavixPath('../secret.js'),false);assert.equal(safeTavixPath('ui/../evil.js'),false);
 await assert.rejects(unpackTavixBytes(makeZip({'../evil.js':'x','manifest.json':'{}','tavix.lock.json':'{}'})),/Unsafe or duplicate/);
 await assert.rejects(validateLocalTavix(fixture({mutateManifest:m=>({...m,permissions:['ui.panel','ziprunner.review']})})),/Protected first-party/);
 await assert.rejects(validateLocalTavix(fixture({id:'org.tavi.core.wallet'})),/Protected first-party/);
});
test('allows local Atrium UI but never official source grant',async()=>{
 const record=await validateLocalTavix(fixture({id:'inc.thebigtree.tavi.atrium'}));
 assert.equal(record.manifest.id,'inc.thebigtree.tavi.atrium');
 assert.equal(extensionSource({local:true,manifest:record.manifest}),LOCAL_TAVIX_SOURCE);
});
test('pins local source revision, does not silently upgrade from publisher',async()=>{
 let data=new Map();const storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};
 const store=createExtensionStore({storage,scope:'test'});const record=await validateLocalTavix(fixture());
 store.install(record.manifest,LOCAL_TAVIX_SOURCE,record.revision);
 const entry={manifest:record.manifest,local:true,release:{revision:record.revision}};
 assert.equal(extensionUpdateStatus(entry,store),'current');
 assert.equal(extensionUpdateStatus({...entry,local:false,repositoryUrl:'https://example.org/repo.json'},store),'source-changed');
 assert.equal(launchableExtensions({catalog:[entry],store,platform:'android'}).length,1);
 assert.equal(launchableExtensions({catalog:[entry],store,platform:'windows'}).length,1);
 store.uninstall(record.manifest.id);assert.equal(launchableExtensions({catalog:[entry],store,platform:'windows'}).length,0);
});
test('rejects truncated / oversize zip and missing headers',async()=>{
 await assert.rejects(unpackTavixBytes(new Uint8Array(10)),/central directory missing/);
 await assert.rejects(unpackTavixBytes(new Uint8Array(12_000_001)),/exceeds 12 MB/);
 await assert.rejects(unpackTavixBytes(fixture().subarray(0,100)),/central directory missing/);
});
test('local runner remains CSP-restricted and opaque-origin',()=>{
 const html=readFileSync(new URL('../public/local-extension-host.html',import.meta.url),'utf8');
 const js=readFileSync(new URL('../public/local-extension-host.js',import.meta.url),'utf8');
 const app=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 const tauri=JSON.parse(readFileSync(new URL('../src-tauri/tauri.conf.json',import.meta.url),'utf8'));
 assert.match(html,/connect-src 'none'/);assert.match(html,/frame-src 'none'/);
 assert.match(html,/script-src 'self' blob:/);assert.match(js,/event\.source!==parent/);
 assert.match(app,/frame\.setAttribute\('sandbox','allow-scripts'\)/);
 assert.doesNotMatch(app,/sandbox','allow-scripts allow-same-origin'/);
 assert.match(tauri.app.security.csp,/script-src 'self' blob:/);
});
test('local archive vault keeps separate accounts and removes only the requested package',async()=>{
 const {saveLocalTavix,loadLocalTavix,deleteLocalTavix}=await import('../src/extensions/local-package.js');
 const old=globalThis.indexedDB,records=new Map();let schema=false;
 globalThis.indexedDB={open(){
  const request={};
  setImmediate(()=>{
   const db={
    objectStoreNames:{contains:()=>schema},
    createObjectStore:()=>{schema=true;},close(){},
    transaction(){
     const tx={};
     const operation=(type,key,value)=>{
      const req={};setImmediate(()=>{
       if(type==='get')req.result=records.get(key);
       if(type==='put')records.set(key,structuredClone(value));
       if(type==='delete')records.delete(key);
       req.onsuccess?.();tx.oncomplete?.();
      });return req;
     };
     tx.objectStore=()=>({get:key=>operation('get',key),put:(value,key)=>operation('put',key,value),delete:key=>operation('delete',key)});
     return tx;
    }
   };
   request.result=db;request.onupgradeneeded?.();request.onsuccess?.();
  });return request;
 }};
 try{
  const record=await validateLocalTavix(fixture());
  await saveLocalTavix('account-A',record);
  assert.equal((await loadLocalTavix('account-A',record.manifest.id)).revision,record.revision);
  // A modified archive at rest must not pass as the pinned SHA-256.
  records.get(`account-A:${record.manifest.id}`).archive[14]^=1;
  await assert.rejects(loadLocalTavix('account-A',record.manifest.id));
  await saveLocalTavix('account-A',record);
  assert.equal(await loadLocalTavix('account-B',record.manifest.id),null);
  await deleteLocalTavix('account-A',record.manifest.id);
  assert.equal(await loadLocalTavix('account-A',record.manifest.id),null);
 }finally{globalThis.indexedDB=old;}
});
test('a local Atrium preview receives no official game-launch or surface privileges',async()=>{
 const {createExtensionHost}=await import('../src/extensions/host.js');
 const callbacks=new Map(),responses=[];
 const fakeWindow={addEventListener:(n,fn)=>callbacks.set(n,fn),removeEventListener:n=>callbacks.delete(n)};
 const sender={postMessage:message=>responses.push(message)};
 const host=createExtensionHost({windowRef:fakeWindow,storage:{getItem:()=>null,setItem:()=>{}},notify:()=>{},close:()=>{}});
 host.mount({contentWindow:sender},{id:'inc.thebigtree.tavi.atrium',scope:'scope',source:LOCAL_TAVIX_SOURCE,permissions:['ui.panel']});
 const request=(id,method)=>callbacks.get('message')({source:sender,origin:'null',data:{channel:'tavi.extension/v1',direction:'request',id,method}});
 request(1,'host.info');assert.equal(responses.at(-1).ok,true);
 assert(!responses.at(-1).result.features.includes('atrium.tavi-launch/v1'));
 assert(!responses.at(-1).result.features.includes('tavix.surface/v1'));
 request(2,'ui.requestGameLaunch');assert.equal(responses.at(-1).ok,false);
 request(3,'surface.requestOpen');assert.equal(responses.at(-1).ok,false);
 host.dispose();
});
