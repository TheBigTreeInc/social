import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {hostToolbar,mobileTabs} from '../src/ui/shell.js';
import {extensionPanelUrl} from '../src/ui/companion-world-entry.js';
import {atScrollEdge,elasticDistance,wireElasticScroll} from '../src/ui/touch-navigation.js';
const read=async path=>readFile(new URL(path,import.meta.url),'utf8');

test('compact host toolbar and tabs have one semantic icon route to Home and messenger',()=>{
 const toolbar=hostToolbar('Companion',{action:'back',backLabel:'Home'});
 assert.match(toolbar,/aria-label="Tavi Home"/);
 assert.match(toolbar,/aria-label="Back to Home"/);
 assert.equal((toolbar.match(/data-action="home"/g)||[]).length,1);
 assert.ok(!toolbar.includes('File</summary>'));
 const tabs=mobileTabs('extension',{unread:2});
 for(const a of ['home','contacts','games','main-menu'])assert.match(tabs,new RegExp(`data-action="${a}"`));
 assert.match(tabs,/aria-label="2 unread"/);
 assert.match(mobileTabs('menu'),/data-action="main-menu"[^>]*aria-current="page"/);
 assert.doesNotMatch(tabs,/data-action="signout"/);
});

test('publisher reviewed Companion opens at its painted world; others unchanged',async()=>{
 const url='https://example.invalid/tavi-extensions/org.tavi.community.companion/ui/index.html';
 assert.equal(extensionPanelUrl(url,{companion:true}),url+'#viewport');
 assert.equal(extensionPanelUrl(url,{companion:false}),url);
 assert.throws(()=>extensionPanelUrl('https://elsewhere.invalid/panel.html',{companion:true}),/published entrypoint/);
 const main=await read('../src/main.js');
 assert.match(main,/extensionPanelUrl\(/);
 assert.match(main,/companion:entry\.manifest\.id===BUNDLED_COMPANION_ID/);
 assert.match(main,/frame\.setAttribute\('sandbox','allow-scripts'\)/);
 const approved=await read('../../extensions/org.tavi.community.companion/ui/index.html');
 assert.match(approved,/<div class="viewport" id="viewport">/);
});

test('rubberband uses bounded passive feedback and respects page scroll bounds',()=>{
 assert.equal(elasticDistance(0),0);
 assert.ok(elasticDistance(1000)>0&&elasticDistance(1000)<=36);
 assert.ok(elasticDistance(-1000)<0&&elasticDistance(-1000)>=-36);
 const top={scrollTop:0,scrollHeight:900,clientHeight:400};
 assert.equal(atScrollEdge(top,50),true);
 assert.equal(atScrollEdge(top,-50),false);
 assert.equal(atScrollEdge({...top,scrollTop:500},-50),true);
 assert.equal(atScrollEdge({...top,scrollTop:300},-50),false);
 assert.equal(typeof wireElasticScroll(null),'function');
});

test('App categories, native scroll snap and non-overlapping mobile chrome are wired',async()=>{
 const main=await read('../src/main.js'), css=await read('../src/style.css');
 for(const part of ["label:'Talk'","label:'Explore'","label:'Your apps'",'wireAppPages(document)','mobileTabs(state.panel','tavi-companion-world-host'])assert.ok(main.includes(part),part);
 for(const part of ['.tavi-app-pages','scroll-snap-type:x mandatory','.tavi-mobile-tabs','overscroll-behavior-y:contain','.tavi-extension-panel>.tavi-extension-toolbar{display:none;}',"@media(max-width:620px)"])assert.ok(css.includes(part),part);
 assert.doesNotMatch(main,/exit\(0\)|history\.back\(/);
});
