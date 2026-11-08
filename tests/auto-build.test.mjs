import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=async p=>readFile(new URL(`../${p}`,import.meta.url),'utf8');
test('ZipRunner gates auto-build after verification and enables Windows by default',async()=>{
  const project=JSON.parse(await read('project.zr'));
  const legacy=JSON.parse(await read('looprd-social.zr'));
  const cfg=JSON.parse(await read('tavi-build.json'));
  assert.deepEqual(project.build,['node tools/prune-companion-legacy-overlay.mjs','npm run verify','node tools/auto-build.mjs']);
  assert.deepEqual(legacy.build_commands,project.build);
  assert.deepEqual(cfg.targets,{Windows:true,Web:false,Android:false});
  const script=await read('tools/auto-build.mjs');
  assert.match(script,/TAVI_AUTO_BUILD_FAILED/);
  assert.match(script,/tavi-last-good-nsis/);
  assert.doesNotMatch(script,/git push|git commit|push origin/);
});
test('Tavi release includes central TaviX discovery while advancing server schema 13 for Companion CAS',async()=>{
  const pkg=JSON.parse(await read('package.json'));
  const server=JSON.parse(await read('server/looprd-release.json'));
  const spec=await read('looprd.yaml');
  // Wallet subcomponent changes the server descriptor/release but adds Companion schema 13.
  const tauri=JSON.parse(await read('client/src-tauri/tauri.conf.json'));
  assert.match(pkg.version,/^\d+\.\d+\.\d+$/);
  assert.equal(tauri.version,pkg.version);
  assert.match(server.release,/^\d+\.\d+\.\d+$/);
  assert.ok(spec.includes(`release: ${server.release}`));
  assert.match(spec,/spec\.subcomponents/);
  assert.match(spec,/extensions\/org\.tavi\.core\.wallet\/looprd\/looprd\.yaml/);
  assert.match(spec,/mode: verified/);
  assert.match(spec,/transport: unifiedpush/);
  assert.match(spec,/schemaVersion: 13/);
  assert.match(spec,/management:/);
});
