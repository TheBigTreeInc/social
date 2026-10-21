import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const file=path=>readFile(new URL(path,import.meta.url),'utf8');
test('UI smoke waits for and approves the host-owned extension install dialog',async()=>{
 const qa=await file('../tools/ui-qa.mjs');
 const install=qa.indexOf("stage='review extension install'");
 const cancel=qa.indexOf("stage='cancel extension install'");
 const approve=qa.indexOf("stage='approve extension install'");
 const open=qa.indexOf("stage='open extension'");
 assert(install>0&&cancel>install&&approve>cancel&&open>approve);
 assert.match(qa,/data-extension-install-cancel/);
 assert.match(qa,/data-extension-install-approve/);
 assert.match(qa,/\.tavi-install-dialog\[role="dialog"\]/);
});
test('Touch devices use an explicit host capability flag without widening mouse-only layouts',async()=>{
 const [main,styles,qa]=await Promise.all([file('../src/main.js'),file('../src/ui/design-tokens.css'),file('../tools/ui-qa.mjs')]);
 assert.match(main,/navigator\.maxTouchPoints/);
 assert.match(main,/document\.documentElement\.dataset\.touch/);
 assert.match(styles,/:root\[data-touch='true'\] \.tavi-classic-home \.tavi-roster-merged \.buddy/);
 assert.match(styles,/min-height:var\(--tavi-hit-target-touch\)/);
 assert.match(qa,/touch input not recognized/);
 assert.match(qa,/buddy rows too small for touch/);
});
