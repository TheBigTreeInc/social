/** Offline TaviX ZIP validation. This validator makes no network requests and
 * does NOT confer publisher trust. Imported code is always sandboxed.
 * All archive members are bounded and SHA-256 verified against tavix.lock.json.
 */
import {validateExtensionManifest} from './contract.js';

export const LOCAL_TAVIX_SOURCE='tavi:local';
export const LOCAL_TAVIX_MAX_BYTES=12_000_000;
const MAX_FILES=60, MAX_FILE_BYTES=1_000_000, MAX_TOTAL_BYTES=12_000_000;
const SAFE_PATH=/^[A-Za-z0-9_.\-/]+$/;
const ALLOWED=/\.(?:html|css|js|mjs|json|png|svg|webp)$/;
const PROTECTED=new Set(['.git','node_modules','secrets','runtime','.venv','__pycache__','target']);
const UTF8=new TextDecoder('utf-8',{fatal:true});
const ZIP_LOCAL=0x04034b50, ZIP_CENTRAL=0x02014b50, ZIP_END=0x06054b50;
const isObject=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const reject=(reason)=>{throw Error(`TaviX package blocked: ${reason}`);};
const hex=bytes=>Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
export const sha256=async(bytes,cryptoRef=globalThis.crypto)=>{
 if(!cryptoRef?.subtle)reject('SHA-256 verification unavailable');
 return hex(new Uint8Array(await cryptoRef.subtle.digest('SHA-256',bytes)));
};
export function safeTavixPath(value){
 if(typeof value!=='string'||value.length>200||!SAFE_PATH.test(value)||value.startsWith('/')||value.includes('//')||!ALLOWED.test(value))return false;
 const parts=value.split('/');
 return !parts.some(p=>!p||p==='.'||p==='..'||p.startsWith('.env')||PROTECTED.has(p));
}
function u16(v,p){return v.getUint16(p,true);}function u32(v,p){return v.getUint32(p,true);}
async function inflateData(compressed,method,size){
 if(method===0){if(compressed.length!==size)reject('Stored file size differs');return compressed.slice();}
 if(method!==8)reject('Unsupported ZIP compression');
 if(typeof DecompressionStream!=='function')reject('This WebView does not support offline ZIP decompression');
 let reader;
 try{
  reader=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
  const parts=[];let count=0;
  while(true){const {done,value}=await reader.read();if(done)break;
   count+=value.byteLength;if(count>size||count>MAX_FILE_BYTES){await reader.cancel();reject('ZIP member expands beyond declared size');}
   parts.push(value);
  }
  if(count!==size)reject('ZIP member size mismatch');
  const out=new Uint8Array(size);let offset=0;
  for(const part of parts){out.set(part,offset);offset+=part.length;}
  return out;
 }catch(e){if(String(e?.message||'').startsWith('TaviX package blocked:'))throw e;reject('Corrupt or unsupported compressed ZIP member');}
}
/** Read the ZIP central directory. Reject ZIP64, encrypted, symlinked and
 * duplicate entries; use central + local headers to prevent path confusion. */
