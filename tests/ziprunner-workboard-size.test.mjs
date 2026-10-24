import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';

const WORKBOARD_UPDATE = new URL('../.ziprunner-workboard-update.json', import.meta.url);
const ZIPRUNNER_WORKBOARD_LIMIT = 256 * 1024;

test('ZipRunner workboard update stays within the 256 KiB ingestion limit', async () => {
  const info = await stat(WORKBOARD_UPDATE);
  assert.ok(
    info.size <= ZIPRUNNER_WORKBOARD_LIMIT,
    `.ziprunner-workboard-update.json is ${info.size} bytes; ZipRunner accepts at most ${ZIPRUNNER_WORKBOARD_LIMIT}`,
  );

  const parsed = JSON.parse(await readFile(WORKBOARD_UPDATE, 'utf8'));
  assert.equal(parsed.schema, 'ziprunner.workboard-update.v1');
  assert.equal(parsed.project, 'looprd-social');
  assert.equal(parsed.version, '0.3.108');
});
