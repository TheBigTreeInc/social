import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source = readFileSync(new URL('../tools/ui-qa.mjs', import.meta.url), 'utf8');

test('unified Store browser smoke waits for one of multiple visible asset cards',()=>{
  assert.doesNotMatch(source, /visible\(page,\s*['"]\.tavi-storefront-asset \[data-asset-item\]['"]\)/);
  assert.match(source, /const publicAssets=page\.locator\('\.tavi-storefront-asset \[data-asset-item\]'\)/);
  assert.match(source, /await publicAssets\.first\(\)\.waitFor\(\{state:'visible',timeout:6000\}\)/);
  assert.match(source, /assert\.ok\(await publicAssets\.count\(\)>=1,/);
  assert.match(source, /Internal Notepad must be absent from public discovery/);
});
