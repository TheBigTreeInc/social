# Android in-app APK update flow — Tavi 0.3.100

The Android build uses the persistent GitHub Release signing identity.
The **only accepted download URL** is the canonical version-matched APK from
`TheBigTreeInc/social`. Rust restricts invocation to the native Tavi main
window and the Android Kotlin plugin validates the URL again before downloads.

`DownloadManager` downloads the official APK to Tavi-owned storage; the updater
parses its package ID, version, and signing identity against installed Tavi.
Real updates require a greater Android `versionCode`. The verified APK is
staged using Android `PackageInstaller.Session`, **not** `ACTION_VIEW`.
Android shows its required install-permission and user-approval steps; no
silent installation occurs. The callback is an explicit, non-exported Android
BroadcastReceiver so it works with Android 14+ and can persist status after
activity recreation. Version 0.3.100 retains the same app ID and automatically
increasing semver-derived Android versionCode as 0.3.99.

## Fast non-installing phone test

In Android Tavi go to **Settings → Android updater & self-test → Test updater**.
The test downloads and checks the latest official signed APK, then discards
it **without installing**, even when its version is equal to/older than the
installed version. Check status or copy sanitized diagnostics. This is a
metadata/signing identity preflight, not an on-device installation guarantee.
Run after installing 0.3.100 manually once. Then publish a later signed
0.3.101 to test actual in-app 0.3.100→0.3.101 updating.

An app using a different signing identity (for example a debug APK) cannot
replace a release-signed version. **Never uninstall the installed Tavi app as
a test shortcut**, as app data may be lost. Back up data before any intentional
signing-key migration.

## Limitations and operator acceptance

A dynamically registered DownloadManager completion listener expects Tavi to
remain alive for the download; a future persistent download receiver is
appropriate if background process-death recovery is required. The OS installer
itself uses a persistent explicit callback. Settings provides **Refresh status**
if Tauri native plugin events are unavailable on a device. The operator must
validate permission denied/enabled, user cancellation, network failure, missing
storage, signed consecutive versions, data persistence, and device Android
version compatibility. Source tests and GitHub-signed build success are not
physical-device acceptance.

No LoopRD descriptor, wallet or Companion publisher change is necessary.
Further acceptance and instructions: `docs/ANDROID_UPDATER_SELF_TEST_0100.md`.
