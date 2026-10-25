// Requests are served by Tavi, not by the iframe. No account, message, auth,
// network, native or contact APIs are exposed directly to applications. TaviX
// navigation is host-owned: apps may request back/close but cannot navigate Tavi.
import {ATRIUM_EXTENSION_ID,isOfficialAtriumSource,parseReviewedLifeHandoff} from './game-launch.js';
import {validateCompanionPreview,previewStorageKey} from './companion-preview.js';
import {REVIEWED_COMPANION} from './reviewed-companion.js';
export const TAVIX_STANDARD='tavix/1.0';
export const TAVIX_CHANNEL='tavi.extension/v1';
const CHANNEL=TAVIX_CHANNEL;
export const CORE_WALLET_ID='org.tavi.core.wallet';
const KEY=/^[a-zA-Z0-9._-]{1,80}$/;
const throttle=()=>({started:Date.now(),count:0});
export function createExtensionHost({windowRef=window,storage,notify,close,onGameLaunch=()=>{throw Error('Game launching unavailable');},walletApi=()=>{throw Error('Wallet service unavailable');},onCompanionPreview=()=>{},isReviewedCompanionSession=()=>false}){
 let session=null;
 function send(message){session?.frame?.contentWindow?.postMessage({channel:CHANNEL,direction:'response',...message},'*');}
 function onMessage(e){
  const current=session;if(!current||e.source!==current.frame.contentWindow||e.origin!=='null')return;
  const request=e.data;
  if(!request||typeof request!=='object'||request.channel!==CHANNEL||request.direction!=='request'||!Number.isSafeInteger(request.id)||request.id<1||typeof request.method!=='string')return;
  const id=request.id;
  if(Date.now()-current.rate.started>60_000){current.rate=throttle();current.previewCount=0;}
  if(++current.rate.count>60){send({id,ok:false,error:'Extension request limit exceeded'});return;}
  const permissions=new Set(current.permissions);
  try{
   let result=null;
   switch(request.method){
    case 'host.info': result={standard:TAVIX_STANDARD,channel:TAVIX_CHANNEL,api:'1.0.0',extensionId:current.id,mode:'embedded',navigation:'host',features:['tavix.navigation/v1',...(current.id===ATRIUM_EXTENSION_ID&&isOfficialAtriumSource(current.source)?['atrium.tavi-launch/v1']:[]),...(isReviewedCompanionSession(current)?['tavi.companion.preview/v1']:[])]};break;
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
     if(!permissions.has('ui.panel')||current.id!==ATRIUM_EXTENSION_ID||!isOfficialAtriumSource(current.source))throw Error('Game launch requires the official Atrium extension');
     const handoff=parseReviewedLifeHandoff(request.handoff);
     result=onGameLaunch(handoff,{extensionId:current.id,scope:current.scope,source:current.source});
     break;
    }
    case 'wallet.balance':
    case 'wallet.transactions':
    case 'wallet.claim':
    case 'wallet.convert':
    case 'wallet.purchase':
    case 'wallet.orderStatus':{
     if(current.id!==CORE_WALLET_ID||current.source!=='tavi:bundled'||!permissions.has('ui.panel'))
       throw Error('Wallet commands are only available to the first-party Wallet');
     const params=request.params;
     if(params!==undefined && (!params||typeof params!=='object'||Array.isArray(params)))throw Error('Invalid wallet arguments');
     // All money operations execute with the verified Social principal in the host.
     result=walletApi(request.method,params||{});break;
    }
    case 'companion.preview':{
     // The trust grant is established by Tavi after digest + *asset* verification
     // of the current reviewed bundle and rechecked against live account state.
     if(current.id!==REVIEWED_COMPANION.id||current.source!=='tavi:bundled'||
        current.reviewedBundle!==REVIEWED_COMPANION.sha256||!permissions.has('ui.panel')||
        !isReviewedCompanionSession(current))throw Error('Companion preview permission denied');
     if(++current.previewCount>12)throw Error('Companion preview rate exceeded');
     result=validateCompanionPreview(request.preview);
     storage.setItem(previewStorageKey(current.scope),JSON.stringify(result));
     onCompanionPreview(result,current.scope);break;
    }
    case 'navigation.back':
    case 'navigation.close':
    case 'ui.close': close();break;
    default:throw Error('Unsupported extension method');
   }
   if(result&&typeof result.then==='function'){
    Promise.resolve(result).then(value=>{if(session===current)send({id,ok:true,result:value});},
      error=>{if(session===current)send({id,ok:false,error:String(error.message||error).slice(0,160)});});
   }else if(session===current)send({id,ok:true,result});
  }catch(error){if(session===current)send({id,ok:false,error:String(error.message||error).slice(0,160)});}
 }
 windowRef.addEventListener('message',onMessage);
 return {
  mount(frame,{id,permissions,scope,source='tavi:bundled',reviewedBundle=null}){
   if(!frame||!scope||typeof id!=='string'||!Array.isArray(permissions))throw Error('Invalid session');
   session={frame,id,permissions,scope,source,reviewedBundle,previewCount:0,rate:throttle()};
  },
  unmount(){session=null;},
  dispose(){session=null;windowRef.removeEventListener('message',onMessage);}
 };
}
