import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadRememberedSession,saveRememberedSession,clearRememberedSession,isPersistentSession} from '../src/session-store.js';
class Store{data=new Map();getItem(k){return this.data.get(k)||null;}setItem(k,v){this.data.set(k,v);}removeItem(k){this.data.delete(k);}}
const item={origin:'https://api.example.test',token:'t'.repeat(48),profileId:'alice'};
test('remembered Tavi account survives browser restart only when opted in',()=>{
 const local=new Store(),session=new Store();
 saveRememberedSession({...item,remember:false},local,session);
 assert.equal(loadRememberedSession(local,new Store()),null);
 assert.equal(loadRememberedSession(local,session).profileId,'alice');
 saveRememberedSession({...item,remember:true},local,session);
 assert.equal(isPersistentSession(local),true);
 assert.equal(loadRememberedSession(local,new Store()).token,item.token);
 assert.equal(JSON.stringify([...local.data]).includes('password'),false);
 clearRememberedSession(local,session);
 assert.equal(loadRememberedSession(local,session),null);
});
test('invalid, expired, or unsafe origin session is rejected and cleared',()=>{
 const local=new Store(),session=new Store();
 saveRememberedSession({...item,remember:true},local,session);
 const key=[...local.data.keys()][0], v=JSON.parse(local.getItem(key));
 for(const patch of [{savedAt:Date.now()-31*86400000},{origin:'http://attacker.example'},{token:'bad'}]){
  local.setItem(key,JSON.stringify({...v,...patch}));
  assert.equal(loadRememberedSession(local,session),null);
  assert.equal(local.getItem(key),null);
 }
});
