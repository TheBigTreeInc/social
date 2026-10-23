# Tavi 0.3.95 — Home UI unification

This source-only pass addresses the 0.3.94 screenshots: Home still had File/Contacts/Actions/Tools/Help and the classic raised three-button dock, while Settings and Games used the centralized host UI.

## Implemented

- Home and Contacts now use the same `uiHeader` / `mobileTabs` as Games, Settings and App Store, on compact Windows, Android and browser.
- Home uses an accessible Tavi header with Notifications and Settings icons; the bottom tabs are Home, Chats, Games and Apps.
- Legacy roster menu/status chrome and raised Home dock are not rendered; contacts, lobby, recent messages, unread, requests, Gold and Companion preview are preserved.
- The sign-in screen uses the same shared header and a Help action.
- Styling for Home/Contacts moved to the central semantic token components CSS and now follows light/dark theme and consistent focus/touch sizes.
- Settings uses display name instead of raw account ID; server origin moved into disclosure.
- Browser safe-layout and tab navigation QA adjusted to the approved mobile-first shell (not weakened).

## Security/compatibility

No LoopRD schema, handler or `looprd.yaml` changes. Do not alter the approved Companion package or its digest. No token or publisher iframe integration changes. No user credentials or runtime state in ZIP. This update does not touch the Android signed-APK updater.

## Operator checks

1. Run ZipRunner source import/version and GitHub exact-commit CI; review workboard ticket TAVI-UI-HOME-095.
2. Compare Home, Chats, Games, Settings, App Store, Wallet, Companion and sign-in at 320, 355, 390, 768 and 1366 widths.
3. Test native Windows chat window reuse and Android Back/gesture handling with physical devices.
4. Check roster state, Gold shortcut, Companion, dark mode, notifications, drafts, scrolling and safe-area bars.
5. Keep ticket in Review until accepted; no push, release, deployment or destructive migration is part of this ZIP.
