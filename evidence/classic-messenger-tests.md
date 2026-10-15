# Classic messenger UI source test evidence

Input source: `looprd-social-0.3.1-ziprunner.zip`, supplied in this conversation.

Date: 2026-10-16. Delivery target: `looprd-social` 0.3.2, `TheBigTreeInc/social`.

Checks executed against combined sources in this environment:

- `npm run test` — **21 passed** (4 server + 17 client, including 3 classic layout checks).
- `node --test client/tests/classic-layout.test.mjs` — **3 passed**, including static DOM window structure, mobile mode and escaping of hostile markup.
- `node client/tools/check-package.mjs` — passed for generated LoopRD SHA-256 link, project/version matching and required files.
- `python tools/generate-looprd.py --check` — passed.
- `python -m unittest discover -s tests -p 'test_*.py' -q` — **20 passed**, a few unclosed SQLite ResourceWarnings observed but no test failures.
- `python tools/check-social-package.py <ZIP>` — execute after archive creation; result to record below.

Native Windows/Android builds: **NOT RUN**. Real desktop/mobile screenshot validation: **NOT RUN** because browser navigation in the authoring environment was blocked. The classic UI sources were checked structurally, not visually approved.

The uploaded LoopRD diagnostic indicates `looprd-social` release `0.2.3`, schema version `1`, and `load: ValueError` for a reload attempt. It does not include enough error detail to identify the cause. Obtain LoopRD runtime log/traceback and fix independently before treating v0.3.x backend as deployed. Do not infer a failed database migration from this generic error alone.
