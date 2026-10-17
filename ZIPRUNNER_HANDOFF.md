# Tavi 0.3.17 — Chat, mobile UX and OS notifications

ZIPRUNNER_HANDOFF v1 | project=looprd-social | version=0.3.17 | filename=looprd-social-0.3.17-chat-notifications-ziprunner.zip

Project key: `looprd-social`. This is a CLIENT-ONLY update for Windows/Android/Web. `looprd.yaml` is unchanged, retaining deployed Social release 0.3.16 and database schema 4. **No server Git push or migration required for this pass.** Existing operator settings and private state must be preserved.

## Implemented

- Unread badge per accepted contact; messages polled in bounded rotating contact batches while active.
- Persisted, server/account-scoped read/notified message ID cursors, without storing message bodies or passwords.
- Native Windows/Android/browser notifications for incoming direct messages and new friend requests while Tavi is running and OS permission is granted; message preview off by default.
- Dedicated conversation windows refresh while composing; text, cursor and scroll are preserved; viewed messages acknowledge unread locally.
- Better phone safe-area/touch navigation and matching chat colors.

## Validation / acceptance

- `npm run verify`: 7 server-source Node + 41 client Node tests passed.
- Python unittest: 43/43 passed.
- `python tools/generate-looprd.py --check`: passed. `looprd.yaml` identical to previous source.
- ZipRunner's saved project Build command should be `node tools/auto-build.mjs`; Start command `node tools/launch-tavi.mjs`.
- Windows NSIS, Android APK, foreground system notifications and two-account end-to-end chat must be confirmed on the actual devices. This Linux environment did not compile those native artifacts.

**Deferred**: LoopRD admin roles, server mailbox summary/read receipts, click-to-reply OS notifications, Android background push (FCM/APNs-style), cross-device unread synchronization and actual offline message push. Do not claim they work.

See `docs/CHAT_AND_NOTIFICATIONS.adoc` and `evidence/chat-notifications-tests.md`.
