import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createExtensionStore} from '../src/extensions/store.js';
import {validateLocalTavix,revalidateLocalTavix,LOCAL_TAVIX_SOURCE} from '../src/extensions/local-package.js';
import {isProtectedDeveloperIdentity,readDeveloperOverrides,pinDeveloperOverride,unpinDeveloperOverride,devPreviewHostPermissions,devPreviewStorageScope} from '../src/extensions/developer-overrides.js';
import {appFavoriteId} from '../src/ui/app-favorites.js';
import {createExtensionHost} from '../src/extensions/host.js';
const sha=b=>createHash('sha256').update(b).digest('hex');
const manifest=(id='org.tavi.community.companion',permissions=['ui.panel','ui.toast','storage.private'])=>({schema:'tavi.extension/v1',id,version:'0.6.99',name:'Dev Companion',summary:'Local developer shadow',publisher:'thebigtree',kind:'app',hostApi:{min:'1.0.0',maxExclusive:'2.0.0'},entrypoints:{panel:'ui/index.html'},contributions:[{slot:'app.launcher',id:'dev-test',label:'Dev',action:'openPanel'}],permissions,platforms:['windows','android','web']});
function storedZip(m){
 const files={'manifest.json':JSON.stringify(m),'ui/index.html':'<!doctype html><html><body>Test</body></html>'};
 files['tavix.lock.json']=JSON.stringify({schema:'tavix.package/v1',standard:'tavix/1.0',applicationId:m.id,version:m.version,files:Object.entries(files).map(([path,content])=>({path,size:Buffer.byteLength(content),sha256:sha(content)}))});
 const chunks=[],directory=[];let pos=0;
 const put=b=>{chunks.push(b);pos+=b.length;};
 for(const [path,content] of Object.entries(files)){
  const name=Buffer.from(path),raw=Buffer.from(content),offset=pos;
  const l=Buffer.alloc(30);l.writeUInt32LE(0x04034b50);l.writeUInt16LE(20,4);l.writeUInt32LE(raw.length,18);l.writeUInt32LE(raw.length,22);l.writeUInt16LE(name.length,26);put(l);put(name);put(raw);
  const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt32LE(raw.length,20);c.writeUInt32LE(raw.length,24);c.writeUInt16LE(name.length,28);c.writeUInt32LE(offset,42);directory.push(c,name);
 }
 const begin=pos;for(const entry of directory)put(entry);
 const e=Buffer.alloc(22);e.writeUInt32LE(0x06054b50);e.writeUInt16LE(Object.keys(files).length,8);e.writeUInt16LE(Object.keys(files).length,10);e.writeUInt32LE(pos-begin,12);e.writeUInt32LE(begin,16);put(e);return Buffer.concat(chunks);
}
const fakeStorage=()=>{const map=new Map();return{getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};};

