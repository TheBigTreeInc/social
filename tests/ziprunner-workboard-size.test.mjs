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
  assert.equal(parsed.version, '0.3.111');
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
  const review = board.implemented.find(item => item.id === 'TAVI-STORE-110');
  assert.ok(review, 'Preserve TAVI-STORE-110 workboard item');
  assert.deepEqual(review.operator_checks, review.acceptance_criteria);
});
