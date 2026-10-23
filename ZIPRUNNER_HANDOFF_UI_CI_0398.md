# Tavi 0.3.98 — Shared Back/Home browser QA selector repair

Date: 2026-10-23 (Europe/Amsterdam)

## GitHub-confirmed 0.3.97 failure

- Exact commit: `c8070c998b570879cbc59dcff33dd53cea36f598`.
- Browser QA run: https://github.com/TheBigTreeInc/social/actions/runs/40000562870
- All five viewport smoke runs reach the Wallet iframe, but then fail on the removed CSS selector `.tavi-shell-bar__back[data-action="minimize-view"]` (30-second click timeout each).
- The same stale selector occurs in the Notepad return step; Games also checks `.tavi-focus-toolbar [data-action="minimize-view"]`.
- Current shared UI host `hostToolbar(...,{action:'back'})` actually renders `.tavi-shell-bar__back[data-action="back"]` and `.tavi-shell-bar__home[data-action="home"]`.

## Scoped repair

- `client/tools/ui-qa.mjs`: Wallet and Games return via the actual shared Back action; Notepad returns via the shared Home action. Check that the messenger Home identity has rendered before proceeding.
- `client/tests/ui-browser-navigation-098.test.mjs`: version-independent check of the host shell contract and regression guard preventing obsolete selectors in browser QA.
- All 145 original operator workboard records preserved, including every status and acceptance criterion; new `TAVI-UI-CI-098` left in Review. All versioned source, Tauri and ZipRunner manifests incremented to 0.3.98.

## Safety boundaries

No changes to Tavi messenger Home/Chats behavior, Wallet/Companion publisher files, extension permissions, `looprd.yaml`, Social server handlers, database schema, authentication, or operator secrets. No push, tag, release or deployment.

## Verification gate

Source verification and exact ZIP checks are executed during packaging, but browser UI green is **not established** until the next exact-SHA GitHub browser QA and actual local run on ZipRunner. The missing `not_github` watcher and stale post-update test identities require independent ZipRunner evidence ingestion repair, not rewriting past CI. Real Android and Windows UI acceptance is separate.
