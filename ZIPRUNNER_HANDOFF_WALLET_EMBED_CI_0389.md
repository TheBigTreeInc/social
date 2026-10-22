# Tavi 0.3.89 — Wallet embedded source ownership + GitHub CI repair

## Changes

- Canonical Wallet backend moved (same bytes) from `server/wallet_ledger.py` to `extensions/org.tavi.core.wallet/looprd/wallet_ledger.py`; `server/wallet_ledger.py` becomes a thin import adapter for non-deleting ZipRunner overlays.
- `tools/generate-looprd.py` embeds that code into the **existing** `looprd-social` component with a checked `backend.json` ownership contract.
- Existing `looprd.yaml`, release `0.3.83`, Social realm, routes, schema 11, Wallet tables, receipts and persistence semantics are **unchanged**. No second Ledger instance/database/service or migration has been deployed.
- Explicit Git byte preservation for Companion 0.6.11 `ui/studio-main.js` and `ui/world-main.js` and their static mirrors. Those files contain one CRLF each; `.gitattributes` previously normalized the bytes in GitHub, causing the 0.3.88 exact-commit source/Android/web/Windows UI workflows to fail with `Reviewed partner bundle integrity changed` before APK compilation. Reviewed partner digest/publisher are unchanged.
- Existing Android updater plugin is not changed. TAVI-UPDATES-003 and its on-device install/chooser issue are still Review.

## Check before handoff

`python tools/generate-looprd.py --check`

`python -m unittest discover -s tests -p test_wallet_extension_embedding.py -v`

`python -m unittest discover -s tests -p test_wallet_ledger.py -q`

`node --test client/tests/reviewed-partner-git-integrity-089.test.mjs`

`npm run extensions:check && npm run verify`

## Operator deployment

1. Import full Tavi 0.3.89 source ZIP into ZipRunner; run source/native builds and check Work board reconciliation. Preserve all pre-existing ticket IDs/statuses/operator decisions.
2. If Git diff is approved, push after confirming CRLF-protected JS files changed in Git blob; verify all required workflows on the exact **new** commit SHA. Do not count partial release-gate workflow successes as full CI.
3. Back up the running LoopRD Social DB; check deployed `/info`, release `0.3.83`, schema 11 and authenticated Wallet route. Reconcile existing descriptor only if required. Never blindly import duplicate Ledger or downgrade schema 12. Account balances, earned/free classes, orders, refunds and ID uniqueness must survive.
4. Test protected Wallet behavior from two accounts on Web, Windows and Android, plus service-only caller restrictions; separate merchant delivery acceptance still required.
5. Android native updater: verify signed APK A→B installation with data preserved, permissions, downloads, cancelled/failed flow, mismatch rejection on real hardware. Gather sanitized Android installer/DownloadManager logs for `TAVI-UPDATES-003`; current GitHub CI red from publisher assets is a separate precursor bug.

## Not changed

Social database schema/version, authentication, API contracts, client Wallet grants, Companion bundle digest/identity, Notepad, Atrium/Life. No auto Git push/release/deploy. Standalone Ledger component `TAVI-WALLET-SPLIT-082` remains planned, NOT Done.
