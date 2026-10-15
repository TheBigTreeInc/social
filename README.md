## Classic MSN/Xfire-style client refresh (0.3.2)

Desktop no longer uses three thick dashboard panels. The light-themed client has compact separate-looking roster and conversation panes, a real File/Contacts/Actions/Tools/Help menu, thin Windows-style chrome, collapsible Online/Offline contact groups, inline contact search, small game/turn listings, an old-style chat transcript, and a multiline message composer. Mobile displays roster and conversation separately. The underlying component, sessions, private chat, alerts, portrait generator and server permission boundary are unchanged. The chat panes remain inside one native window for this release.

**No SQL schema change:** v0.3.2 retains Social database `schemaVersion: 3`. The generated `looprd.yaml` release changes solely to match the source package version. If the running LoopRD dashboard reports `load: ValueError`, inspect the server logs before attempting a new activation; a cached older component can keep serving while new revisions fail. A ZipRunner update does not itself mean the running LoopRD component has activated.

# LoopRD Social 0.3.2 — classic gaming messenger

One repository, one ZipRunner project (`looprd-social`): Social server component and a compact MSN Messenger/Xfire-inspired client for Windows and Android.

## Optional server-granted Admin / Debug tools (v0.3.1)

New accounts (and upgraded existing accounts) have `SocialAccount.developerEnabled = false`. **Only an operator with OS/database access on the LoopRD host** can enable the flag; there is intentionally no client-facing privilege-grant operation, and the normal user cannot grant it to themselves. This is a Social-scoped developer entitlement **not a LoopRD platform admin role**. It grants **read-only, sanitized Social diagnostics**, not access to message contents, tokens, passwords, environment, the LoopRD management API, or raw database queries.

After backing up your database and activating the generated `looprd.yaml` (additive schema v2 → v3), use the operator script **on the server where LoopRD stores the Social database**:

```sh
python tools/social-developer-access.py \
  --db /path/to/looprd-data/databases/looprd-social.sqlite3 \
  --user alice --enable
```

To inspect or revoke the flag, replace `--enable` with `--show` or `--disable`. The username must belong to an already registered Social account. The script refuses an absent database, missing account, or schema older than v3 and does not create users or databases. Do not copy this database into the client or expose the command over the Social API. The actual LoopRD data directory depends on the host/container mounts; the path above is only a placeholder.

When a permitted user connects, **Settings → Show developer tools** appears, initially off. Switching it on adds **Admin / Debug** to the navigation; switching it off only hides the panel and never changes server permissions. The server rechecks permission on every diagnostics request; the client rechecks `me` on refresh, discarding the panel and its data when the flag is revoked. A client that fakes the switch still receives a permission-denied response. Existing development tokens do not grant developer access. Diagnostic values include release, schema version, server clock, aggregate counts, client connection/WebSocket state and game activity errors, **never private user data**.

**Activation note:** This ZIP updates source files and project manifests. Deploying `looprd.yaml` from an old schema 1 or 2 deployment may run the existing migrations to schema 3; updating from v0.3.1 schema 3 requires no new migration; installing in ZipRunner alone does not migrate a live database. Back up before deployment and verify the change on a disposable/restored database first. No client rebuild is needed when toggling a user's server flag, but installing v0.3.2 client code requires the normal Windows/Android rebuild.

## User onboarding

Open the client, enter the **LoopRD server origin** (HTTPS; localhost HTTP only for development) and select **Find Social**. The client checks `GET /looprd/looprd-social/v1/info`, then asks Social for `capabilities`. If Social isn't running there, it explains the missing component **without creating an account, storing chat data or falling back to another server**. A supported server offers **Register** and **Sign in**. Choose a unique username and a password of 12–128 characters. No admin-issued token and no OIDC provider are required. Social issues a random device session automatically; no token is shown to the user.

The same credentials can sign in from Windows and Android (separate revocable sessions), with shared profile, buddy list and direct messages on that server only. Tokens are held **in process memory** in v0.3.2: sign in again after app restart. No account or password gets stored in client localStorage; password hashes and session-token hashes are stored in the Social component's database. Logout revokes only the current session.

## Architecture and security

- LoopRD is generic API, SQL storage, event and access infrastructure; Social owns usernames, password hashing, sessions, contacts and messages; games own game state and turns.
- Existing `looprd/v1` component at `looprd.yaml`, component ID `looprd-social`; the descriptor is generated from `server/looprd_handler.py` using `python tools/generate-looprd.py` and hashed by `python tools/update-looprd-link.py`.
- SQL schema version **3**, adding a false-by-default `SocialAccount.developerEnabled` boolean to the existing v2 tables. The earlier v1→v2 additive migration remains present. Existing SocialProfile, SocialMessage, SocialPulse and old dev-token accounts remain unchanged. **Back up the component database before applying this migration.** LoopRD does not automatically downgrade schemas.
- Social actions `register`, `login`, `logout`, `contact_list`, `contact_request`, `contact_accept`, `contact_remove`, `dm_feed`, `dm_send` are additional JSON operations at `POST /looprd/looprd-social/v1/social`. Existing `me`, `save_profile`, `chat_feed`, `chat_send` and opaque pulse events continue to work.
- Passwords use salted standard-library scrypt; account logins lock temporarily after five failures; sessions are random, individually revocable and expire after 30 days. Generic LoopRD per-client rate limits are declared.
- Contacts consent before DMs; message text is only returned to participants and only after a current accepted friendship check. Presence reflects recent authenticated activity, not arbitrary client claims. Public pulses contain no private content.
- **Public registrations are enabled by default** for this first trial. The operator can set `LOOPRD_SOCIAL_ALLOW_REGISTRATION=false` on the LoopRD server to disable registration, retaining login. A publicly exposed service still needs abuse controls, moderation, recovery and security review before production deployment. Protect the LoopRD API with HTTPS.
- Client and game components use the same selected server; Social credentials never go to game endpoints. No automatic federation, cross-server discovery, or sharing of game passwords.
- Turn alerts require games to provide `looprd.game.activity/v1` (see `client/docs/GAME_ACTIVITY_CONTRACT.md`). Android notifications after app termination require push infrastructure not yet implemented.
- Built-in portrait workshop remains sourced from official `TheBigTreeInc/assets` with reviewable updates. The numeric portrait value remains a canonical string stored on Social.

## Build / verify

```sh
npm run test
node client/tools/check-package.mjs
python tools/generate-looprd.py --check
python -m unittest discover -s tests -p 'test_*.py' -v
```

Local frontend development (Node 22+):

```sh
cd client
npm install
npm run portrait:sync
npm run dev
```

GitHub Actions: `.github/workflows/verify.yml`, `windows.yml` (Windows NSIS), `android.yml` (ARM64 debug APK), and `portrait-updates.yml`. The previous v0.2.3 Android attempt failed at Tauri initialization due to `bundle.targets:["apk"]`; v0.3.0 removed the unsupported configuration. Native builds have **not been completed for v0.3.2**.

## Deployment

Use `looprd-social-0.3.2-ziprunner.zip` in the existing `looprd-social` ZipRunner project. Do not create a second project. Preserve existing credentials, SQLite database and node secrets. Deploy/activate the generated `looprd.yaml` in the LoopRD server separately under normal operator controls; installing a ZIP does not itself authorize a database migration. Configure allowed origins for the native Tauri app/web preview when required. Review `ZIPRUNNER_HANDOFF.md` and `evidence/auth-and-ux-tests.md` before release.
