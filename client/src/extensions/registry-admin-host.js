// The permission in a TaviX manifest is a request, never a trusted grant.
// All requests are validated before the privileged host calls authenticated Social.
export const REGISTRY_ADMIN_FEATURE='assets.registry.admin/v1';
export const REGISTRY_ADMIN_METHODS=Object.freeze([
 'status','stage.begin','stage.chunk','stage.commit','stage.abort',
 'records.list','records.get','price.propose','publish','revoke',
]);
export const REGISTRY_CONFIRM_METHODS=Object.freeze(['price.propose','publish','revoke']);
const T='assets.registry.admin.';
const SHA=/^[a-f0-9]{64}$/;
const KEY=/^[A-Za-z0-9_-]{16,128}$/;
const FILE=/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}\.tavia$/;
const PLAIN=o=>o&&typeof o==='object'&&!Array.isArray(o);
const RULES={
 'status':{},
 'stage.begin':{fileName:x=>typeof x==='string'&&FILE.test(x),byteLength:x=>Number.isSafeInteger(x)&&x>=1&&x<=67108864,sha256:x=>typeof x==='string'&&SHA.test(x),idempotencyKey:x=>typeof x==='string'&&KEY.test(x)},
 'stage.chunk':{uploadId:x=>typeof x==='string'&&KEY.test(x),offset:x=>Number.isSafeInteger(x)&&x>=0&&x<67108864,dataBase64:x=>typeof x==='string'&&x.length>=4&&x.length<=349528&&/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(x)},
 'stage.commit':{uploadId:x=>typeof x==='string'&&KEY.test(x),sha256:x=>typeof x==='string'&&SHA.test(x),idempotencyKey:x=>typeof x==='string'&&KEY.test(x)},
 'stage.abort':{uploadId:x=>typeof x==='string'&&KEY.test(x)},
 'records.list':{state:x=>['staged','published','revoked','failed'].includes(x),limit:x=>Number.isSafeInteger(x)&&x>=1&&x<=100,cursor:x=>typeof x==='string'&&x.length>=1&&x.length<=256},
 'records.get':{recordId:x=>typeof x==='string'&&KEY.test(x)},
 'price.propose':{recordId:x=>typeof x==='string'&&KEY.test(x),expectedRevision:x=>Number.isSafeInteger(x)&&x>=1&&x<=2147483647,priceGold:x=>Number.isSafeInteger(x)&&x>=0&&x<=1000000,idempotencyKey:x=>typeof x==='string'&&KEY.test(x)},
 'publish':{recordId:x=>typeof x==='string'&&KEY.test(x),expectedRevision:x=>Number.isSafeInteger(x)&&x>=1&&x<=2147483647,idempotencyKey:x=>typeof x==='string'&&KEY.test(x)},
 'revoke':{recordId:x=>typeof x==='string'&&KEY.test(x),expectedRevision:x=>Number.isSafeInteger(x)&&x>=1&&x<=2147483647,reason:x=>typeof x==='string'&&x.length>=10&&x.length<=500,idempotencyKey:x=>typeof x==='string'&&KEY.test(x)},
};
const REQUIRED={...Object.fromEntries(Object.keys(RULES).map(k=>[k,Object.keys(RULES[k])])),'records.list':[]};
export function validateRegistryAdminRequest(method,params){
 if(typeof method!=='string'||!method.startsWith(T))throw Error('unsupported_method');
 const op=method.slice(T.length);const rules=RULES[op];if(!rules)throw Error('unsupported_method');
 if(!PLAIN(params))throw Error('invalid_request');
 if(Object.keys(params).some(k=>!Object.hasOwn(rules,k))||
    REQUIRED[op].some(k=>!Object.hasOwn(params,k))||
    Object.entries(params).some(([k,v])=>!rules[k](v)))throw Error('invalid_request');
 return op;
}
export function registryAdminTrusted({session,permissions,isTrustedSession,ready}){
 return !!session&&Array.isArray(session.permissions)&&session.permissions.includes('ui.panel')&&
  session.permissions.includes(REGISTRY_ADMIN_FEATURE)&&
  typeof isTrustedSession==='function'&&isTrustedSession(session)===true&&
  typeof ready==='function'&&ready()===true;
}
export async function dispatchRegistryAdmin({method,params,session,isActive,isTrustedSession,ready,
  authenticatedApi,approveMutation}){
 const op=validateRegistryAdminRequest(method,params);
 const trusted=()=>isActive()&&registryAdminTrusted({session,permissions:session.permissions,isTrustedSession,ready});
 if(!trusted())throw Error('permission_denied');
 if(typeof authenticatedApi!=='function')throw Error('unavailable');
 // The extension cannot supply confirmation. The trusted host must obtain a
 // confirmation for sensitive actions, showing the fresh canonical record.
 if(REGISTRY_CONFIRM_METHODS.includes(op)){
  if(typeof approveMutation!=='function')throw Error('confirmation_declined');
  const record=await authenticatedApi('records.get',{recordId:params.recordId});
  if(!trusted())throw Error('permission_denied');
  if(!record||record.recordId!==params.recordId||record.revision!==params.expectedRevision||
      typeof record.manifestSha256!=='string'||!SHA.test(record.manifestSha256))throw Error('revision_conflict');
  if(await approveMutation({operation:op,record:Object.freeze(record),params:Object.freeze({...params})})!==true)
   throw Error('confirmation_declined');
  if(!trusted())throw Error('permission_denied');
 }
 const answer=await authenticatedApi(op,{...params},REGISTRY_CONFIRM_METHODS.includes(op));
 if(!trusted())throw Error('permission_denied');
 return answer;
}
