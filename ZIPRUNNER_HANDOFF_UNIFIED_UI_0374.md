# Tavi 0.3.74 — Video review and minor UI repair

Operator video: `Screen Recording 2026-10-20 184905.mp4` (~49 sec, compact desktop). The recording itself is not redistributed in source ZIP.

## Small implementation (Review only)
- One classic `File/Contacts/Actions/Tools/Help` menu expanded at a time, Escape closes and returns focus.
- Home and Messages both use the compact combined conversations/presence roster, alphabetically sorted with one row per contact.
- Remove the duplicate Tavi-owned Home button in extension subtoolbar; outer shell remains the escape route. Atrium's separate publisher Return awaits upstream integration.
- All 110 prior operator workboard IDs and statuses remain unchanged; 1 Review + 5 Planned tickets appended.

## Future work
- Adopt Lit + semantic CSS tokens as a gradual design-system migration, never a one-pass replatform.
- One route/header contract, compact fields/cards and responsive Companion, complete light/dark green accessibility, extension embedded-mode bridge.
- Playwright + actual Windows/Android acceptance; no assumption from source tests.
- `TAVI-AUTO-REGISTRY` and local extension package installer remain parked.

## Verification
- `npm run verify`
- `python -m unittest discover -s tests -p 'test_*.py'`
- `python tools/generate-looprd.py --check`
- `python tools/check-social-package.py <exact-ZIP>`
- `node --test client/tests/ui-shell-consistency.test.mjs`
- `npm --prefix client run ui:ci` where browser dependencies installed; operator native Windows/Android are separate.

No push, release, CI proof or production deployment claimed.
