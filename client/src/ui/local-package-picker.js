/**
 * Native Windows file selection is deliberately independent of HTML file
 * controls, which may be silently declined by an embedded WebView2 instance.
 * Web/Android still use the ordinary file input. Neither path authorizes an
 * install: the caller verifies LoopRD developer status before validation and
 * again when the user approves the package.
 */
export function fileFromNativeTavixReply(reply,{decode=globalThis.atob}={}){
 if(!reply||reply.status!=='selected')throw Error('No native package selected');
 if(typeof reply.name!=='string'||!reply.name.toLowerCase().endsWith('.tavix')||reply.name.length>255||
  typeof reply.base64!=='string'||reply.base64.length>16_000_004||!/^[A-Za-z0-9+/]*={0,2}$/.test(reply.base64))
  throw Error('Invalid native file selection response');
 const decoded=decode(reply.base64);
 if(!decoded.length||decoded.length>12_000_000)throw Error('Selected package must be under 12 MB');
 const data=Uint8Array.from(decoded,letter=>letter.charCodeAt(0));
 return {name:reply.name,size:data.length,arrayBuffer:async()=>data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength)};
}

export function wireLocalPackagePicker(root,{canSelect,onSelected,onBlocked,nativeSelect}={}){
 const button=root?.querySelector?.('[data-local-file-picker]');
 const primary=root?.getElementById?.('tavi-local-file');
 const direct=root?.getElementById?.('tavi-local-file-direct');
 const fallback=root?.querySelector?.('[data-local-file-direct-fallback]');
 const status=root?.getElementById?.('tavi-local-picker-status');
 if(!button||!primary||!direct||!fallback||!status)return false;
 const report=message=>{status.hidden=false;status.textContent=message;};
 const allowed=()=>canSelect?.()===true;
 let opening=false;
 const native=typeof nativeSelect==='function';
 button.addEventListener('click',()=>{
  if(!allowed()){onBlocked?.();return;}
  if(opening)return;
  if(native){
   opening=true;
   report('Opening Windows file dialog…');
   // Native Windows API: independent of the WebView's HTML file chooser.
   void Promise.resolve().then(()=>nativeSelect()).then(reply=>{
    if(!allowed()){onBlocked?.();return;}
    if(reply?.status==='cancelled'){report('No package selected.');return;}
    const file=fileFromNativeTavixReply(reply);
    report('Checking selected TaviX package…');
    return onSelected?.(file);
   }).catch(error=>{
    report('Windows file dialog failed: '+String(error?.message||'Unknown error').slice(0,150));
    fallback.hidden=false;
   }).finally(()=>{opening=false;});
   return;
  }
  fallback.hidden=false;
  report('Choose a .tavix package. If the file dialog does not open, use Browse files directly.');
  try{primary.click();}catch{report('HTML file picker unavailable. Use Browse files directly.');}
 });
 for(const input of [primary,direct]){
  input.addEventListener('click',event=>{
   if(allowed())return;
   event.preventDefault();onBlocked?.();
  });
  input.addEventListener('change',event=>{
   const file=event.target.files?.[0]||null;
   event.target.value='';
   if(!file)return;
   if(!allowed()){onBlocked?.();return;}
   report('Checking selected TaviX package…');
   void onSelected?.(file);
  });
  input.addEventListener('cancel',()=>report('No package selected.'));
 }
 return true;
}
