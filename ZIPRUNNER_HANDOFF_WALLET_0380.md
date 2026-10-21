# Tavi 0.3.80 — Gold Wallet core extension + Social Ledger stage

- Source package over installed 0.3.79; all 123 latest operator workboard tickets preserved by ID/status/priority/criteria, 3 Wallet tickets added.
- First-party bundled `org.tavi.core.wallet` UI, optional user installation from App Store, Wallet shortcut in main app launcher, no Social token in sandbox.
- Gold: one-time 100 welcome grant; refill to exactly 100 on demand after spending; free game entries allowed; operator-priced game fees, item purchases, optional exact two-way currency policies; history and pending game fulfillment.
- Transactional balance/ledger/order tables in additive **Social SQLite schema 11**; this is *not* a client-only change. Back up and review DB 10→11 before deploying a regenerated `looprd.yaml`.
- User wallet route and verified service-only merchant route do not allow arbitrary client minting/charging. Game delivery is NOT assumed from wallet payment alone.
- Strict digest/idempotency and server price/rate quote review. Verified same-account Social session via existing LoopRD verifier. No fiat, cashout, deposits or real-money conversion.
- `docs/TAVI_GOLD_WALLET_CORE_0380.adoc` documents server config, contracts, migration, acceptance and future standalone Ledger extraction.
- No live DB migration, native hardware test, Git push, release or deployment performed by package author.