export async function unpackTavixBytes(input){
 const data=input instanceof Uint8Array?input:new Uint8Array(input);
 if(!data.length||data.length>LOCAL_TAVIX_MAX_BYTES)reject('Archive exceeds 12 MB');
 const v=new DataView(data.buffer,data.byteOffset,data.byteLength);
 let end=-1;for(let p=data.length-22;p>=Math.max(0,data.length-65557);p--){if(u32(v,p)===ZIP_END&&p+22+u16(v,p+20)===data.length){end=p;break;}}
 if(end<0)reject('ZIP central directory missing');
 const count=u16(v,end+10),total=u16(v,end+8),cdSize=u32(v,end+12),cdOffset=u32(v,end+16);
 if(u16(v,end+4)!==0||u16(v,end+6)!==0||count!==total||count>MAX_FILES+1||count===0||count===65535||cdOffset===0xffffffff||cdSize===0xffffffff||cdOffset+cdSize!==end)reject('Unsupported ZIP directory');
 let cursor=cdOffset,uncompressedTotal=0;
 const entries=new Map();
 for(let i=0;i<count;i++){
  if(cursor+46>end||u32(v,cursor)!==ZIP_CENTRAL)reject('Invalid ZIP directory entry');
  const flags=u16(v,cursor+8),method=u16(v,cursor+10),sizeCompressed=u32(v,cursor+20),size=u32(v,cursor+24);
  const nameLen=u16(v,cursor+28),extra=u16(v,cursor+30),comment=u16(v,cursor+32),disk=u16(v,cursor+34),attrs=u32(v,cursor+38),localOffset=u32(v,cursor+42);
  const next=cursor+46+nameLen+extra+comment;
  if(next>end||!nameLen||disk||flags&1||flags&0x40||size>MAX_FILE_BYTES||sizeCompressed>LOCAL_TAVIX_MAX_BYTES)reject('Unsafe ZIP entry');
  // Symbolic links are never valid package contents.
  if(((attrs>>>16)&0xf000)===0xa000)reject('ZIP symlink forbidden');
  const name=UTF8.decode(data.subarray(cursor+46,cursor+46+nameLen));
  if(!safeTavixPath(name)||entries.has(name))reject('Unsafe or duplicate TaviX asset path');
  uncompressedTotal+=size;if(uncompressedTotal>MAX_TOTAL_BYTES)reject('Package expands beyond 12 MB');
  if(localOffset+30>cdOffset||u32(v,localOffset)!==ZIP_LOCAL||u16(v,localOffset+8)!==method)reject('ZIP local header mismatch');
  const localNameLen=u16(v,localOffset+26),localExtraLen=u16(v,localOffset+28);
  if(localOffset+30+localNameLen+localExtraLen+sizeCompressed>cdOffset)reject('Invalid ZIP member bounds');
  const localName=UTF8.decode(data.subarray(localOffset+30,localOffset+30+localNameLen));
  if(localName!==name)reject('ZIP path mismatch');
  const start=localOffset+30+localNameLen+localExtraLen;
  const bytes=await inflateData(data.subarray(start,start+sizeCompressed),method,size);
  entries.set(name,bytes);cursor=next;
 }
 if(cursor!==end||!entries.has('manifest.json')||!entries.has('tavix.lock.json'))reject('Missing or invalid TaviX package metadata');
 return entries;
}
export async function validateLocalTavix(input,{cryptoRef=globalThis.crypto,developerPreview=false}={}){
 const bytes=input instanceof Uint8Array?input:new Uint8Array(input);
 const entries=await unpackTavixBytes(bytes);
 let manifest,lock;
 try{manifest=JSON.parse(UTF8.decode(entries.get('manifest.json')));lock=JSON.parse(UTF8.decode(entries.get('tavix.lock.json')));}catch{reject('Invalid manifest or lockfile JSON');}
 const compatibility=validateExtensionManifest(manifest);
 if(!compatibility.compatible)reject(compatibility.reason);
 if(manifest.platforms?.length===0)reject('No supported platforms');
 // Local code cannot receive privileged first-party-only host grants.
 if(!developerPreview&&(manifest.permissions.includes('ziprunner.review')||manifest.id.startsWith('org.tavi.core.')||manifest.id==='org.tavi.community.companion'||manifest.id==='inc.thebigtree.ziprunner.review'))reject('Protected first-party identity or privileged permission');
 if(!isObject(lock)||lock.schema!=='tavix.package/v1'||lock.standard!=='tavix/1.0'||lock.applicationId!==manifest.id||lock.version!==manifest.version||!Array.isArray(lock.files)||lock.files.length!==entries.size-1||lock.files.length>MAX_FILES)reject('Invalid TaviX lockfile');
 const expected=new Set();
 for(const item of lock.files){
  if(!isObject(item)||Object.keys(item).some(k=>!['path','size','sha256'].includes(k))||!safeTavixPath(item.path)||expected.has(item.path)||!entries.has(item.path)||!Number.isSafeInteger(item.size)||item.size<0||item.size>MAX_FILE_BYTES||!/^([a-f0-9]{64})$/.test(item.sha256))reject('Invalid TaviX lockfile member');
  expected.add(item.path);
  const file=entries.get(item.path);
  if(file.length!==item.size||(await sha256(file,cryptoRef))!==item.sha256)reject(`SHA-256 mismatch for ${item.path}`);
 }
 for(const name of entries.keys())if(name!=='tavix.lock.json'&&!expected.has(name))reject('Archive contains files outside lockfile');
 if(!entries.has(manifest.entrypoints.panel)||manifest.icon&&!entries.has(manifest.icon))reject('Required extension entry asset is missing');
 const revision=await sha256(bytes,cryptoRef);
 const assets=Object.fromEntries([...entries].filter(([path])=>path!=='tavix.lock.json').map(([path,data])=>[path,data]));
 return {schema:'tavi.local-package/v1',manifest,revision,lock,assets,archive:bytes.slice()};
}
export async function revalidateLocalTavix(record,{cryptoRef=globalThis.crypto,developerPreview=false}={}){
 if(!record||record.schema!=='tavi.local-package/v1'||!record.manifest||!record.assets||!record.lock||!/^([a-f0-9]{64})$/.test(record.revision))reject('Local package record missing');
 const m=record.manifest;
 validateExtensionManifest(m);
 if(!developerPreview&&(m.permissions.includes('ziprunner.review')||m.id.startsWith('org.tavi.core.')||m.id==='org.tavi.community.companion'||m.id==='inc.thebigtree.ziprunner.review'))reject('Protected local package');
 if(record.lock.applicationId!==m.id||record.lock.version!==m.version||!Array.isArray(record.lock.files))reject('Local package identity mismatch');
 const expected=new Set();
 for(const f of record.lock.files){
  if(!safeTavixPath(f.path)||expected.has(f.path)||!/^([a-f0-9]{64})$/.test(f.sha256)||!Number.isInteger(f.size))reject('Invalid stored lock member');
  const bytes=record.assets[f.path];if(!(bytes instanceof Uint8Array)||bytes.length!==f.size||(await sha256(bytes,cryptoRef))!==f.sha256)reject('Stored local asset changed');expected.add(f.path);
 }
 if(expected.size!==Object.keys(record.assets).length||!expected.has('manifest.json')||!expected.has(m.entrypoints.panel))reject('Stored files incomplete');
 if(JSON.stringify(JSON.parse(UTF8.decode(record.assets['manifest.json'])))!==JSON.stringify(m))reject('Stored manifest does not match approved manifest');
 return record;
}

