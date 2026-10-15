# v0.3.3 web SDK source-level validation

Observed in the authoring environment (Linux, Node 22 and Python 3.13):

- `npm run test`: 4 server Node tests and 20 client Node tests PASSED, including 3 new browser SDK tests.
- `node client/tools/check-package.mjs`: PASSED.
- `python tools/generate-looprd.py --check`: PASSED.
- `python -m unittest discover -s tests -p 'test_*.py' -q`: 20 tests PASSED.
- `npm install --no-audit --no-fund` from `client/`: TIMED OUT in the tool environment; this environment cannot verify the Vite/static web build. `web.yml` must run `npm run web:build` + `npm run web:verify` on GitHub.
- Native app compilation and live Social account tests against a deployed LoopRD server: NOT RUN.

The fake-fetch cross-client test verifies SDK/native module identity, independent device tokens, one shared account ID, revocation of only one token, and server-local API routing. It is not evidence of a live deployment.
