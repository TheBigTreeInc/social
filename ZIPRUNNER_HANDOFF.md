# Tavi 0.3.175 — GitHub browser QA unblocker

Base: 0.3.174. Fix Playwright strict-mode locator in five-viewport unified Store browser QA, add regression test and release/owner publication notes. Source-only, release candidate not yet operator accepted. Do not push/tag/release/deploy without explicit ZipRunner gates.

Exact-commit requirements after an approved push: Verify Social server and client source, Windows desktop app (NSIS artifact), Android phone app (signed APK), Tavi browser UI QA. Use the existing read-only `Prepare Tavi release candidate` workflow with scope `windows-android`; inspect SHA-256 and perform Windows/Android acceptance. Only then use the distinct `Publish approved Tavi release` workflow with the exact candidate run ID, operator acceptance reference, explicit publication confirmation and configured protected GitHub environment.

Klondike publication is owned by TaviX/official repository publisher and not implemented in this ZIP. Never expose an unreviewed sideloaded package in public discovery or bypass explicit installation/permission approval.
