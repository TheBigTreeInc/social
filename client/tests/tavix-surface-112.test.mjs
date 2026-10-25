import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateTaviXSurface} from '../src/extensions/surface-host.js';
import {createExtensionHost} from '../src/extensions/host.js';
import {ATRIUM_EXTENSION_ID,ATRIUM_REPOSITORY_URL,TAVIX_ATRIUM_REPOSITORY_URL} from '../src/extensions/game-launch.js';
const good={schema:'tavix.surface/v1',id:'life.loop',kind:'game',target:'https://thebigtreeinc.github.io/life/',context:{matchId:'match_123'},presentation:'auto'};
const memory={getItem:()=>null,setItem:()=>{}};
test('generic game surface only carries an opaque match selector and canonical public HTTPS',()=>{
 const req=validateTaviXSurface(good);
 assert.equal(req.url,'https://thebigtreeinc.github.io/life/?match=match_123');
 assert.equal(req.matchId,'match_123');
 assert.equal(validateTaviXSurface({...good,context:undefined}).url,good.target);
 for(const bad of [
  {...good,kind:'application'}, {...good,id:'invalid / id'}, {...good,presentation:'popup'},
  {...good,context:{matchId:'hello',token:'SECRET'}},{...good,context:{matchId:'a&token=x'}},
  {...good,context:{seat:'abc'}},{...good,authorization:'Bearer abc'},
  {...good,target:'http://thebigtreeinc.github.io/life/'},
  {...good,target:'https://username:pass@thebigtreeinc.github.io/life/'},
  {...good,target:'https://thebigtreeinc.github.io/life/?token=abc'},
  {...good,target:'https://thebigtreeinc.github.io/life/#secret'},
  {...good,target:'https://127.0.0.1/life/'}, {...good,target:'https://localhost/life/'},
  {...good,target:'https://evil.local/life/'},{...good,target:'https://bad.example.test/life/'},
  {...good,target:'https://thebigtreeinc.github.io:8443/life/'},
  {...good,target:'https://thebigtreeinc.github.io/%2fother'},
  {...good,target:'https://thebigtreeinc.github.io//life/'},
 ])assert.throws(()=>validateTaviXSurface(bad),JSON.stringify(bad));
});
test('only current first-party Atrium with ui.panel may request a game surface',()=>{
 const listeners=new Map(),sent=[],calls=[];
 const frame={contentWindow:{postMessage:data=>sent.push(data)}};
 const host=createExtensionHost({windowRef:{addEventListener:(n,fn)=>listeners.set(n,fn),removeEventListener:n=>listeners.delete(n)},storage:memory,notify:()=>{},close:()=>{},onSurfaceOpen:(surface,caller)=>{calls.push({surface,caller});return {awaitingApproval:true}}});
 let id=0;
 const dispatch=(origin='null',source=frame.contentWindow)=>listeners.get('message')({origin,source,data:{channel:'tavi.extension/v1',direction:'request',id:++id,method:'surface.requestOpen',surface:good}});
 const info=()=>listeners.get('message')({origin:'null',source:frame.contentWindow,data:{channel:'tavi.extension/v1',direction:'request',id:++id,method:'host.info'}});
 for(const source of [ATRIUM_REPOSITORY_URL,TAVIX_ATRIUM_REPOSITORY_URL]){
  host.mount(frame,{id:ATRIUM_EXTENSION_ID,permissions:['ui.panel'],scope:'server:account',source});
  info();assert(sent.at(-1).result.features.includes('tavix.surface/v1'));
  dispatch();assert.equal(sent.at(-1).ok,true);
 }
 assert.equal(calls.length,2);
 for(const [extension,source,permissions] of [
   ['org.tavi.community.companion',ATRIUM_REPOSITORY_URL,['ui.panel']],
   [ATRIUM_EXTENSION_ID,'https://evil.example.org/tavi.repository.json',['ui.panel']],
   [ATRIUM_EXTENSION_ID,ATRIUM_REPOSITORY_URL,[]]
 ]){
   host.mount(frame,{id:extension,source,permissions,scope:'server:account'});
   info();assert(!sent.at(-1).result.features.includes('tavix.surface/v1'));
   dispatch();assert.equal(sent.at(-1).ok,false);
 }
 host.mount(frame,{id:ATRIUM_EXTENSION_ID,source:ATRIUM_REPOSITORY_URL,permissions:['ui.panel'],scope:'server:account'});
 dispatch('https://evil.example');dispatch('null',{});
 assert.equal(calls.length,2);
 host.dispose();
});
test('Tavi hosts an opaque-origin game frame with explicit approval, Atrium/Home controls and no game-end RPC',async()=>{
 const main=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
 const css=await readFile(new URL('../src/style.css',import.meta.url),'utf8');
 for(const value of ['data-surface-approve','data-surface-cancel','showNestedGameSurface','closeNestedGameSurface','currentAtriumCaller','onSurfaceOpen:offerGameSurface','Back to Atrium lobby','Return to Tavi Home'])assert(main.includes(value),value);
 assert.match(main,/frame\.setAttribute\('sandbox','allow-scripts allow-forms'\)/);
 assert.match(main,/frame\.setAttribute\('referrerpolicy','no-referrer'\)/);
 assert.doesNotMatch(main,/frame\.setAttribute\('sandbox','allow-scripts allow-forms allow-same-origin'\)/);
 assert.match(main,/if\(activeGameSurface\)\{closeNestedGameSurface\(\);return;\}/);
 assert.match(css,/\.tavi-nested-game-stage iframe/);
});
