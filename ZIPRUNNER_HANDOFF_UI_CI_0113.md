# Tavi 0.3.113 — Five-viewport App Store QA repair

## Scope

Only `looprd-social` is changed. This is a source test-harness and version/workboard correction: no Tavi production UI behavior, Atrium, Life, LoopRD server, schema, TaviX publisher assets or Android PackageInstaller code is modified. Import as a new version because ZipRunner does not re-import the same version.

## Observed failure on 0.3.112

- Git commit: `42b70b5aa1025ff7b5c38dfa7931b2819c04bfe1`.
- 7/8 exact-SHA push workflows passed, including Windows and Android.
- Browser UI QA failed on [run 40215255912](https://github.com/TheBigTreeInc/social/actions/runs/40215255912), job `121234892407`.
- All five viewports failed waiting for `#extension-repository-form input[name="repository"]` to become visible; it was intentionally hidden within `<details id="tavi-marketplace-repositories">`.
- The UI is correct: App Store 0.3.110+ starts repository diagnostics collapsed, with a visible Manage repositories control. The test was obsolete.

## Repair

`client/tools/ui-qa.mjs` clicks the existing `[data-marketplace-manage]` control; asserts diagnostics were initially collapsed, the URL input becomes visible, expanded content has no horizontal overflow, then closes it and continues Notepad install, permissions and Home navigation checks. `client/tests/ui-qa-store-selector-091.test.mjs` now guards this sequence.

## Verification

- Verified locally: `node --test client/tests/ui-qa-store-selector-091.test.mjs` (3 passed), Node syntax, ZipRunner workboard size and mandatory operator checks, descriptor unchanged.
- Needs operator/CI: `npm ci` and `npm --prefix client run ui:ci` with real Playwright Chromium, `npm run verify`, Windows NSIS and Android builds as configured, exact-SHA 8-workflow release gate, re-run ZipRunner post-update checks tied to **0.3.113 ZIP SHA**.
- Do not assume `Publish verified Tavi release` workflow's own `success` conclusion means a release was published: check its gate result and associated tag/release.
- Prior ZipRunner `not_github` and 7 stale `test-*` failures are evidence correlation, not proof of a source failure; do not rewrite historical results.
- Android internal updater bug `ZRB-9297228324E24D42` maps to the existing `TAVI-UPDATES-003` Review ticket; no behavioral repair is claimed here, and operator QA screenshots/logs are required before root-cause assertions.

## Workboard

The package carries all 154 prior ticket IDs unchanged and adds review ticket `TAVI-UI-CI-113` with operator checks. Do not mark any old ticket Done.
