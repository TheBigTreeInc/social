> **v0.3.47 workboard planning pass (no new messaging or gameplay behavior):**
> Native OpenClaw-as-normal-Tavi-user channel, Life authoritative opponent turns and full Atrium multiplayer acceptance are planned in `docs/TAVI_NATIVE_CHANNEL_MULTIPLAYER_WORKBOARD_0347.adoc`. Reconciled exact v0.3.46 GitHub/ZIP evidence: `docs/TAVI_QA_0346_RECONCILIATION.adoc`.

## Tavi 0.3.46 — Launch published games and challenge OpenClaw

Windows Tavi now has a visible Games shortcut with operator-reviewed HTTPS game cards and Play buttons, plus a Challenge contact selector. The accepted OpenClaw Tavi account can receive challenges through Tavi Inbox and `tavi-agent.mjs challenges`, then manually accept/decline; optional supervised game/peer-allowlisted autoaccept is available in the existing OpenClaw service. This is a Social challenge handshake, **not** a Life game match or an OpenClaw legal-action implementation. No Social database migration from schema 10. See `docs/TAVI_OPENCLAW_GAME_CHALLENGES_0346.adoc` for setup and acceptance.

# Tavi 0.3.45 — Dedicated native multiplayer match chat (source candidate)

Builds on 0.3.44's approved game seat roster and private match messages. Windows Tavi now opens a separate match conversation window beside the Life game. The window carries only an opaque match-room ID, delegates all authorized requests to the main Tavi process and clears rendered message history after revocation. Browser/Android continue using their Games panel. **No new SQL migration** (Social remains schema 10); **no public Life `/play`** integration or game action authorization is claimed. See `docs/TAVI_NATIVE_MATCH_CONVERSATIONS.adoc`.

Prior exact v0.3.44 commit `f72dc541cdd338c463a75f61563dd754457febe1` has all eight GitHub push workflows successful; these are *not* v0.3.45 CI results. Multiplayer and native device acceptance remain open. Next implementation work should wire Life's actual authoritative async match API to Tavi consent, invitations and roster publication, then validate Atrium join/resume and headless OpenClaw turns.

# Tavi 0.3.44 — Multiplayer match conversations (source candidate)

Approved game backends may synchronize verified match seats into consenting-player-only private Tavi chat rooms via `tavi-game-room-roster/v1`. Revision-safe roster replacement and termination, private message feeds, shared SDK and Games-pane conversation UI. Adds Social schema 10. Life remains game authority, Atrium owns launch, Tavi owns only chat; no real match integration or operator approval yet. See `docs/TAVI_MULTIPLAYER_MATCH_CHAT.adoc`.

# Tavi 0.3.43 — LRS-004 account recovery candidate

Opt-in one-use recovery codes (180 days), safe password reset, all-old-session revocation, and a configurable global hourly registration limit. Additive Social SQL schema 9. Operator database backup/migration and physical-device tests are required before approval. See `docs/LRS_004_ACCOUNT_RECOVERY.adoc`.

## Tavi 0.3.42 — Android sign-in and reporter repair

TAVI-ANDROID-042 logged from Android screenshots: Social discovery timeout on api.thebigtree.life; raw Invalid URL when submitting pre-login report without valid server; system status bar overlaps Tavi header. This client-only pass makes discovery stages and transient 503 failures explicit, validates report origin, and applies Android status-bar spacing. Social schema 8 is unchanged; the real device/backend timeout remains an operator acceptance blocker. See docs/WORKBOARD.md.

## v0.3.41 — Game invitations and scoped identity proof

Tavi now supports service-origin invitations from approved games to accepted Social contacts, a recipient-controlled accept/decline path, and 5-minute one-use game-scoped account identity proofs redeemable by an approved same-runtime game component. This does **not** authorize Life seats or provide headless game rules. See `docs/GAME_INVITES_AND_GRANTS_0.3.41.adoc`.

## 0.3.40 — Game turn notifications (first integration pass)

