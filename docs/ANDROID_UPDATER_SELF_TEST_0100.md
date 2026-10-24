# Android official APK updater — Tavi 0.3.100 (TAVI-UPDATES-003)

## What changed

The legacy DownloadManager → `ACTION_VIEW` file handler is replaced by
DownloadManager → native verified APK → Android `PackageInstaller.Session`.
No external APK/file chooser is used and no silent install is attempted.
Android's mandatory installation approval remains in place.

The native updater independently checks the official versioned GitHub release
asset URL, downloaded file size, `packageName`, `versionName`, signing
certificate compatibility with the installed Tavi, and a strictly greater
Android `versionCode` for actual updates. Tauri generates Android version codes
from semver (`major*1000000 + minor*1000 + patch`) without a manual override.
APK signing and source identity are verified on the phone before requesting
installation. This is not a replacement for Android's platform signature check.

The self-test in **Settings → Android updater & self-test** downloads the latest
published release APK, performs the package/signature checks, deletes the
verification download, and DOES NOT call PackageInstaller. Thus installing the
0.3.100 update manually one time is enough to run the self-test on the phone.
The latest official release can be the same or older than installed Tavi for
self-test; only an actual update requires a greater versionCode.

Stages: `downloading` → `verifying` → `verified` (self-test) or
`install_pending` → `awaiting_approval` → `installed` (real update).
Errors have bounded safe codes, such as `signature_mismatch`, `download`,
`unknown_sources`, `not_newer`, `permission_screen`, `installer_session`,
`blocked`, `cancelled`, or `storage`. No Social session, username or URLs are
included in the diagnostics. Settings includes **Refresh status** in case
native plugin events do not arrive on the current Android/Tauri runtime.

## Easiest real-phone acceptance sequence

1. Back up any irreplaceable local data and confirm you are currently on a
   release-signed Tavi APK; do **not** uninstall Tavi to test updates.
2. Apply **0.3.100** using the official release APK if already published.
3. Open Settings → Android updater & self-test → **Test updater**.
   Ensure the download completes and reports `verified`. No Android install
   confirmation should appear. Copy updater diagnostics if it fails.
4. After an operator-approved **0.3.101** signed release is published, tap the
   regular Tavi update action. Check progress in Settings, approve Android's
   system installer, and reopen Tavi to check version and existing data.
5. Run the same flow with unknown-sources permission off, cancellation,
   network interruption, and low storage (on a disposable/test phone only).
   Copy only privacy-safe updater diagnostics and, if needed, sanitized logcat.

## Limitations and safe fallbacks

- CI source tests and Android compilation do **not** prove on-device
  installation; signature-compatible 0.3.100→0.3.101 device acceptance remains
  a Review gate.
- A debug-signed build cannot silently replace a release-signed install.
  A self-test reports `signature_mismatch` if installed and published signers
  differ. Do not uninstall to work around it without an explicit data backup.
- The dynamically registered DownloadManager completion listener needs Tavi
  alive during the download. The explicit manifest-installed PackageInstaller
  callback survives activity recreation, but full force-kill/reboot recovery
  still needs real-device testing. Refresh status after returning to the app.
- No release is pushed or deployed by this package.
- LoopRD schema and Companion/Wallet assets are unchanged.
