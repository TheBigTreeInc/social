// Requests are served by Tavi, not by the iframe. No account, message, auth,
// network, native, navigation or contact APIs are exposed to extensions.
import {ATRIUM_EXTENSION_ID,ATRIUM_REPOSITORY_URL,parseReviewedLifeHandoff} from './game-launch.js';
const CHANNEL='tavi.extension/v1';
const KEY=/^[a-zA-Z0-9._-]{1,80}$/;
const throttle=()=>({started:Date.now(),count:0});
export function createExtensionHost({windowRef=window,storage,notify,close,onGameLaunch=()=>{throw Error('Game launching unavailable');}}){
 let session=null;
 function send(message){session?.frame?.contentWindow?.postMessage({channel:CHANNEL,direction:'response',...message},'*');}
 function onMessage(e){
  const current=session;if(!current||e.source!==current.frame.contentWindow||e.origin!=='null')return;
  const request=e.data;
  if(!request||typeof request!=='object'||request.channel!==CHANNEL||request.direction!=='request'||!Number.isSafeInteger(request.id)||request.id<1||typeof request.method!=='string')return;
  const id=request.id;
  if(Date.now()-current.rate.started>60_000)current.rate=throttle();
  if(++current.rate.count>60){send({id,ok:false,error:'Extension request limit exceeded'});return;}
  const permissions=new Set(current.permissions);
  try{
   let result=null;
   switch(request.method){
    case 'host.info': result={api:'1.0.0',extensionId:current.id,mode:'embedded',navigation:'host',features:current.id===ATRIUM_EXTENSION_ID&&current.source===ATRIUM_REPOSITORY_URL?['atrium.tavi-launch/v1']:[]};break;
    case 'host.capabilities': result=current.permissions.filter(p=>['ui.panel','ui.toast','storage.private'].includes(p));break;
    case 'storage.get':{
     if(!permissions.has('storage.private'))throw Error('Permission denied');
     if(typeof request.key!=='string'||!KEY.test(request.key))throw Error('Invalid key');
     result=storage.getItem(`${current.scope}:${current.id}:${request.key}`);break;
    }
    case 'storage.set':{
     if(!permissions.has('storage.private'))throw Error('Permission denied');
     if(typeof request.key!=='string'||!KEY.test(request.key)||typeof request.value!=='string'||request.value.length>8192)throw Error('Invalid value');
     storage.setItem(`${current.scope}:${current.id}:${request.key}`,request.value);break;
    }
    case 'ui.toast':{
     if(!permissions.has('ui.toast'))throw Error('Permission denied');
     if(typeof request.message!=='string'||request.message.length>140)throw Error('Invalid toast');
     notify(request.message);break;
    }
    case 'ui.requestGameLaunch':{
     if(!permissions.has('ui.panel')||current.id!==ATRIUM_EXTENSION_ID||current.source!==ATRIUM_REPOSITORY_URL)throw Error('Game launch requires the official Atrium extension');
     const handoff=parseReviewedLifeHandoff(request.handoff);
     result=onGameLaunch(handoff,{extensionId:current.id,scope:current.scope,source:current.source});
     break;
    }
    case 'ui.close': close();break;
    default:throw Error('Unsupported extension method');
   }
   send({id,ok:true,result});
  }catch(error){send({id,ok:false,error:String(error.message||error).slice(0,160)});}
 }
 windowRef.addEventListener('message',onMessage);
 return {
  mount(frame,{id,permissions,scope,source='tavi:bundled'}){
   if(!frame||!scope||typeof id!=='string'||!Array.isArray(permissions))throw Error('Invalid session');
   session={frame,id,permissions,scope,source,rate:throttle()};
  },
  unmount(){session=null;},
  dispose(){session=null;windowRef.removeEventListener('message',onMessage);}
 };
}
