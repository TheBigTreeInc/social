/** Isolated native-window to authenticated parent bridge. No bearer in URL/events. */
export const WORKSPACE_CHANNEL='tavi.extension/v1';
const ID=/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+){2,}$/;
const LABEL=/^workspace-[a-f0-9]{32}$/;
const NONCE=/^[a-f0-9-]{32,64}$/i;
export function safeWorkspaceLabel(label){return typeof label==='string'&&LABEL.test(label);}
export function validateWorkspaceMessage(envelope,session){
 if(!session||!envelope||typeof envelope!=='object'||envelope.label!==session.label||envelope.nonce!==session.nonce||!NONCE.test(envelope.nonce))return null;
 const message=envelope.message;
 if(!message||typeof message!=='object'||message.channel!==WORKSPACE_CHANNEL||message.direction!=='request'||!Number.isSafeInteger(message.id)||message.id<1||typeof message.method!=='string'||message.method.length>100)return null;
 // Tauri event transport is not an application network API; cap serialised bytes.
 try{if(JSON.stringify(message).length>700_000)return null;}catch{return null;}
 return message;
}
export function workspaceSessionStillValid(session,{accountScope,connected,entry,store,verified}){
 if(!connected||!verified||session.scope!==accountScope||!entry||!store||entry.manifest.id!==session.id||!ID.test(session.id))return false;
 return store.enabled(session.id)&&store.source(session.id)===session.source&&store.version(session.id)===session.version&&store.revision(session.id)===session.revision;
}
export function createWorkspaceProxy({label,nonce,send}){
 let onRequest=null;
 const frame={contentWindow:{postMessage(message){void send(label,'tavi-workspace-response',{label,nonce,message});}}};
 const windowRef={addEventListener(type,listener){if(type==='message')onRequest=listener;},removeEventListener(type,listener){if(type==='message'&&onRequest===listener)onRequest=null;}};
 return {frame,windowRef,receive(envelope){
  const message=validateWorkspaceMessage(envelope,{label,nonce});
  if(!message||!onRequest)return false;
  onRequest({source:frame.contentWindow,origin:'null',data:message});return true;
 }};
}
