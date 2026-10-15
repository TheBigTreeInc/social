# Social Messenger client 0.1.2 — Classic windows pass

The client uses a **lightweight classic Windows Messenger-inspired layout**, not a modern dashboard. Desktop presents a narrow contact-list window alongside a distinct conversation window (currently two panes within one native Tauri app window; not independent OS windows). Chats use a simple transcript, with message author, time and text instead of large chat bubbles. The sign-in UI is a compact single-window dialog. Mobile shows roster and conversation one at a time with bottom navigation.

Buttons and menus are wired to the existing Social client actions: contact requests, messages, games, alerts, settings, avatar generator and logout. `Enter` sends, `Shift+Enter` inserts a newline. A roster search filters displayed contacts without sending extra server requests. Group disclosure is client-local. Games and turn alerts occupy a compact section beneath the contacts, not a permanent right-side panel. Server-granted Admin/Debug remains hidden unless permitted.

The initial design is inspired by the compact density, blue title bars, white list backgrounds and modest menu/toolbar patterns of Windows Live Messenger and Xfire. It doesn't bundle their trademarks, branded graphics, UI code or assets.

## Test locally

```bash
cd client
npm install
npm run portrait:sync
npm run dev
```

See repository `README.md` for Social deployment, account registration and native GitHub Actions builds. The social backend owns identity; games run as separate components on the same LoopRD server. This visual pass requires **no database schema changes** relative to v0.3.1.

The UI shell stays one native Tauri window in v0.1.2. Actual separate native chat windows (including shared sessions and notification targeting) can be added as a later optional desktop capability without breaking Android navigation.
