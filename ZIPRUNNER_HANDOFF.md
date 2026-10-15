# ZIPRUNNER_HANDOFF v1

Project: `looprd-social`  
Version: `0.3.1`  
Artifact: `looprd-social-0.3.1-ziprunner.zip`  
Repository target: https://github.com/TheBigTreeInc/social

## 0.3.1 Developer console update

- Adds false-by-default SocialAccount.developerEnabled flag in additive SQLite schema v3 migration.
- Only an OS-level operator of the LoopRD host can grant/revoke it using tools/social-developer-access.py; no Social API can mutate it.
- `me` reports permission for the authenticated account, and `developer_diagnostics` checks the current database flag for every request.
- Settings shows the optional Show developer tools switch only for permitted users; switching on reveals read-only Admin / Debug diagnostics. Revoke blocks immediately and hides UI on refresh.
- Access to LoopRD management, raw logs, other users' profiles/messages, environment and secrets is not conferred.
- Local automated authorization/migration/CLI/protocol tests are author evidence; live LoopRD and native installations remain for operator review.

## Delivered / author tests

- Social server account register/login/logout, password hashes, per-device session handling, account lockout, capability discovery; real friend-request/accept/remove and private direct-message contract.
- Refactored desktop and mobile social client into MSN/Xfire-style compact buddy/chat interface with turns and portrait workshop, no manual Social token.
- SQLite schema v1 -> v2 -> v3 additive migration, old profile/lobby preserved; descriptor regenerated and SHA-256 link updated.
- Android Tauri invalid `bundle.targets:["apk"]` removed; native workflows still need execution.
- Source regression tests and ZIP structure checks are producer evidence, **not** operator-approved Done or live runtime health.

## Operator checks

Back up the Social component database, apply component descriptor through your normal LoopRD source process, confirm schema v3 migration and registration/sign-in on localhost or protected HTTPS, verify existing dev-token users and messages still work. Register separate accounts from Windows and Android, confirm friend consent/direct message privacy, and inspect Windows/Android GitHub builds. Rate-limit and account abuse controls need review before public exposure; no OIDC dependency.

## Remaining

Native installer and APK device acceptance, production recovery/moderation, secure remembered sessions, game-backed turn activity, background Android push, group chat, and game invitations.

No git push, remote deploy or production migration is claimed by this package.
