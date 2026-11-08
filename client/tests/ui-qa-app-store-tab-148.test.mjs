import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
const script=readFileSync(new URL('../tools/ui-qa.mjs',import.meta.url),'utf8');
test('App Store QA targets the active All tab, never both hidden and visible tiles',()=>{
 assert.match(script,/page\.locator\('#tavi-app-page-1 \[data-action="app-store"\]'\)/);
 assert.match(script,/assert\.equal\(await allAppsStore\.count\(\),1,/);
 assert.match(script,/await allAppsStore\.click\(\)/);
 assert.doesNotMatch(script,/visible\(page,'\.tavi-menu-grid \[data-action="app-store"\]'\)/);
 assert.doesNotMatch(script,/page\.locator\('\.tavi-menu-grid \[data-action="app-store"\]'\)\.click\(\)/);
});
