## Always-available browser client and JS SDK (v0.1.3)

Design: `../docs/DESIGN.adoc`; JavaScript integration contract:
`../docs/JAVASCRIPT_CLIENT.adoc`. A browser build **is independently
produced** by `.github/workflows/web.yml` and must remain part of each release.
It is the same compact classic Messenger UI as the Windows/Android wrappers,
not a separate account or demo server. `npm run web:build` produces `dist/`
including a portable static app and `dist/sdk/looprd-social.js`.

Serve `dist/` from HTTPS (or HTTP localhost). The user selects their own
LoopRD origin, registers/signs in on its Social component and sees the same
server-owned account, roster, messages and portrait as on native devices.
Browser and native sessions are distinct and independently revocable. Enable
CORS on LoopRD for the website origin. No secrets are baked into the JS build.

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

## Compact native Windows shell

The installer opens a 355×630 buddy-list window. Choosing a buddy/lobby opens a separate 585×525 native conversation window; login and credentials stay exclusively in the main window. Browser and Android use their responsive views. The source includes an independent `chat.html` entry point for the conversation windows.
