import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
const root=new URL('../../',import.meta.url);
async function read(path){return readFile(new URL(path,root),'utf8')}
test('Tavi branding belongs to client without breaking compact native geometry',async()=>{
 const main=await read('client/src/main.js');
 const css=await read('client/src/style.css');
 const config=JSON.parse(await read('client/src-tauri/tauri.conf.json'));
 assert.match(main,/Games\. Friends\. Together\./);
 assert.match(main,/welcome-mark/);
 assert.match(css,/tavi-mark\.svg/);
 assert.equal(config.productName,'Tavi');
 assert.equal(config.version,'0.3.43');
 assert.equal(config.app.windows[0].width,355);
 assert.equal(config.bundle.targets[0],'nsis');
});
test('Versioned icon assets exist for Windows and Web',async()=>{
 const svg=await read('client/assets/tavi-mark.svg');
 assert.match(svg,/<svg/);
 assert.match(await read('client/index.html'),/Tavi — Games\. Friends\. Together\./);
 for(const p of ['client/src-tauri/icons/icon.png','client/src-tauri/icons/icon.ico','client/public/tavi-mark.svg'])
  assert.ok((await stat(new URL(p,root))).size>100,p);
});
