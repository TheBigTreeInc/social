import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canInstallLocalTavix,verifyLocalTavixDeveloperGrant} from '../src/extensions/developer-install-gate.js';

const allowedState=()=>({connected:true,api:{me:async()=>({permissions:{developer:true}})},developerAllowed:true,developerVisible:true});
const apply=state=>me=>{state.developerAllowed=me?.permissions?.developer===true;if(!state.developerAllowed)state.developerVisible=false;};

test('LoopRD grant AND developer switch are required to display the local installer',()=>{
 const state=allowedState();
 assert.equal(canInstallLocalTavix(state),true);
 for(const field of ['connected','developerAllowed','developerVisible']){
  const variant={...state,[field]:false};
  assert.equal(canInstallLocalTavix(variant),false,field);
 }
 assert.equal(canInstallLocalTavix({...state,api:null}),false);
 assert.equal(canInstallLocalTavix({...state,developerAllowed:'true'}),false);
 assert.equal(canInstallLocalTavix({...state,developerVisible:'true'}),false);
});

test('approval requires a fresh authenticated LoopRD permission, not merely cached UI state',async()=>{
 const state=allowedState();
 assert.equal(await verifyLocalTavixDeveloperGrant(state,apply(state)),true);
 state.api.me=async()=>({permissions:{developer:false}});
 assert.equal(await verifyLocalTavixDeveloperGrant(state,apply(state)),false);
 assert.equal(state.developerAllowed,false);
 assert.equal(state.developerVisible,false);
});

test('missing, unsuccessful and offline LoopRD checks fail closed',async()=>{
 const state=allowedState();
 state.api.me=async()=>({permissions:{}});
 assert.equal(await verifyLocalTavixDeveloperGrant(state,apply(state)),false);
 state.developerAllowed=true;state.developerVisible=true;
 state.api.me=async()=>{throw Error('Server unavailable');};
 assert.equal(await verifyLocalTavixDeveloperGrant(state,apply(state)),false);
});

test('switching account while permission response is in flight cannot grant installation',async()=>{
 const state=allowedState();let finish;
 state.api.me=()=>new Promise(resolve=>{finish=resolve;});
 const pending=verifyLocalTavixDeveloperGrant(state,apply(state));
 state.api={me:async()=>({permissions:{developer:false}})};
 finish({permissions:{developer:true}});
 assert.equal(await pending,false);
});

test('turning off the opt-in during a pending request blocks installation',async()=>{
 const state=allowedState();let finish;
 state.api.me=()=>new Promise(resolve=>{finish=resolve;});
 const pending=verifyLocalTavixDeveloperGrant(state,apply(state));
 state.developerVisible=false;
 finish({permissions:{developer:true}});
 assert.equal(await pending,false);
});

test('Tavi launcher and file-picker handlers require the same developer gate',()=>{
 const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(source,/\$\{canInstallLocalTavix\(state\)\?`<div class="tavi-local-package-toolbar(?: \w[\w-]*)?"/);
 assert.match(source,/if\(name==='local-tavix-picker'\)\{toast\('Open Apps and select Install \.tavix/);
 assert.match(source,/wireLocalPackagePicker\(document,\{/);
 assert.match(source,/onSelected:file=>selectLocalTavix\(file\)/);
 assert.match(source,/verifyLocalTavixDeveloperGrant\(state,updateDeveloperPermission\)/);
 assert.match(source,/function localTavixDialog\(\)\{\s*if\(!pendingLocalTavix\|\|!canInstallLocalTavix\(state\)\)return '';/);
});

test('revoked server grant and disabled switch both dismiss pending install approval',()=>{
 const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(source,/if\(!allowed\)\{state\.developerVisible=false;pendingLocalTavix=null;/);
 assert.match(source,/if\(!state\.developerVisible\)\{pendingLocalTavix=null;/);
 assert.match(source,/if\(pending!==pendingLocalTavix\|\|store!==extensionAccountStore\(\)\|\|!canInstallLocalTavix\(state\)\)/);
});
