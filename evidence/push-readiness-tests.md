# Tavi v0.3.19 — local verification evidence

Environment: Linux host, Node.js v22, Python 3.13. No Windows native runtime,
Android toolchain, deployed UnifiedPush/ntfy backend or real device available.

Commands and observations:

- `npm run verify`: 7 root Node tests and 54 client Node tests passed;
  package consistency check passed.
- `node --test client/tests/push-readiness.test.mjs`: default-off scoped consent,
  strict capability negotiation, payload privacy, duplicate suppression and
  foreground resume recovery tested.
- `python tools/generate-looprd.py --check`: descriptor/handler in sync.
- `python -m unittest discover -s tests -p test_*.py -q`: 59 Python tests passed.
- Source archive preflight and ZIP SHA-256 are recorded in handoff.

Unverified: real Windows/Android installers, OS notification visibility,
actual suspended/closed-app push delivery, external ntfy distributor, and
LoopRD server capability. No server descriptor change or push enrollment.
