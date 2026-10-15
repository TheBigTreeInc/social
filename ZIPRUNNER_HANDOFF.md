# ZIPRUNNER_HANDOFF v1

Project: `looprd-social`  
Version: `0.3.2`  
Artifact: `looprd-social-0.3.2-ziprunner.zip`  
Kind: source_update  

## Implemented in this pass

- SCL-019: classic old-Windows/Messenger-inspired UI replacing thick/dark multi-panel dashboard; lightweight contact list, online/offline roster groups, search, chat transcript, menu/toolbar, small turn list, mobile navigation and Enter-to-send.
- Preserves source Social backend (profile/accounts/contact request/DM), server-gated developer option, portrait integration, and existing game activity APIs.
- No new SQL migration; descriptor release marker and integrity link refreshed for 0.3.2.

## Operator checks

1. Install via the already-registered `looprd-social` ZipRunner project. Verify project identity before overlay; do not make another project.
2. Validate with `npm run test`, `node client/tools/check-package.mjs`, `python tools/generate-looprd.py --check`, Python regression tests.
3. Build native Windows NSIS and Android debug APK via GitHub Actions. Source checks do not certify native installer builds.
4. On Windows, inspect compact roster and light chat windows; use menus, search, Online/Offline expanders, lobby, DM, alerts, options and portrait.
5. On Android, inspect responsive roster/conversation switching.
6. Confirm privileged Admin/Debug is absent for nonpermitted accounts; test server grant/revoke. No client flag can elevate access.
7. Check running LoopRD server logs for the `looprd-social: load: ValueError` shown in supplied snapshot. Runtime still exposes cached 0.2.3, schema 1; do not treat source ZIP ingestion as successful 0.3.x server activation.

## Remaining and boundaries

SCL-010 native/device acceptance; LRS-004 hardened account recovery; SCL-007 groups/invitations; SCL-009 background Android push; SCL-011 game-owned turn contracts; SCL-017 secure persistent login. No database, personal credentials, or management secrets are included. No git push/remote deploy performed.
