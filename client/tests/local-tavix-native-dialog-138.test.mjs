import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileFromNativeTavixReply,wireLocalPackagePicker} from '../src/ui/local-package-picker.js';

const rust=readFileSync(new URL('../src-tauri/src/lib.rs',import.meta.url),'utf8');
const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const cargo=readFileSync(new URL('../src-tauri/Cargo.toml',import.meta.url),'utf8');
const cargoLock=readFileSync(new URL('../src-tauri/Cargo.lock',import.meta.url),'utf8');

function fixture(){
 const button=new EventTarget(), primary=new EventTarget(), direct=new EventTarget();
 primary.value='';direct.value='';primary.files=[];direct.files=[];
 let htmlClicks=0;
 primary.click=()=>htmlClicks++;
 const fallback={hidden:true},status={hidden:true,textContent:''};
 const root={getElementById:id=>({'tavi-local-file':primary,'tavi-local-file-direct':direct,'tavi-local-picker-status':status})[id],querySelector:sel=>({'[data-local-file-picker]':button,'[data-local-file-direct-fallback]':fallback})[sel]};
 return {root,button,primary,direct,fallback,status,htmlClicks:()=>htmlClicks};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const payload=(value,name='test.tavix')=>({status:'selected',name,base64:Buffer.from(value).toString('base64')});

test('Windows Tauri command is main-window restricted and OS-native',()=>{
 assert.match(rust,/async fn tavi_native_pick_tavix\(window: WebviewWindow\)/);
 assert.match(rust,/main_window_only\(&window\)\?/);
 assert.match(rust,/GetOpenFileNameW\(&mut dialog\)/);
 assert.match(rust,/CommDlgExtendedError/);
 assert.match(rust,/spawn_blocking\(native_tavix_picker::pick\)/);
 assert.match(rust,/tavi_session_clear, tavi_native_pick_tavix,/);
 assert.match(main,/nativeSelect:nativeWindowsPet\?\(\)=>invoke\('tavi_native_pick_tavix'\):null/);
 assert.match(cargo,/base64 = "=0.22.1"/);
 assert.ok(cargoLock.includes(`name = "looprd-social-client"\nversion = "0.3.138"\ndependencies = [\n "base64 0.22.1"`));
});

test('native returns only filename and bounded package bytes, no path',()=>{
 assert.match(rust,/metadata\.len\(\) > MAX_PACKAGE_BYTES/);
 assert.match(rust,/file\.take\(MAX_PACKAGE_BYTES \+ 1\)/);
 assert.match(rust,/name\.to_ascii_lowercase\(\)\.ends_with\("\.tavix"\)/);
 assert.match(rust,/"base64":STANDARD\.encode\(&bytes\)/);
 assert.doesNotMatch(rust,/"path"\s*:/);
 const file=fileFromNativeTavixReply(payload([1,2,3]));
 assert.equal(file.name,'test.tavix');assert.equal(file.size,3);
 return file.arrayBuffer().then(buffer=>assert.deepEqual([...new Uint8Array(buffer)],[1,2,3]));
});

test('native file response rejects malformed filename, data and size',()=>{
 assert.throws(()=>fileFromNativeTavixReply({status:'cancelled'}),/No native package/);
 assert.throws(()=>fileFromNativeTavixReply(payload([1,2],'not.zip')),/Invalid native/);
 assert.throws(()=>fileFromNativeTavixReply({status:'selected',name:'x.tavix',base64:'%' }),/Invalid native/);
 assert.throws(()=>fileFromNativeTavixReply(payload([])),/under 12 MB/);
 assert.throws(()=>fileFromNativeTavixReply({status:'selected',name:'x.tavix',base64:'a'.repeat(16_000_005)}),/Invalid native/);
});

test('Windows native selection never calls HTML picker, and emits selection',async()=>{
 const ui=fixture(),received=[];
 wireLocalPackagePicker(ui.root,{canSelect:()=>true,nativeSelect:async()=>payload([80,75]),onSelected:file=>received.push(file)});
 ui.button.dispatchEvent(new Event('click'));
 assert.equal(ui.htmlClicks(),0);
 assert.match(ui.status.textContent,/Opening Windows file dialog/);
 await flush();await flush();
 assert.equal(received.length,1);
 assert.equal(received[0].name,'test.tavix');assert.equal(received[0].size,2);
 assert.equal(ui.fallback.hidden,true);
});

test('native cancellation, errors and repeat click are handled visibly',async()=>{
 const ui=fixture();let calls=0,approve;
 wireLocalPackagePicker(ui.root,{canSelect:()=>true,nativeSelect:()=>{calls++;return new Promise(resolve=>approve=resolve);},onSelected:()=>{}});
 ui.button.dispatchEvent(new Event('click'));
 ui.button.dispatchEvent(new Event('click'));
 await flush();assert.equal(calls,1);
 approve({status:'cancelled'});await flush();await flush();
 assert.match(ui.status.textContent,/No package selected/);
 ui.button.dispatchEvent(new Event('click'));await flush();assert.equal(calls,2);
 approve({status:'selected',name:'test.tavix',base64:'broken!'});await flush();await flush();
 assert.match(ui.status.textContent,/Windows file dialog failed/);assert.equal(ui.fallback.hidden,false);
});

test('native picker is denied without developer authorization',()=>{
 const ui=fixture();let calls=0,denied=0;
 wireLocalPackagePicker(ui.root,{canSelect:()=>false,nativeSelect:async()=>{calls++;return payload([1])},onBlocked:()=>denied++});
 ui.button.dispatchEvent(new Event('click'));
 assert.equal(calls,0);assert.equal(denied,1);
});
