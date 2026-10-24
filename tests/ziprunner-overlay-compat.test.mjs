import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('ZipRunner overlay package overwrites legacy updater test path instead of relying on deletion', async()=>{
  const legacy = await read('client/tests/android-updater-100.test.mjs');
  const current = await read('client/tests/android-updater-101.test.mjs');
  assert.match(legacy,/non-destructive overlays/);
  assert.doesNotMatch(legacy,/assert\.equal\(config\.version,'0\.3\.100'\)/);
  assert.match(current,/app\\.tauri\\.plugin\\.JSObject|app\.tauri\.plugin\.JSObject/);
});
