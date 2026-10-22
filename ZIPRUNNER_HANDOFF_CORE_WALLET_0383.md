# Tavi 0.3.83 — Core Wallet, clickable profile Gold balance

## What changed

* Wallet is an always-on, first-party Tavi extension. It never requires an App Store installation, update approval, enable/disable or remove; optional apps remain explicitly installed.
* Main Menu still shows Wallet. The classic profile line under the signed-in name now shows `100 Gold` (actual server balance) rather than the internal `acct_N · hostname`. The balance is a clickable button and opens Wallet immediately, with Home available from both toolbars.
* Signed-in account ID and server URL remain accessible through **Settings**, not in the limited roster profile.
* On initial sign-in, the line shows `Gold · loading…` until the authenticated Wallet API responds; if the service is unavailable it says `Gold unavailable` rather than inventing free credit. It refreshes on sign-in, focus, periodic sync and balance-changing Wallet actions. No data is persisted in the profile.
* Core Wallet uses the **bundled manifest and SHA-256 verification** and retains sandboxed `allow-scripts` only; the Social bearer never enters the iframe. Remote repositories cannot replace it. Legacy per-user installed/disabled Wallet records are intentionally ignored.
* Wallet ledger rules, Gold funding classes, server APIs, schema-11 database, game purchase authorization, and experimental pre-launch fresh-start policy are unchanged.

## Acceptance

1. Import the versioned 0.3.83 source ZIP through ZipRunner; confirm preflight and source tests pass. Historical **129 tickets** and all their operator decisions/criteria must be intact, plus the new Review ticket `TAVI-WALLET-CORE-083`.
2. Check the requested profile placement at desktop 355 px, Android 320/390 px and tablet. Tap or keyboard-activate the Gold line, verify Wallet opens *without* App Store or installation, and return Home.
3. Check App Store still installs Private Notepad through approval; Wallet has no install, disable or remove controls. Existing optional extensions still work.
4. Use a real server with Wallet schema 11: Gold reflects actual authenticated balance and changes after a Wallet refill; use an unsupported server to verify `Gold unavailable` (not 0/100).
5. Verify real Windows WebView2/physical Android acceptance, exact push-commit GitHub workflows, safe areas and separate chat windows. Do **not** mark Done solely on source tests.
6. No Git push, production migration, database reset or release performed by this source package.

## Boundaries

This update is client-side behavior plus a release stamp on the unchanged Social handler. The Wallet server itself must already be deployed to show an amount; Tavi cannot manufacture an account balance from the refill policy. Older experimental database schema-12 deployments are **not** automatically migrated or downgraded by the ZipRunner package.
