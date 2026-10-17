# Android in-app APK update flow — 0.3.39

The Android release build is signed with the persistent GitHub Secrets keystore, and the official published APK asset is named `tavi-android-arm64-vX.Y.Z.apk`.

On launch / periodic check, the shared webview discovers the GitHub Release metadata. The UI passes only the **exact validated** official asset URL to an Android-specific Rust command and Kotlin plugin. The plugin independently validates the repository, tag and filename. It uses Android `DownloadManager` to download to app-owned external files, observes download completion and hands the resulting APK to Android's package installer via a scoped `FileProvider` URI. Android owns user approval and signing-certificate checks. The application neither silently installs nor bypasses platform permissions.

First installation from external sources may require enabling permission for Tavi to request package installations; if prompted to enable it, return to Tavi and select Update again. **Do not uninstall existing release-signed Tavi when applying a signed update.** Older debug-signed builds require a one-time migration to the persistent signing identity.

Security boundaries: no URL chosen outside the canonical GitHub Tavi release namespace; no arbitrary file paths; no credentials in the updater; no in-app APK execution; installation confirmation is mandatory. The release gate checks the signed artifact. The Android build fails if `tools/configure-android-updater.py` cannot patch its generated native project.

Required on-device acceptance: release-signed APK installation; version A -> B update with data preserved; first-time install permission flow; cancellation; offline / download failure; stale release; non-Tavi URL rejection; Android 13/14/15 notification and download receiver; certificate mismatch is rejected by Android. **CI source checks are not an on-device installation test.**
