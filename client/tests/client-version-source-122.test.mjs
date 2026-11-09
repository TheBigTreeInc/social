import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const text = rel => readFileSync(new URL(rel, import.meta.url),'utf8');
const json = rel => JSON.parse(text(rel));
const root = json('../../package.json');
const client = json('../package.json');
const config = json('../src-tauri/tauri.conf.json');
const stamp = json('../../.ziprunner-post-update-tests.json');
const board = json('../../.ziprunner-workboard-update.json');

test('Vite injects package version into About and stable updater without a hardcoded UI version', () => {
  const vite = text('../vite.config.mjs');
  const main = text('../src/main.js');
  assert.match(vite, /JSON\.parse\(readFileSync\(resolve\(root,'package\.json'\),'utf8'\)\)/);
  assert.match(vite, /__TAVI_CLIENT_VERSION__\s*:\s*JSON\.stringify\(clientPackage\.version\)/);
  assert.match(main, /const CLIENT_VERSION=__TAVI_CLIENT_VERSION__;/);
  assert.doesNotMatch(main, /const CLIENT_VERSION\s*=\s*['"]\d+\.\d+\.\d+['"]/);
  assert.match(main, /CLIENT_VERSION/);
});

test('client, Tauri, Cargo, root, ZipRunner metadata versions agree', () => {
  const cargo = text('../src-tauri/Cargo.toml');
  const lock = text('../src-tauri/Cargo.lock').replaceAll('\r\n','\n');
  assert.equal(root.version, client.version);
  assert.equal(config.version, client.version);
  assert.equal(stamp.version, client.version);
  assert.equal(board.version, client.version);
  assert.match(cargo, new RegExp('^version\\s*=\\s*"'+client.version.replaceAll('.', '\\.')+'"', 'm'));
  assert.match(lock, new RegExp('name = "looprd-social-client"\\nversion = "'+client.version.replaceAll('.', '\\.')+'"'));
  assert.equal(json('../../project.zr').version, client.version);
  assert.equal(json('../../ziprunner-manifest.json').project.version, client.version);
});

test('LoopRD schema 13 repair has a separate server release and operator gate', () => {
  const server = json('../../server/looprd-release.json').release;
  assert.equal(server, '0.3.124');
  assert.equal(json('../../ziprunner-manifest.json').release_notes.server_unchanged, false);
  assert.match(json('../../ziprunner-manifest.json').verification_summary.server_deploy, /Not deployed/);
});
