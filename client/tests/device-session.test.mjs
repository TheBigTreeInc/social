import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDeviceSessionStore} from '../src/device-session.js';
import {saveRememberedSession,isPersistentSession} from '../src/session-store.js';
class Store {
 data=new Map();getItem(k){return this.data.get(k)||null;}setItem(k,v){this.data.set(k,v);}removeItem(k){this.data.delete(k);}
}
const account={origin:'https://api.example.test',token:'s'.repeat(48),profileId:'acct_1'};
function harness(){
 const local=new Store(),session=new Store();
 let vault=null,fail=null;
 const calls=[];
 const invoke=async(name,args)=>{
  calls.push(name);
  if(fail===name)throw Error('vault unavailable');
  if(name==='tavi_session_load')return vault;
  if(name==='tavi_session_save'){vault=args.record;return;}
  if(name==='tavi_session_clear'){vault=null;return;}
  throw Error('Unexpected vault command');
 };
 return {local,session,calls,invoke,store:createDeviceSessionStore({windows:true,invoke,local,session}),setFailure:(name)=>{fail=name;},getVault:()=>vault,setVault:(value)=>{vault=value;}};
}
test('Windows remembers a session outside WebView storage and reloads it',async()=>{
 const h=harness();
 assert.equal(await h.store.save({...account,remember:true}),true);
 assert.match(h.getVault(),/tavi.remembered-session\/v1/);
 assert.equal(h.local.data.size,0);assert.equal(h.session.data.size,0);
 const restarted=createDeviceSessionStore({windows:true,invoke:h.invoke,local:new Store(),session:new Store()});
 const restored=await restarted.load();
 assert.equal(restored.remembered,true);assert.equal(restored.record.token,account.token);
 await restarted.clear();assert.equal((await restarted.load()).record,null);
});
test('Migrates legacy localStorage into the Windows vault, removing plaintext',async()=>{
 const h=harness();saveRememberedSession({...account,remember:true},h.local,h.session);
 const restored=await h.store.load();
 assert.equal(restored.remembered,true);assert.equal(restored.record.profileId,'acct_1');
 assert.ok(h.getVault());assert.equal(h.local.data.size,0);assert.equal(h.session.data.size,0);
 assert.equal(h.calls.join(','),'tavi_session_load,tavi_session_save');
});
test('When a saved device is disabled, only a tab-session remains',async()=>{
 const h=harness();await h.store.save({...account,remember:true});
 await h.store.save({...account,remember:false});
 assert.equal(h.getVault(),null);assert.equal(isPersistentSession(h.local),false);
 assert.equal((await h.store.load()).remembered,false);
 assert.equal((await h.store.load()).record.token,account.token);
});
test('Windows vault failures never silently downgrade to plaintext localStorage',async()=>{
 const h=harness();h.setFailure('tavi_session_save');
 await assert.rejects(h.store.save({...account,remember:true}),/vault unavailable/);
 assert.equal(h.local.data.size,0);assert.equal(h.session.data.size,0);
});
test('Existing unencrypted copy survives failed secure migration for a later retry',async()=>{
 const h=harness();saveRememberedSession({...account,remember:true},h.local,h.session);
 h.setFailure('tavi_session_save');await assert.rejects(h.store.load(),/vault unavailable/);
 assert.equal(isPersistentSession(h.local),true);
});
test('Malformed or stale Windows vault records are rejected and removed',async()=>{
 const h=harness();h.setVault('{"token":"x"}');
 assert.deepEqual(await h.store.load(),{record:null,remembered:false});
 assert.equal(h.getVault(),null);
});
test('Plain web client preserves remembered sessions without any native bridge',async()=>{
 const local=new Store(),session=new Store();
 const web=createDeviceSessionStore({windows:false,local,session});
 await web.save({...account,remember:true});
 assert.equal(isPersistentSession(local),true);
 assert.equal((await web.load()).record.profileId,account.profileId);
 await web.clear();assert.equal((await web.load()).record,null);
});
