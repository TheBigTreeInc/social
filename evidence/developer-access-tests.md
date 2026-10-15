# SCL-018 — Developer access test evidence (source only)

Date: 2026-10-15. Base project: `looprd-social` 0.3.0; new source release: 0.3.1.

The local test suite covers server-side denial before operator grant, per-account entitlement, another account's denial, multi-device grant, immediate revocation, unknown/forged client fields, legacy-token refusal, v2 -> v3 non-destructive migration, local SQLite-only operator CLI controls, and client diagnostics contract validation.

Reported local results: **20 Python tests passed** and **18 Node tests passed** (4 server + 14 client). Generated descriptor and manifest link validated.

Source tests:
- `python -m unittest discover -s tests -p 'test_*.py' -q`
- `npm run test`
- `python tools/generate-looprd.py --check`
- `node client/tools/check-package.mjs`

No claim is made for a live LoopRD migration, release approval or native APK/NSIS execution. Granting the role requires OS access to the selected LoopRD component DB. There is no client HTTP privilege-grant endpoint.
