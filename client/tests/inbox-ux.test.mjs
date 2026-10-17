import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const sdk=readFileSync(new URL('../sdk/looprd-social.js',import.meta.url),'utf8');
test('inbox has action and history filters, native dynamic forms and dismissal',()=>{
 for(const marker of ['data-inbox-filter','Needs action','History','data-interaction-dismiss','data-interaction-reply','data-interaction-link'])assert.ok(main.includes(marker),marker);
 assert.match(sdk,/dismissInteraction\(id\)/);
 assert.ok(!main.includes('admin-dashboard'));
});
