# ZIPRUNNER_HANDOFF v1

Project: `looprd-social`  
Version: `0.3.0`  
Artifact: `looprd-social-0.3.0-ziprunner.zip`  
Repository target: https://github.com/TheBigTreeInc/social

## Delivered / author tests

- Social server account register/login/logout, password hashes, per-device session handling, account lockout, capability discovery; real friend-request/accept/remove and private direct-message contract.
- Refactored desktop and mobile social client into MSN/Xfire-style compact buddy/chat interface with turns and portrait workshop, no manual Social token.
- SQLite schema v1 -> v2 additive migration, old profile/lobby preserved; descriptor regenerated and SHA-256 link updated.
- Android Tauri invalid `bundle.targets:["apk"]` removed; native workflows still need execution.
- Source regression tests and ZIP structure checks are producer evidence, **not** operator-approved Done or live runtime health.

## Operator checks

Back up the Social component database, apply component descriptor through your normal LoopRD source process, confirm schema v2 migration and registration/sign-in on localhost or protected HTTPS, verify existing dev-token users and messages still work. Register separate accounts from Windows and Android, confirm friend consent/direct message privacy, and inspect Windows/Android GitHub builds. Rate-limit and account abuse controls need review before public exposure; no OIDC dependency.

## Remaining

Native installer and APK device acceptance, production recovery/moderation, secure remembered sessions, game-backed turn activity, background Android push, group chat, and game invitations.

No git push, remote deploy or production migration is claimed by this package.
