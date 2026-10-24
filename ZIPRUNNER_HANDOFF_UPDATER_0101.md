# Tavi 0.3.101 — Android updater Kotlin compilation repair

## Scope

Client-only repair of TAVI-UPDATES-003. The 0.3.100 Android GitHub build reached the generated Android project and failed Kotlin compilation because `TaviUpdaterPlugin.kt` imported `JSObject` from `app.tauri.JSObject` instead of Tauri's plugin package.

## Implemented

- Correct `tools/android-update/TaviUpdaterPlugin.kt` to `import app.tauri.plugin.JSObject`.
- Add Node and Python regression assertions that require the correct import and reject the old one.
- Advance Tavi client/source metadata to 0.3.101; keep Social server release `0.3.99` and schema `11`.
- Preserve the 0.3.100 PackageInstaller session, signed APK package/version/signature preflight, explicit Android user approval, non-installing self-test and privacy-safe diagnostics.
- Preserve all 146 operator workboard entries and keep `TAVI-UPDATES-003` in **Review**.

## Verification to run before operator acceptance

```text
npm run verify
npm run check:looprd
npm run extensions:check
node --test client/tests/android-updater-101.test.mjs
python -m unittest discover -s tests -p test_android_updater.py -v
```

The author environment does not provide a full Android SDK/Gradle native build. A successful source test does **not** prove the native APK compiles or installs.

## Operator / ZipRunner sequence

1. Import the exact 0.3.101 source ZIP into ZipRunner and let the normal local Windows build/launch workflow run.
2. Confirm the Windows client starts and the source/package version is 0.3.101.
3. Review and push only after local acceptance.
4. Require the exact pushed Android workflow to compile the APK successfully.
5. Install the signed 0.3.101 APK over the existing app without uninstalling, then run **Settings -> Android updater self-test**.
6. Use the next signed 0.3.102 publication for the real in-app 0.3.101 -> 0.3.102 update test; verify account/session data remains intact and test cancellation/permission paths.

No Git push, release, deployment, server schema change or operator acceptance is performed by this package.
