# Tavi UI/UX foundation pass — 0.3.94

## Implemented

- Introduced `client/src/ui/components.js` with HTML-escaped, validated, host-owned header/action/status templates. `ui/shell.js` now renders host Back/Home through the same component as standalone native windows.
- Moved first-party SVG glyph registry out of application launcher logic into `client/src/ui/glyphs.js`; old launcher import/export is retained for compatibility. No glyph font/third-party assets.
- Introduced `client/src/ui/components.css` with one semantic green control/header/card/input system. Main, Windows chat and Windows game/match windows now import the same design tokens and components CSS, rather than depending exclusively on legacy screen-specific palettes.
- Replaced native chat's fake File/Edit/Actions/Help bar, the native match chat header, and native game/chat minimize headers with real semantic host-controlled glyph actions; existing minimize event flow is unchanged.
- Theme changes in the main Windows messenger broadcast a bounded cosmetic `tavi-ui-theme` message to existing native chat/game/match windows. Those windows initialize from the same public cosmetic preference. No session tokens or chat data are transmitted.
- Preserved Tavi 0.3.93 Android system Back, native bottom navigation, extension iframe sandbox, Companion digest and Wallet behavior. No LoopRD schema or handler changes.

## Source tests

- `npm run verify` (Node tests + source package audit)
- `python -m unittest discover -s tests -p 'test_*.py' -q`
- `python tools/generate-looprd.py --check`
- `node tools/sync-internal-extensions.mjs --check`
- `node --test client/tests/ui-central-foundation-094.test.mjs`

## Not yet complete: UI/UX release acceptance

- Physical Android / Windows / Web layout and navigation/gesture checks; 320/355/390/768/1366 widths and light/dark visual review.
- Review and refactor every remaining utility screen currently rendered as templates in `client/src/main.js` and remove unused legacy overrides. Do not mass-rewrite until live UI snapshots and operator acceptance exist.
- Adopt optional extension host theme contract (`TAVI-UI-EXTENSION-078`) without styling third-party iframes, then separately update Companion's own world-first/mobile UI by its publisher.
- Resolve prior contradictory roster/search workboard acceptance criteria with the operator, preserving original ticket IDs/statuses.
- Exact-push GitHub Actions and physical device tests. Keep items in Review/Planned rather than claiming Done.

## Source package guardrails

No `.env`, active `ziprunner.config.json`, runtime DB, secrets, generated build output, Git push or server deployment. The existing workboard IDs/statuses/acceptance are preserved, with `TAVI-UI-CORE-094` added in Review.
