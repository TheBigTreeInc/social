import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {menuApplications,appGlyph,extensionIconUrl,launchableExtensions} from '../src/launcher.js';
import {validateExtensionManifest,validateCatalog} from '../src/extensions/contract.js';
const entry=JSON.parse(await readFile(new URL('../public/tavi-extensions/catalog.v1.json',import.meta.url),'utf8')).extensions[0];
const id=entry.manifest.id;
const fakeStore={enabled:x=>x===id,source:()=> 'tavi:bundled',version:()=>entry.manifest.version};
test('app drawer contains working built-in actions with icons and optional pet',()=>{
 const list=menuApplications({});
 assert.deepEqual(list.map(a=>a.action),['contacts','games','wallet','inbox','companion','portrait','app-store','add-friend','settings']);
 assert(list.every(a=>a.symbol&&appGlyph(a.symbol).startsWith('<svg')));
 assert(list.some(a=>a.action==='companion')); 
 assert(menuApplications({petEnabled:true}).some(a=>a.action==='companion'));
});
test('installed pinned extension appears as a tile, not before installation or when disabled',()=>{
 assert.equal(launchableExtensions({catalog:[entry],store:null,platform:'web'}).length,0);
 const list=menuApplications({catalog:[entry],store:fakeStore,platform:'windows'});
 assert.equal(list.at(-1).label,'Private Notepad');assert.equal(list.at(-1).kind,'extension');
 assert.equal(launchableExtensions({catalog:[entry],store:{...fakeStore,enabled:()=>false},platform:'web'}).length,0);
 assert.equal(launchableExtensions({catalog:[entry],store:{...fakeStore,source:()=> 'https://evil.invalid'},platform:'web'}).length,0);
 assert.equal(launchableExtensions({catalog:[entry],store:{...fakeStore,version:()=> '9.9.9'},platform:'web'}).length,0);
 assert.equal(launchableExtensions({catalog:[{...entry,manifest:{...entry.manifest,platforms:['android']}}],store:fakeStore,platform:'windows'}).length,0);
});
test('icon path validation is safe and backward-compatible with older manifests',()=>{
 assert.equal(validateExtensionManifest(entry.manifest).compatible,true);
 assert.equal(validateCatalog({schema:'tavi.store.catalog/v1',extensions:[entry]}).length,1);
 assert.match(extensionIconUrl(entry,'https://tavi.test/'),/\/tavi-extensions\/org.tavi.examples.notepad\/ui\/icon.svg$/);
 const old={...entry.manifest};delete old.icon;assert.equal(validateExtensionManifest(old).compatible,true);
 for(const bad of ['https://evil.test/p.png','../secret.png','/absolute.svg','ui/../../../x.svg','data:image/svg+xml,test','ui/icon.js']){
  assert.throws(()=>validateExtensionManifest({...entry.manifest,icon:bad}),/icon/);
 }
 assert.throws(()=>validateCatalog({schema:'tavi.store.catalog/v1',extensions:[{...entry,files:entry.files.filter(f=>f.path!=='ui/icon.svg')}]}),/icon asset/);
});
test('remote icons are resolved only within their own publisher repository path, no arbitrary URLs',()=>{
 const remote={...entry,repositoryUrl:'https://example.org/tavi/tavi.repository.json',remote:{entrypoint:'https://example.org/tavi/ui/index.html'}};
 assert.equal(extensionIconUrl(remote,'https://tavi.test/'),'https://example.org/tavi/ui/icon.svg');
 const old={...remote,manifest:{...entry.manifest}};delete old.manifest.icon;
 assert.equal(extensionIconUrl(old,'https://tavi.test/'),null);
});
test('menu and store use icon tiles, persistent Home and standard extension controls',async()=>{
 const ui=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
 const css=await readFile(new URL('../src/style.css',import.meta.url),'utf8');
 assert.match(ui,/aria-label="Swipe between app categories"/);assert.match(ui,/class="tavi-app-tile"/);
 assert.match(ui,/data-action="minimize-view"/);assert.match(ui,/data-extension-open/);
 assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
 assert.match(css,/\.tavi-app-icon-image/);
});
