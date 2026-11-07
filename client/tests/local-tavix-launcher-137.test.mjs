import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {wireLocalPackagePicker} from '../src/ui/local-package-picker.js';
const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const source=readFileSync(new URL('../src/ui/local-package-picker.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/style.css',import.meta.url),'utf8');
const menu=main.slice(main.indexOf('function mainMenu(){'),main.indexOf('function homeScreen(){'));

test('developer chooser is restored above swipeable app grid',()=>{
 const tabs=menu.indexOf('tavi-app-page-tabs');
 const shortcut=menu.indexOf('tavi-local-package-shortcut');
 const grid=menu.indexOf('tavi-app-pages');
 const footer=menu.indexOf('tavi-launcher-tools');
 assert.ok(tabs<shortcut && shortcut<grid && grid<footer);
 assert.equal((menu.match(/id="tavi-local-file"/g)||[]).length,1);
 assert.equal((menu.match(/id="tavi-local-file-direct"/g)||[]).length,1);
 assert.match(menu,/\$\{canInstallLocalTavix\(state\)\?`<div class="tavi-local-package-toolbar tavi-local-package-shortcut"/);
});

test('Windows uses the OS command instead of WebView2 file inputs',()=>{
 assert.match(source,/typeof nativeSelect==='function'/);
 assert.match(source,/nativeSelect\(\)/);
 assert.match(main,/nativeSelect:nativeWindowsPet\?\(\)=>invoke\('tavi_native_pick_tavix'\):null/);
 assert.match(source,/try\{primary\.click\(\);\}/); // browser and Android only
});

test('fallback and feedback are not hidden by Material display selectors',()=>{
 assert.match(css,/\.tavi-menu-panel \.tavi-local-picker-fallback\[hidden\]\{display:none!important;\}/);
 assert.match(css,/\.tavi-menu-panel #tavi-local-picker-status\[hidden\]\{display:none!important;\}/);
 assert.match(main,/id="tavi-local-picker-status" role="status" aria-live="polite" hidden/);
});
