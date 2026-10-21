import test from 'node:test';
import assert from 'node:assert/strict';
import {snapshotTouchTargets} from '../tools/ui-qa-touch.mjs';
function el(height,{connected=true,width=320}={}){
 return {isConnected:connected,getBoundingClientRect:()=>({width,height}),style:{display:'block',visibility:'visible',minHeight:'44px'}};
}
function fixture(section,rows){
 return {querySelector:()=>section,querySelectorAll:()=>rows,defaultView:{getComputedStyle:e=>e.style}};
}
test('browser touch QA retries an unpainted or detached roster instead of reading 0px',()=>{
 assert.equal(snapshotTouchTargets(fixture(el(0),[el(44)])),null);
 assert.equal(snapshotTouchTargets(fixture(el(44),[el(0)])),null);
 assert.equal(snapshotTouchTargets(fixture(el(44),[el(44,{connected:false})])),null);
 assert.equal(snapshotTouchTargets(fixture(null,[el(44)])),null);
});
test('browser touch QA observes both visible controls in one layout snapshot',()=>{
 assert.deepEqual(snapshotTouchTargets(fixture(el(44),[el(44),el(48)])),{
  section:{height:44,width:320,cssMinHeight:'44px'},
  buddies:[{height:44,width:320,cssMinHeight:'44px'},{height:48,width:320,cssMinHeight:'44px'}]
 });
});
test('browser touch QA does not hide a genuine undersized visible row',()=>{
 const actual=snapshotTouchTargets(fixture(el(44),[el(30)]));
 assert.equal(actual.buddies[0].height,30);
 assert.equal(actual.buddies[0].height>=44,false);
});
