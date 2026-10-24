# Tavi 0.3.102 — ZipRunner overlay-safe Android updater repair

## Why this pass exists

The 0.3.101 source ZIP passed when extracted into a clean directory but failed when ZipRunner applied it over the existing 0.3.100 checkout. ZipRunner source updates are non-destructive overlays: removing or renaming a file in a later ZIP does not delete the old target file.

0.3.101 renamed `client/tests/android-updater-100.test.mjs` to `android-updater-101.test.mjs`. On the real local overlay the old 0.3.100 test remained and still asserted `config.version === 0.3.100`, so `npm run verify` failed before the Windows native build could start.

## Changes

- Keep the Android Kotlin repair: `import app.tauri.plugin.JSObject`.
- Restore/overwrite `client/tests/android-updater-100.test.mjs` as a version-agnostic overlay compatibility test.
- Keep `android-updater-101.test.mjs`, updated for client 0.3.102.
- Add `tests/ziprunner-overlay-compat.test.mjs` so future packages cannot silently rely on file deletion for this path.
- Advance client/source package metadata to 0.3.102.
- Keep Social server release 0.3.99 and schema 11 unchanged.
- Preserve all 146 workboard items and operator statuses; `TAVI-UPDATES-003` remains Review.

## Verification expected

1. Apply the 0.3.102 ZIP over the current 0.3.100/failed-0.3.101 local checkout.
2. `npm run verify` must pass with both updater test paths present.
3. ZipRunner must continue to `node tools/auto-build.mjs` and build the Windows NSIS client.
4. Launch the Windows client and confirm it reports 0.3.102 before any Git push.
5. Only after local acceptance, push/review CI. Android CI must compile the corrected Kotlin updater.
6. Install signed 0.3.102 over the existing Android app without uninstalling; run updater self-test. Use a later signed 0.3.103 for the real in-app update test.

No Git push, release, server deployment, or operator acceptance is performed by this package.
