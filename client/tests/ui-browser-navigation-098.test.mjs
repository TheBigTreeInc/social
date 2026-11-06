import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {hostToolbar} from '../src/ui/shell.js';
const uiQa=()=>readFile(new URL('../tools/ui-qa.mjs',import.meta.url),'utf8');
test('Wallet, Games and Notepad return routes use current shared host actions',async()=>{
 const source=await uiQa();
 for(const stage of ['Wallet return Home through shared Back','return from Games through shared Back','return from Notepad via contextual Back']) assert.ok(source.includes(stage),stage);
 assert.ok((source.match(/\.tavi-utility-focus \.tavi-shell-bar__back\[data-action=\"back\"\]/g)||[]).length>=2);
 assert.doesNotMatch(source,/\.tavi-utility-focus \.tavi-shell-bar__home\[data-action=\"home\"\]/);
 for(const obsolete of ['.tavi-shell-bar__back[data-action="minimize-view"]','.tavi-focus-toolbar [data-action="minimize-view"]','.tavi-roster-merged'])assert.ok(!source.includes(obsolete),`stale browser selector: ${obsolete}`);
});
test('shared host uses a single Back command in Wallet extension and Games toolbar',()=>{
 for(const title of ['Games','Core Gold Wallet','Private Notepad']){
  const html=hostToolbar(title,{action:'back',backLabel:'Home'});
  assert.match(html,/class="tavi-ui-header tavi-focus-toolbar tavi-shell-bar"/);
  assert.match(html,/class="tavi-ui-action tavi-ui-action--quiet tavi-shell-bar__back" data-action="back"/);
  assert.doesNotMatch(html,/class="tavi-ui-action tavi-ui-action--quiet tavi-shell-bar__home" data-action="home"/);
  assert.doesNotMatch(html,/data-action="minimize-view"/);
 }
});
