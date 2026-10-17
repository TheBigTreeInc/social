# Tavi 0.3.18 — verification evidence

Producer-side checks performed in Linux Python/Node environment:

- `npm run verify` — passed (Node tests, package consistency).
- `python -m unittest discover -s tests -p test_*.py -q` — passed, including
  `test_conversation_sync.py` (two devices, authorization, read-cursor monotonicity).
- `python tools/generate-looprd.py --check` — passed.
- `client/tests/mailbox-sync.test.mjs` tests baseline, notification suppression,
  local-to-server cursor sync and strict SDK API routing.

This does not establish installed LoopRD migration success or functioning
Windows/Android OS notifications; those are operator acceptance checks.
