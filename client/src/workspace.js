/** Separate Tauri window: isolated TaviX iframe + host-owned event relay. */
import {listen,emitTo} from '@tauri-apps/api/event';
import {getCurrentWindow} from '@tauri-apps/api/window';
import {safeWorkspaceLabel,WORKSPACE_CHANNEL} from './extensions/workspace-relay.js';
import {loadWorkspaceLocalPackage} from './extensions/workspace-local-package.js';
import './workspace.css';
const windowHandle=getCurrentWindow(),label=windowHandle.label;
const root=document.getElementById('workspace'),status=document.getElementById('status');
if(!safeWorkspaceLabel(label))throw Error('Invalid workspace window');
const challenge=crypto.randomUUID();
let nonce=null,frame=null,configured=false;
function displayError(text){status.textContent=text;status.hidden=false;if(!status.isConnected)root.append(status);}
await listen('tavi-workspace-grant',event=>{
 const p=event.payload;
 if(configured||!p||p.label!==label||p.challenge!==challenge||!p.nonce||!p.app||typeof p.app.url!=='string'||!p.app.url.startsWith('https:')&&!p.app.url.startsWith(location.origin+'/'))return;
 // A sibling window cannot guess the challenge sent privately to the main host.
 configured=true;nonce=p.nonce;status.remove();
 const header=document.createElement('header');header.className='workspace-header';
 const title=document.createElement('strong');title.textContent=p.app.name;header.append(title);
 const returnButton=document.createElement('button');returnButton.textContent='Return to Tavi';
 returnButton.addEventListener('click',()=>void emitTo('main','tavi-workspace-embed',{label,nonce}).catch(()=>displayError('Cannot reach Tavi')));
 const closeButton=document.createElement('button');closeButton.type='button';closeButton.textContent='Close window';
 closeButton.addEventListener('click',()=>{
  closeButton.disabled=true;
  // A Tauri close command may resolve even if a native event handler prevents
  // destruction. If the window still exists, report that instead of leaving a
  // permanently disabled Close button with no explanation.
  const stalled=setTimeout(()=>{
   closeButton.disabled=false;
   displayError('The window is still open (TAVI_WINDOW_CLOSE_STALLED). Try the title-bar X or Alt+F4.');
  },2000);
  void windowHandle.close().catch(()=>{
   clearTimeout(stalled);closeButton.disabled=false;
   displayError('Unable to close this window (TAVI_WINDOW_CLOSE_DENIED). Try the title-bar X or Alt+F4.');
  });
 });
 header.append(returnButton,closeButton);root.append(header);
 frame=document.createElement('iframe');frame.className='workspace-frame';frame.title=p.app.name;
 frame.setAttribute('sandbox','allow-scripts');frame.referrerPolicy='no-referrer';frame.src=p.app.url;
 if(p.app.local===true){
  // The native shell reads only the exact archive reviewed for this account.
  // The untrusted iframe receives package assets but never account scope or tokens.
  const id=p.app.id,scope=p.app.scope,revision=p.app.revision;
  frame.addEventListener('load',async()=>{
   try{
    if(!nonce||!/^([a-f0-9]{64})$/.test(revision)||typeof scope!=='string'||!scope)throw Error('Local package session invalid');
    const payload=await loadWorkspaceLocalPackage({scope,id,revision});
    if(!nonce)throw Error('Local workspace grant ended');
    frame?.contentWindow?.postMessage({type:'tavi.local.load/v1',package:payload},'*');
   }catch{displayError('The local application could not be verified. Return to Tavi and reopen it.');}
  },{once:true});
 }
 root.append(frame);
});
await listen('tavi-workspace-response',event=>{
 const p=event.payload;if(!nonce||p?.label!==label||p?.nonce!==nonce||p?.message?.channel!==WORKSPACE_CHANNEL||!['response','event'].includes(p.message.direction))return;
 frame?.contentWindow?.postMessage(p.message,'*');
});
await listen('tavi-workspace-close-failed',event=>{
 if(!nonce||event.payload?.label!==label||event.payload?.nonce!==nonce)return;
 displayError('Tavi could not close this window. Try the title-bar X or Alt+F4.');
});
await listen('tavi-workspace-disconnect',event=>{
 if(!nonce||event.payload?.label!==label||event.payload?.nonce!==nonce)return;
 nonce=null;frame?.remove();frame=null;displayError('Tavi session ended. Reopen the application from the messenger.');
});
window.addEventListener('message',event=>{
 if(!nonce||event.source!==frame?.contentWindow||event.origin!=='null'||event.data?.channel!==WORKSPACE_CHANNEL||event.data?.direction!=='request')return;
 void emitTo('main','tavi-workspace-request',{label,nonce,message:event.data}).catch(()=>displayError('Cannot reach Tavi. Return to the messenger.'));
});
void emitTo('main','tavi-workspace-ready',{label,challenge}).catch(()=>displayError('Tavi messenger is not available.'));
