/** Transactional account-scoped Tavi Assets device storage.
 * One IndexedDB readwrite transaction covers read, change and commit, so two
 * WebViews sharing the same origin cannot silently overwrite each other.
 * Fail closed if the device denies storage (no memory-only fallback).
 */
import {EMPTY_STATE} from './vendor/tavi-assets-0.1.9/storage.mjs';
import {cloneJSON} from './vendor/tavi-assets-0.1.9/validation.mjs';
const DB='tavi.assets.runtime/v1',STORE='account-stores';
const MAX_SNAPSHOT=8*1024*1024;
const scopeAllowed=s=>typeof s==='string'&&s.startsWith('tavi.extensions.install/v1:')&&s.length<=1024;
export function createIndexedAssetStorage({indexedDB,scope}){
 if(!scopeAllowed(scope)||!indexedDB||typeof indexedDB.open!=='function')throw Error('Tavi Assets persistent storage unavailable');
 let dbPromise=null;
 const open=()=>{
  if(dbPromise)return dbPromise;
  dbPromise=new Promise((resolve,reject)=>{
   const req=indexedDB.open(DB,1);
   req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE);};
   req.onsuccess=()=>resolve(req.result);
   req.onerror=()=>reject(Error('Tavi Assets database open failed'));
   req.onblocked=()=>reject(Error('Tavi Assets database upgrade blocked'));
  }).catch(err=>{dbPromise=null;throw err;});
  return dbPromise;
 };
 const transact=async(mode,callback)=>{
  const db=await open();
  return new Promise((resolve,reject)=>{
   let completed=false,answer;
   const tx=db.transaction(STORE,mode),store=tx.objectStore(STORE);
   const fail=error=>{if(!completed){completed=true;reject(error instanceof Error?error:Error('Asset storage transaction failed'));}};
   const get=store.get(scope);
   get.onerror=()=>{try{tx.abort();}catch{};fail(Error('Asset storage read failed'));};
   get.onsuccess=()=>{
    try{
     const next=cloneJSON(get.result??EMPTY_STATE());
     if(next.schema!=='tavi.assets.runtime-store/v1')throw Error('Invalid asset storage schema');
     answer=callback(next);
     // IndexedDB transactions cannot safely remain open during arbitrary awaits.
     if(answer&&typeof answer.then==='function')throw Error('Async asset storage mutation is unsupported');
     if(mode==='readwrite'){
      const encoded=JSON.stringify(next);
      if(encoded.length>MAX_SNAPSHOT)throw Error('Asset storage quota exceeded');
      store.put(next,scope);
     }
    }catch(error){try{tx.abort();}catch{};fail(error);}
   };
   tx.oncomplete=()=>{if(!completed){completed=true;resolve(answer);}};
   tx.onerror=()=>fail(tx.error||Error('Asset storage transaction failed'));
   tx.onabort=()=>fail(tx.error||Error('Asset storage transaction aborted'));
  });
 };
 return Object.freeze({
  read:()=>transact('readonly',state=>cloneJSON(state)),
  transact:callback=>transact('readwrite',callback)
 });
}
