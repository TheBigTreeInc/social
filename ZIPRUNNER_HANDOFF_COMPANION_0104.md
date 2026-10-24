# Tavi 0.3.104 — Companion 0.6.27 reviewed bundle refresh

## Scope

Tavi 0.3.104 refreshes the reviewed bundled-partner Companion from 0.6.11 to independently supplied Tavi Companion 0.6.27. The Companion source was tested and transformed with its own `npm run tavi:bundle`, then staged using Tavi's canonical `tools/import-reviewed-extension.mjs` dry-run and apply paths.

This pass is client/source packaging only. Social remains release 0.3.103 with database schema 12 from the messenger receipt pass. No new database migration, server deployment, Git push or release is performed by this package.

## Reviewed Companion identity

- Extension ID: `org.tavi.community.companion`
- Publisher: `tavi-community`
- Version: `0.6.27`
- Reviewed catalog digest: `f1bf1db6276641f7b19c8ca6bcfd814e8aedc8a903d022bff6fbd0662d280844`
- Permissions remain exactly: `ui.panel`, `ui.toast`, `storage.private`
- Platforms remain: Web, Windows, Android
- Official Tavi bundle contains 18 supported assets.
- Companion 0.6.27 source tests: 131 passed before integration.

## What 0.6.27 changes

The supplied Companion 0.6.27 release is the continuous cave visual/scale pass. Tavi's reviewed snapshot now contains the 0.6.27 cave UI, Cat/Unicorn runtime bundle and generated static assets. Tavi still owns host navigation, sandboxing, installation consent, account scoping and the top-right Companion preview.

## Cloud persistence boundary

Companion 0.6.27 contains a future server-authoritative save design, but Tavi 0.3.104 does not yet implement the required reviewed `companion.get` / `companion.put` host methods, authenticated Social CAS storage, Companion-specific schema migration or operator reset action.

Do not interpret this source import as proof of cross-device/server-owned Companion persistence. Local/private extension behavior remains available through the existing host contract; server-owned Companion save/reset must be implemented and accepted as a separate Tavi/LoopRD pass.

## Android updater preservation

The native updater implementation is unchanged from Tavi 0.3.103:

- `tools/android-update/TaviUpdaterPlugin.kt` — byte-identical
- `tools/android-update/TaviInstallResultReceiver.kt` — byte-identical
- `tools/configure-android-updater.py` — byte-identical
- `PackageInstaller.Session` remains the installation path.
- APK package/version/signing-certificate validation remains required.
- The non-installing updater self-test remains available.
- ZipRunner non-destructive overlay regression coverage remains included.

Tavi package/client version is 0.3.104, so after Windows acceptance and an operator-approved signed Android build, the updater should be tested as an in-app update to signed 0.3.104 from the previously accepted signed Tavi build. Preserve application data and remembered account/session state.

## Source verification

Required source checks for this exact candidate:

- `npm run verify`
- `python -m unittest discover -s tests -v`
- `python tools/generate-looprd.py --check`
- `npm run extensions:check`
- `node --test client/tests/companion-027-integration-104.test.mjs`
- `node --test client/tests/android-updater-100.test.mjs client/tests/android-updater-101.test.mjs client/tests/message-receipts-103.test.mjs tests/ziprunner-overlay-compat.test.mjs`
- `python -m unittest discover -s tests -p test_android_updater.py -v`

The exact 147 pre-existing workboard items must remain unchanged. `TAVI-EXT-COMPANION-104` is the only new Review candidate.

## Operator acceptance

1. Import the exact 0.3.104 ZIP into ZipRunner and require the normal Windows verification, NSIS build and Tavi launch.
2. Open App Store / Companion and verify the installed reviewed extension reports 0.6.27 and the expected publisher.
3. Verify Cat/Unicorn cave rendering, top-right Companion portrait, Home/Back navigation and account isolation on Windows.
4. Repeat Companion UI checks on Android. Do not claim server-owned Companion persistence from this test.
5. Confirm messenger 0.3.103 receipt functionality still works against deployed Social 0.3.103/schema 12.
6. After operator-approved push, require exact-SHA Windows/Web/Android CI.
7. Use the installed signed Tavi build to update in-app to signed 0.3.104. Confirm PackageInstaller flow, user approval, remembered account/session preservation and updater self-test.
8. Keep `TAVI-EXT-COMPANION-104`, `TAVI-CHAT-004` and `TAVI-UPDATES-003` in Review until their respective native/live checks pass.
