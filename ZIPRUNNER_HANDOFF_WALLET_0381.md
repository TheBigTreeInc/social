# Tavi 0.3.81 — Free Gold is for playing, never shopping

**Version:** Tavi/LoopRD Social source 0.3.81; first-party Wallet extension 0.2.0.

**Reason:** Prior v0.3.80 implementation made free Gold fully fungible, allowing item purchases and conversions from the refill. The v0.3.81 ledger fixes this **server-side**, preserving one Gold denomination with separately tracked `playOnly` and `availableForShopping` portions.

## Repaired behavior

- Welcome/refill grants only increase play-only Gold; refill remains repeatable when play-only funds fall below 100.
- Paid game entry charges play-only Gold first; free entries require no Gold; shop items require earned Gold.
- Conversion cannot spend play-only Gold. Refunds return the precise original funding class; older receipts are treated conservatively.
- Only an operator-allowlisted service principal can grant earned Gold, under per-event/per-player limits with replay protection. No end-user or remote extension can mint currency.
- Wallet first-party UI explicitly displays play-only and earned balances, restrictions and shopping/entry types; manifest 0.2.0 and SHA-pinned assets updated.

## Deployment/acceptance

- **New additive schema 12**: the operator must back up and stage any schema 11 data (and a direct schema 10 upgrade). Existing balances without provenance are restricted, not deleted or silently made shopping-eligible.
- Confirm `LOOPRD_TAVI_WALLET_MERCHANTS_JSON` and the **new** `LOOPRD_TAVI_WALLET_REWARDS_JSON` allow only intended service callers. Never put service secrets in source, ZIP or client.
- Run `python -m unittest discover -s tests -p test_wallet_ledger.py -q`, `python tools/generate-looprd.py --check`, `npm run verify`, and the normal ZipRunner package preflight.
- Check shop refusal using 100 only-free Gold, earned reward/merchant fulfillment, replay, exchange laundering, refunds, and actual Wallet UI on Windows/Android/Web.
- All 126 prior workboard tickets retain IDs, statuses and operator criteria; `TAVI-WALLET-081` is new **Review**, not Done. No Git push/release/deployment performed.

Detailed design and risk list: `docs/TAVI_GOLD_WALLET_PROTECTED_PLAY_CREDIT_0381.adoc`.
