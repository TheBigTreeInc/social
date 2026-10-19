# Tavi 0.3.69 — Repair ZipRunner diagnostic build

Base: failed 0.3.68 diagnostic source candidate over stable 0.3.67. No runtime behavior change beyond 0.3.68.

## Root cause

`npm run verify` failed at `tests/auto-build.test.mjs` because its client package assertion expected `0.3.67` while package.json is 0.3.68. Correct assertion for this release to 0.3.69. Existing LoopRD component remains server release 0.3.58, schema 10.

## Metadata correction

0.3.68 carried a stale `.ziprunner-workboard-update.json` tagged 0.3.67 with no `TAVI-DEBUG-068` entry; now versioned 0.3.69 and the diagnostics ticket added in Review. All previous tickets kept as-is. No historical operator decision is changed.

## Acceptance

Import source ZIP, run npm run verify, run Python suite and generated descriptor check, then build native Windows. Inspect Help > Copy diagnostics, including clipboard fallback and privacy. Keep operator acceptance and Git CI evidence separate from source tests. No push, tag or release by this patch.
