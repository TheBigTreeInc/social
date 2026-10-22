import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {webcrypto} from 'node:crypto';
import {createExtensionHost} from '../src/extensions/host.js';
import {validateCompanionPreview,previewStorageKey,readCompanionPreview,clearCompanionPreview} from '../src/extensions/companion-preview.js';
import {verifyReviewedCompanion,REVIEWED_COMPANION} from '../src/extensions/reviewed-companion.js';
import {inspectReviewedBundle} from '../../tools/import-reviewed-extension.mjs';
const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFAAAABQCAYAAACOEfKtAAAAxUlEQVR4nO3QwQmAMADAwNr9oRv5diu7Q/MQ4W6CkOu51zs4Nr8O+DsDIwMjAyMDIwMjAyMDIwMjAyMDIwMjAyMDIwMjAyMDIwMjAyMDIwMjAyMDIwMjAyMDIwMjAyMDIwMjAyMDIwMjAyMDIwMjAyMDIwMjAyMDIwMjAyMDIwMjAyMDIwMjAyMDIwMjAyMDIwMjAyMDIwMjAyMDIwMjAyMDIwMjAyMDIwMjAyMDIwMjAyMDIwMjAyMDIwMjAyMDIwMjA6MNj48DtIcTZ9MAAAAASUVORK5CYII=';
const valid={schema:'tavi.companion.preview/v1',form:'cat',name:'Pippin',image:PNG};
const scope=(server,account)=>`tavi.extensions.install/v1:${encodeURIComponent(server)}:${encodeURIComponent(account)}`;
const alice=scope('https://social.example','alice'),bob=scope('https://social.example','bob'),other=scope('https://other.example','alice');
const store=()=>{const d=new Map();return {getItem:k=>d.get(k)??null,setItem:(k,v)=>d.set(k,v),removeItem:k=>d.delete(k),keys:()=>[...d.keys()]};};
test('Companion preview accepts only 80x80 bounded original-rendered PNG and four public fields',()=>{
 assert.deepEqual(validateCompanionPreview(valid),valid);
 for(const mutate of [v=>v.schema='bad',v=>v.form='dog',v=>v.name='A'.repeat(33),v=>v.image='https://x/p.png',v=>v.image='data:image/svg+xml;base64,AAAA',v=>v.image=PNG.slice(0,65),v=>v.image='data:image/png;base64,'+PNG.split(',')[1].replace('U', 'Z'),v=>v.genome='secret',v=>v.credentials='Bearer 123']){
  const changed={...valid};mutate(changed);assert.throws(()=>validateCompanionPreview(changed));
 }
 assert.throws(()=>validateCompanionPreview({...valid,image:PNG+'A'.repeat(90000)}));
});
test('reviewed partner source digest matches compiled trust grant and bundled catalog',async()=>{
 const registry=JSON.parse(await readFile(new URL('../../extensions/registry.json',import.meta.url)));
 const record=registry.extensions.find(e=>e.id===REVIEWED_COMPANION.id);
 assert.equal(record.mode,'optional');assert.equal(record.publisher,'tavi-community');assert.equal(record.sha256,REVIEWED_COMPANION.sha256);
 const companionDir=new URL('../../extensions/org.tavi.community.companion/',import.meta.url);
 // Use a file URL or fileURLToPath() for portability: URL.pathname fails on Windows (C:\C:\...).
 const scanned=await inspectReviewedBundle(companionDir);
 assert.equal(scanned.sha256,(await inspectReviewedBundle(fileURLToPath(companionDir))).sha256);
 assert.equal(scanned.sha256,record.sha256);
 const catalog=JSON.parse(await readFile(new URL('../public/tavi-extensions/catalog.v1.json',import.meta.url))).extensions;
 const entry=catalog.find(e=>e.manifest.id===record.id);
 assert.equal(await verifyReviewedCompanion(entry,{cryptoRef:webcrypto}),record.sha256);
 await assert.rejects(verifyReviewedCompanion({...entry,manifest:{...entry.manifest,publisher:'tavi'}},{cryptoRef:webcrypto}),/Unreviewed/);
 await assert.rejects(verifyReviewedCompanion({...entry,files:entry.files.slice(1)},{cryptoRef:webcrypto}),/digest/);
 await assert.rejects(verifyReviewedCompanion({...entry,remote:{entrypoint:'https://evil.example'}},{cryptoRef:webcrypto}),/Unreviewed/);
});
test('isolation by server/account and preview cache invalidation after disable',()=>{
 const storage=store();storage.setItem(previewStorageKey(alice),JSON.stringify(valid));
 assert.deepEqual(readCompanionPreview(storage,alice),valid);
 assert.equal(readCompanionPreview(storage,bob),null);
 assert.equal(readCompanionPreview(storage,other),null);
 clearCompanionPreview(storage,alice);assert.equal(readCompanionPreview(storage,alice),null);
});
test('host allows validated preview only from pinned verified enabled live Companion frame',()=>{
 const events=new Map(),windowRef={addEventListener:(kind,fn)=>events.set(kind,fn),removeEventListener:kind=>events.delete(kind)};
 const storage=store(),sent=[],published=[];
 let enabled=true,liveScope=alice;
 const frame={contentWindow:{postMessage:msg=>sent.push(msg)}};
 const host=createExtensionHost({windowRef,storage,notify:()=>{},close:()=>{},onCompanionPreview:(val,s)=>published.push([val,s]),
  isReviewedCompanionSession:session=>enabled&&session.scope===liveScope&&session.reviewedBundle===REVIEWED_COMPANION.sha256&&session.id===REVIEWED_COMPANION.id&&session.source==='tavi:bundled'});
 const mount=(id=REVIEWED_COMPANION.id,source='tavi:bundled',digest=REVIEWED_COMPANION.sha256,scope=alice)=>host.mount(frame,{id,permissions:['ui.panel','storage.private','ui.toast'],scope,source,reviewedBundle:digest});
 let seq=0;
 const send=(method='companion.preview',preview=valid,origin='null',sender=frame.contentWindow)=>{const before=sent.length;events.get('message')({origin,source:sender,data:{channel:'tavi.extension/v1',direction:'request',id:++seq,method,preview}});return sent.length>before?sent.at(-1):null;};
 mount();assert.equal(send().ok,true);assert.equal(published.length,1);
 assert.equal(send('host.info').result.features.includes('tavi.companion.preview/v1'),true);
 assert.equal(send('companion.preview',valid,'https://evil.test'),null);
 assert.equal(send('companion.preview',valid,'null',{}),null);
 for(const [id,source,digest] of [
  ['org.tavi.examples.notepad','tavi:bundled',REVIEWED_COMPANION.sha256],
  [REVIEWED_COMPANION.id,'https://evil.test',REVIEWED_COMPANION.sha256],
  [REVIEWED_COMPANION.id,'tavi:bundled','0'.repeat(64)]]){
  mount(id,source,digest);assert.equal(send().ok,false);
 }
 mount();enabled=false;assert.equal(send().ok,false);
 enabled=true;liveScope=bob;assert.equal(send().ok,false);
 mount(REVIEWED_COMPANION.id,'tavi:bundled',REVIEWED_COMPANION.sha256,bob);
 assert.equal(send().ok,true);assert.deepEqual(readCompanionPreview(storage,bob),valid);
 assert.equal(readCompanionPreview(storage,other),null);
 host.dispose();
});
test('host per-frame preview publication is rate limited independently',()=>{
 const events=new Map(),sent=[],storage=store(),frame={contentWindow:{postMessage:msg=>sent.push(msg)}};
 const host=createExtensionHost({windowRef:{addEventListener:(kind,fn)=>events.set(kind,fn),removeEventListener:()=>{}},storage,notify:()=>{},close:()=>{},isReviewedCompanionSession:()=>true});
 host.mount(frame,{id:REVIEWED_COMPANION.id,source:'tavi:bundled',permissions:['ui.panel'],scope:alice,reviewedBundle:REVIEWED_COMPANION.sha256});
 for(let id=1;id<=13;id++)events.get('message')({source:frame.contentWindow,origin:'null',data:{channel:'tavi.extension/v1',direction:'request',id,method:'companion.preview',preview:valid}});
 assert.equal(sent[11].ok,true);assert.equal(sent[12].ok,false);assert.match(sent[12].error,/rate/);
 host.dispose();
});
