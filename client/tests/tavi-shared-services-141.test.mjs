import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createExtensionHost} from '../src/extensions/host.js';
import {createTaviXSDK} from '../extension-sdk/index.js';
import {trustedInstalledGameInventory,requestedInstalledGame} from '../src/extensions/installed-games-host.js';
import {ATRIUM_EXTENSION_ID,TAVIX_ATRIUM_REPOSITORY_URL} from '../src/extensions/game-launch.js';

const gameId='org.tavi.klondike';
const game={id:gameId,entry:{manifest:{id:gameId,version:'1.2.3',name:'Klondike'}},classification:{type:'game',categories:['cards','solitaire']}};
const packId='org.tavi.cards';
const grants={schema:'tavix.asset-grants/v1',extensionId:ATRIUM_EXTENSION_ID,extensionVersion:'0.1.0',manifestSha256:'a'.repeat(64),scope:'host-session',grants:[{packId,capabilities:['card.back'],canCustomize:false}]};
function harness({id=ATRIUM_EXTENSION_ID,source=TAVIX_ATRIUM_REPOSITORY_URL,authorized=true,rows=[game],service=null,grant=null,onOpen=()=>true}={}){
 const hostListeners=new Map(),childListeners=new Map(),calls=[];
 const child={addEventListener:(name,fn)=>childListeners.set(name,fn),removeEventListener:name=>childListeners.delete(name)};
 const frame={contentWindow:{postMessage:data=>childListeners.get('message')?.({source:parent,origin:'https://tavi.example',data})}};
 const parent={postMessage:data=>hostListeners.get('message')?.({source:frame.contentWindow,origin:'null',data})};
 const host=createExtensionHost({windowRef:{addEventListener:(k,fn)=>hostListeners.set(k,fn),removeEventListener:k=>hostListeners.delete(k)},storage:{getItem:()=>null,setItem:()=>{}},notify:()=>{},close:()=>{},
   isTrustedAtriumSession:()=>authorized,listInstalledGames:()=>rows,onInstalledGameOpen:(g,c)=>{calls.push({g,c});return onOpen(g,c);},
   assetService:service,assetGrants:()=>grant});
 host.mount(frame,{id,scope:'account-a',source,permissions:['ui.panel','assets.read']});
 const sdk=createTaviXSDK(parent,child);
 return {host,sdk,calls,frame,parent,hostListeners,close(){sdk.dispose();host.dispose();},revoke(){authorized=false;},setRows(value){rows=value;},setGrant(value){grant=value;}};
}

