# Tavi 0.3.55 — Classic roster Home with green colors and raised circle dock

Project: looprd-social. Version: **0.3.55**, base version: 0.3.54. Change: restore old dense messenger roster to Home, use forest/sage colors and retain approved v0.3.54 circular dock.

Files changed: `client/src/main.js`, `client/src/style.css`, new `client/tests/classic-home-restoration.test.mjs`, new `docs/TAVI_CLASSIC_HOME_0355.adoc`, version-bearing source/manifest/workboard/verification plan. Existing operator ticket statuses and criteria remain unchanged. Added planned `TAVI-UX-055` for operator visual acceptance.

No deployment, Git push, server migration, active ZipRunner config, .env or private data. Social server remains v0.3.48 / schema 10. Preserve generated native build outputs on target.

Acceptance is **pending on actual Windows NSIS/Android builds**, even when source and exact-ZIP tests pass. The Android updater bug remains open under `TAVI-UPDATES-003`.
