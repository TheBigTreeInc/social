import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolveTavixClassification,validateExtensionManifest} from '../src/extensions/contract.js';
import {GAME_CATEGORIES,APP_CATEGORIES} from '../src/extensions/classification.js';
import {createExtensionStore} from '../src/extensions/store.js';
import {installedGameExtensions,menuApplications} from '../src/launcher.js';
import {validateLocalTavix,safeTavixPath} from '../src/extensions/local-package.js';
import {extensionUpdateStatus} from '../src/extensions/updates.js';

// Source fixture copied from the supplied TaviX 0.1.10 official sample.
const sample=JSON.parse(await readFile(new URL('../../docs/fixtures/tavix-0.1.10-classified-game.json',import.meta.url),'utf8'));
const v2=structuredClone(sample);
const mem=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)};};
const makeStore=()=>createExtensionStore({storage:mem(),scope:'server-and-account'});
const withGame=(m=sample,revision='c'.repeat(64))=>({manifest:m,local:true,release:{revision}});
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
function zipStored(files){
 let pos=0;const entries=[],heads=[];
 for(const [path,content] of Object.entries(files)){
  const name=Buffer.from(path),data=Buffer.from(content),offset=pos;
  const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt32LE(data.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(name.length,26);
  entries.push(local,name,data);pos+=local.length+name.length+data.length;
  const head=Buffer.alloc(46);head.writeUInt32LE(0x02014b50);head.writeUInt16LE(20,4);head.writeUInt16LE(20,6);head.writeUInt32LE(data.length,20);head.writeUInt32LE(data.length,24);head.writeUInt16LE(name.length,28);head.writeUInt32LE(offset,42);heads.push(head,name);
 }
 const start=pos;for(const x of heads){entries.push(x);pos+=x.length;}
 const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(Object.keys(files).length,8);end.writeUInt16LE(Object.keys(files).length,10);end.writeUInt32LE(pos-start,12);end.writeUInt32LE(start,16);entries.push(end);
 return Buffer.concat(entries);
}
function gamePackage(manifest=sample){
 const files={'manifest.json':JSON.stringify(manifest),'ui/index.html':'<!doctype html><html><body>Klondike Test</body></html>','ui/main.js':'document.title="Klondike Test";', 'ui/style.css':'.table{color:green}'};
 const lock={schema:'tavix.package/v1',standard:'tavix/1.0',applicationId:manifest.id,version:manifest.version,files:Object.entries(files).map(([path,text])=>({path,size:Buffer.byteLength(text),sha256:digest(text)}))};
 return zipStored({...files,'tavix.lock.json':JSON.stringify(lock)});
}

test('official TaviX 0.1.10 schema taxonomy is reflected verbatim',async()=>{
 const s=JSON.parse(await readFile(new URL('../../docs/contracts/tavix-classification-v1.schema.json',import.meta.url),'utf8'));
 const cases=s.allOf[0];
 assert.deepEqual(GAME_CATEGORIES,[...cases.then.properties.categories.items.enum]);
 assert.deepEqual(APP_CATEGORIES,[...cases.else.properties.categories.items.enum]);
 assert.deepEqual(resolveTavixClassification(sample),{type:'game',categories:['cards','solitaire']});
 assert.equal(validateExtensionManifest(sample).compatible,true);
});
test('classification is optional, kind stays app, no name-based guessing',()=>{
 const legacy={...sample};delete legacy.classification;
 assert.deepEqual(resolveTavixClassification(legacy),{type:'app',categories:[]});
 assert.equal(validateExtensionManifest(legacy).compatible,true);
 assert.throws(()=>validateExtensionManifest({...sample,kind:'game'}),/identity/);
 assert.deepEqual(resolveTavixClassification({...sample,classification:{type:'game'}}),{type:'game',categories:[]});
});
test('reject unknown classifications, duplicate/cross-type or excessive tags, invented keys',()=>{
 const bad=[null,[],{}, {type:'tool'}, {type:'game',categories:['finance']},
  {type:'app',categories:['solitaire']},{type:'game',categories:['cards','cards']},
  {type:'game',categories:Array(9).fill('cards')},{type:'game',categories:'cards'},
  {type:'game',categories:['Cards']},{type:'game',categories:[],unsafe:true}];
 for(const c of bad)assert.throws(()=>validateExtensionManifest({...sample,classification:c}),undefined,JSON.stringify(c));
});
test('a classified .tavix archive passes the real offline SHA-256 validator',async()=>{
 const record=await validateLocalTavix(gamePackage());
 assert.deepEqual(resolveTavixClassification(record.manifest),{type:'game',categories:['cards','solitaire']});
 assert.equal(record.manifest.kind,'app');assert.equal(record.revision,digest(gamePackage()));
 await assert.rejects(validateLocalTavix(gamePackage({...sample,classification:{type:'game',categories:['finance']}})),/category/);
});
test('TaviX .mjs module assets are allowed in classified game packages and prepared as JS',async()=>{
 assert.equal(safeTavixPath('ui/engine.mjs'),true);
 const manifest=structuredClone(sample);
 const files={'manifest.json':JSON.stringify(manifest),'ui/index.html':'<!doctype html><script type="module" src="./engine.mjs"></script>', 'ui/engine.mjs':'export const hello=1;'};
 const lock={schema:'tavix.package/v1',standard:'tavix/1.0',applicationId:manifest.id,version:manifest.version,files:Object.entries(files).map(([path,data])=>({path,size:Buffer.byteLength(data),sha256:digest(data)}))};
 const record=await validateLocalTavix(zipStored({...files,'tavix.lock.json':JSON.stringify(lock)}));
 assert(record.assets['ui/engine.mjs'] instanceof Uint8Array);
 const host=await readFile(new URL('../public/local-extension-host.js',import.meta.url),'utf8');
 assert.match(host,/m\?js/);
});

test('approved local games appear in Apps and installed games, blocked/uninstalled are not listed',()=>{
 const store=makeStore(),entry=withGame();
 assert.deepEqual(installedGameExtensions({catalog:[entry],store,platform:'windows'}),[]);
 store.install(sample,'tavi:local',entry.release.revision);
 assert.deepEqual(store.classification(sample.id),{type:'game',categories:['cards','solitaire']});
 assert.equal(store.listInstalled()[0].classification.type,'game');
 assert.equal(menuApplications({catalog:[entry],store,platform:'windows'}).at(-1).label,'Solitaire Demo');
 assert.equal(installedGameExtensions({catalog:[entry],store,platform:'windows'})[0].id,sample.id);
 assert.equal(installedGameExtensions({catalog:[entry],store,platform:'android'}).length,1);
 store.disable(sample.id);assert.equal(installedGameExtensions({catalog:[entry],store,platform:'windows'}).length,0);
 store.enable(sample,'tavi:local');assert.equal(installedGameExtensions({catalog:[entry],store,platform:'windows'}).length,1);
 store.uninstall(sample.id);assert.equal(installedGameExtensions({catalog:[entry],store,platform:'windows'}).length,0);
});
test('classified games without an app.launcher tile remain visible in the Games inventory',()=>{
 const m=structuredClone(sample);m.contributions=m.contributions.filter(c=>c.slot!=='app.launcher');
 const store=makeStore();store.install(m,'tavi:local','c'.repeat(64));
 assert.equal(menuApplications({catalog:[withGame(m)],store,platform:'windows'}).some(x=>x.id===m.id),false);
 assert.equal(installedGameExtensions({catalog:[withGame(m)],store,platform:'windows'}).some(x=>x.id===m.id),true);
});
test('installed games fail closed on stale source/revision/manifest/platform and forged classification',()=>{
 const store=makeStore(),entry=withGame();store.install(sample,'tavi:local',entry.release.revision);
 const changed=structuredClone(sample);changed.classification={type:'app',categories:['entertainment']};
 assert.equal(extensionUpdateStatus(withGame(changed),store),'update-available');
 assert.equal(installedGameExtensions({catalog:[withGame(changed)],store,platform:'web'}).length,0);
 assert.throws(()=>store.enable(changed,'tavi:local'),/metadata/);
 assert.equal(installedGameExtensions({catalog:[withGame(sample,'a'.repeat(64))],store,platform:'web'}).length,0);
 assert.equal(installedGameExtensions({catalog:[{manifest:sample,repositoryUrl:'https://others.test/index.json'}],store,platform:'web'}).length,0);
 assert.equal(installedGameExtensions({catalog:[entry],store,platform:'windows',staleSources:new Set(['tavi:local'])}).length,1);
 const androidOnly={...sample,platforms:['android']};const mobileStore=makeStore();mobileStore.install(androidOnly,'tavi:local',entry.release.revision);
 assert.equal(installedGameExtensions({catalog:[withGame(androidOnly)],store:mobileStore,platform:'windows'}).length,0);
 const old=makeStore();const app={...sample};delete app.classification;old.install(app,'tavi:local',entry.release.revision);
 assert.equal(installedGameExtensions({catalog:[withGame(app)],store:old,platform:'web'}).length,0);
});
test('Games routes use normal isolated extension open and preserve back to Games',async()=>{
 const source=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(source,/data-installed-game-open/);
 assert.match(source,/installedGameExtensions\(\{catalog:extensionCatalog/);
 assert.match(source,/openInstalledExtension\(id,\{fromGames:true\}\)/);
 assert.match(source,/extensionGamesReturn\?'games'/);
 assert.match(source,/if\(state\.panel==='extension'&&extensionGamesReturn\)/);
 assert.match(source,/loadLocalTavix\(scope,id\);await revalidateLocalTavix\(record\)/);
 const host=await readFile(new URL('../src/extensions/host.js',import.meta.url),'utf8');
 assert.match(host,/games\.installed\.list/); // 0.3.141 explicitly implements the reviewed Atrium-only API.
 assert.match(host,/authorizedAtrium\(\)/);
});
