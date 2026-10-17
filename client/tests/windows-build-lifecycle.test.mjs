import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source = async path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
test('Windows local build releases only the targeted Cargo executable before Tauri', async () => {
  const build = await source('BUILD-LOCAL.ps1');
  const helper = await source('tools/stop-running-tavi.ps1');
  assert.match(build, /stop-running-tavi\.ps1/);
  assert.match(build, /target\/release\/looprd-social-client\.exe/);
  assert(build.indexOf('stop-running-tavi.ps1') < build.indexOf("Run $npmCommand @('run','tauri','--','build','--bundles','nsis')"));
  assert.match(helper, /Get-CimInstance Win32_Process/);
  assert.match(helper, /\$_.ExecutablePath/);
  assert.match(helper, /StringComparison\]::OrdinalIgnoreCase/);
  assert.match(helper, /CloseMainWindow/);
  assert.match(helper, /Stop-Process -Id \$processId -Force/);
  assert.doesNotMatch(helper, /Stop-Process\s+-Name/);
  assert.doesNotMatch(helper, /Remove-Item|rm -|taskkill/i);
});
test('ZipRunner auto-build invalidates its cache when stop helper changes and retains installer backup', async () => {
  const runner = await source('tools/auto-build.mjs');
  assert.match(runner, /tools\/stop-running-tavi\.ps1/);
  assert.match(runner, /tavi-last-good-nsis/);
  assert.match(runner, /TAVI_AUTO_BUILD_FAILED/);
});
