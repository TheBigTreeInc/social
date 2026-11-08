# looprd-social 0.3.148 — CI browser QA repair

Base: 0.3.147. Fix: scope App Store action to active All tab in `client/tools/ui-qa.mjs` and add `client/tests/ui-qa-app-store-tab-148.test.mjs` regression. Keep existing operator/CI/release gates; no server migration or runtime change in this repair.

Source verification: npm run verify passed. Real five-viewport browser QA is pending because the npm package cache here does not contain Vite / Playwright; run the ZipRunner parity gate on Windows. No Git push or publication performed.

# looprd-social 0.3.147 — CI parity and test repairs

Source based on 0.3.146. Fixes brittle Cargo.lock native picker test and ambiguous Playwright menu-item locator. ZipRunner prebuild now runs project-owned CI-parity plan (root JS, full Python, browser five viewport smoke), recording evidence in ignored qa-artifacts/ci-parity. Browser dependencies and Chrome must exist on operator host; no missing check is treated as a pass. Release and operator gates unchanged.
