import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {wireLocalPackagePicker} from '../src/ui/local-package-picker.js';

const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/style.css',import.meta.url),'utf8');

function pickerFixture(){
 const button=new EventTarget();
 const primary=new EventTarget();
 const direct=new EventTarget();
 primary.files=[];primary.value='selected';
 direct.files=[];direct.value='selected';
 let primaryClicks=0;
 primary.click=()=>{primaryClicks++;primary.dispatchEvent(new Event('click',{cancelable:true}));};
 const fallback={hidden:true};
 const status={hidden:true,textContent:''};
 const root={getElementById:id=>({'tavi-local-file':primary,'tavi-local-file-direct':direct,'tavi-local-picker-status':status})[id]||null,
  querySelector:sel=>({'[data-local-file-picker]':button,'[data-local-file-direct-fallback]':fallback})[sel]||null};
 return {root,button,primary,direct,fallback,status,primaryClicks:()=>primaryClicks};
}

test('restored Apps button preserves direct native chooser fallback and no silent click',()=>{
 assert.match(main,/data-local-file-picker/);
 assert.match(main,/<input type="file" id="tavi-local-file"[^>]+ hidden/);
 assert.match(main,/id="tavi-local-file-direct"/);
 assert.match(main,/id="tavi-local-picker-status" role="status" aria-live="polite"/);
 assert.match(main,/wireLocalPackagePicker\(document,\{/);
 assert.match(css,/\.tavi-local-picker-fallback>input\[type=file\]\{position:absolute;/);
});

test('primary button opens file picker synchronously and exposes a direct fallback',()=>{
 const {root,button,primary,primaryClicks,fallback,status}=pickerFixture();const selected=[];
 assert.equal(wireLocalPackagePicker(root,{canSelect:()=>true,onSelected:file=>selected.push(file)}),true);
 button.dispatchEvent(new Event('click'));
 assert.equal(primaryClicks(),1);
 assert.equal(fallback.hidden,false);
 assert.equal(status.hidden,false);
 assert.match(status.textContent,/Browse files directly/);
 const file={name:'test.tavix'};
 primary.files=[file];primary.dispatchEvent(new Event('change'));
 assert.deepEqual(selected,[file]);assert.equal(primary.value,'');
 primary.value='selected';primary.dispatchEvent(new Event('change'));
 assert.deepEqual(selected,[file,file]);
});

test('direct input fallback selects a file without relying on synthetic click',()=>{
 const {root,direct,button}=pickerFixture();const selected=[];
 wireLocalPackagePicker(root,{canSelect:()=>true,onSelected:file=>selected.push(file)});
 button.dispatchEvent(new Event('click'));
 const file={name:'test.tavix'};
 direct.files=[file];direct.dispatchEvent(new Event('change'));
 assert.deepEqual(selected,[file]);assert.equal(direct.value,'');
});

test('revoked developer mode blocks both routes',()=>{
 const {root,button,primary,direct,primaryClicks}=pickerFixture();let denied=0,selected=0;
 wireLocalPackagePicker(root,{canSelect:()=>false,onSelected:()=>selected++,onBlocked:()=>denied++});
 button.dispatchEvent(new Event('click'));
 assert.equal(primaryClicks(),0);
 const click=new Event('click',{cancelable:true});direct.dispatchEvent(click);
 assert.equal(click.defaultPrevented,true);
 direct.files=[{name:'a.tavix'}];direct.dispatchEvent(new Event('change'));
 assert.equal(selected,0);assert.equal(denied,3);
});

test('missing controls and cancelled selection do not install',()=>{
 const {root,primary}=pickerFixture();let selected=0;
 assert.equal(wireLocalPackagePicker({getElementById:()=>null,querySelector:()=>null},{}),false);
 assert.equal(wireLocalPackagePicker(root,{canSelect:()=>true,onSelected:()=>selected++}),true);
 primary.files=[];primary.dispatchEvent(new Event('change'));
 assert.equal(selected,0);assert.equal(primary.value,'');
});

test('LoopRD developer permission is checked after file choice and before commit',()=>{
 assert.match(main,/verifyLocalTavixDeveloperGrant\(state,updateDeveloperPermission\)/);
 assert.match(main,/if\(!canInstallLocalTavix\(state\)\)\{toast\('Developer Mode is no longer active/);
 assert.match(main,/if\(!store\|\|!scope\)\{toast\('Local extension storage is not ready/);
});
