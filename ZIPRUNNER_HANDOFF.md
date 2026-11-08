# looprd-social 0.3.151 — operator-approved GitHub release publication

Base: 0.3.150. Adds `.github/workflows/publish-approved-release.yml` and `tools/publish-approved-release.py` for manually authorized Windows/Android installer publication. Verifies exact candidate run, commit, version, checksums and original installer ZIP bytes. Appends missing EXE/APK, two ZIP bundles and SHA256SUMS to a matching existing release (including `v0.3.150` once accepted); refuses mismatched tag or conflicting files. New releases require the candidate commit to be current main. Candidate preparation remains read-only; no automatic push, tag, release or deployment. Configure GitHub `tavi-public-release` environment reviewers and record ZipRunner acceptance before running the manual publish workflow. See `docs/TAVI_APPROVED_RELEASE_PUBLICATION_0151.adoc`.

Source regression and test evidence must be reported separately from Windows/Android operator acceptance and real GitHub publication.

# looprd-social 0.3.150 — Windows + signed Android candidate first

Base: 0.3.149. Introduced an explicitly scoped, manual `windows-android` release-candidate workflow requiring four exact-commit successful push workflows (source, Windows, Android, browser UI QA). It packages two installer ZIPs and direct Windows EXE + Android APK with checksums and review-only metadata. The original eight-workflow `full` profile remains available for later Linux/macOS/SDK delivery. No automatic push, GitHub tag, release publication or LoopRD deployment. See `docs/TAVI_WINDOWS_ANDROID_CANDIDATE_0150.adoc`.

Local tests and native acceptance must be reported separately; real GitHub runs for the **next** pushed commit are pending.

# looprd-social 0.3.149 — Notepad Back browser QA repair

Base: 0.3.148. The App Store was reopened through Settings > App sources before installing and launching Notepad. Back from Notepad returns to App Store, and Back from that App Store correctly returns to Settings, not Apps. The old browser QA asserted Apps. This patch verifies Settings as the parent and the direct Home tab; it does not change the user's navigation, release permissions, or server behavior.

Tests: full local Node source suite 14 server + 438 client + 30 OpenClaw passed; package and LoopRD descriptor checks passed. Real Playwright/Chromium five-viewport run has NOT been executed here because playwright-core is unavailable in the container; ZipRunner CI-parity prebuild must run it. Native Windows/Android and operator acceptance remain pending. No push/deploy/release.

# looprd-social 0.3.148 — CI browser QA repair

Base: 0.3.147. Fix: scope App Store action to active All tab in `client/tools/ui-qa.mjs` and add `client/tests/ui-qa-app-store-tab-148.test.mjs` regression. Keep existing operator/CI/release gates; no server migration or runtime change in this repair.

Source verification: npm run verify passed. Real five-viewport browser QA is pending because the npm package cache here does not contain Vite / Playwright; run the ZipRunner parity gate on Windows. No Git push or publication performed.

# looprd-social 0.3.147 — CI parity and test repairs

Source based on 0.3.146. Fixes brittle Cargo.lock native picker test and ambiguous Playwright menu-item locator. ZipRunner prebuild now runs project-owned CI-parity plan (root JS, full Python, browser five viewport smoke), recording evidence in ignored qa-artifacts/ci-parity. Browser dependencies and Chrome must exist on operator host; no missing check is treated as a pass. Release and operator gates unchanged.

## 0.3.152 — LoopRD specification validation repair

The LoopRD 0.3.123 parent descriptor now lists the three non-editable `reset-companion` write fields under operator management. `tools/looprd_management_preflight.py` and `tests/test_looprd_management_contract_152.py` detect the prior root-level `value_error` at source/build time. SchemaVersion 13 and user data remain unchanged. This is a **server spec change** requiring exact-runtime LoopRD validation and separate operator approval; the 0.3.151 Windows/Android release publication approval gate is preserved. See `docs/TAVI_LOOPRD_SPECIFICATION_VALIDATION_0152.adoc`.
