/** Host-owned TaviX desktop surface manager. Keep user/session credentials in main. */
import {createWorkspaceProxy,safeWorkspaceLabel,workspaceSessionStillValid} from './workspace-relay.js';
import {rememberPresentation} from './workspace-presentation.js';
import {workspaceContext,uiContext} from './ui-context.js';

export function createNativeWorkspaceManager({desktop,WebviewWindow,listen,emitTo,createHost,getHostOptions,getInstallation,assetUrl,onEmbed,notify,storage}){
 const sessions=new Map();let connecting=null;
 const labelFor=async id=>{
  const data=new TextEncoder().encode(id),digest=await crypto.subtle.digest('SHA-256',data);
  return 'workspace-'+Array.from(new Uint8Array(digest)).slice(0,16).map(n=>n.toString(16).padStart(2,'0')).join('');
 };
 const current=s=>getInstallation(s.id);
 const active=s=>{
  const i=current(s);
  return workspaceSessionStillValid(s,i)&&i.entry.manifest.id===s.id&&i.entry.manifest.version===s.version;
 };
 const drop=label=>{const s=sessions.get(label);if(!s)return;sessions.delete(label);s.host.dispose();};
 async function close(label){
  const s=sessions.get(label);if(!s)return true;
  try{
   const handle=await WebviewWindow.getByLabel(label);
   if(handle)await handle.close();
   // Never invalidate the authenticated relay before the native close succeeds.
   drop(label);
   return true;
  }catch{
   notify('Could not close the application window. Use the window X to close it.');
   return false;
  }
 }
 async function bridge(){
  if(!desktop)throw Error('Desktop workspace unavailable');
  if(connecting)return connecting;
  connecting=(async()=>{
   await listen('tavi-workspace-ready',({payload:p})=>{
    const s=sessions.get(p?.label);
    if(!s||!safeWorkspaceLabel(p.label)||!active(s)||typeof p.challenge!=='string'||!/^[-a-f0-9]{36}$/i.test(p.challenge))return;
    void emitTo(s.label,'tavi-workspace-grant',{label:s.label,nonce:s.nonce,challenge:p.challenge,app:{id:s.id,name:s.name,url:s.url,...(s.local?{local:true,scope:s.scope,revision:s.revision}:{})}});
   });
   await listen('tavi-workspace-request',({payload:p})=>{
    const s=sessions.get(p?.label);
    if(!s)return;
    if(!active(s)){void close(s.label);return;}
    s.proxy.receive(p);
   });
   await listen('tavi-workspace-embed',async({payload:p})=>{
    const s=sessions.get(p?.label);if(!s||p.nonce!==s.nonce||!active(s))return;
    if(!await close(s.label)){
     void emitTo(s.label,'tavi-workspace-close-failed',{label:s.label,nonce:s.nonce}).catch(()=>{});
     return;
    }
    rememberPresentation(storage,s.scope,s.id,'embedded');
    onEmbed(s.id);
   });
   // Rust notifies MAIN only after the OS has destroyed an isolated workspace window.
   // Do not use onCloseRequested(): Tauri intercepts native X/Alt+F4 and its JS
   // wrapper requires destroy permission (which is deliberately not granted).
   await listen('tavi-workspace-native-destroyed',async({payload:p})=>{
    if(!safeWorkspaceLabel(p?.label)||!sessions.has(p.label))return;
    // Event transport can be spoofed by a window with event permissions.
    // Never tear down the authenticated relay while the native window exists.
    try{if(await WebviewWindow.getByLabel(p.label))return;}catch{return;}
    drop(p.label);
   });
  })();
  try{await connecting;}catch(e){connecting=null;throw e;}
 }
 async function open(entry,{remember=true}={}){
  await bridge();const id=entry?.manifest?.id;if(!id)throw Error('Missing application');
  const label=await labelFor(id),i=getInstallation(id);
  if(!i?.connected||!i.verified||!i.accountScope||!i.entry||i.entry!==entry||!i.store?.enabled(id)||i.store.source(id)!==i.source)throw Error('Installed app changed');
  const previous=await WebviewWindow.getByLabel(label);
  if(previous&&sessions.has(label)&&active(sessions.get(label))){await previous.show();await previous.setFocus();return true;}
  if(previous)await previous.close(); // A failed close must not spawn a duplicate label or discard its relay.
  drop(label);
  const nonce=crypto.randomUUID(),url=assetUrl(entry);
  const s={label,id,nonce,url,name:entry.manifest.name,scope:i.accountScope,source:i.source,version:entry.manifest.version,revision:i.store.revision(id),local:entry.local===true};
  const proxy=createWorkspaceProxy({label,nonce,send:emitTo});s.proxy=proxy;
  s.host=createHost({...getHostOptions(),windowRef:proxy.windowRef,close:()=>{void close(label);},
   workspaceInfo:()=>workspaceContext({desktop:true,mode:'detached'}),
   uiInfo:()=>uiContext({platform:'windows',presentation:'detached',theme:getHostOptions().uiInfo?.().theme})});
  s.host.mount(proxy.frame,{id,permissions:i.store.permissions(id),scope:s.scope,source:s.source,revision:s.revision,
   reviewedBundle:null,mode:'detached'});
  sessions.set(label,s);
  try{
   const minWidth=entry.manifest.presentation?.minimumSize?.width||420,minHeight=entry.manifest.presentation?.minimumSize?.height||480;
   const width=Math.max(minWidth,entry.manifest.presentation?.preferredSize?.width||1000),height=Math.max(minHeight,entry.manifest.presentation?.preferredSize?.height||720);
   const handle=new WebviewWindow(label,{url:'workspace.html',title:entry.manifest.name+' — Tavi',width,height,minWidth,minHeight,resizable:true,center:true});
   handle.once('tauri://error',e=>{notify('Application window failed: '+String(e.payload));drop(label);});
   // No close-request listener: let Tauri/Windows complete X, Alt+F4 and
   // Window.close normally. Rust's Destroyed event reclaims the host relay.
   if(remember)rememberPresentation(storage,s.scope,id,'detached');
   return true;
  }catch(e){drop(label);throw e;}
 }
 async function closeAll(){const labels=[...sessions.keys()];await Promise.all(labels.map(close));}
 function publishUIContext(){for(const s of sessions.values())if(active(s))s.host.publishUIContext();}
 return {open,closeAll,publishUIContext,sessionCount:()=>sessions.size};
}
