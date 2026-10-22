# Tavi 0.3.91 — Browser App Store QA selector repair

Fixes five-viewport `ui:ci` Playwright strict-mode failures in v0.3.90 by selecting the optional Private Notepad App Store card via its stable extension ID. Does not remove Companion or change the App Store. Details in `ZIPRUNNER_HANDOFF_UI_STORE_QA_0391.md`. Ledger source from v0.3.89, preflight checks from v0.3.90, Social release 0.3.83/schema 11 and native Android updater remain unchanged. Device and exact-commit QA require operator acceptance; do not auto-push, deploy or mark Done.