Additive Social SQL schema 7, service-only `tavi-game-event/v1`, consented per-match notifications, durable Social inbox and SDK methods. Requires an operator-approved game caller, issuer and credential; actual Life/Atrium integration and shared game grants are NOT yet available. See `docs/GAME_EVENT_IMPLEMENTATION.adoc`.


## v0.3.39 — DAPI-aligned chat notification performance

LoopRD `pulses` and UnifiedPush `sync` messages are hints only. The Tavi foreground client now coalesces bursts through `client/src/sync-coordinator.js`, retaining a pending hint if a full refresh is in progress, and refreshes authenticated contact/conversation/active-DM/interactions without reloading the game turn catalog on every social event. The 25-second full poll remains for game alerts and reconnection. The existing `dm_conversations` and `dm_feed` server handlers are authoritative; private chat is **not** declared as a generic LoopRD snapshot resource, so `_sync` cannot be substituted without changing the application model. No new DAPI capability or Social migration.
# v0.3.39 — Login bug reports via LoopRD

Explicit **Report a login problem to LoopRD** control before authentication, using `reports.bugs` and `looprd-bugreport/v1`. Sends user-approved context with no credentials, displays issue receipt. LoopRD runtime must support reports.bugs and deploy regenerated descriptor. Does not itself resolve Android login.

# Tavi 0.3.39 — Resilient remembered sessions (client pass)

This version allows remembered sign-ins to recover when LoopRD was offline at
startup: bounded retries, immediate retry on network restoration/focus, visible
manual retry and account switching, and preservation of OS-protected credentials
on HTTP 403 or transient failures. Only HTTP 401 or explicit session removal
clears rejected credentials. Fixes duplicated trusted-device help copy. Windows
uses its existing DPAPI vault; native acceptance remains required.

LoopRD descriptor release is stamped **0.3.39** for version consistency; the Social
database remains **schema 6** with no data migration and no new server handlers.
The client changes work without redeploying the server, although the descriptor
must be pushed/reconciled for LoopRD to show the new release ID. See
`docs/SESSION_RECOVERY.adoc` and `ZIPRUNNER_HANDOFF.md`.

---

# Tavi 0.3.24 — Windows rebuild reliability and ecosystem administration subscriptions

Tavi accounts can now be promoted or demoted through **LoopRD -> Data & actions -> looprd-social -> Tavi accounts** using audited, named management actions. The `ecosystemAdmin` flag is false by default (additive Social schema 6). Trusted, privately configured LoopRD service callers can publish bounded HTTPS-link or acknowledgement notifications to all current admins through `tavi-admin-notify/v1`, and check current roles through `tavi-admin-role/v1`. The existing dynamic Inbox handles these events; no permanent admin UI is added. `docs/ECOSYSTEM_ADMIN.adoc` documents deployment and the private service secret mapping. Server push and native Android receiver remain separate acceptance gates.

**Server publication required:** this package's `looprd.yaml` declares release 0.3.24/schema 6; push source through Git and reconcile the LoopRD component. Do not push credentials, databases or state. The source tests passed locally but the live LoopRD runtime is not yet verified.

Tavi 0.3.18: server-backed conversation previews and cross-device read state (Social schema 5). Requires reviewed LoopRD descriptor publication. See docs/CONVERSATION_SYNC.adoc.

Tavi 0.3.17: chat notifications, unread badges, mobile/Windows conversation UX. Client-only; LoopRD descriptor remains server release 0.3.16/schema 4. See docs/CHAT_AND_NOTIFICATIONS.adoc.

Tavi 0.3.16: server-enforced event dismissal and filtered inbox; LoopRD release 0.3.16, schema 4; push/deploy server descriptor. No admin-role auto-routing or web SSO yet.

## Canonical design / browser client (v0.3.3)

