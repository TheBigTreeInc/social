# Tavi 0.3.174 — native-feeling Store interactions (source candidate)

Base: 0.3.173. This ZIP adjusts only Tavi's first-party Store UI and source metadata. It does not alter LoopRD, TaviX package permissions, asset grants, Wallet or user data.

* Pull down from the top of the Store listing to refresh TaviX and Tavi Assets catalogs. A bottom Refresh catalog action is retained for mouse/keyboard accessibility.
* Four category buttons fit at 355px; the profile avatar no longer has a thick green frame.
* Tap/click an app/game icon or title to open its details. A distinct Open/Install/Update action is available only when authorized by the existing installation state. Direct Install still opens Tavi's publisher and permission approval.
* Asset card art/name opens details. Verified free bundled packs offer an Install action through the existing host-owned consent dialog. Unverified remote packs never offer a Gold charge or install.

See docs/TAVI_STORE_TOUCH_INTERACTIONS_0174.adoc and client/tests/storefront-touch-174.test.mjs.

Known independent gates: the 0.3.173 ZipRunner report identifies 7 failed post-update checks, stale/other-ZIP verification data and missing exact-commit CI. The operator's local Workboard has 239 tickets; this source ZIP does not overwrite operator decisions or mark completed work Done. Native Windows/Android tests, publication, push and release remain unapproved.

**Workboard safety:** `.ziprunner-workboard-update.json` contains only two new 0.3.174 IDs. The 0.3.173 source Workboard update is preserved byte-for-byte in `docs/qa/workboard-0.3.173-source-snapshot.json`. Import must not overwrite the local 239-ticket operator Workboard or mark any old ticket complete.
