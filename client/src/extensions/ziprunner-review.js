// Application-specific read-only bridge. Extension frames keep connect-src 'none'.
export const ZIPRUNNER_ID='inc.thebigtree.ziprunner.review';
export const ZIPRUNNER_PERMISSION='ziprunner.review';
export function createZipRunnerReview({fetchImpl=globalThis.fetch,cryptoImpl=globalThis.crypto,now=()=>Date.now()}={}){
 let grant=null,generation=0,controller=null,reads=Promise.resolve();
 function clear(){generation++;grant=null;controller?.abort();controller=null;reads=Promise.resolve();}
 async function request(project){
  const current=grant,version=generation;
  if(!current||current.expires<=now()) {clear();throw Error('Load a current ZipRunner authentication file inside Tavi');}
  if(project!==undefined&&(typeof project!=='string'||! /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,79}$/.test(project)))throw Error('Select an exact project');
  controller?.abort();const pending=new AbortController();controller=pending;
  const timer=setTimeout(()=>pending.abort(),10000);
  try{
   const path=project?`/api/tavi/project?project=${encodeURIComponent(project)}`:'/api/tavi/review';
   const response=await fetchImpl(current.origin+path,{method:'GET',headers:{Authorization:`Bearer ${current.secret}`,'X-ZipRunner-Credential-SHA256':current.digest,Accept:'application/json'},credentials:'omit',cache:'no-store',redirect:'error',signal:pending.signal});
   if(version!==generation||grant!==current||current.expires<=now())throw Error('ZipRunner connection changed');
   if(!response.ok){clear();throw Error('ZipRunner authorization rejected; load a current authentication file');}
   const raw=await response.text();
   if(raw.length>2_000_000)throw Error('ZipRunner review response is too large');
   let data;try{data=JSON.parse(raw);}catch{throw Error('Unsupported ZipRunner review response');}
   if(version!==generation||grant!==current||current.expires<=now())throw Error('ZipRunner connection changed');
   if(!data||data.ok!==true||data.mode!=='read_only'||data.actions_enabled!==false)throw Error('Unsupported ZipRunner review response');
   return data;
  }catch{if(version===generation)clear();throw Error('ZipRunner review unavailable; reload a current authentication file');}
  finally{clearTimeout(timer);if(controller===pending)controller=null;}
 }
 async function importCredential(bytes){
  clear();const version=generation;
  if(!Array.isArray(bytes)||bytes.length<20||bytes.length>16384||bytes.some(n=>!Number.isInteger(n)||n<0||n>255))throw Error('Select the original .zrmobile authentication file');
  const raw=new Uint8Array(bytes);let file;
  try{file=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));}catch{throw Error('Invalid ZipRunner authentication file');}
  if(file.schema!=='ziprunner.mobile-device-credential-file.v2'||typeof file.secret!=='string'||!/^zrmd_[A-Za-z0-9_-]{32,}$/.test(file.secret)||file.secret.length>512||!Number.isSafeInteger(file.expires_at)||file.expires_at*1000<=now())throw Error('A current ZipRunner web-connection authentication file is required');
  let origin;try{origin=new URL(file.public_origin);}catch{throw Error('Invalid ZipRunner HTTPS origin');}
  if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)throw Error('Authentication file must identify one exact HTTPS ZipRunner origin');
  const digest=Array.from(new Uint8Array(await cryptoImpl.subtle.digest('SHA-256',raw)),n=>n.toString(16).padStart(2,'0')).join('');
  if(version!==generation)throw Error('ZipRunner connection changed');
  grant={origin:origin.origin,secret:file.secret,digest,expires:file.expires_at*1000};
  const data=await request();
  return {origin:origin.origin,expires:file.expires_at,data};
 }
 return {importCredential,review:project=>{
  const epoch=generation;const result=reads.catch(()=>{}).then(()=>{
   if(epoch!==generation)throw Error('ZipRunner connection changed');
   return request(project);
  });reads=result;return result;
 },clear};
}
