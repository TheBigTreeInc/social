# Tavi 0.3.66 — Hosted Life launch broker

Source-only candidate; no pushes or deployments. See `docs/TAVI_ATRIUM_HOSTED_LIFE_LAUNCH_0366.adoc`. Existing 100-ticket workboard status preserved, new TAVI-LIFE-066 in Review. Production depends on upstream Atrium 0.5.24 adapter, actual Pages catalog, Life seat authorization and live Windows/Android/browser acceptance.

Run `node --test client/tests/extension-life-launch.test.mjs` and `npm run verify`; then `python tools/generate-looprd.py --check`. Do not mark TAVI-031 or TAVI-MULTI-048 Done based on these unit tests.
