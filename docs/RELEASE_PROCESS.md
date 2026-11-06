# Tavi verification, candidate preparation and publication gates — 0.3.131

## Principle: a push is never a publication request

Development and CI are separate from distribution. A code push or pull request may
run the source tests, headless browser UI QA and Windows/Android/Linux/macOS builds.
Those runs produce *temporary CI artifacts*, not accepted releases. A green GitHub
workflow does not substitute for native device tests or ZipRunner/operator acceptance.

**No code in this package automatically creates a GitHub tag or Release.** A future
public release mechanism needs a separately reviewed implementation and explicit
operator authorization. The 0.3.130 and 0.3.131 ZIPs are local ZipRunner candidates.

## 1. Verify exact source (automatic CI, read-only)

Eight required push workflows must finish successfully on the **same current main
commit SHA**: source verification, Windows NSIS, Android signed ARM64 APK,
Linux/macOS installers, web client/JS SDK, SDK cross-platform checks,
SDK/OpenClaw source packages and five-viewport browser UI QA.

A PR run, tag run or manually triggered run is **not** substitute evidence for this
gate. Failed, cancelled, skipped, missing and in-progress jobs all block candidate
preparation. Latest attempts are authoritative. No published tag/deployment follows.

`client/tests/client-version-source-122.test.mjs` accepts LF or CRLF for Cargo.lock.
`client/tools/ui-qa.mjs` exercises the right-click/Shift+F10 Favorites context menu
instead of checking a removed star button. The fixes require remote GitHub CI
verification on a subsequent, separately approved push.

## 2. Prepare candidate (manual, read-only)

Manually run `.github/workflows/release.yml` (now **Prepare Tavi release candidate**)
with a **40-character current main SHA**. This is one manual workflow, not eight
independent workflow_run triggers. It has only `actions:read` and `contents:read`.
The gate `tools/release-gate.py` fails with a red job when required checks are not
successful. It refuses stale SHA, wrong checkout, non-stable version, missing/expired
artifacts and suspicious Android artifacts. Once all pass it downloads six original
build outputs, bundles them, generates `SHA256SUMS.txt` and `release-candidate.json`,
and uploads `tavi-candidate-<sha>` for review. It NEVER tags or publishes.

The JSON explicitly states `ci_passed_operator_unverified`, `operator_acceptance:
pending` and `publication_authorized: false`. This is not an update feed, a Release,
or proof that Windows/Android native behavior passed.

## 3. ZipRunner operator acceptance (outside GitHub)

Import the intended source ZIP into local ZipRunner, perform its configured tests,
then verify Windows and Android native behavior, including safe TaviX preview memory
use. Preserve local private config, databases, credentials and original extension
packages. Operator must explicitly accept the exact version/artifact digest. A
candidate failing any required check remains unapproved. Do not infer acceptance
from GitHub's successful candidate-artifact upload.

## 4. Optional external distribution

* **GitHub Releases:** intentionally DISABLED in this source package. Do not push,
  tag, or call `gh release create` automatically. Future public publication requires
  an explicitly approved design that checks the immutable candidate, ZipRunner
  acceptance, approval receipts, existing tags and artifact digests.
* **GitHub Pages:** `.github/workflows/pages.yml` is **manual-only**. There is no
  `push`, `tag` or `workflow_run` deployment trigger. To publish, an operator must
  manually provide the exact current main SHA and enter `PUBLISH-TAVI-WEB`;
  source checkout and all eight exact-SHA CI checks must pass again. The
  `github-pages` GitHub environment MUST have required reviewers configured
  in repository settings. Environment protection is a repository-side setting;
  merely naming the environment in YAML does **not** enable required reviewers.
  Until that configuration and operator acceptance exist, leave Pages unpublished.

Native updater manifests remain unchanged. No claim of signed macOS distribution,
Android in-app updater acceptance or public release is made by this revision.

## Operational checks

`python -m unittest discover -s tests -p test_release_gate.py -v` and
`npm run verify` validate the source-level candidate gate and UI contracts. Inspect
all actual GitHub Actions run logs for the new SHA separately; this archive cannot
prove CI results for a commit that has not been pushed. Native Windows/Android
visual and installer checks remain operator tasks.
