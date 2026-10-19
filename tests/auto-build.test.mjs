import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=async p=>readFile(new URL(`../${p}`,import.meta.url),'utf8');
test('ZipRunner gates auto-build after verification and enables Windows by default',async()=>{
  const project=JSON.parse(await read('project.zr'));
  const legacy=JSON.parse(await read('looprd-social.zr'));
  const cfg=JSON.parse(await read('tavi-build.json'));
  assert.deepEqual(project.build,['npm run verify','node tools/auto-build.mjs']);
  assert.deepEqual(legacy.build_commands,project.build);
  assert.deepEqual(cfg.targets,{Windows:true,Web:false,Android:false});
  const script=await read('tools/auto-build.mjs');
  assert.match(script,/TAVI_AUTO_BUILD_FAILED/);
  assert.match(script,/tavi-last-good-nsis/);
  assert.doesNotMatch(script,/git push|git commit|push origin/);
});
test('Social multiplayer match rooms add schema 10 without losing game-event capabilities',async()=>{
  const pkg=JSON.parse(await read('package.json'));
  const server=JSON.parse(await read('server/looprd-release.json'));
  const spec=await read('looprd.yaml');
  assert.equal(pkg.version,'0.3.58');
  assert.equal(server.release,'0.3.58');
  assert.match(spec,/release: 0\.3\.58/);
  assert.match(spec,/mode: verified/);
  assert.match(spec,/transport: unifiedpush/);
  assert.match(spec,/schemaVersion: 10/);
  assert.match(spec,/management:/);
});
