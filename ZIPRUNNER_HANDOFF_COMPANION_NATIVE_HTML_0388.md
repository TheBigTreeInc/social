# Tavi 0.3.88 — Companion installation blocked by native HTML rewrite

## Operator report

On installed Windows Tavi 0.3.87, App Store → Companion 0.6.11 → Install displayed:

`Installation blocked: Extension asset size changed: ui/cat-study.html`

This is **new operator evidence**, not acceptance or CI proof. A read-only audit of the source ZIP found that the published Companion files have exactly the sizes and SHA-256 values claimed in `catalog.v1.json`; `extensions/registry.json` still pins the reviewed publisher digest `e979fd0c473167c64106fa59c45eae366692b6d2cf2d2ab0c3bcc0fdeb9b11a6`. This makes a native asset-serving/build-time modification more plausible than corrupted Companion source.

Tauri v2 can modify the CSP inside HTML assets at compile time. The old runtime compares the served HTML bytes to the original unmodified file size and SHA. An intentionally transformed HTML response therefore fails verification. The exact Windows binary was not available here to capture the modified response; this remains the hypothesis for native confirmation.

## Bounded source repair

- `tools/sync-internal-extensions.mjs` produces an additional `.html.bytes` sidecar for **each** bundled HTML file. Sidecars are byte-for-byte copies, transported as non-HTML resources so Tauri's HTML CSP processing does not transform them.
- `client/src/extensions/store.js` fetches the `.bytes` transport for HTML checksum validation. It still verifies **size and SHA-256**, fails closed on missing/tampered sidecars, does not downgrade checks, and never adds raw transports to the extension catalog or permissions.
- The **normal HTML** file is still the extension iframe entrypoint, with Tauri's normal CSP transformation and Tavi's opaque-origin `sandbox="allow-scripts"` (no `allow-same-origin`). All JS/CSS/image files continue to undergo normal digest verification.
- Source synchronizer `--check` compares both HTML and its raw transport against the canonical source. `.gitattributes` disables Git text conversion for the `.bytes` files. This is important for Windows checkouts.
- No Companion source, trusted publisher digest, wallet rules, LoopRD descriptor, database, stored private data or external registry is changed. These sidecars represent the already-approved original bytes and are not new privileges.

**Trust boundary:** Original HTML source bytes are authenticated from the transport mirror; the HTML served for rendering is the same bundled artifact after trusted native Tauri build-time processing. It is not a byte-for-byte verification of Tauri's postprocessed HTML response. The signed native build/runtime remains a trusted part of the chain. Native device inspection is required to validate this assumption.

## Validation and operator instructions

1. Import `looprd-social-0.3.88-companion-html-integrity-ziprunner.zip` into the existing ZipRunner project without deleting the installation or runtime settings.
2. Check `npm run verify`, `npm run extensions:check` and `node --test client/tests/extension-native-html-integrity-088.test.mjs`. The latter covers source equality, tampering, missing sidecar and simulated native HTML rewriting.
3. Complete the real Windows NSIS build and launch it. Install Companion 0.6.11 via App Store; confirm the original `ui/cat-study.html` error is gone and the painted Companion loads. Also install Notepad, save/reopen a note, open Wallet, visit My pet, and return Home.
4. Repeat the App Store, navigation, account isolation and privacy tests on Android and Web. Confirm the iframe has no same-origin grant and no Social token is shared.
5. Use exact-commit GitHub Actions results and fresh checks against **this** ZIP SHA. Keep existing 135 workboard tickets and the new TAVI-EXT-NATIVE-HTML-088 in Review pending operator acceptance. No automatic Git push/tag/release/server deployment.

## Separate existing issues

Do not conflate this native installation error with `TAVI-EXT-COMPANION-WINPATH-087` (Windows URL pathname/ENOENT) or `TAVI-UPDATES-003` (Android APK installer chooser failure). Those have their own operator checks and statuses.
