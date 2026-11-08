# LoopRD Social 0.3.141 — exact-source cross-project tests

Reviewed upload hashes are recorded in the final ZIPRUNNER_HANDOFF block. Inputs: `looprd-social-0.3.140-ziprunner (1).zip`, `atrium-0.5.77-ziprunner.zip`, `tavix-0.1.10-game-classification-ziprunner(1).zip`, `tavi-assets-0.1.7-ziprunner.zip`.

## Verified source evidence

- `node --test client/tests/tavi-shared-services-141.test.mjs`: 8 / 8 passing (real Social host and SDK transport, authorization, inventory, stale requests, grant-bound Assets 0.1.7 calls).
- `node --test client/tests/tavix-game-classification-139.test.mjs`: classified game manifest compatibility; optional app-launcher independent game inventory covered.
- `npm run verify`: full Social Node server, client, OpenClaw and package checks passed after adjusting ZipRunner workboard/post-update metadata limits.
- `python -m unittest discover -s tests -p test_atrium_catalog.py -q`: 9 / 9 passed.
- `python -m unittest discover -s tests -p test_tavix_package.py -q`: 2 / 2 passed.
- `python tools/generate-looprd.py --check`: Social/Wallet descriptors in sync.
- Cross-source ESM smoke with actual Atrium 0.5.77 `installedGamesClient/openInstalledGame`, actual Assets 0.1.7 `AssetService`, `MemoryAssetStorage`, `TrustedAssetHostBridge`, source Social 0.3.141 host and SDK: passed with explicit **fixture-only** packs and grants.

## Not verified / must remain gated

- `npm --prefix client run web:build` is blocked here because Vite is not installed (`sh: vite: not found`); bundled source ZIP intentionally omits `node_modules`. No native Windows or Android toolchain acceptance was performed.
- The full `python -m unittest discover -s tests -p 'test_*.py' -q` run did not complete in the session timeout; the targeted Python suites listed above passed. Do not claim full Python coverage.
- Production Assets runtime and grants are not attached in `client/src/main.js`. No catalog install, Gold purchase or real entitlement test has run.
- Actual sideloaded classified Klondike, updated Atrium embedded developer extension, two-account active session, Windows and Android device and browser GUI end-to-end checks remain with the operator.
- No Git push, release, publication, server deploy or DB migration was performed or approved.

## ZipRunner metadata note

The preexisting `ziprunner-manifest.json` planned-work and done/todo sets were inconsistent. Added missing record references only; existing statuses, permissions, private project files, release approval and operator gates were not closed or changed. The workboard update was already within ~100 bytes of the 256 KiB limit; no new items were appended to that separate file. The new source work is tracked in the manifest and `ziprunner-verification-plan.json`.
