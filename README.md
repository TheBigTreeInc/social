# LoopRD Social v0.2.2 — one repository, one ZipRunner project

TheBigTreeInc/social is the **single repository** for the Social LoopRD component and its reusable game-oriented Windows/Android client.

- **Server:** `looprd.yaml` generated from `server/looprd_handler.py` into a native LoopRD component named `looprd-social`; existing SQLite models/data and REST bridge remain intact.
- **Client:** `client/` contains a Tauri v2 app for Windows, Android and a local web preview; supported games run as separate LoopRD components on the **same selected LoopRD server**.
- **Art:** `client/` integrates TheBigTreeInc/assets Portrait Library 3.0.0; generator JS is pinned, fetched at build time and reviewed by PR. The registry and SHA-verified art are fetched online on launch.
- **ZipRunner:** root `project.zr` and historical `looprd-social.zr` share project key `looprd-social`; `ziprunner.looprd.json` explicitly links the component by descriptor hash. Install `looprd-social-0.2.2-ziprunner.zip` in the existing project; **do not create a second project**. Workboard and manifest live at the archive root.

## Existing Social API

Current LoopRD server route: `POST /looprd/looprd-social/v1/social`, with action `op` values `me`, `save_profile`, `chat_feed`, `chat_send`. The server's `auth.mode: public` is *not* sufficient authentication: the handler additionally validates server-configured development credentials in the JSON action body.

For a local trusted development setup, configure `LOOPRD_SOCIAL_DEV_TOKENS_JSON` **on the LoopRD runtime**, for example via a protected environment setting: a JSON map of 8–72-char test user IDs to independent random secret values at least 24 characters. Do not put them in source, logs or any ZIP. **Never expose this development credential mode to the public internet.**

`save_profile` now optionally accepts `portraitCode`, the exact canonical decimal text of the shared Portrait Library v3.0 numeric format. This is stored in existing `SocialProfile.data` JSON alongside `displayName` and legacy `appearance`. Older clients omitting `portraitCode` preserve an existing code on update. `looprd.yaml` keeps `database.schemaVersion: 1`, with no new database tables or migrations. The profile format remains `looprd.social.profile/v1`, additive only.

Game state, turn computation and invitations remain game-owned, not LoopRD-owned. Social-owned accounts and device identity do **not** require any external OIDC provider. The legacy `game_ticket` action still refuses issuance until trusted application-owned identity and game validation exist. No cross-server federation is implemented or required.

## Local tests (no native SDK)

```sh
npm run test
node client/tools/check-package.mjs
python -m pip install -r requirements-dev.txt
python tools/generate-looprd.py --check
# After changing server/looprd_handler.py: run generator, then link updater
# python tools/generate-looprd.py && python tools/update-looprd-link.py
python -m unittest discover -s tests -p 'test_*.py' -v
```

## Local client web preview

```sh
cd client
npm install
npm run portrait:sync
npm run dev
```

Open http://127.0.0.1:5173. Enter the *LoopRD server origin* and a development account token. The server must already have registered `looprd-social`, and CORS/origin settings must permit this client. Native app artifacts are produced via `.github/workflows/windows.yml` and `android.yml`; the generated Windows NSIS and Android ARM64 debug APK need operator/device acceptance. Android background push is **not** implemented: local turn alerts require a running client and a game implementing `GET /looprd/<game>/v1/activity`. See `client/docs/GAME_ACTIVITY_CONTRACT.md`.

## Bridge compatibility

`bridge.mjs` still exposes the older Life Loop `GET/PUT /v1/me` and `GET/POST /v1/chat/lobby` on loopback port 8947, forwarding to the same Social LoopRD component. Set the local `LOOPRD_SOCIAL_LOOPRD_URL` to the native Social action URL and `LOOPRD_SOCIAL_ALLOWED_ORIGINS` to trusted local browser origins. The original `server.mjs` development-only server is retained for old local testing, not as the live source of truth. Avoid running `bridge.mjs` and `server.mjs` on the same port.

## GitHub Actions

- `verify.yml` — server and client Node tests, Python handler + YAML generation checks.
- `windows.yml` — Windows NSIS installer from `client/`.
- `android.yml` — Android ARM64 debug APK from `client/`.
- `portrait-updates.yml` — weekly reviewable pull request for generator source. Do not automatically execute unreviewed generator changes at runtime.

All are repository-root workflows and use the **same GitHub repository**. Root build verification doesn't need Rust or Android SDK. They have not been run on GitHub in this delivery.

## Boundaries / security

- Never ship live credentials, `.data/`, SQLite files, or local project state in the ZIP.
- The client keeps tokens in process memory; it never sends a Social token to a game endpoint.
- LoopRD owns generic API/data infrastructure; Social owns profile/chat/account behavior; each game owns game rules and turn state.
- The next necessary server work is verified application-owned sessions, private social APIs and game-owned activity/invitation contracts. OIDC and cross-server service federation are not prerequisites.
