import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseReviewedLifeHandoff,ATRIUM_EXTENSION_ID,ATRIUM_REPOSITORY_URL} from '../src/extensions/game-launch.js';
import {createExtensionHost} from '../src/extensions/host.js';

const valid={schema:'atrium.tavi-launch/v1',gameId:'life.loop',target:'https://life.example.org/game/',matchContext:{matchId:'opaque_123-xyz'}};
const memory=()=>({getItem:()=>null,setItem:()=>{}});
test('Atrium Life launch is a canonical HTTPS target with opaque match only',()=>{
 const launch=parseReviewedLifeHandoff(valid);
 assert.equal(launch.url,'https://life.example.org/game/?match=opaque_123-xyz');
 assert.equal(launch.gameId,'life.loop');
 for(const bad of [
  {...valid,target:'https://user:token@life.example.org/game/'},
  {...valid,target:'http://life.example.org/game/'},
  {...valid,target:'https://life.example.org/game/?proof=secret'},
  {...valid,target:'https://life.example.org/game/#access_token=123'},
  {...valid,target:'https://localhost/game/'},
  {...valid,target:'https://127.0.0.1/game/'},
  {...valid,target:'https://life.example.org:8443/game/'},
  {...valid,target:'javascript:alert(1)'},
  {...valid,target:'https://life.example.org/%2fsecret'},
  {...valid,matchContext:{matchId:'a&proof=123'}},
  {...valid,matchContext:{matchId:'a',authorization:'x'}},
  {...valid,authorization:'Bearer secret'},
  {...valid,gameId:'other.game'},
  {...valid,schema:'atrium.tavi-launch/v2'},
 ])assert.throws(()=>parseReviewedLifeHandoff(bad));
});
test('only the current official Atrium sandbox can ask user to open Life',()=>{
 const listeners=new Map(),windowRef={addEventListener:(n,cb)=>listeners.set(n,cb),removeEventListener:n=>listeners.delete(n)};
 const sent=[],frame={contentWindow:{postMessage:p=>sent.push(p)}};
 const accepted=[];let awaiting=false;
 const host=createExtensionHost({windowRef,storage:memory(),notify:()=>{},close:()=>{},onGameLaunch:(launch,caller)=>{if(awaiting)throw Error('Already pending');awaiting=true;accepted.push({launch,caller});return {awaitingApproval:true};}});
 let id=0;
 const dispatch=(handoff,origin='null',source=frame.contentWindow)=>listeners.get('message')({source,origin,data:{channel:'tavi.extension/v1',direction:'request',id:++id,method:'ui.requestGameLaunch',handoff}});
 host.mount(frame,{id:ATRIUM_EXTENSION_ID,source:ATRIUM_REPOSITORY_URL,scope:'account-x',permissions:['ui.panel']});
 dispatch(valid);assert.equal(accepted.length,1);assert.equal(sent.at(-1).ok,true);assert.deepEqual(sent.at(-1).result,{awaitingApproval:true});
 dispatch(valid);assert.equal(accepted.length,1);assert.equal(sent.at(-1).ok,false);
 dispatch({...valid,target:'https://evil.example/?proof=secret'});assert.equal(accepted.length,1);assert.equal(sent.at(-1).ok,false);
 dispatch(valid,'https://fake.example');assert.equal(accepted.length,1);
 dispatch(valid,'null',{});assert.equal(accepted.length,1);
 awaiting=false;host.mount(frame,{id:ATRIUM_EXTENSION_ID,source:'https://evil.example/atrium.json',scope:'account-x',permissions:['ui.panel']});
 dispatch(valid);assert.equal(accepted.length,1);assert.equal(sent.at(-1).ok,false);
 host.mount(frame,{id:'org.bad.actor.extension',source:ATRIUM_REPOSITORY_URL,scope:'account-x',permissions:['ui.panel']});
 dispatch(valid);assert.equal(accepted.length,1);assert.equal(sent.at(-1).ok,false);
 host.dispose();
});
test('hosted Life approval is a first-party Tavi click, never iframe popup permission',()=>{
 const js=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(js,/data-life-launch-approve/);assert.match(js,/link\.target='_blank'/);
 assert.match(js,/link\.rel='noopener noreferrer'/);assert.match(js,/openUrl\(launch\.url\)/);
 assert.match(js,/clearPendingLifeLaunch/);
 assert.match(js,/sandbox','allow-scripts'/);
 assert.doesNotMatch(js,/sandbox','allow-scripts allow-popups'/);
 const sdk=fs.readFileSync(new URL('../src/extensions/sdk.js',import.meta.url),'utf8');
 assert.match(sdk,/requestGameLaunch:handoff=>request\('ui.requestGameLaunch'/);
 const distributed=fs.readFileSync(new URL('../extension-sdk/index.js',import.meta.url),'utf8');
 assert.equal(sdk,distributed,'distributed SDK must include game launch RPC');
});

test('central first-party TaviX Atrium supports the compatibility broker but other origins do not',()=>{
 const listeners=new Map(),windowRef={addEventListener:(n,cb)=>listeners.set(n,cb),removeEventListener:n=>listeners.delete(n)};
 const frame={contentWindow:{postMessage:()=>{}}};let calls=0;
 const host=createExtensionHost({windowRef,storage:memory(),notify:()=>{},close:()=>{},onGameLaunch:()=>{++calls;return {awaitingApproval:true};}});
 const dispatch=()=>listeners.get('message')({source:frame.contentWindow,origin:'null',data:{channel:'tavi.extension/v1',direction:'request',id:calls+1,method:'ui.requestGameLaunch',handoff:valid}});
 host.mount(frame,{id:ATRIUM_EXTENSION_ID,source:'https://thebigtreeinc.github.io/tavix/tavi.repository.json',scope:'account-x',permissions:['ui.panel']});
 dispatch();assert.equal(calls,1);
 host.mount(frame,{id:ATRIUM_EXTENSION_ID,source:'https://other.example.org/tavi.repository.json',scope:'account-x',permissions:['ui.panel']});
 dispatch();assert.equal(calls,1);
 host.dispose();
});
