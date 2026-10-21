# Tavi 0.3.78 — GitHub exact-commit browser QA repair

Previous installed ZipRunner source 0.3.77 passed the Windows build but **not** the exact push browser UI QA at commit `4d78890f43e70474bc9497fc4b06f090d433e9db`.

Failed workflow: https://github.com/TheBigTreeInc/social/actions/runs/39593041760
Artifact: `tavi-ui-qa-11`, five viewports:

- `desktop` and `compact-355`: test waited for the installed extension Open button, never clicking Tavi's required Install extension approval. The screenshot shows the approval dialog remains open.
- `tablet`, `mobile-390`, `mobile-320`: measured contact row min-height 30px, below intended 44px touch area.

## This package

- Uses the 0.3.77 source as base; no server handler, schema, private data or credentials changed.
- Corrects smoke test to inspect approval dialog, cancel first, then deliberately approve before opening the Notepad extension.
- Adds reliable touch capability signaling in `client/src/main.js` and accessible hit-target styles in `client/src/ui/design-tokens.css` without enlarging mouse-driven 355px Windows rows.
- Adds `client/tests/ui-qa-contract-078.test.mjs` and keeps the 20-test ZipRunner post-update limit.
- Preserves all 121 existing Work Board entries and latest operator acceptance criteria. Adds `TAVI-UI-CI-078` as **Review**, not Done.

## Gates

Run `npm run verify`, `python -m unittest discover -s tests -p 'test_*.py'`, `python tools/generate-looprd.py --check`, and `python tools/check-social-package.py <ZIP>`.

Run `npm install --prefix client && npm --prefix client run ui:ci` on a host with Chromium/Playwright; this must pass in exact-commit GitHub Actions before any release. Confirm the real Tavi Windows/Android UI separately. CI evidence must match the Git push SHA; a local ZIP build is not CI acceptance.

No automatic push/tag/release, migration or operator approval is requested.
