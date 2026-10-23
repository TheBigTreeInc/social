# Tavi 0.3.99 — LRS-004 account recovery hardening

Date: 2026-10-23 (Europe/Amsterdam)

## What is implemented

- Recovery codes were already implemented in Social schema 9: eight random one-time codes stored hashed, 180-day expiry, password-confirmed creation/rotation, guest recovery, automatic revocation of all existing sessions and remaining codes, and content-free device push revocation. This pass preserves those contracts.
- An existing-account malformed recovery code (wrong format/type) now increments `recoveryFailures` and triggers the exact same five-failure / 15-minute lockout as a well-formed wrong code. Previously malformed attempts returned before accounting. Invalid users still receive the same public `RECOVERY_DENIED` error.
- Internal developer diagnostics now report the actual current Social database schema **11**, rather than the stale constant 9. The schema 9 recovery migration remains historical and is **NOT** run again.
- Added tests for malformed code attempts, timed unlock, successful recovery afterward, session revocation and diagnostics/schema consistency.

## Deployment distinction

The versioned Tavi source package is 0.3.99. Because this pass changes Social server behavior, `server/looprd-release.json` and generated `looprd.yaml` are advanced to release 0.3.99; the database schema stays **11**. This is a *candidate descriptor*, not a deployment. An operator must back up the live DB and validate the actual deployed schema/LoopRD release before approving any server update. Do not assume a schema 8→9 migration is still pending.

## Preserve and verify

- All 146 local workboard tickets retained with current operator statuses (87 Review, 41 Planned, 16 Deferred, 2 Suggested); no Done approvals. LRS-004 stays Review.
- No changes to stored chats, local sessions, other accounts, Wallet ledger logic, Companion 0.6.11 publisher assets, Atrium games or extension content.
- Check `npm run verify`, `python -m unittest discover -s tests -p 'test_*.py' -q`, `python tools/generate-looprd.py --check`, `npm run extensions:check`, and the ZipRunner ZIP preflight.
- On staging test account recovery, wrong codes (including malformed), unlock after 15 minutes, password policies, one-time redemption, all other device logout, code rotation, registration rate limits and actual Android/Windows recovery screens. Avoid recording real tokens/codes in test logs.
- Source tests are not evidence of actual LoopRD migration, native-device behavior, CI on the new SHA or ZipRunner-local per-ZIP test reconciliation.
- `TAVI-QA-047` remains a ZipRunner CI/QA evidence issue; `TAVI-UPDATES-003` remains the Android in-app installer issue. Neither is changed here.

No Git push, release, or deployment is authorized by this source package.
