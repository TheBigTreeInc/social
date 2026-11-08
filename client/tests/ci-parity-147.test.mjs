import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(name)=>readFileSync(new URL(name,import.meta.url),'utf8');
test('all context-menu UI QA assertions scope an exact action, not plural menuitems',()=>{
 const source=read('../tools/ui-qa.mjs');
 assert.doesNotMatch(source,/visible\(page,\s*['"]\.tavi-app-context-menu \[role=[^\]]+\]['"]\)/);
 assert.match(source,/Remove from Favorites/);
});
test('ZipRunner CI parity is a mandatory prebuild gate, separate from native acceptance',()=>{
 const project=JSON.parse(read('../../project.zr'));
 assert(project.build.some(command=>command.includes('tools/ci-parity.mjs --profile prebuild')));
 const plan=JSON.parse(read('../../ci-parity-plan.json'));
 assert.equal(plan.schema,'tavi.ci-parity-plan/v1');
 assert(plan.checks.some(check=>check.id==='browser-five-viewports'&&check.required));
 assert(plan.checks.some(check=>check.id==='python-full-suite'&&check.required));
 assert(plan.remoteOnly.some(x=>x.os==='macos'));
});