const DB_NAME='tavi-local-tavix-v1',STORE='packages';
function openDB(indexedDBRef=globalThis.indexedDB){
 if(!indexedDBRef)throw Error('This device does not provide local package storage');
 return new Promise((resolve,reject)=>{
  const request=indexedDBRef.open(DB_NAME,1);
  request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE);};
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(Error('Unable to open local extension storage'));
 });
}
async function transaction(mode,scope,id,value,dbOpen=openDB){
 if(typeof scope!=='string'||!scope||!id)throw Error('Account scope required for local package');
 const db=await dbOpen();try{
  return await new Promise((resolve,reject)=>{
   const tx=db.transaction(STORE,mode),bucket=tx.objectStore(STORE),key=`${scope}:${id}`;
   const req=mode==='readonly'?bucket.get(key):value===null?bucket.delete(key):bucket.put(value,key);
   let found=null;req.onsuccess=()=>{found=req.result;};
   tx.oncomplete=()=>resolve(mode==='readonly'?found:null);
   tx.onerror=()=>reject(Error('Local extension storage operation failed'));
   tx.onabort=()=>reject(Error('Local extension storage operation aborted'));
  });
 }finally{db.close();}
}
export async function saveLocalTavix(scope,record,{developerPreview=false}={}){
 await revalidateLocalTavix(record,{developerPreview});
 if(!(record.archive instanceof Uint8Array)||await sha256(record.archive)!==record.revision)reject('Local archive revision changed');
 // Store exact uploaded archive bytes, not an independently mutable extracted tree.
 return transaction('readwrite',scope,record.manifest.id,{schema:'tavi.local-archive/v1',revision:record.revision,archive:record.archive});
}
export async function loadLocalTavix(scope,id,{developerPreview=false}={}){
 const saved=await transaction('readonly',scope,id);
 if(!saved)return null;
 if(saved.schema!=='tavi.local-archive/v1'||!(saved.archive instanceof Uint8Array)||!/^([a-f0-9]{64})$/.test(saved.revision))reject('Local archive storage is invalid');
 const record=await validateLocalTavix(saved.archive,{developerPreview});
 if(record.revision!==saved.revision||record.manifest.id!==id)reject('Saved ZIP revision or application ID mismatch');
 return record;
}
export const deleteLocalTavix=(scope,id)=>transaction('readwrite',scope,id,null);
