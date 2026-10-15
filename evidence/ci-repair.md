# Native CI failure diagnosis and repair (2026-10-15)

Source validation: https://github.com/TheBigTreeInc/social/actions/runs/38778840781 — success.
Windows build: https://github.com/TheBigTreeInc/social/actions/runs/38778840719 — failed
at `client/tools/check-package.mjs:25` due to a byte-exact generated LoopRD descriptor SHA-256
mismatch: committed link `a62267af...` versus CRLF checkout `8a97bed1...`.
The Linux source workflow passed because its checkout retained LF. Add explicit
`*.yaml text eol=lf` to `.gitattributes` so Git for Windows retains authoritative descriptor bytes.
Package check now explicitly diagnoses CR bytes before checking the SHA.

Android build: https://github.com/TheBigTreeInc/social/actions/runs/38778840452 — failed
in `android-actions/setup-android@v3` at `sdkmanager tools`, with "Failed to find
package 'tools'". In v3 the action default packages are `tools platform-tools`.
The supported v4 action defaults to `platform-tools` and its v4.0.4 revision was
verified at `https://github.com/android-actions/setup-android/releases/tag/v4.0.4`.
Explicitly specify `packages: platform-tools` to prevent deprecated package regressions.

No native NSIS or Android APK compilation occurred during the failed runs, so there may
be additional issues after these first blockers are cleared. Fresh Actions builds and
physical device acceptance remain outstanding; do not report installer/APK success.
LoopRD SQLite schema and handler logic are unchanged; the generated release marker increments to 0.2.3.

## Executed repair checks

- 11/11 Node source tests passed.
- 7/7 Python unit tests passed.
- Descriptor generation check passed.
- Package consistency check passed.
- Local Git fixture with `core.autocrlf=true` and `.gitattributes` yielded identical LoopRD descriptor bytes.
- GitHub native Windows and Android builds remain not run with the repair.
