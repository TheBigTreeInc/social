import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {uiAction,uiHeader,uiStatus} from '../src/ui/components.js';
import {hostToolbar} from '../src/ui/shell.js';
const read=rel=>readFile(new URL(rel,import.meta.url),'utf8');

test('central header/actions escape untrusted text and reject invalid host attributes',()=>{
 const html=uiHeader({title:'<Tavi & chats>',backAction:'back',backLabel:'Back',home:true});
 assert.match(html,/&lt;Tavi &amp; chats&gt;/);
 assert.match(html,/aria-label="Tavi Home"/);
 assert.match(html,/data-action="back"/);
 assert.doesNotMatch(html,/<Tavi & chats>/);
 assert.throws(()=>uiAction({label:'x',action:'exit_app()'}),/Invalid host action/);
 assert.throws(()=>uiAction({label:'x',id:'a onmouseover='}),/Invalid action id/);
 assert.match(uiStatus('<script>'),/&lt;script&gt;/);
});

test('one component drives main toolbar and native chat/game header',async()=>{
 const toolbar=hostToolbar('Wallet',{action:'back',backLabel:'Home'});
 assert.match(toolbar,/class="tavi-ui-header tavi-focus-toolbar tavi-shell-bar"/);
 assert.match(toolbar,/data-action="home"/);
 for(const file of ['../src/main.js','../src/chat.js','../src/game.js','../src/match.js']){
  const source=await read(file);
  assert.match(source,/\.\/ui\/components\.css/);
 }
 for(const file of ['../src/chat.js','../src/game.js','../src/match.js']){
  const source=await read(file);
  assert.match(source,/uiHeader\(/);
  assert.doesNotMatch(source,/File &nbsp; Edit &nbsp;/);
 }
});

test('all three native shells consume shared semantic tokens without styling publisher iframe',async()=>{
 const css=await read('../src/ui/components.css');
 for(const selector of ['.tavi-ui-header','.tavi-ui-action','.tavi-single-workspace','.pop-chat','.tavi-player'])assert.ok(css.includes(selector),selector);
 for(const token of ['--tavi-color-text','--tavi-color-border','--tavi-color-background','--tavi-color-surface'])assert.ok(css.includes(token),token);
 assert.doesNotMatch(css,/iframe\s*\{|iframe\.contentDocument|\.tavi-extension-frame iframe\s*\{/);
 const main=await read('../src/main.js');
 assert.match(main,/frame\.setAttribute\('sandbox','allow-scripts'\)/);
 assert.match(main,/decideHostBack\(/);
});

test('native child windows receive theme updates but not Social credentials',async()=>{
 const main=await read('../src/main.js');
 assert.match(main,/emitTo\(label,'tavi-ui-theme',\{theme:state.theme\}\)/);
 for(const name of ['chat','game','match']){
  const source=await read(`../src/${name}.js`);
  assert.match(source,/listen\('tavi-ui-theme'/);
  assert.match(source,/readConfig\(\)\.theme/);
  assert.doesNotMatch(source,/tavi-ui-theme.*token|tavi-ui-theme.*bearer/);
 }
});
