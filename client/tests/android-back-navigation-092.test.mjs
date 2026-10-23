import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {decideHostBack,shouldDismissKeyboard} from '../src/ui/navigation-policy.js';
import {appGlyph,uiGlyph} from '../src/launcher.js';
import {hostToolbar} from '../src/ui/shell.js';

const source=async path=>readFile(new URL(path,import.meta.url),'utf8');
const connected={connected:true};
test('Android system Back never exits at Home, sign in, or rooted messenger',()=>{
 assert.equal(decideHostBack({...connected,panel:'home'}),'root');
 assert.equal(decideHostBack({connected:false,step:'server'}),'root');
 assert.equal(decideHostBack({connected:false,step:'account'}),'server-step');
 assert.equal(decideHostBack({...connected,panel:'messenger',mobileRoster:false}),'contacts');
 assert.equal(decideHostBack({...connected,panel:'messenger',mobileRoster:true}),'home');
});
test('native Back returns nested messenger utilities to host while dialogs close first',()=>{
 for(const panel of ['settings','games','portrait','companion','menu','app-store','developer','add-friend']){
  assert.equal(decideHostBack({...connected,panel}),'home',panel);
 }
 assert.equal(decideHostBack({...connected,panel:'extension',extensionReturnsHome:true}),'home');
 assert.equal(decideHostBack({...connected,panel:'extension',extensionReturnsHome:false}),'app-store');
 assert.equal(decideHostBack({...connected,panel:'inbox',interactionDetail:true}),'close-interaction');
 assert.equal(decideHostBack({...connected,panel:'extension',installApproval:true}),'cancel-install');
 assert.equal(decideHostBack({...connected,panel:'extension',lifeLaunch:true}),'cancel-life-launch');
 assert.equal(decideHostBack({...connected,panel:'home',diagnostics:true}),'close-diagnostics');
});
test('android keyboard is dismissed before host navigation only if actually visible',()=>{
 assert.equal(shouldDismissKeyboard({isEditable:true,viewportHeight:420,layoutHeight:800}),true);
 assert.equal(shouldDismissKeyboard({isEditable:false,viewportHeight:420,layoutHeight:800}),false);
 assert.equal(shouldDismissKeyboard({isEditable:true,viewportHeight:780,layoutHeight:800}),false);
});
test('Android Tauri integration registers native back event and has no implicit app exit',async()=>{
 const main=await source('../src/main.js'),pkg=JSON.parse(await source('../package.json'));
 assert.match(main,/import \{onBackButtonPress\} from '@tauri-apps\/api\/app'/);
 assert.match(main,/if\(clientPlatform==='android'\)\{\s*void onBackButtonPress\(\(\)=>goBackInTavi\(\)\)/);
 assert.match(main,/if\(name==='back'\)\{goBackInTavi\(\);return;\}/);
 assert.doesNotMatch(main,/history\.back\(|window\.close\(|exit\(0\)/);
 assert.ok(Number(pkg.dependencies['@tauri-apps/api'].match(/\d+\.\d+/)[0])>=2.9);
});
test('host navigation glyphs are local SVG shapes with labels and no font dependency',async()=>{
 for(const name of ['home','back','send','bell','settings','refresh']){
  const html=uiGlyph(name);
  assert.match(html,/<svg/);assert.match(html,/aria-hidden="true"/);assert.match(html,/<path|<circle|<rect/);
  assert.doesNotMatch(html,/<use|url\(|https?:|<font/);
 }
 assert.match(appGlyph('messages'),/tavi-app-glyph/);
 const back=hostToolbar('Safe',{action:'back',backLabel:'Home'});
 assert.match(back,/data-action="back"/);assert.match(back,/aria-label="Back to Home"/);
 assert.match(back,/<svg/);
 const styles=await source('../src/style.css');
 assert.match(styles,/\.tavi-ui-glyph/);
 assert.match(styles,/min-height:44px/);
});
