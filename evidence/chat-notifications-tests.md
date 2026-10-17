# Tavi v0.3.17 chat-first pass — producer-side verification

Project: `looprd-social`; target client/package `0.3.17`; deployed LoopRD Social specification unchanged from v0.3.16 (schema 4).

Executed in the Linux authoring environment:

- `npm run verify`: passed (7 Node server-source tests + 41 Node client tests, package consistency).
- `node --test client/tests/message-state.test.mjs client/tests/chat-ux.test.mjs`: passed (9 tests, also in the main client suite).
- `python -m unittest discover -s tests -p test_*.py -q`: passed (43 tests).
- `python tools/generate-looprd.py --check`: passed.
- `node --check client/src/main.js` and `node --check client/src/chat.js`: passed.
- Bytewise SHA-256 of packaged `looprd.yaml` matches source v0.3.16: `0bd55333c72e2774a42ba1dee39dd405f2c8b7a0975a9e03e1437ba29b204c52`.

**Not executed:** Vite build (dependencies not available here), Tauri Windows/Android compilation and GUI/notification acceptance, live two-account direct-message tests or OS notification click behavior. User's Windows ZipRunner installation is the designated native build runner. No server push or migration is necessary for this client-only pass.
