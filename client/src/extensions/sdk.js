/** Public, tokenless Tavi extension-frame SDK.
 * v1 capabilities are discoverable; future data facades deliberately fail closed
 * until the host and authoritative LoopRD component implement that operation.
 */
export function createTaviExtensionSDK(target=window.parent,source=window){
 let nextId=0;
 const pending=new Map();
 const channel='tavi.extension/v1';
 const receiver=e=>{
  if(e.source!==target||e.data?.channel!==channel||e.data?.direction!=='response')return;
  const item=pending.get(e.data.id);if(!item)return;pending.delete(e.data.id);
  if(e.data.ok)item.resolve(e.data.result);else item.reject(Error(e.data.error||'Extension request failed'));
 };
 source.addEventListener('message',receiver);
 const request=(method,args={})=>{
  const id=++nextId;
  return new Promise((resolve,reject)=>{
   if(pending.size>=20)return reject(Error('Too many extension requests'));
   pending.set(id,{resolve,reject});
   target.postMessage({channel,direction:'request',id,method,...args},'*');
  });
 };
 const call=(method,params={})=>request(method,{params});
 return {
  info:()=>request('host.info'),
  capabilities:()=>request('host.capabilities'),
  storage:{get:key=>request('storage.get',{key}),set:(key,value)=>request('storage.set',{key,value})},
  ui:{toast:message=>request('ui.toast',{message}),close:()=>request('ui.close'),requestGameLaunch:handoff=>request('ui.requestGameLaunch',{handoff})},
  // Future shared-service APIs. Every call is checked by the host broker and
  // again by the corresponding server; this SDK never stores a Social bearer.
  wallet:{balance:params=>call('wallet.balance',params),transactions:params=>call('wallet.transactions',params),transfer:params=>call('wallet.transfer',params)},
  pets:{list:params=>call('pets.list',params),get:params=>call('pets.get',params),command:params=>call('pets.command',params)},
  contacts:{list:params=>call('contacts.list',params)},
  messages:{list:params=>call('messages.list',params),send:params=>call('messages.send',params)},
  events:{list:params=>call('events.list',params)},
  services:{list:()=>call('services.list')},
  dispose:()=>{source.removeEventListener('message',receiver);for(const item of pending.values())item.reject(Error('Extension disconnected'));pending.clear();}
 };
}
