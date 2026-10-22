import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createExtensionStore} from '../src/extensions/store.js';
import {extensionUpdateStatus,extensionUpdateSummary,releaseRevision} from '../src/extensions/updates.js';
import {validateRepository} from '../src/extensions/repositories.js';
import {extensionIconUrl} from '../src/launcher.js';
const bundled=JSON.parse(await readFile(new URL('../public/tavi-extensions/catalog.v1.json',import.meta.url),'utf8')).extensions[0];
const manifest=bundled.manifest;
const revisions=['a'.repeat(64),'b'.repeat(64)];
const memory=()=>{const map=new Map();return {getItem:key=>map.get(key)||null,setItem:(key,value)=>map.set(key,value)};};
const entry=(version='1.0.0',revision=null,repo='https://publisher.example/apps/index.json')=>({manifest:{...manifest,version},repositoryUrl:repo,...(revision?{release:{revision}}:{})});
test('version and metadata revisions are separately visible; downgrades never count as updates',()=>{
 const storage=memory(),store=createExtensionStore({storage,scope:'test'});
 assert.equal(extensionUpdateStatus(entry(),store),'not-installed');
 store.install(manifest,'https://publisher.example/apps/index.json');
 assert.equal(extensionUpdateStatus(entry(),store),'current');
 assert.equal(extensionUpdateStatus(entry('1.1.0'),store),'update-available');
 assert.equal(extensionUpdateStatus(entry('1.0.0',revisions[0]),store),'update-available');
 assert.equal(extensionUpdateStatus(entry('0.9.0'),store),'published-older');
 assert.equal(extensionUpdateStatus(entry('1.0.0',null,'https://attacker.example/index.json'),store),'source-changed');
 store.install(manifest,'https://publisher.example/apps/index.json',revisions[0]);
 assert.equal(extensionUpdateStatus(entry('1.0.0',revisions[0]),store),'current');
 assert.equal(extensionUpdateStatus(entry('1.0.0',revisions[1]),store),'update-available');
 assert.equal(extensionUpdateStatus(entry(),store),'unknown');
 assert.equal(releaseRevision(entry('1.0.0',revisions[0])),revisions[0]);
 const hosted={...entry(),remote:{entrypoint:'https://publisher.example/apps/ui/index.html'}};
 assert.equal(extensionUpdateStatus(hosted,store),'update-available'); // legacy record must approve hosted origin pin
 store.install(manifest,hosted.repositoryUrl,revisions[0],hosted.remote.entrypoint);
 assert.equal(extensionUpdateStatus({...hosted,release:{revision:revisions[0]}},store),'current');
 assert.equal(extensionUpdateStatus({...hosted,remote:{entrypoint:'https://publisher.example/other/ui/index.html'},release:{revision:revisions[0]}},store),'update-available');
 assert.equal(extensionUpdateStatus({...hosted,manifest:{...manifest,summary:'New publisher text'},release:{revision:revisions[0]}},store),'update-available');
 assert.equal(extensionUpdateStatus({...hosted,manifest:{...manifest,permissions:['ui.panel']},release:{revision:revisions[0]}},store),'update-available');
 assert.throws(()=>store.install(manifest,'tavi:bundled','invalid'),/revision/);
 assert.equal(store.revision(manifest.id),revisions[0]);
 assert.equal(store.listInstalled().length,1);
 store.uninstall(manifest.id);
 assert.equal(store.listInstalled().length,0);
});
test('repository metadata revision must be a strict hash and does not add permissions',()=>{
 const example=JSON.parse(requireJson());
 const modified={...example,extensions:example.extensions.map(item=>({...item,release:{revision:revisions[0]}}))};
 assert.equal(validateRepository(modified)[0].release.revision,revisions[0]);
 for(const bad of ['not-a-hash','AB'.repeat(32),'a'.repeat(65)]){
  const malicious=structuredClone(modified);malicious.extensions[0].release.revision=bad;
  assert.throws(()=>validateRepository(malicious),/revision/);
 }
 const extra=structuredClone(modified);extra.extensions[0].release.secret='oops';
 assert.throws(()=>validateRepository(extra),/revision/);
});
function requireJson(){return `{"schema":"tavi.repository/v1","name":"Example","extensions":[{"manifest":${JSON.stringify(manifest)},"entrypoint":"https://publisher.example/apps/ui/index.html","source":"https://github.com/example/publisher","license":"MIT"}]}`;}
test('stale and missing repository records are not misreported as fully updated',()=>{
 const store=createExtensionStore({storage:memory(),scope:'test'});
 const a=entry('1.0.0',revisions[0]);store.install(manifest,a.repositoryUrl);
 const s=extensionUpdateSummary([a],store,{staleSources:new Set([a.repositoryUrl])});
 assert.equal(s.count,0);assert.equal(s.statuses[0].status,'unavailable');assert.equal(s.missing.length,0);
 assert.equal(extensionUpdateSummary([],store).missing[0].id,manifest.id);
});
test('nested entrypoints resolve extension icons relative to each app, never index root',()=>{
 const entrypoint='https://publisher.example/extension-bundles/apps/org.tavi.examples.notepad/ui/index.html';
 const item={manifest,remote:{entrypoint},repositoryUrl:'https://publisher.example/extension-bundles/tavi.repository.json'};
 assert.equal(extensionIconUrl(item,'https://tavi.example/'),'https://publisher.example/extension-bundles/apps/org.tavi.examples.notepad/ui/icon.svg');
 assert.throws(()=>extensionIconUrl({...item,remote:{entrypoint:'https://publisher.example/outside/index.html'}},'https://tavi.example/'),/entrypoint/);
});
test('UI announces last checked time, explicit updates, and compact combined presence',async()=>{
 const source=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
 const css=await readFile(new URL('../src/style.css',import.meta.url),'utf8');
 assert.match(source,/EXTENSION_CHECK_INTERVAL=15\*60\*1000/);
 assert.match(source,/Check for updates/);
 assert.match(source,/Updated|Update available/);
 assert.match(source,/Conversations &amp; contacts/);
 assert.match(source,/tavi-inline-presence/);
 assert.match(css,/\.tavi-roster-merged \.buddy\{min-height:29px/);
 assert.match(source,/optionalUpdateSummary\(extensionCatalog/);
 assert.match(source,/filterOptionalApps\(entries\)/);
});
