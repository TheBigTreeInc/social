import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import fs from 'node:fs';
import {FIRST_PARTY_REPOSITORIES,createRepositorySubscriptions,repositoryStorageKey,validateRepository,validateRepositoryList,fetchRepository,fetchServerRepositories,mergeRepositoryEntries,extensionSource,remoteOrigin} from '../src/extensions/repositories.js';
import {createExtensionStore,extensionStorageScope} from '../src/extensions/store.js';
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};};
const bundled=JSON.parse(await readFile(new URL('../public/tavi-extensions/catalog.v1.json',import.meta.url),'utf8')).extensions;
const example=JSON.parse(await readFile(new URL('../../docs/extension-examples/tavi-repository.example.json',import.meta.url),'utf8'));
test('public repository example validates as a static HTTPS catalog',()=>{
 const entries=validateRepository(example);
 assert.equal(entries.length,1);
 assert.equal(entries[0].manifest.id,'org.tavi.examples.notepad');
 assert.equal(remoteOrigin(entries[0]),'https://extensions.example.org');
 assert.throws(()=>validateRepository({...example,extensions:[...example.extensions,example.extensions[0]]}),/Duplicate/);
 for(const u of ['javascript:alert(1)','http://example.org','https://user:pass@example.org/repo.json']){
  const copy=structuredClone(example);copy.extensions[0].entrypoint=u;
  assert.throws(()=>validateRepository(copy));
 }
 const noLicense=structuredClone(example);delete noLicense.extensions[0].license;
 assert.throws(()=>validateRepository(noLicense),/license/);
});
test('repository subscribers scoped by community server, not shared globally',()=>{
 const storage=memory();const a=createRepositorySubscriptions({storage,serverOrigin:'https://alpha.example'});
 const b=createRepositorySubscriptions({storage,serverOrigin:'https://beta.example'});
 assert.notEqual(repositoryStorageKey('https://alpha.example'),repositoryStorageKey('https://beta.example'));
 a.add('https://extensions.example.org/tavi.repository.json');
 a.add('https://extensions.example.org/tavi.repository.json');
 assert.equal(a.list().length,1);assert.equal(b.list().length,0);
 assert.equal(createRepositorySubscriptions({storage,serverOrigin:'https://alpha.example'}).list().length,1);
 assert.throws(()=>a.add('http://insecure.test/repo.json'),/HTTPS/);
 a.remove('https://extensions.example.org/tavi.repository.json');assert.equal(a.list().length,0);
});
test('server suggests optional HTTPS repositories and no response is an empty list',async()=>{
 const list={schema:'tavi.repository-list/v1',repositories:['https://extensions.example.org/tavi.repository.json']};
 assert.deepEqual(validateRepositoryList(list),list.repositories);
 assert.deepEqual(await fetchServerRepositories('https://social.example',{fetcher:async(url,opts)=>{
  assert.equal(url,'https://social.example/.well-known/tavi-repositories.json');assert.equal(opts.credentials,'omit');
  return {status:200,ok:true,text:async()=>JSON.stringify(list)};
 }}),list.repositories);
 assert.deepEqual(await fetchServerRepositories('https://social.example',{fetcher:async()=>({status:404,ok:false})}),[]);
 assert.throws(()=>validateRepositoryList({...list,repositories:['https://one.example/#password']}));
});
test('remote catalog is fetched without tokens, merged with bundled precedence and source pinned per account',async()=>{
 const url='https://extensions.example.org/tavi.repository.json';
 const remote=await fetchRepository(url,{fetcher:async(request,opts)=>{
  assert.equal(request,url);assert.equal(opts.credentials,'omit');assert.equal(opts.redirect,'error');
  return {ok:true,text:async()=>JSON.stringify(example)};
 }});
 assert.equal(extensionSource(remote[0]),url);
 assert.equal(mergeRepositoryEntries(bundled,[remote]).length,bundled.length); // bundled ID cannot be hijacked
 const storage=memory(),store=createExtensionStore({storage,scope:extensionStorageScope('https://social.example','u1')});
 store.install(remote[0].manifest,url);
 assert.equal(store.source(remote[0].manifest.id),url);
 assert.throws(()=>store.enable(remote[0].manifest,'https://evil.test/catalog.json'),/repository changed/);
 assert.equal(store.enabled(remote[0].manifest.id),true);
});
test('Tavi client binds remote entrypoints into opaque iframe without revealing session tokens',async()=>{
 const code=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(code,/frame\.src=extensionPanelUrl\(entry\.remote \? entry\.remote\.entrypoint/);
 assert.match(code,/sandbox','allow-scripts'/);
 assert.doesNotMatch(code,/sandbox','allow-scripts allow-same-origin'/);
 assert.match(code,/Hosted origin/);
 assert.match(code,/role="dialog" aria-modal="true"/);
});

test('Atrium is first-party discoverable without user subscription or automatic installation',()=>{
 assert.deepEqual(FIRST_PARTY_REPOSITORIES,['https://thebigtreeinc.github.io/atrium/tavi/tavi.repository.json']);
 const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(main,/\.\.\.FIRST_PARTY_REPOSITORIES,\.\.\.subscribed,\.\.\.suggested/);
 assert.match(main,/Official Atrium repository/);
 assert.match(main,/data-extension-install/);
});
