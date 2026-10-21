import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL(path,import.meta.url),'utf8');
test('real Windows native QA exercises menus and compact Home without installing anything',async()=>{
 const qa=await read('../tools/native-ui-qa.mjs');
 for(const token of ['native_exclusive_menus','menu_exclusivity_failed','menu_escape_failed','compact_messenger_home','legacy_roster_controls_returned','TAVI_NATIVE_QA_DISPOSABLE','TAVI_NATIVE_QA_CAPTURE'])assert.ok(qa.includes(token),token);
 assert.doesNotMatch(qa,/data-extension-install|message-form|send-message|password|bearer/i);
});
test('disposable browser QA checks updated layout and 44px mobile touch target',async()=>{
 const tool=await read('../tools/ui-qa.mjs');
 const css=await read('../src/ui/design-tokens.css');
 assert.match(tool,/stage='mobile touch targets'/);
 assert.match(tool,/height>=44/);
 assert.match(tool,/\.games-strip, \.tavi-discovered-mini, \.roster-toolbar, \.roster-search/);
 assert.match(css,/@media \(pointer:coarse\)/);
 assert.match(css,/min-height:var\(--tavi-hit-target-touch\)/);
 assert.doesNotMatch(tool,/visible\(page,'\.tavi-discovered-mini'\)/);
});
