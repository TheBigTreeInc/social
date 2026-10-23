import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {hostToolbar,uiTokens} from '../src/ui/shell.js';
const read=async path=>readFile(new URL(path,import.meta.url),'utf8');
test('shared host navigation does not permit injected attributes/actions',()=>{
 const html=hostToolbar('<Wallet & Friends>');
 assert.match(html,/class="tavi-ui-header tavi-focus-toolbar tavi-shell-bar"/);
 assert.match(html,/data-action="minimize-view"/);
 assert.match(html,/&lt;Wallet &amp; Friends&gt;/);
 assert.doesNotMatch(html,/<Wallet/);
 assert.throws(()=>hostToolbar('Bad',{action:'signout" onclick="x'}),/Unsupported/);
 assert.deepEqual(uiTokens.themes,['light','dark']);
});
test('host UI uses shared, scoped design tokens and preserves dark palette',async()=>{
 const tokens=await read('../src/ui/design-tokens.css');
 const main=await read('../src/main.js');
 for(const name of ['background','surface','text','text-muted','accent','border','focus','field'])assert.match(tokens,new RegExp('--tavi-color-'+name+':'));
 assert.match(tokens,/:root\[data-theme='dark'\]/);
 assert.match(tokens,/tavi-classic-home/);
 assert.match(tokens,/tavi-utility-focus/);
 assert.match(tokens,/tavi-contact-focus/);
 assert.match(tokens,/--tavi-hit-target-touch: 44px/);
 assert.match(main,/import '\.\/ui\/design-tokens\.css'/);
 assert.equal((main.match(/hostToolbar\(/g)||[]).length,3);
 assert.match(main,/homeToolbar\(\)/);
 assert.match(main,/frame\.setAttribute\('sandbox','allow-scripts'\)/);
 assert.doesNotMatch(tokens,/iframe\.contentDocument|postMessage|Social bearer/);
});
test('native QA targets disposable Windows WebView2 and never the operator account silently',async()=>{
 const tool=await read('../tools/native-ui-qa.mjs');
 const launcher=await read('../tools/START-NATIVE-UI-QA.ps1');
 assert.match(tool,/nativeQaPreflight/);
 assert.match(tool,/TAVI_NATIVE_QA_DISPOSABLE/);
 assert.match(tool,/windows_required/);
 assert.match(tool,/chromium\.connectOverCDP/);
 assert.match(tool,/window\.__TAURI_INTERNALS__/);
 assert.match(tool,/TAVI_NATIVE_QA_CAPTURE==='1'/);
 assert.match(tool,/native-ui-qa-report\/v1/);
 assert.doesNotMatch(tool,/api\.thebigtree\.life|tavi_qa_disposable_token_only/);
 assert.match(launcher,/WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS/);
 assert.match(launcher,/Read-Host/);
});
test('browser fixture QA keeps game discovery in Games, tests all representative widths and uses shared back button',async()=>{
 const tool=await read('../tools/ui-qa.mjs');
 for(const frag of ['mobile-320','compact-355','mobile-390','tablet','desktop','tavi-home-group-title','tavi-shell-bar__back'])assert.ok(tool.includes(frag),frag);
 assert.doesNotMatch(tool,/visible\(page,'\.tavi-discovered-mini'\)/);
 assert.doesNotMatch(tool,/tavi-extension-toolbar \[data-action="home"\]/);
});
test('ZipRunner launched native executable opts in to WebView2 debugging only for disposable QA',async()=>{
 const launcher=await read('../../tools/launch-tavi.mjs');
 assert.match(launcher,/TAVI_NATIVE_QA_DISPOSABLE==='1'/);
 assert.match(launcher,/TAVI_NATIVE_QA_CDP_PORT/);
 assert.match(launcher,/qaApproved\)\{/);
 assert.match(launcher,/WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS/);
 assert.match(launcher,/env:nativeEnv/);
 assert.match(launcher,/TAVI_NATIVE_QA_SKIPPED/);
});
test('light and dark host text/color tokens meet minimum contrast against their surfaces',async()=>{
 const css=await read('../src/ui/design-tokens.css');
 const blocks=[css.match(/:root \{([\s\S]*?)\}/)?.[1],css.match(/:root\[data-theme='dark'\] \{([\s\S]*?)\}/)?.[1]];
 const luminance=color=>{
  const rgb=color.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i)?.slice(1).map(part=>{
   const n=parseInt(part,16)/255;return n<=0.04045?n/12.92:((n+0.055)/1.055)**2.4;
  });
  assert.ok(rgb,`Expected six-digit color: ${color}`);
  return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
 };
 const contrast=(a,b)=>{const values=[luminance(a),luminance(b)].sort((x,y)=>x-y);return (values[1]+.05)/(values[0]+.05);};
 for(const [index,block] of blocks.entries()){
  assert.ok(block);
  const vars=new Map([...block.matchAll(/--tavi-color-([a-z-]+):\s*(#[\da-f]{6})/gi)].map(([,key,value])=>[key,value]));
  for(const [a,b] of [['text','surface'],['text','background'],['text-muted','surface'],['accent-contrast','accent']]){
   assert.ok(contrast(vars.get(a),vars.get(b))>=4.5,`Insufficient ${index?'dark':'light'} ${a}/${b} contrast`);
  }
 }
});
