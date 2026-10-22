# Tavi 0.3.91 — App Store Chromium QA strict-mode repair

## Observed problem

The v0.3.90 `npm --prefix client run ui:ci` browser build passed Vite, then failed at stage `app-store` across five Chromium viewports: desktop, tablet, compact-355, mobile-390, mobile-320.

The test `await visible(page,'.tavi-store-item')` was ambiguous after the App Store correctly rendered two entries: Private Notepad and Companion. Playwright's strict-mode locator must match one element. This is a **test selector defect**, not evidence that the App Store should display only one application.

## Repair

- Select `data-extension-install="org.tavi.examples.notepad"` and wait for that unique control.
- Filter `.tavi-store-item` by that scoped control and require exactly one Notepad card; verify its title.
- Keep App Store's actual two-card functionality and the existing cancellation, approval, launch, Wallet-is-core, return-Home and five-viewport tests.
- Add `client/tests/ui-qa-store-selector-091.test.mjs` source regressions and include it in post-update QA, without increasing the 20-test ZipRunner cap.
- Version all Tavi client and ZipRunner package metadata to 0.3.91. Preserve existing 138 operator workboard tickets verbatim and add TAVI-UI-STORE-QA-091 in Review with five mandatory operator checks.
- Keep the main LoopRD Social backend at release 0.3.83/schema 11. No API, database, Wallet rules, registry, static extension bundle, Companion digest, or Android update behavior changes.

## Test scope

Run:

```
node --test client/tests/ui-qa-store-selector-091.test.mjs
npm run verify
npm run extensions:check
python tools/generate-looprd.py --check
npm --prefix client run ui:ci
```

The last command requires installed Vite, Playwright and Chromium. Source-only tests and Vite build do not prove that actual Chromium browser QA passes. Verify all five viewports on the **exact pushed commit** before approving release.

### Operator acceptance

1. Import exact new v0.3.91 ZIP through ZipRunner. Confirm workboard preflight accepts 139 records with 138 historical records unaltered.
2. Verify native Windows build completes and no Runtime/Private data was overwritten.
3. Confirm the App Store shows both Notepad and Companion; Notepad install Cancel, Install, Open and Home navigation work in Chromium and ideally real Windows/Android.
4. Confirm the GitHub exact-commit `ui-qa.yml` and required verification/Android workflows finish successfully. No automatic push or release is authorized.
5. Continue Android `TAVI-UPDATES-003` separately: a green Android build is not proof of APK in-app update success on a real phone.
