import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root=new URL('../../',import.meta.url);
const read=async path=>readFile(new URL(path,root),'utf8');
test('ZipRunner explicitly registers the browser UI smoke tests and retains no more than 20 post-update checks',async()=>{
 const plan=JSON.parse(await read('.ziprunner-post-update-tests.json'));
 assert(plan.tests.length<=20);
 assert(plan.tests.some(x=>x.command.includes('ui:ci')&&x.attention_on_failure===true&&x.rerun_policy==='every_update'));
 const client=JSON.parse(await read('client/package.json'));
 assert(client.scripts['ui:ci'].includes('web:build'));
 assert(client.scripts['ui:qa'].includes('ui-qa.mjs'));
});
test('browser smoke checks use a disposable self-contained Social fixture and preserve failure screenshots',async()=>{
 const source=await read('client/tools/ui-qa.mjs');
 for(const fragment of ['disposableToken','127.0.0.1','pageerror','screenshot','qa-artifacts','mobile-390','mobile-320','desktop','app-store','tavi-extension-surface','UI QA BLOCKED'])assert(source.includes(fragment),fragment);
 assert(!source.includes('api.thebigtree.life'),'browser smoke must never target a real LoopRD installation');
});

test('browser game smoke clicks visible Home dock, not a hidden menu duplicate',async()=>{
 const source=await read('client/tools/ui-qa.mjs');
 assert(source.includes(".tavi-home-dock [data-action=\"games\"]"));
 assert(!source.includes("locator('[data-action=\"games\"]').first().click()"));
});
