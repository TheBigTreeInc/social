import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {canShowFloating,normalizePetPosition,petWindowSnapshot,parsePetWindowCommand,PET_WINDOW_LABEL,PET_SIZE} from '../src/companions/native.js';
const read=p=>readFile(new URL(p,import.meta.url),'utf8');
test('floating pet is gated by explicit opt-in, platform and a signed-in account',()=>{
  const record={enabled:true,overlay:'floating'};
  assert.equal(canShowFloating(record,{windows:true,authenticated:true}),true);
  for(const broken of [{windows:false,authenticated:true},{windows:true,authenticated:false},{windows:false,authenticated:false}])assert.equal(canShowFloating(record,broken),false);
  assert.equal(canShowFloating({...record,enabled:false},{windows:true,authenticated:true}),false);
  assert.equal(canShowFloating({...record,overlay:'in-app'},{windows:true,authenticated:true}),false);
});
test('auxiliary commands are narrow and cannot mutate arbitrary account or mode state',()=>{
  for(const action of ['ready','hide','open','reset-position','feed','clean','play','rest','pet'])assert.equal(parsePetWindowCommand({action}),action);
  for(const data of [null,{},[],{action:'sendMessage'},{action:'feed',token:'private'},{action:'classic'},{action:'logout'},{action:'feed',mode:'classic'}])assert.equal(parsePetWindowCommand(data),null);
});
test('position only accepts bounded integer pixels',()=>{
  assert.deepEqual(normalizePetPosition({x:-104,y:490}),{x:-104,y:490});
  for(const bad of [{x:3.3,y:9},{x:NaN,y:0},{x:99999,y:0},{x:2,y:'3'},null])assert.equal(normalizePetPosition(bad),null);
});
test('snapshot is strictly pet-only, never contains a bearer, personal account or conversation',()=>{
  const record={enabled:true,overlay:'floating',petId:'pebble',name:'P',mode:'companion',needs:{fullness:30,cleanliness:80,energy:71,happiness:90,bond:2},secret:'NO',token:'NO',accountId:'NO',messages:['NO']};
  const text=JSON.stringify(petWindowSnapshot(record));
  assert(!text.includes('NO'));assert.equal(JSON.parse(text).schema,'tavi.companion-window/v1');
  assert.equal(petWindowSnapshot({...record,enabled:false}),null);
});
test('native window compiles as independent HTML entrypoint with minimal permissions',async()=>{
  const [main,overlay,config,vite]=await Promise.all([read('../src/main.js'),read('../src/companion-window.js'),read('../src-tauri/capabilities/companion.json'),read('../vite.config.mjs')]);
  const caps=JSON.parse(config);assert.deepEqual(caps.windows,[PET_WINDOW_LABEL]);assert(PET_SIZE.width<240&&PET_SIZE.height<260);
  assert(!caps.permissions.includes('core:webview:allow-create-webview-window'));
  assert.match(main,/transparent:true,alwaysOnTop:true,skipTaskbar:true/);
  assert.match(main,/nativeWindowsPet=nativeDesktop && \/Windows\/i.test\(navigator.userAgent\)/);
  assert.match(main,/if\(!canShowFloating\(state.companion/);
  assert.match(main,/void closePetWindow\(\)/);
  assert.match(main,/petWindowPositionKey\(\)/);
  assert.match(vite,/companion:resolve\(root,'companion.html'\)/);
  assert.match(overlay,/getCurrentWindow/);assert.doesNotMatch(overlay,/localStorage|sessionStorage|LooprdSocial|password|bearer|token|window\.open/);
});
