import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {androidApkAsset,checkTaviRelease} from '../src/release-updates.js';
import {renderSettings} from '../src/ui/settings-view.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const native=readFileSync(resolve(root,'tools/android-update/TaviUpdaterPlugin.kt'),'utf8');
const callback=readFileSync(resolve(root,'tools/android-update/TaviInstallResultReceiver.kt'),'utf8');
const rust=readFileSync(resolve(root,'client/src-tauri/src/lib.rs'),'utf8');
const main=readFileSync(resolve(root,'client/src/main.js'),'utf8');
const overlay=readFileSync(resolve(root,'tools/configure-android-updater.py'),'utf8');
const config=JSON.parse(readFileSync(resolve(root,'client/src-tauri/tauri.conf.json'),'utf8'));

test('Tauri JSObject import uses the plugin package required by Android Kotlin compilation',()=>{
 assert.match(native,/import app\.tauri\.plugin\.JSObject/);
 assert.doesNotMatch(native,/import app\.tauri\.JSObject/);
});
test('Android uses PackageInstaller sessions rather than external APK viewer chooser',()=>{
 assert.match(native,/PackageInstaller\.SessionParams\(/);
 assert.match(native,/session\.commit\(callback\.intentSender\)/);
 assert.match(callback,/STATUS_PENDING_USER_ACTION/);
 assert.match(native,/TaviInstallResultReceiver::class.java/);
 assert.match(callback,/FLAG_ACTIVITY_NEW_TASK/);
 assert.match(native,/FLAG_MUTABLE/);
 assert.doesNotMatch(native,/Intent\(Intent\.ACTION_VIEW\)/);
 assert.doesNotMatch(native,/startActivity\(install\)/);
 assert.doesNotMatch(overlay,/androidx\.core\.content\.FileProvider/);
});
test('APK preflight checks namespace, version, package, signer and versionCode before installation',()=>{
 assert.match(native,/official\.matchEntire\(url\)/);
 assert.match(native,/candidate\.packageName != activity\.packageName/);
 assert.match(native,/candidate\.versionName != version/);
 assert.match(native,/sameSigner\(current, candidate\)/);
 assert.match(native,/versionCode\(candidate\) <= versionCode\(current\)/);
 assert.match(native,/PackageInstaller\.SessionParams\.USER_ACTION_REQUIRED/);
 assert.match(native,/"package_mismatch"/);
 assert.match(native,/"signature_mismatch"/);
});
test('Self-test consumes same signed release but never creates install session',async()=>{
 assert.match(native,/fun testRelease\(invoke: Invoke\) \{ begin\(invoke, dryRun = true\) \}/);
 assert.match(native,/if \(dryRun\) \{/);
 assert.match(native,/file\.delete\(\)/);
 assert.match(native,/if \(!dryRun && versionCode/);
 assert.match(rust,/fn tavi_android_test_update\(/);
 assert.match(rust,/main_window_only\(&window\)/);
 const settingsHtml=renderSettings({page:'about',platform:'android',nativeApp:true,clientVersion:'0.3.111',notifyPrefs:{},pushPrefs:{},androidStatus:{stage:'idle'}});
 assert.match(settingsHtml,/data-action="android-update-self-test"/);
 assert.match(settingsHtml,/data-action="android-update-copy-diagnostics"/);
 assert.match(main,/tavi_android_update_status/);
 const release={tag_name:'v0.3.99',assets:[{name:'tavi-android-arm64-v0.3.99.apk',size:12345678,browser_download_url:'https://github.com/TheBigTreeInc/social/releases/download/v0.3.99/tavi-android-arm64-v0.3.99.apk'}]};
 assert.equal((await checkTaviRelease('0.0.0',{fetcher:async()=>({ok:true,json:async()=>release})})).androidUrl,androidApkAsset(release));
});
test('Target app identity remains stable through 0.3.111',()=>{
 assert.equal(config.identifier,'inc.thebigtree.looprdsocial');
 assert.equal(config.version,'0.3.111');
 assert.equal(config.bundle?.android?.versionCode,undefined);
});