test('protected Companion stays rejected in normal import but allowed as explicit developer shadow',async()=>{
 const archive=storedZip(manifest());
 await assert.rejects(validateLocalTavix(archive),/Protected first-party/);
 const record=await validateLocalTavix(archive,{developerPreview:true});
 assert.equal(record.manifest.id,'org.tavi.community.companion');
 await assert.rejects(revalidateLocalTavix(record),/Protected local package/);
 assert.equal((await revalidateLocalTavix(record,{developerPreview:true})).revision,sha(archive));
});
test('core Wallet and privileged ZipRunner package IDs support preview without trusted grants',async()=>{
 for(const id of ['org.tavi.core.wallet','inc.thebigtree.ziprunner.review']){
  const permissions=id.includes('ziprunner')?['ui.panel','ziprunner.review']:['ui.panel'];
  await assert.rejects(validateLocalTavix(storedZip(manifest(id,permissions))),/Protected first-party/);
  const record=await validateLocalTavix(storedZip(manifest(id,permissions)),{developerPreview:true});
  assert.equal(record.manifest.id,id);
  assert.deepEqual(devPreviewHostPermissions(record.manifest.permissions),['ui.panel']);
 }
});
test('override metadata and extension installation remain independent; revert restores original pin',()=>{
 const storage=fakeStorage(),scope='account-X';
 const store=createExtensionStore({storage,scope:'installed:'+scope});
 const original=manifest('org.tavi.community.companion');original.version='0.6.27';
 store.install(original,'tavi:bundled','a'.repeat(64));
 assert.equal(isProtectedDeveloperIdentity(manifest(),store),true);
 pinDeveloperOverride(storage,scope,original.id,'b'.repeat(64));
 assert.deepEqual(readDeveloperOverrides(storage,scope),[{id:original.id,revision:'b'.repeat(64)}]);
 assert.equal(store.source(original.id),'tavi:bundled');assert.equal(store.revision(original.id),'a'.repeat(64));
 unpinDeveloperOverride(storage,scope,original.id);
 assert.deepEqual(readDeveloperOverrides(storage,scope),[]);
 assert.equal(store.source(original.id),'tavi:bundled');assert.equal(store.installed(original.id),true);
});
test('separate accounts, corrupt storage and duplicate dev overrides fail safely',()=>{
 const storage=fakeStorage();
 pinDeveloperOverride(storage,'A','org.tavi.community.companion','a'.repeat(64));
 pinDeveloperOverride(storage,'A','org.tavi.community.companion','b'.repeat(64));
 assert.equal(readDeveloperOverrides(storage,'A').length,1);
 assert.equal(readDeveloperOverrides(storage,'B').length,0);
 storage.setItem('tavi.developer-overrides/v1:A','{garbage');
 assert.deepEqual(readDeveloperOverrides(storage,'A'),[]);
 assert.throws(()=>pinDeveloperOverride(storage,'A','../evil','c'.repeat(64)));
});
test('developer preview private storage is isolated from the bundled app state',()=>{
 const scope='user';
 const shadow=devPreviewStorageScope(scope,'a'.repeat(64));
 assert.notEqual(`${shadow}:org.tavi.community.companion:key`,`${scope}:org.tavi.community.companion:key`);
 assert.equal(appFavoriteId({kind:'developer-preview',id:'org.tavi.core.future'}),'extension:org.tavi.core.future');
});
test('local identity impersonation cannot invoke Companion, Wallet, ZipRunner or Atrium trusted operations',()=>{
 const events=new Map(),output=[];
 const win={addEventListener:(n,fn)=>events.set(n,fn),removeEventListener:n=>events.delete(n)};
 const sender={postMessage:message=>output.push(message)};
 const host=createExtensionHost({windowRef:win,storage:fakeStorage(),notify:()=>{},close:()=>{}});
 let next=0;
 const check=(id,method,permissions=['ui.panel','ui.toast'])=>{
  const frame={contentWindow:sender};
  host.mount(frame,{id,source:LOCAL_TAVIX_SOURCE,scope:devPreviewStorageScope('user','b'.repeat(64)),permissions:devPreviewHostPermissions(permissions),reviewedBundle:null});
  events.get('message')({source:sender,origin:'null',data:{channel:'tavi.extension/v1',direction:'request',id:++next,method}});
  assert.equal(output.at(-1).ok,false,`${id} ${method}`);
 };
 check('org.tavi.community.companion','companion.preview');
 check('org.tavi.core.wallet','wallet.balance');
 check('inc.thebigtree.ziprunner.review','ziprunner.review',['ui.panel','ziprunner.review']);
 check('inc.thebigtree.tavi.atrium','ui.requestGameLaunch');
 host.dispose();
});
test('Tavi has protected preview and revert hooks behind LoopRD developer permission',()=>{
 const app=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(app,/validateLocalTavix\(await file\.arrayBuffer\(\),\{developerPreview:true\}\)/);
 assert.match(app,/verifyLocalTavixDeveloperGrant\(state,updateDeveloperPermission\)/);
 assert.match(app,/if\(pending\.developerPreview\)\{/);
 assert.match(app,/pinDeveloperOverride\(localStorage,pending\.scope,m\.id,record\.revision\)/);
 assert.match(app,/if\(!canInstallLocalTavix\(state\)\)return apps/);
 assert.match(app,/source:LOCAL_TAVIX_SOURCE,reviewedBundle:null/);
 assert.match(app,/onRestore:item=>/);
 assert.match(app,/unpinDeveloperOverride\(localStorage,scope,id\)/);
 assert.match(app,/activeDeveloperOverlay=null;developerOverlays\.clear\(\)/);
});
