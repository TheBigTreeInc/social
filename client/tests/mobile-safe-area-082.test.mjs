import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {snapshotSafeLayout} from '../tools/ui-qa-insets.mjs';
const read=path=>readFile(new URL(path,import.meta.url),'utf8');

test('mobile root owns its safe insets and nested workspace cannot exceed its content box',async()=>{
 const css=await read('../src/style.css');
 assert.match(css,/\.android-shell #app\s*\{[^}]*padding: var\(--tavi-safe-top\)/s);
 assert.match(css,/\.android-shell\s*\{[^}]*--tavi-safe-bottom:\s*max\(/s);
 assert.doesNotMatch(css,/@media\(max-width:620px\)\{\.tavi-single-workspace\{height:100dvh/);
 assert.match(css,/\.tavi-single-workspace\s*\{height:100%;max-height:100%;min-height:0;/);
});

test('Home menu is owned by the common tab bar, not a raised dock',async()=>{
 const css=await read('../src/style.css');
 assert.match(css,/\.tavi-mobile-tabs\{display:none/);
 assert.match(css,/\.tavi-mobile-tabs button\{/);
});

test('five-viewport browser QA measures real simulated Android system-bar geometry',async()=>{
 const qa=await read('../tools/ui-qa.mjs');
 for(const token of ['snapshotSafeLayout','Android simulated safe areas','--tavi-safe-top','--tavi-safe-bottom','Android safe Back and focused header','Main Menu overlaps roster text'])
  assert.ok(qa.includes(token),token);
});

test('safe layout snapshot reads root-padding and physical element bounds',()=>{
 const el=(top,bottom)=>({getBoundingClientRect:()=>({top,bottom,left:0,right:355,width:355,height:bottom-top})});
 const targets={'#app':el(0,600),'.tavi-unified-home .tavi-mobile-tabs':el(480,600),'.tavi-unified-home .tavi-mobile-tabs [data-action=\"main-menu\"]':el(493,585)};
 const win={innerHeight:630,innerWidth:355,getComputedStyle:()=>({paddingTop:'46px',paddingBottom:'34px'})};
 const d={querySelector:selector=>targets[selector]||null,documentElement:{ownerDocument:{defaultView:win}}};
 const result=snapshotSafeLayout(d);
 assert.equal(result.insets.top,46);
 assert.equal(result.insets.bottom,34);
 assert.equal(result.menu.top,493);
 assert.equal(result.menu.bottom,585);
});
