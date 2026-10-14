# Looprd Social — native Looprd service v0.2.1

**Separate service/repository** for cross-game display profiles, modular portrait selections, and a small social lobby. The authoritative game Looprd instance (The Life Loop or another game) remains independent.

This release contains a real **Looprd v1 deployable `looprd.yaml`**, generated from `server/looprd_handler.py`, plus a `looprd-social.zr` ZipRunner project descriptor. It also retains the previous local JavaScript proof-of-concept server, and adds a loopback REST compatibility bridge for The Life Loop v0.5.45.

**Security status: development only. Do not deploy on a public internet endpoint with development tokens.** OIDC, game-ticket trust, account recovery, friend lists and moderation are NOT implemented.

## Included files

| File | Role |
|---|---|
| `looprd.yaml` | Self-contained Looprd v1 component with SQLite models, read-only pulse resource, WebSocket subscription, and embedded Python handler |
| `server/looprd_handler.py` | Editable source of the Looprd `/social` action handler |
| `tools/generate-looprd.py` | Regenerates and checks the embedded handler source |
| `looprd-social.zr` | ZipRunner project configuration (project key `looprd-social`) |
| `.ziprunner-workboard-update.json` | Compatible workboard v1 handoff with completed and blocked scope |
| `bridge.mjs` | Loopback REST facade mapping Life Loop's existing profile/chat HTTP calls to native Looprd `/social` |
| `server.mjs` | Original standalone local-only Node development server; does not use Looprd persistence |
| `tests/` | Native SQLite/descriptor and JS bridge/API regression tests |

## Native Looprd deployment

1. Register a separate **`looprd-social`** component/instance in your Looprd infrastructure. Import the packaged `looprd.yaml` (or allow ZipRunner to stage this source project). Keep it separate from the `the-life-loop` component and its SQLite database.
2. Configure the **Looprd server process environment** using a protected secret (not a file in Git):

   ```powershell
   $env:LOOPRD_SOCIAL_DEV_TOKENS_JSON = '{"user_alex":"REPLACE_WITH_A_RANDOM_SECRET_AT_LEAST_24_CHARACTERS"}'
   ```

   This JSON maps each test subject ID to its own development token. Supported IDs are 8–72 letters, digits, `_`, or `-`. Do not use the example secret in production.
3. Deploy/reload `looprd.yaml` through your usual Looprd component deployment. **This package does not contain the Looprd platform binary or a runner for it**; your existing Looprd runtime supplies the HTTP, SQLite and WebSocket integration.
4. Test the native action endpoint **at the component's routed base URL** (adjust the URL to the path shown by your Looprd deployment):

   ```powershell
   $token = '<the-development-token-configured-on-the-server>'
   $body = @{ op = 'me'; token = $token } | ConvertTo-Json
   Invoke-RestMethod -Uri 'http://127.0.0.1:YOUR_LOOPRD_PORT/social' -Method Post -ContentType 'application/json' -Body $body
   ```

   Other supported `op` values: `save_profile` (`profile` object), `chat_feed`, `chat_send` (`text`), `game_ticket` (always refused). Responses are `{ok:true,...}` or `{ok:false,error:...}`. The public Looprd `/events` stream only emits an opaque `pulses` signal; it never contains a token, message, or profile.

### Connect The Life Loop v0.5.45 without modifying its JavaScript

The existing game client expects `GET/PUT /v1/me` and `GET/POST /v1/chat/lobby`, while verified Looprd v1 custom handlers use a JSON action body over `POST /social`. Run the local compatibility bridge:

```powershell
$env:LOOPRD_SOCIAL_LOOPRD_URL = 'http://127.0.0.1:YOUR_LOOPRD_PORT/social'
$env:LOOPRD_SOCIAL_ALLOWED_ORIGINS = 'http://127.0.0.1:8080,http://localhost:8080'
node bridge.mjs
```

The bridge listens on **127.0.0.1:8947**, forwards only the allowed profile and lobby operations, and maps the game's Bearer token to the Looprd action. Open The Life Loop over `http://127.0.0.1:8080`; in Profile, choose `http://127.0.0.1:8947`, and enter that same test user's development token. Do not run `bridge.mjs` and `server.mjs` on the same port simultaneously. Native Looprd must be running for the bridge to work.

For a quick *standalone development test without Looprd*, `LOOPRD_SOCIAL_DEV_TOKEN` (24+ chars) plus `node server.mjs` still works, but stores its own `.data/profiles.json` and is **not** the native Looprd service.

## Trust and data boundaries

- Social owns: `profileId`, `displayName`, appearance identity, bounded lobby history (up to 100 entries; 7-day time window).
- Games own: turns, jobs, money, game state, saves, inventories, matchmaking room capabilities.
- The social server **never** issues game-room credentials in v0.2.1. In future, game Looprd instances must verify signed, short-lived audience-scoped credentials from a trusted identity issuer.
- Social data never appears in public Looprd `resources` or WebSocket pulse payloads. Credential checks live inside the action handler; `auth.mode: public` alone is **not** authentication.
- Treat development tokens as passwords. Do not paste them into chats/logs, check them into Git, or send them over non-local HTTP. The bridge refuses plain HTTP for remote Looprd URLs and binds to loopback only.
- For shared/public deployment, replace the development credential mechanism with OIDC Authorization Code + PKCE, server-validated JWTs, scoped user privacy, rate limiting, moderation, TLS, key rotation, and a purpose-built cross-game ticket issuer.

## Verification

```powershell
node --test tests/*.test.mjs
python -m pip install -r requirements-dev.txt
python tools/generate-looprd.py --check
python -m unittest discover -s tests -p 'test_*.py' -v
```

`looprd.yaml` is **generated**. Modify `server/looprd_handler.py`, then run `python tools/generate-looprd.py` and commit both. The ZipRunner build command deliberately uses the dependency-free Node suite; extended Python native tests run with the Looprd Python dependencies in your test environment.

## Version compatibility

- Game-side profile contract: `looprd.social.profile/v1` and `modular-portraits.identity/v1`.
- Native social action contract: Looprd `POST /social` (not a replacement for the older Life Loop REST API; use `bridge.mjs`).
- Looprd descriptor: `looprd/v1`; SQLite schema version 1.
- ZipRunner source package: `looprd-social-0.2.0-ziprunner.zip`.

No git push or server deployment is performed by this package.

## v0.2.1 loader validation repair

Looprd requires **every** primary key to be an integer with `generated: true`.
The earlier `SocialPulse.id` declared `primaryKey: true` without `generated: true`,
which causes `load: ValidationError` *before* any database activation. The fix is
a source-generator change and regenerated `looprd.yaml`. The SQLite schema version
remains 1; no migration, table replacement or database reset is needed.

Run `python -m looprd validate looprd.yaml` in a Looprd-enabled environment.
`python tests/test_loader_contract.py` provides focused checks without requiring
the Looprd runtime. Do not deploy development tokens on a public endpoint.
