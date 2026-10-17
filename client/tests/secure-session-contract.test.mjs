import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const rust=readFileSync(new URL('../src-tauri/src/lib.rs',import.meta.url),'utf8');
const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
test('Windows session vault is OS-protected, main-window-only and user-scoped',()=>{
 assert.match(rust,/window\.label\(\) == "main"/);
 assert.match(rust,/CryptProtectData/);
 assert.match(rust,/CryptUnprotectData/);
 assert.match(rust,/app_local_data_dir\(\)/);
 assert.match(rust,/remembered-session\.v1\.dpapi/);
 assert.match(rust,/MoveFileExW/);
 assert.doesNotMatch(rust,/CRYPTPROTECT_LOCAL_MACHINE/);
 for(const c of ['tavi_session_load','tavi_session_save','tavi_session_clear'])assert.match(rust,new RegExp(c));
});
test('Tavi login opts into vault and transient server outages do not delete credentials',()=>{
 assert.match(main,/createDeviceSessionStore/);
 assert.match(main,/sessionStore\.save/);
 assert.match(main,/sessionStore\.load/);
 assert.match(main,/sessionStore\.clear/);
 assert.match(main,/if\(error\.status===401\|\|error\.status===403\)/);
 assert.match(main,/Saved sign-in was kept/);
 assert.match(main,/settings-disclosure/);
});