The design is maintained in **`docs/DESIGN.adoc`** and the independent browser
SDK contract in **`docs/JAVASCRIPT_CLIENT.adoc`**. Windows, Android and the web
client share `client/sdk/looprd-social.js`. `client/src/protocol.js` re-exports
that implementation. **Same Social username/password on the same LoopRD
server = same account**, each device/tab receiving its own revocable session.
The browser build is an independent GitHub Actions artifact named
`social-web-client`, containing the static app and `sdk/looprd-social.js`.

Build/test: `cd client && npm install && npm run portrait:sync && npm run web:build && npm run web:verify`. Serve `client/dist/` over HTTPS or localhost.
Your LoopRD server must permit the web host's Origin (CORS). The JS SDK works
without Tauri or native build dependencies. A browser login is not magically
persistent across reloads: sign in again, and server-side profile/chat/contacts
are restored. No local account is created if Social is missing.

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

## Windows classic-messenger shell (v0.3.4)

The native Windows application now uses a narrow roster-sized main window rather than the older 1060-pixel-wide dashboard. Chats open in separate windows with no duplicated login credentials. `docs/DESIGN.adoc` is the authoritative UX acceptance contract. No server schema changes in this UI-only update.


## Dedicated ZipRunner project

Import `tavi-0.3.7-looprd-social-ziprunner.zip` into existing project `looprd-social`. Prefilled repository URLs are in `ziprunner-git-targets.json`; the existing LoopRD component ID is not renamed. See `GIT-REPOSITORIES.md`.

## Tavi identity

The native and web clients now use the custom Tavi speech/leaf mark and classic teal/forest accents. See `docs/BRANDING.adoc`. Icon source: `client/assets/tavi-mark.svg`. Client-only branding does not change `looprd.yaml`.


Interactive events: see `docs/INTERACTIVE_EVENTS.adoc`; LoopRD deployment and schema v4 upgrade required for inbox.


## Tavi 0.3.19 — UnifiedPush readiness (client-only)

This pass adds opt-in background-notification preferences, an explicit server-capability check, a bounded native wakeup contract, OS notification tests and Android resume synchronization. **No UnifiedPush distributor enrollment and no background delivery are implemented yet.** See `docs/PUSH_TRANSPORT.adoc`. `looprd.yaml` and Social schema 5 are unchanged from v0.3.18; no Git push required for this source/client change.


## Tavi 0.3.23 — LoopRD UnifiedPush backend contract

This source ZIP upgrades Social from public component auth to `auth.mode:
verified` with guest-scoped registration/login, durable events, and the
published LoopRD UnifiedPush device APIs. **Upgrade the LoopRD runtime and
publish `looprd.yaml` before expecting device enrollment**. There are no
existing users to migrate, but the new verified client credential contract
is a compatibility change for older clients. A real Android distributor
receiver is **not yet implemented**; see `docs/PUSH_TRANSPORT.adoc`.

## v0.3.23 — Windows remembered-device reliability

Windows now persists opt-in Tavi sessions using a per-user DPAPI-encrypted file in application data instead of WebView localStorage. Existing remembered tokens migrate on successful protected save; chat/game windows cannot read the native vault. Temporary offline startup retains saved credentials. Settings notification sections collapse to improve usability at the native roster size. Web/Android continue using existing origin-scoped storage. No Social schema migration is necessary (schema 6); native Windows DPAPI compilation/acceptance must still be completed through ZipRunner on Windows.

## Tavi 0.3.24 — Windows NSIS file-lock fix

Windows builds now close only this project's running `client/src-tauri/target/release/looprd-social-client.exe` before Cargo replaces it. The pre-build helper attempts a graceful close then, if necessary, forces termination of the path-verified PID; unrelated installed copies are unaffected. Native acceptance required. See `ZIPRUNNER_HANDOFF.md` and `docs/LOCAL_BUILD.adoc`. Schema 6 unchanged.


## OpenClaw integration v0.3.39

A standalone headless Tavi account CLI and copyable OpenClaw agent instructions are in `integrations/openclaw/`. Use a dedicated Tavi user and private session. Chat and contacts are supported; game discovery is read-only until games implement agent-specific player/action contracts. The integration is a CLI adapter (not yet a native OpenClaw channel plugin). LoopRD schema 6 unchanged.

