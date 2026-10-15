# ZIPRUNNER_HANDOFF v1

Project: `looprd-social`  
Version: `0.3.4`  
Artifact: `looprd-social-0.3.4-ziprunner.zip`  
Kind: `source_update`  

## Delivered

- Compact Windows **native application window** (355×630) for sign-in and buddy list, no giant dashboard backdrop.
- Contacts / Community Lobby open **independent native chat windows** (585×525), with transcript, composer and friend-request acceptance.
- Only the main window holds credentials. Chat webviews use request/response Tauri events through the main window. No token in chat URL, event or storage.
- Tauri capability scopes restrict chat-window creation to the main roster; separate conversation permissions are limited to IPC events.
- Standalone Web/JavaScript SDK and Android clients retain the common Social account protocol and responsive presentation.
- Updated `docs/DESIGN.adoc` and `docs/JAVASCRIPT_CLIENT.adoc` to require compact desktop and independent conversations. New source-level regression tests.

## Validation

Run `npm run test`, `node client/tools/check-package.mjs`, `python tools/generate-looprd.py --check` and `python -m unittest discover -s tests -p 'test_*.py' -q`. Build the Web output from `client/` using `npm install && npm run portrait:sync && npm run web:build && npm run web:verify`.

The build requires actual Windows GitHub Actions + native GUI acceptance for true separate OS windows; source test success is not a native installer proof. Browser output now includes `chat.html` for the Tauri child window. Android layout stays mobile-first. No database migration; Social schema remains 3.

## Known external blocker

User's LoopRD diagnostic reported Social cached release 0.2.3 and `load: ValueError` despite subsequent source versions. Activating a compatible Social backend is necessary for new-account functionality. This ZIP only changes client UX and release identification; it does not diagnose the root exception automatically.
