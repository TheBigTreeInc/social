# Android signed releases and update flow — v0.3.33

## Signing configuration (required once)

Create a long-lived Android release keystore **offline**, and back it up securely. Set GitHub Actions repository secrets:

- `TAVI_ANDROID_KEYSTORE_B64`: base64 of the entire JKS file (one line)
- `TAVI_ANDROID_KEYSTORE_PASSWORD`: keystore password
- `TAVI_ANDROID_KEY_ALIAS`: alias of signing key
- `TAVI_ANDROID_KEY_PASSWORD`: key password

Do not regenerate these for each version: the same signing certificate and Android application identifier `inc.thebigtree.looprdsocial` are required for upgrades. Never commit the keystore. Rotate only with a deliberate migration plan.

The Android workflow builds release APKs on main using Tauri and Gradle, fails closed if secrets are absent, and builds debug APKs only on pull requests. The verified release gate requires the signed artifact and publishes `tavi-android-arm64-v<version>.apk` directly alongside ZIP bundles and SHA256SUMS.

## User behavior

Tavi discovers the latest stable release through the official GitHub API. On Android, the Update action opens the exact direct APK asset URL (not a generic release page); the OS/browser download flow takes over. The user must then approve Android's installer prompt, and Android validates that the package identifier and signing certificate match the installed application. The user can choose Not now to hide a version's reminder. A new version gets a new notice.

**Not yet a fully integrated in-app downloader or package-installer bridge.** The Android download is handed to the system/browser, not downloaded to app-private storage and passed to Android PackageInstaller by Tavi. An Android native update adapter is the next pass to remove the remaining Downloads/installer handoff. The update cannot be silent on an ordinary personal Android device.

**Migration caveat:** previous debug APKs are signed with debug certificates. Android will not upgrade an existing debug-signed installation with a release-signed APK. Users must uninstall the debug app once (export anything local first) before installing the first signed release. Subsequent releases signed by the same key should install as upgrades without uninstalling. Do not claim the first migration preserves local app data.
