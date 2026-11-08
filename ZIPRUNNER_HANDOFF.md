# looprd-social 0.3.147 — CI parity and test repairs

Source based on 0.3.146. Fixes brittle Cargo.lock native picker test and ambiguous Playwright menu-item locator. ZipRunner prebuild now runs project-owned CI-parity plan (root JS, full Python, browser five viewport smoke), recording evidence in ignored qa-artifacts/ci-parity. Browser dependencies and Chrome must exist on operator host; no missing check is treated as a pass. Release and operator gates unchanged.
