# Social v0.3.0: implementation evidence / caveats

- 2026-10-15: verified Social backend and client source on Linux (Node and Python).
- Backend: registration/login, hashed/salted scrypt password storage, SHA256-hashed revocable tokens, 30-day device sessions, 15-minute per-account lock after five failures, server-configured registration disable, generic LoopRD request limits.
- Contact requests and accept/remove gate direct messages; unauthorized access tested; contact presence is inferred from recent authenticated sessions.
- Existing v1 profile, lobby and pulse contracts remain; migration v2 only creates new tables/indexes.
- Client discovery first checks the selected server's /info and anonymous Social capabilities. No Social component => no Social account operations or fallback storage.
- Client is a messenger-first compact desktop/mobile UI, credentials never included in game API requests.
- Android previous CI run 38786249152 stopped during `tauri android init --ci` because Android config incorrectly placed `apk` under general `bundle.targets`. Removed invalid target; artifact build on GitHub still requires acceptance.
- No native build, live LoopRD activation, browser UI exercise, or external upstream ZipRunner validator executed in this pass. SQLite migration has a source-level integration test; deploy with database backup and separate operator acceptance.
- Limitations: open registration must be protected by appropriate deployment-level anti-abuse controls, account recovery/verification and moderation are not implemented. Client asks for login after restart; secure OS credential storage is future work. Push alerts after Android app termination require a separate provider. No automatically shared game session.
