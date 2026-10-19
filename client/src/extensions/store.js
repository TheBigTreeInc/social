import {validateCatalog,validateExtensionManifest,extensionAssetUrl} from './contract.js';
const PREFIX='tavi.extensions.install/v1';
export function extensionStorageScope(origin,account){
 if(typeof origin!=='string'||!/^https?:\/\//.test(origin)||typeof account!=='string'||!account)return null;
 return `${PREFIX}:${encodeURIComponent(origin)}:${encodeURIComponent(account)}`;
}
export function createExtensionStore({storage,scope}){
 let saved={};
 try{const raw=JSON.parse(storage.getItem(scope)||'{}');if(raw&&typeof raw==='object'&&!Array.isArray(raw))saved=raw;}catch{}
 const persist=()=>storage.setItem(scope,JSON.stringify(saved));
 return {
  installed(id){return saved[id]?.installed===true;},
  enabled(id){return saved[id]?.installed===true&&saved[id]?.enabled===true;},
  permissions(id){return Array.isArray(saved[id]?.permissions)?[...saved[id].permissions]:[];},
  source(id){return saved[id]?.source || 'tavi:bundled';},
  version(id){return saved[id]?.version || null;},
  install(manifest,source='tavi:bundled'){
   validateExtensionManifest(manifest);
   saved[manifest.id]={installed:true,enabled:true,version:manifest.version,source,permissions:[...manifest.permissions]};persist();
  },
  disable(id){if(!saved[id]?.installed)return; saved[id].enabled=false;persist();},
  enable(manifest,source='tavi:bundled'){
   if(!saved[manifest.id]?.installed)throw Error('Not installed');
   if((saved[manifest.id].source||'tavi:bundled')!==source)throw Error('Extension repository changed; remove and reinstall');
   if(manifest.permissions.some(p=>!saved[manifest.id].permissions.includes(p)))throw Error('New permissions require reinstallation');
   saved[manifest.id].enabled=true;persist();
  },
  uninstall(id){delete saved[id];persist();}
 };
}
export async function loadBundledCatalog({baseUrl,fetcher=fetch}={}){
 const url=new URL('tavi-extensions/catalog.v1.json',baseUrl);
 if(url.origin!==new URL(baseUrl).origin)throw Error('Catalog outside Tavi origin');
 const response=await fetcher(url.href,{credentials:'omit',cache:'no-store'});
 if(!response.ok)throw Error(`Catalog unavailable (${response.status})`);
 const body=await response.text();if(body.length>150_000)throw Error('Catalog too large');
 const catalog=JSON.parse(body);validateCatalog(catalog);
 return catalog.extensions;
}
export async function verifyBundledExtension(entry,{baseUrl,fetcher=fetch,cryptoRef=globalThis.crypto}={}){
 if(!cryptoRef?.subtle)throw Error('SHA-256 verification unavailable');
 validateExtensionManifest(entry.manifest);
 for(const f of entry.files){
  const url=extensionAssetUrl(entry.manifest.id,f.path,baseUrl);
  const response=await fetcher(url,{credentials:'omit',cache:'no-store',redirect:'error'});
  if(!response.ok)throw Error(`Extension asset unavailable: ${f.path}`);
  const data=await response.arrayBuffer();
  if(data.byteLength!==f.size)throw Error(`Extension asset size changed: ${f.path}`);
  const digest=await cryptoRef.subtle.digest('SHA-256',data);
  const hash=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
  if(hash!==f.sha256)throw Error(`Extension asset integrity failure: ${f.path}`);
 }
 return true;
}
