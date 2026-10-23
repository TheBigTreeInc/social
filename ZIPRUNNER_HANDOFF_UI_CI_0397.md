# Tavi 0.3.97 — Five-viewport messenger UI QA repair

Date: 2026-10-23 (Europe/Amsterdam)  
Project: `looprd-social` / ZipRunner  
Base source: exact v0.3.96 ZIP, SHA-256 `bde3de5ef62d87b4dab909ab09b34ad2cbcea49b7d970e8d7c4c5b9c8ecba74b`.

## Confirmed failure on pushed 0.3.96

Commit `6a793ee73681a7bd366021d931c61fcaca96fb65`, browser UI QA run:
https://github.com/TheBigTreeInc/social/actions/runs/39993035629

All five viewports timed out waiting for removed `.tavi-roster-merged` in `client/tools/ui-qa.mjs`. Home 0.3.96 correctly uses `.tavi-home-messenger`; Messages correctly uses `.tavi-message-inbox`. It is inappropriate to restore the removed merged UI to satisfy obsolete tests.

Android, Windows, Web, source verify and SDK jobs succeeded at that commit. Linux/macOS status was still running when the latest handoff was initially inspected. The release workflow skipped publishing because required CI wasn't green; a green release workflow *run* is not release authorization.

## 0.3.97 scoped source fixes

- `client/tools/ui-qa.mjs`: inspect real Home profile-left/Companion-right layout and online/offline buddy groups. Switch to Chats and verify conversation search, lobby, All/Unread/Friends and **no Wallet or Companion**, then return Home. Preserve game, Wallet/Notepad extension, privacy and Back checks.
- `client/tools/ui-qa-touch.mjs`: sample current Home group/button geometry in one frame, refuse zero-area and rows below 44px.
- `client/tools/ui-qa-insets.mjs`: use current Home scroll container when checking simulated Android system bars, not the old `.tavi-classic-home` roster.
- `client/src/ui/design-tokens.css`: explicit 44px phone/touch Home group headers and buddy rows, while retaining legacy styling only where still used by independent windows.
- Extend the existing source regression tests and update versioned packaging / ZipRunner post-update revision. No messaging, extension publisher, wallet, or LoopRD code was changed.

## Acceptance: NOT YET COMPLETED

The full Node verifier passed (11 server tests, 249 client tests and 20 OpenClaw tests); 172 Python tests, generated LoopRD descriptor consistency and three audited bundled-extension integrity checks also passed. The real Playwright browser run is **not verified here** if Chromium dependencies cannot be installed. Import 0.3.97 via ZipRunner and check actual `npm --prefix client run ui:ci`. On a new operator-approved Git push verify all eight required workflows for the **new exact commit**, not 0.3.91 or failed 0.3.96. Do not mark `TAVI-UI-CI-097`, `TAVI-UI-MESSENGER-096` or `TAVI-QA-047` Done until native and source identity evidence is reviewed.

Unchanged: Social LoopRD descriptor/schema, trusted Companion 0.6.11 bundled bytes/digest, core Wallet and account-local state. Android internal APK installer bug `TAVI-UPDATES-003`, original report `ZRB-9297228324E24D42`, remains open; no speculative updater change in this patch.

No automatic Git push, tag, release, server redeploy or Work board Done promotion.