test('Atrium 0.5.77 receives restricted inventory DTOs and approved game open acknowledgment',async()=>{
 const b=harness();
 assert((await b.sdk.info()).features.includes('tavix.installed-games/v1'));
 assert.deepEqual(await b.sdk.games.installed.list(),{schema:'tavix.installed-games.inventory/v1',games:[{id:gameId,version:'1.2.3',name:'Klondike',classification:{type:'game',categories:['cards','solitaire']}}]});
 assert.deepEqual(await b.sdk.games.installed.open({id:gameId,expectedVersion:'1.2.3'}),{accepted:true,id:gameId,version:'1.2.3'});
 assert.equal(b.calls.length,1);assert.deepEqual(b.calls[0].c,{extensionId:ATRIUM_EXTENSION_ID,scope:'account-a',source:TAVIX_ATRIUM_REPOSITORY_URL});
 b.close();
});
test('untrusted authors, closed sessions and revoked accounts never enumerate games',async()=>{
 for(const settings of [{id:'org.bad.extension'}, {source:'https://bad.example/index.json'}, {authorized:false}]){
  const b=harness(settings);
  assert(!(await b.sdk.info()).features.includes('tavix.installed-games/v1'));
  await assert.rejects(b.sdk.games.installed.list(),/permission denied/);
  await assert.rejects(b.sdk.games.installed.open({id:gameId,expectedVersion:'1.2.3'}),/permission denied/);
  assert.equal(b.calls.length,0);b.close();
 }
 const b=harness();b.revoke();await assert.rejects(b.sdk.games.installed.list(),/permission denied/);b.close();
});
test('stale/uninstalled/invalid game requests are denied before launch callback',async()=>{
 const b=harness();
 for(const target of [{id:gameId,expectedVersion:'9.9.9'}, {id:'org.tavi.private',expectedVersion:'1.2.3'}, {id:gameId}])
  await assert.rejects(b.sdk.games.installed.open(target),/Invalid|unavailable/);
 // Raw postMessage bypasses the SDK's typed projection; the host must reject extra fields.
 await assert.rejects(new Promise((resolve,reject)=>{
  const handler=b.hostListeners.get('message');
  const raw={channel:'tavi.extension/v1',direction:'request',id:90,method:'games.installed.open',params:{id:gameId,expectedVersion:'1.2.3',url:'https://evil.example'}};
  const original=b.frame.contentWindow.postMessage;
  b.frame.contentWindow.postMessage=data=>{b.frame.contentWindow.postMessage=original;data.ok?resolve(data.result):reject(Error(data.error));};
  handler({source:b.frame.contentWindow,origin:'null',data:raw});
 }),/Invalid/);
 b.setRows([]);assert.deepEqual((await b.sdk.games.installed.list()).games,[]);
 await assert.rejects(b.sdk.games.installed.open({id:gameId,expectedVersion:'1.2.3'}),/unavailable/);
 assert.equal(b.calls.length,0);b.close();
});
test('host refuses to acknowledge an unaccepted launch',async()=>{
 const b=harness({onOpen:()=>false});
 await assert.rejects(b.sdk.games.installed.open({id:gameId,expectedVersion:'1.2.3'}),/not accepted/);
 assert.equal(b.calls.length,1);b.close();
});
test('only clean, unique, classified installed game descriptors can leave host',()=>{
 assert.throws(()=>trustedInstalledGameInventory([{...game,entry:{manifest:{...game.entry.manifest,name:'A'.repeat(61)}}}]),/Invalid/);
 assert.throws(()=>trustedInstalledGameInventory([game,game]),/Invalid/);
 assert.throws(()=>trustedInstalledGameInventory([{...game,classification:{type:'app',categories:[]}}]),/Invalid/);
 assert.throws(()=>trustedInstalledGameInventory([{...game,entry:{manifest:{...game.entry.manifest,id:ATRIUM_EXTENSION_ID}}}]),/Invalid/);
 assert.throws(()=>requestedInstalledGame({id:gameId,expectedVersion:'1.2.3',url:'file:///secret'},trustedInstalledGameInventory([game])),/Invalid/);
});
test('Assets 0.1.7 pack discovery + multi-pack composition remain grant-scoped',async()=>{
 const service={ready:()=>true,request:(method,params)=>{
  if(method==='assets.packs.list')return {schema:'tavi.assets.pack-list/v1',total:1,nextOffset:null,items:[{packId,capabilities:['card.back']} ]};
  if(method==='assets.objects.discover')return {schema:'tavi.assets.discovery/v1',total:1,nextOffset:null,items:[{packId,version:'1.0.0',object:{id:'card-one'}}]};
  if(method==='assets.composition.resolve')return {schema:'tavi.assets.composition/v1',items:params.components.map(x=>({...x,version:'1.0.0',encoding:'base64',data:'AA==',contentType:'image/png'}))};
  throw Error(method);
 }};
 const b=harness({service,grant:grants});await b.sdk.assets.connect();
 assert.equal((await b.sdk.assets.listPacks()).items[0].packId,packId);
 assert.equal((await b.sdk.assets.discoverObjects()).items[0].packId,packId);
 assert.equal((await b.sdk.assets.resolveComposition([{slot:'background',packId,capability:'card.back'}])).items[0].slot,'background');
 await assert.rejects(b.sdk.assets.resolveComposition([{slot:'back',packId:'org.tavi.other',capability:'card.back'}]),/denied/);
 await assert.rejects(b.sdk.assets.resolveComposition([{slot:'back',packId,capability:'card.front'}]),/denied/);
 await assert.rejects(b.sdk.assets.resolveComposition([{slot:'back',packId,capability:'card.back'},{slot:'back',packId,capability:'card.back'}]),/Invalid/);
 b.setGrant(null);await assert.rejects(b.sdk.assets.listPacks(),/unavailable/);b.close();
});
test('Assets response cannot disclose ungranted packs or unsafe composition media',async()=>{
 let result={schema:'tavi.assets.pack-list/v1',total:1,nextOffset:null,items:[{packId:'org.tavi.foreign',capabilities:[]}]};
 const b=harness({service:{ready:()=>true,request:()=>result},grant:grants});await b.sdk.assets.connect();
 await assert.rejects(b.sdk.assets.listPacks(),/Cross-pack/);
 result={schema:'tavi.assets.composition/v1',items:[{packId,slot:'background',capability:'card.back',contentType:'text/html',encoding:'base64',data:'AA=='}]};
 await assert.rejects(b.sdk.assets.resolveComposition([{slot:'background',packId,capability:'card.back'}]),/Invalid or oversized/);
 b.close();
});
test('shared services are hosted only by Tavi; Account/session checks and trusted navigation live in main',async()=>{
 const main=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(main,/listInstalledGames:atriumInstalledGames,onInstalledGameOpen:acceptAtriumInstalledGame/);
 assert.match(main,/currentAtriumCaller\(caller\)/);
 assert.match(main,/openInstalledExtension\(chosen\.id,\{fromGames:true\}\)/);
 assert.match(main,/state\.api\?\.origin!==server\|\|state\.profile\?\.profileId!==account/);
 assert.match(main,/assetGrants:activeAssetGrants/); // Host derives scoped grants from verified installed applications.
});
