import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=async p=>readFile(new URL(`../${p}`,import.meta.url),'utf8');
test('ZipRunner builds and starts native Tavi app',async()=>{
 const project=JSON.parse(await read('project.zr'));
 const legacy=JSON.parse(await read('looprd-social.zr'));
 assert.deepEqual(project.start,['node tools/launch-tavi.mjs']);
 assert.deepEqual(legacy.start_commands,project.start);
 assert.deepEqual(project.build,['npm run verify','node tools/auto-build.mjs']);
 const launch=await read('tools/launch-tavi.mjs');
 assert.match(launch,/TAVI_LAUNCH_MISSING/);
 assert.match(launch,/looprd-social-client\.exe/);
 const build=await read('tools/auto-build.mjs');
 assert.match(build,/TAVI_EXECUTABLE_READY/);
});
