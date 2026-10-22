import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,cp,rm,writeFile,unlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {webcrypto,createHash} from 'node:crypto';
import {verifyBundledExtension} from '../src/extensions/store.js';
import {syncInternalExtensions} from '../../tools/sync-internal-extensions.mjs';

const publicRoot=new URL('../public/tavi-extensions/',import.meta.url);
const catalog=JSON.parse(await readFile(new URL('catalog.v1.json',publicRoot)));
const prefix='https://tavi.test/';
const readPublished=async url=>readFile(new URL(url.replace(prefix,'../public/'),import.meta.url));
const fixtureFetcher=async url=>({ok:true,arrayBuffer:async()=>readPublished(url)});

test('all bundled HTML source and binary transport are byte-identical without changing catalog or publisher digest',async()=>{
 for(const entry of catalog.extensions){
  const base=new URL(`${entry.manifest.id}/`,publicRoot);
  for(const file of entry.files.filter(f=>f.path.endsWith('.html'))){
   const html=await readFile(new URL(file.path,base));
   const binary=await readFile(new URL(file.path+'.bytes',base));
   assert.deepEqual(binary,html,`${entry.manifest.id}/${file.path}`);
   assert.equal(binary.length,file.size);
   assert.equal(createHash('sha256').update(binary).digest('hex'),file.sha256);
   assert(!entry.files.some(f=>f.path.endsWith('.bytes')),'transport copies are not new approved extension assets');
  }
  assert(await verifyBundledExtension(entry,{baseUrl:prefix,fetcher:fixtureFetcher,cryptoRef:webcrypto}));
 }
});

test('native HTML mutation cannot break source verification, and corrupted binary always blocks install',async()=>{
 const entry=catalog.extensions.find(x=>x.manifest.id==='org.tavi.community.companion');
 const html=[];
 const nativeFetcher=async url=>{
  // Simulate the native CSP rewrite and assert verification uses only .bytes.
  if(url.endsWith('.html'))throw Error('Runtime tried to hash modified native HTML');
  if(url.endsWith('.html.bytes'))html.push(url);
  return fixtureFetcher(url);
 };
 assert(await verifyBundledExtension(entry,{baseUrl:prefix,fetcher:nativeFetcher,cryptoRef:webcrypto}));
 assert(html.some(url=>url.endsWith('/ui/cat-study.html.bytes')));
 const mutatedFetcher=async url=>url.endsWith('ui/cat-study.html.bytes')
  ?{ok:true,arrayBuffer:async()=>new TextEncoder().encode('<html>tampered</html>').buffer}
  :fixtureFetcher(url);
 await assert.rejects(verifyBundledExtension(entry,{baseUrl:prefix,fetcher:mutatedFetcher,cryptoRef:webcrypto}),/asset size changed/i);
 const missingFetcher=async url=>url.endsWith('ui/cat-study.html.bytes')
  ?{ok:false,status:404}:fixtureFetcher(url);
 await assert.rejects(verifyBundledExtension(entry,{baseUrl:prefix,fetcher:missingFetcher,cryptoRef:webcrypto}),/asset unavailable/i);
});

test('extension sync/check treats HTML sidecars as generated artifacts and rejects stale copies',async()=>{
 const tmp=await mkdtemp(join(tmpdir(),'tavi-html-088-'));
 try{
  await cp(new URL('../../extensions/',import.meta.url),join(tmp,'extensions'),{recursive:true});
  await cp(publicRoot,join(tmp,'client/public/tavi-extensions'),{recursive:true});
  await syncInternalExtensions({root:tmp,check:true});
  const sidecar=join(tmp,'client/public/tavi-extensions/org.tavi.community.companion/ui/cat-study.html.bytes');
  await writeFile(sidecar,'tampered');
  await assert.rejects(syncInternalExtensions({root:tmp,check:true}),/raw HTML stale/i);
  await syncInternalExtensions({root:tmp});
  await syncInternalExtensions({root:tmp,check:true});
  await unlink(sidecar);
  await assert.rejects(syncInternalExtensions({root:tmp,check:true}),/raw HTML stale/i);
 }finally{await rm(tmp,{recursive:true,force:true});}
});