## v0.3.39 — GitHub clients, SDKs and Pages

See [docs/PUBLIC_CLIENTS.md](docs/PUBLIC_CLIENTS.md) and [sdk/README.md](sdk/README.md). Pages is opt-in through repository Settings; publishing the source alone does not activate Pages.


## Tavi 0.3.39 — GitHub Actions coverage repair

The 0.3.27 GitHub Pages run failed **after successful Vite build** because the GitHub Pages site was not configured: `actions/configure-pages@v5` returned 404. In 0.3.39 the web client is always uploaded as a downloadable build artifact; Pages deployment still requires the repository owner to select **Settings → Pages → Build and deployment → GitHub Actions**. The deployment job is intentionally allowed to fail visibly until Pages is enabled.

The Linux/macOS native workflow now runs on main pushes and relevant PRs, producing a Linux amd64 `.deb` and macOS Apple Silicon `.dmg` subject to CI success. The SDK source-package workflow produces JavaScript, Python, Go, C# and OpenClaw bridge ZIPs, without implying binary distributions for language libraries. Artifacts are retained for 30 days. Native Linux/macOS workflows require remote GitHub runner verification. Social DB schema remains 6.


## Tavi 0.3.39 — Native conversation history fix

Windows chat-window peer validation previously required at least eight characters, but the server issues short IDs such as `acct_1`. Notifications worked through the main roster, while the native chat window rejected those IDs before loading history. The validator now accepts only the server-issued `acct_[1-9][0-9]{0,18}` form (and `lobby`), with regression tests for short IDs and malformed inputs. No schema migration or backend API change.

## Verified GitHub releases (v0.3.39)

After a push to `main`, the `Publish verified Tavi release` workflow waits for seven required CI workflows to pass **on the same current commit**, verifies their artifacts, and publishes a `vX.Y.Z` tag plus a GitHub Release containing six downloadable ZIP bundles. The version comes from root `package.json`. Each source release must bump that version; existing tags are never overwritten. SDK checks and SDK packaging run on every main push to ensure the gate can complete. GitHub Pages hosting is not part of the gate because Pages must be enabled in repository settings. See `docs/RELEASE_PROCESS.md`.

## v0.3.39 — Signed Android upgrade distribution

See `docs/ANDROID_UPDATES.md` for the mandatory signing secrets, one-time debug-to-release migration, and remaining native installation work.

## v0.3.39 Android in-app upgrade
Native Android Update now starts a scoped DownloadManager download for the validated signed APK and hands it to Android package installer, requiring OS approval. See `docs/ANDROID_IN_APP_UPDATES.md`. Native acceptance pending.

### v0.3.39 Android build correction
The Android signed-release workflow now reads Tauri APK output at `gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk`, verifies its signature with Android SDK `apksigner`, and stages one APK for GitHub Actions release artifacts. No native runtime behavior changes.


## v0.3.39 — Nearby/offline gameplay foundation

Added `client/src/nearby/local-session.js` offline turn journal with chain verification, local persistence, explicit server sync prefix and conflict detection. See `docs/NEARBY_LOCAL_SESSIONS.md`. **No Bluetooth pairing, nearby chat, game adapter or cloud synchronization is implemented in this release.** No Social schema migration.

## 0.3.39 OpenClaw notification-driven bridge
Persistent Tavi WebSocket pulse consumer with authenticated DM reconciliation and opt-in OpenClaw CLI agent reply service. See integrations/openclaw/README.md. This is not an installed native OpenClaw channel; live Gateway acceptance outstanding.


## v0.3.39 — OpenClaw sender identity

Tavi now sends the contact’s verified username and profile-selected display name through the bridge to OpenClaw. `acct_N` remains an internal routing ID, not a name. This requires deploying the updated LoopRD Social component to expose the `displayName` field in `contact_list`; the bridge falls back to `username` with older runtimes. No database migration is needed.
