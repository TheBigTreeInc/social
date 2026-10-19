# Tavi 0.3.59 — Extension Platform / App Store preview

**Base:** source ZIP `looprd-social-0.3.58-classic-header-shared-atrium-ziprunner(2).zip`.
**ZipRunner project:** `looprd-social`. **Result:** 0.3.59 source candidate; no Git push or deployment carried out.

## New source
- `docs/TAVI_EXTENSION_PLATFORM_V1.adoc`: complete architecture and security / release phases.
- `docs/TAVI_EXTENSION_PUBLISHING.adoc`: extension registration workflow.
- `schemas/`: strict v1 manifest and bundled-catalog schema.
- `client/src/extensions/`: validator, install state, SHA-256 asset verification, minimal broker and preview TypeScript SDK source.
- `client/extension-sdk/`: named local SDK package source (not npm-published).
- `tools/register-tavi-extension.mjs`: curated source-bundle registrar.
- `examples/extension-notepad/`, `client/public/tavi-extensions/`: validated first-party sample and bundled catalog.
- `client/src/main.js` and CSS: App Store & install/enable/disable/remove, isolated extension launcher, always-available Home navigation.
- `client/tests/extensions.test.mjs`: validator, publisher CLI, broker, scope and integrity regressions.

## Version separation
- Client/ZIP recipe/source update 0.3.59; native version/Cargo version 0.3.59.
- Existing Social server and `looprd.yaml` remain release 0.3.58 with schema 10. No new endpoints, secrets, migrations or server reconfiguration.
- ZipRunner workboard adds `TAVI-EXT-059` as **planned / awaiting operator acceptance**, leaves prior task statuses unchanged.
- ZipRunner stamp remains within the maximum 20 post-update tests; new extension test is included.

## Verification obtained in source container
- `npm run verify`: PASS — Node server, Node client (including 6 extension tests), OpenClaw and package integrity/ZipRunner metadata.
- `python -m unittest discover -s tests -p test_*.py -q`: PASS — 146 tests.
- `node --check client/src/main.js`: PASS.
- `npm run client:build`: NOT RUN TO COMPLETION — Vite dependency unavailable in this offline container; `npm install` could not reach npmjs.org (EAI_AGAIN). The existing Windows `BUILD-LOCAL.ps1` installs NPM dependencies before building.
- Native Windows NSIS / Android / browser visual tests: NOT performed in this container.

## Operator checks
1. Install source update into existing ZipRunner project; run `npm run verify`, local NPM installation, Web/native build.
2. Sign in to Tavi. Main menu > App Store > Private Notepad > Install. Explicitly review grants and open; create note, save, leave and reopen.
3. Switch server/account and ensure another identity sees neither the installed permission nor saved note. Sign out while extension is open; no stale frame may remain.
4. Disable/remove, open contacts and chats, minimize and return Home. Confirm native Companions and Atrium continue to function as before.
5. Verify iframe has `sandbox="allow-scripts"` without `allow-same-origin`, test tampering and foreign-origin messaging; regression tests should reject.
6. **Block remote/third-party extension publishing** until independent asset origin and signed `.tavix`/registry/key/capability security gates are implemented. The current same-origin assets are suitable only for reviewed first-party source-bundled examples.

Do not label Companions or Atrium as migrated plugins or say `.tavix` installer is live. Publishing pipeline and native permission slots are separate pending milestones.
