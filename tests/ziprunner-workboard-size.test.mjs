import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';

const WORKBOARD_UPDATE = new URL('../.ziprunner-workboard-update.json', import.meta.url);
const ZIPRUNNER_WORKBOARD_LIMIT = 256 * 1024;

// Cargo.lock is checked out with CRLF by some Windows Git configurations.
// Parse only the exact package stanza, without assuming platform newlines.
const cargoClientVersions = (content) => [...content.matchAll(
  /^\[\[package\]\]\r?\nname = "looprd-social-client"\r?\nversion = "([^"\r\n]+)"/gm,
)].map((match) => match[1]);

test('Cargo.lock client stanza matches with LF and Windows CRLF', () => {
  const fixture = '[[package]]\nname = "looprd-social-client"\nversion = "1.2.3"\n';
  assert.deepEqual(cargoClientVersions(fixture), ['1.2.3']);
  assert.deepEqual(cargoClientVersions(fixture.replaceAll('\n', '\r\n')), ['1.2.3']);
  assert.deepEqual(cargoClientVersions(fixture.replace('looprd-social-client', 'another-crate')), []);
});

test('ZipRunner workboard update stays within the 256 KiB ingestion limit', async () => {
  const info = await stat(WORKBOARD_UPDATE);
  assert.ok(
    info.size <= ZIPRUNNER_WORKBOARD_LIMIT,
    `.ziprunner-workboard-update.json is ${info.size} bytes; ZipRunner accepts at most ${ZIPRUNNER_WORKBOARD_LIMIT}`,
  );

  const parsed = JSON.parse(await readFile(WORKBOARD_UPDATE, 'utf8'));
  assert.equal(parsed.schema, 'ziprunner.workboard-update.v1');
  assert.equal(parsed.project, 'looprd-social');
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(parsed.version, pkg.version);
});

// Mirror the mandatory ZipRunner workboard validation contract locally.
// A missing operator_checks previously blocked 0.3.110 before source overlay.
test('every implemented workboard item has 1 to 20 nonempty operator checks', async () => {
  const board = JSON.parse(await readFile(WORKBOARD_UPDATE, 'utf8'));
  for (const item of board.implemented) {
    assert.ok(Array.isArray(item.operator_checks) && item.operator_checks.length >= 1 && item.operator_checks.length <= 20,
      `Missing or invalid operator_checks for ${item.id}`);
    assert.ok(item.operator_checks.every(check => typeof check === 'string' && check.trim()),
      `Empty operator check for ${item.id}`);
  }
  const previous = JSON.parse(await readFile(new URL('../docs/qa/workboard-0.3.173-source-snapshot.json', import.meta.url), 'utf8'));
  const review = previous.implemented.find(item => item.id === 'TAVI-STORE-110');
  assert.ok(review, 'Preserve TAVI-STORE-110 workboard item');
  assert.deepEqual(review.operator_checks, review.acceptance_criteria);
  assert.deepEqual([...board.implemented,...board.remaining].map(item=>item.id).sort(), ['TAVI-STORE-TOUCH-174','TAVI-STORE-TOUCH-174-NATIVE-QA'].sort(), 'Only current new IDs may update local Workboard');
});

// A previous release shipped a stale workboard version even though the app
// and package reported a newer version; ZipRunner correctly rejected it.
test('ZipRunner release metadata versions agree with package.json', async () => {
  const root = new URL('../', import.meta.url);
  const readJson = async (name) => JSON.parse(await readFile(new URL(name, root), 'utf8'));
  const version = (await readJson('package.json')).version;
  const versions = {
    'client/package.json': (await readJson('client/package.json')).version,
    'client/package-lock.json': (await readJson('client/package-lock.json')).version,
    'client/package-lock.json packages root': (await readJson('client/package-lock.json')).packages[''].version,
    '.ziprunner-workboard-update.json': (await readJson('.ziprunner-workboard-update.json')).version,
    '.ziprunner-post-update-tests.json': (await readJson('.ziprunner-post-update-tests.json')).version,
    'ziprunner-verification-plan.json': (await readJson('ziprunner-verification-plan.json')).version,
    'ziprunner-manifest.json': (await readJson('ziprunner-manifest.json')).project.version,
    'ziprunner-manifest.json release_notes': (await readJson('ziprunner-manifest.json')).release_notes.version,
    'project.zr': (await readJson('project.zr')).version,
    'client/src-tauri/tauri.conf.json': (await readJson('client/src-tauri/tauri.conf.json')).version,
    'ci-parity-plan.json': (await readJson('ci-parity-plan.json')).version,
  };
  for (const [path, actual] of Object.entries(versions)) {
    assert.equal(actual, version, `Stale release metadata at ${path}`);
  }
  const cargo = await readFile(new URL('client/src-tauri/Cargo.toml', root), 'utf8');
  const lock = await readFile(new URL('client/src-tauri/Cargo.lock', root), 'utf8');
  assert.match(cargo, new RegExp(`^version = "${version.replaceAll('.', '\\.')}"\\r?$`, 'm'));
  assert.deepEqual(cargoClientVersions(lock), [version],
    'client/src-tauri/Cargo.lock: expected exactly one client package at package.json version');
});
