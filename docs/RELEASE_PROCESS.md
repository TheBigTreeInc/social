# Verified Tavi releases

Tavi releases are created from `main` automatically after seven required workflows succeed for the exact same current commit SHA: source verification, Windows NSIS, Android ARM64 debug APK, Linux/macOS installers, web client, SDK cross-platform checks and SDK/OpenClaw source packages.

`Publish verified Tavi release` listens to completed runs. It will **not** release when a workflow is missing, in progress, failed, cancelled, belongs to another SHA, or is a PR/manual run. It also skips outdated commits and refuses to replace an existing version tag. The root `package.json` version must be bumped for each new release.

Once all workflows pass, it downloads their verified artifacts, packages six release ZIP files, and creates `v<version>` and a GitHub Release under **Releases**. ZIPs contain the original build outputs (installer/APK/DMG/DEB/static web and SDK source bundles). The Android artifact is a debug APK; macOS DMG is unsigned until signing credentials are configured. No claim of production signing is made.

**Pages deployment is separate:** it requires GitHub Pages to be enabled in Settings → Pages → GitHub Actions. Its failure does not block downloading valid release artifacts.

**Operator acceptance:** push a bumped version; inspect all seven CI runs and the release workflow; verify `https://github.com/TheBigTreeInc/social/releases` contains the new tag and six downloadable assets. If a required workflow failed, fix the cause and push a new commit; do not manually create a release for failed builds.

The gate is implemented by `.github/workflows/release.yml` and `tools/release-gate.py`. It uses the standard `GITHUB_TOKEN` with Actions read and Contents write permissions. The repository must allow Actions to create releases.
