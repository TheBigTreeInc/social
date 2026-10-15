# Scope and trust boundaries

## What works now

- One Tauri v2 client source for native Windows NSIS and Android ARM64 APK.
- Connect to an HTTPS LoopRD origin; localhost HTTP permitted for development.
- Native `POST /looprd/looprd-social/v1/social` actions `me`, `save_profile`, `chat_feed`, `chat_send` (existing Social v0.2.2 contract).
- Optional public `pulses` WebSocket wakes the lobby. Periodic REST reconciliation is authoritative.
- Locally configure game component IDs on the **same server** and poll the optional application-level `/activity` convention.
- Native OS notifications for unseen active turns while running; user-granted permission required.
- Embedded current portrait workshop, with official generator JS synchronized at build and latest online metadata/images loaded at runtime.
- Server-synchronized v3 canonical numeric portrait code, stored in Social profile JSON without a SQL migration.

## What does not work yet

- Social does not currently expose private conversations, friends, group membership, or trusted game invite endpoints.
- No Android background push after system kills the app. No FCM, Google account or notification server is implied.
- No established standard turn-activity endpoint is present on existing game components. A game implementer must add the `looprd.game.activity/v1` application contract.
- Account creation, password recovery, device session linking and account ownership remain Social concerns, NOT LoopRD features.
- Shared server does not imply shared credentials: verified generic principals require application-owned session verification.
- No cross-LoopRD federation, remote component calls, or central game catalog.
- The current Social development-token backend is unsuitable for a publicly exposed server; native client does not make it production-ready.

## Security

- No credential shipped. Developer/social token and optional game credential stay in process memory, not localStorage or source files. Disconnect clears them.
- Remote origins require HTTPS. URLs contain no credentials, paths, queries, fragments. Games are accessed on the same origin.
- Social token goes ONLY to the Social component action endpoint, never to game endpoints. Game tokens are explicitly entered per game.
- HTML from messages and game activity is escaped before rendering. No raw server HTML inserted.
- Upstream generator JS executes locally in the Tauri renderer, therefore updates MUST be reviewed; a weekly PR lets maintainers inspect it. PNGs are verified with their hash filenames by the official portrait engine.
- No access to LoopRD management endpoints or admin API keys. Client is a consumer.

## Protocol / migration

Social v0.2.2 uses `auth.mode: public` plus token-in-body. Future Social can expose a versioned authenticated REST API using LoopRD verified principals and durable events; client adapter should be upgraded without extending LoopRD with social-specific types. Preserve server-scoped data isolation.

## Technical caveat

The cross-platform native build workflows are authored against Tauri v2 and require GitHub runners for execution. A Linux source-only environment without the Rust/Android SDK cannot certify native installer output. CI-generated APK is a sideloadable DEBUG build, not a Google Play release; Windows NSIS is not code-signed.
