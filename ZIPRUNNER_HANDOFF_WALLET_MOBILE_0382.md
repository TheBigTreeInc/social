# Tavi 0.3.82 — Clean Gold Wallet and mobile Back/Menu geometry

## Scope

- Wallet (first-party extension 0.3.0): same account-bound, tokenless iframe; UI still shows 100 free play-only Gold and earned/shop Gold separately.
- Wallet schema: all 6 ledger tables are generated together by version-11 migration for a **fresh pre-production Social database**. Wallet 0.3.80/0.3.81 experimental migrations, backfill and legacy-refund acceptance were dropped. Other preexisting Social 2–10 migrations are retained for the current LoopRD contract.
- **Important:** LoopRD previously activated at schema 12 cannot be rolled back by installing this source. No production user accounts exist according to the operator, but validate the deployed database and reset only under explicit operator control. The ZIP does not erase data.
- Android UI: safe-area top and bottom reserved on app root; focused header Back and Home dock use the remaining container, never `100dvh` again as a nested child; bottom Main Menu is fully contained inside its dock. Embedded game controls also avoid system bars.

## QA / gates

- Run `npm run verify`, `python tools/generate-looprd.py --check`, `python -m unittest discover -s tests -p 'test_*.py'`, `node --test client/tests/mobile-safe-area-082.test.mjs` and `python tools/check-social-package.py <ZIP>`.
- Chromium layout fixture covers 320×568, 320×720, 355×630, 390×844, 430×932, 768×1024, and 932×430 with a simulated 56px top / 40px bottom safe area. Browser UI QA also checks 46px/34px on mobile login/Home/focused Games.
- Actual Windows WebView2, Android gesture vs three-button navigation, keyboard, notch, landscape, dark/light theme and staging Wallet merchant fulfillment remain operator acceptance, not achieved by source tests.
- ZipRunner workboard: all 127 existing ticket IDs, priorities, statuses and operator checks preserved; two new Review tickets only. No release, automatic Git push or destructive DB reset.
