import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const source=await readFile(new URL('../tools/ui-qa.mjs',import.meta.url),'utf8');
test('App Store browser QA resolves the Notepad card by stable extension ID rather than ambiguous card order',()=>{
 assert.doesNotMatch(source,/visible\(page,\s*['"]\.tavi-store-item['"]\)/);
 assert.doesNotMatch(source,/locator\(['"]\.tavi-store-item['"]\)\.first\(\)/);
 assert.match(source,/const notepadInstall=page\.locator\('\[data-extension-install="org\.tavi\.examples\.notepad"\]'\)/);
 assert.match(source,/page\.locator\('\.tavi-store-item'\)\.filter\(\{has:notepadInstall\}\)/);
 assert.match(source,/assert\.equal\(await notepadCard\.count\(\),1,/);
 assert.match(source,/await notepadCard\.innerText\(\)/);
});
test('App Store QA still covers user-confirmed installation, cancellation and Home navigation',()=>{
 for(const token of [
  'data-extension-install-cancel',
  'data-extension-install-approve="org.tavi.examples.notepad"',
  'data-extension-open="org.tavi.examples.notepad"',
  'return home',
  "name:'desktop'","name:'tablet'","name:'compact-355'","name:'mobile-390'","name:'mobile-320'"
 ])assert(source.includes(token),token);
});

test('App Store browser QA explicitly opens and recloses collapsed repository diagnostics before probing the URL input',()=>{
 const manage=source.indexOf("await page.locator('[data-marketplace-manage]').click()");
 const input=source.indexOf("await visible(page,'#extension-repository-form input[name=\"repository\"]')");
 assert(manage>0&&input>manage,'Open Manage repositories before expecting its hidden form');
 assert.match(source,/const repositoryDetails=page\.locator\('#tavi-marketplace-repositories'\)/);
 assert.match(source,/repositoryDetails\.locator\('summary'\)\.click\(\)/);
 assert.match(source,/expanded App Store repositories/);
 assert.match(source,/waitFor\(\{state:'hidden',timeout:6000\}\)/);
});
