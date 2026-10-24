import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const native=readFileSync(resolve(root,'tools/android-update/TaviUpdaterPlugin.kt'),'utf8');
const config=JSON.parse(readFileSync(resolve(root,'client/src-tauri/tauri.conf.json'),'utf8'));

test('legacy updater test path remains safe for ZipRunner non-destructive overlays',()=>{
 assert.equal(config.identifier,'inc.thebigtree.looprdsocial');
 assert.match(config.version,/^0\.3\.\d+$/);
 assert.match(native,/import app\.tauri\.plugin\.JSObject/);
 assert.doesNotMatch(native,/import app\.tauri\.JSObject/);
});
