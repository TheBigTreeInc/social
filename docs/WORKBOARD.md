## Multiplayer priority override — Tavi v0.3.46 (review candidate)

- **TAVI-MULTI-046 — Review candidate, NOT Done:** Windows Games roster shortcut and operator-published catalog with Play/Challenge, account-to-account challenge workflow, explicit OpenClaw accept/decline or opt-in allowed auto-accept. Schema 10; no new tables.
- **Live acceptance pending:** the Windows installer, real Life HTTPS URL, operator LoopRD deploy and OpenClaw supervised process must be tested. Game challenge acceptance is NOT Life match creation or gameplay.
- **Preserve latest local operator workboard:** 72 tickets; 39 Review, 20 Planned, 12 Deferred, 1 Suggested; no ticket marked Done. Existing SCL-007, TAVI-032, TAVI-MULTI-044/045 remain open. Critical client decomposition remains deferred under the user's multiplayer-priority override.
- **Next P0:** Life authenticated /play create/join/resume and OpenClaw game-seat/action adapter, then Atrium launch and E2E match acceptance.
- Contract and setup: `docs/TAVI_OPENCLAW_GAME_CHALLENGES_0346.adoc`.

## Multiplayer priority override — v0.3.45 source candidate

- **TAVI-MULTI-045** (Review pending operator): separate native Windows match conversation with verified seat/consent; source tests pass. Real Life, Windows, Atrium acceptance open.
- **TAVI-MULTI-044** (Review pending operator): game-owned seat roster and private room conversation remains open until real Life publication and cross-client testing.
- **SCL-007 / TAVI-032**: remain Planned; Tavi chat infrastructure alone does not finish hostless multiplayer.
- **engineering-review-main-cc2aac2e**: preserve as Suggested/Critical in latest operator snapshot; temporarily postponed under explicit user multiplayer-priority override. No decomposition done.
- Local ZipRunner operator workboard (71 tickets) remains the authority. A source update must not delete or change statuses of unrelated tickets.

## TAVI-ADMIN-001 — Ecosystem administrator event delivery (0.3.23)

Implemented in source: LoopRD protected Tavi accounts management declarations,
operator-audited promote/revoke actions, additive schema 6 administrator flag,
verified machine service principals loaded from private secret references,
`tavi-admin-notify/v1` and `tavi-admin-role/v1` service contracts, per-admin inbox
fanout and transaction-bound opaque event/UnifiedPush notifications. De-promotion
immediately removes access to service-issued inbox events; existing Tavi chat UI
remains unchanged. Python regression coverage added in
`tests/test_ecosystem_admin.py`; live LoopRD reconciliation and production machine
credential provisioning must be validated by operator. See `docs/ECOSYSTEM_ADMIN.adoc`.

# Work board — Social 0.3.2

- SCL-019: classic slim Windows Messenger UI in source; awaiting native/operator visual acceptance.
- SCL-018: server-gated developer mode implemented in 0.3.1 and preserved; no privilege changes this pass.
- SCL-010: native GitHub Windows/Android build and device acceptance pending for this release.
- LRS-004: account recovery / hardened public registration remains open.
- SCL-007: private groups and trusted invites remain open.
- SCL-009: Android background notifications remain open.
- SCL-011: game activity contracts depend on game components.
- SCL-017: secure remembered-device login remains open.


## TAVI-CHAT-001 — Foreground chat notifications, unread state and mobile usability (0.3.17)

Implemented in source: per-contact unread badges, bounded rotating DM feed scans, local per-account read state, private-by-default OS notifications, separate-window seen acknowledgments, chat composer live refresh, Android safe-area/touch improvements. Awaiting Windows installer and Android foreground acceptance. Background mobile push and server inbox summaries remain future work.

## TAVI-CHAT-002 — Server inbox and synced read cursors (0.3.18)

Implemented producer-side in schema 5. Client syncs one mailbox summary per
refresh and obtains full chat only for the open peer; older server fallback
retained. SQL ownership, monotonic cursor and client reconciliation tested.
Must undergo operator two-device verification before Done.

## TAVI-CHAT-003 — Android closed-app push (pending)

Client preparation v0.3.19 now includes default-off per-device consent, strict capability parsing, OS notification test, content-free wakeup validation and foreground resume sync. LoopRD-owned UnifiedPush/ntfy enrollment, distributor discovery/receiver, rotation/revocation and *real suspended/closed-app delivery* remain open and require Android device acceptance. FCM is optional.

## TAVI-PUSH-001 — Provider-independent push client preparation (0.3.19)

Implemented client-side readiness and tests; no new server operations or database changes. **Do not mark as verified** before checking OS notification UI and Android resume behavior on devices. See `docs/PUSH_TRANSPORT.adoc` and `client/tests/push-readiness.test.mjs`.

== TAVI-SESSION-002 — Windows secure device sign-in (0.3.23)

* Implemented: main-window-only Tauri commands for Windows DPAPI-encrypted local session file; async client adapter; migration of existing saved localStorage sessions; explicit signout/disable; offline restore retains vault; collapsible settings sections and focused regression tests.
* Acceptance remaining: Windows NSIS compilation and real OS DPAPI save/restore, secondary webview access denial, offline/revoked session, compact Settings scrolling. Android Keystore is not included in this pass.
* Git/LoopRD: all version metadata is 0.3.23; descriptor application schema remains 6. Review/push the generated `looprd.yaml` to keep server revision synchronized; no database schema bump.

== TAVI-BUILD-LOCK-024 — Windows target executable build lock

Delivered in v0.3.24: `tools/stop-running-tavi.ps1` path-specific stop, called from `BUILD-LOCAL.ps1` before Tauri/Rust NSIS compilation. Source test `client/tests/windows-build-lifecycle.test.mjs` added. Windows native acceptance remains required: rebuild while previous target/release Tavi is running and confirm generated NSIS succeeds, without terminating unrelated installations or deleting local/generated state.

== TAVI-SESSION-RECOVERY-025 — Resilient remembered-session reconnection

Source-delivered in v0.3.39: preserve Windows OS-vault credentials during 403,
429, 5xx and network errors; allow explicit retry or alternate account; bounded
8/16/32/60-second retries and event-based acceleration without overlapping
attempts; cancellation on successful login or sign-out. Node unit tests cover
failure classification and timer behavior. Windows runtime DPAPI/reconnect and
native chat acceptance still require the operator's device.


## Tavi 0.3.39 — GitHub Actions coverage repair

The 0.3.27 GitHub Pages run failed **after successful Vite build** because the GitHub Pages site was not configured: `actions/configure-pages@v5` returned 404. In 0.3.39 the web client is always uploaded as a downloadable build artifact; Pages deployment still requires the repository owner to select **Settings → Pages → Build and deployment → GitHub Actions**. The deployment job is intentionally allowed to fail visibly until Pages is enabled.

The Linux/macOS native workflow now runs on main pushes and relevant PRs, producing a Linux amd64 `.deb` and macOS Apple Silicon `.dmg` subject to CI success. The SDK source-package workflow produces JavaScript, Python, Go, C# and OpenClaw bridge ZIPs, without implying binary distributions for language libraries. Artifacts are retained for 30 days. Native Linux/macOS workflows require remote GitHub runner verification. Social DB schema remains 6.


## Tavi 0.3.39 — Native conversation history fix

Windows chat-window peer validation previously required at least eight characters, but the server issues short IDs such as `acct_1`. Notifications worked through the main roster, while the native chat window rejected those IDs before loading history. The validator now accepts only the server-issued `acct_[1-9][0-9]{0,18}` form (and `lobby`), with regression tests for short IDs and malformed inputs. No schema migration or backend API change.

### TAVI-AGENT-004 — Sender identity for OpenClaw (v0.3.39)
Authenticated contacts now include chosen displayName alongside verified username. The watcher forwards both to the OpenClaw prompt while keeping acct_N as the internal routing key.


## TAVI-ANDROID-042 — Android discovery timeout, invalid pre-login bug report, status bar overlay (high, 2026-10-18)

* **Reported:** User screenshots show Tavi disconnected with `Server discovery timed out.` using `https://api.thebigtree.life`. With an empty/default server field, **Report a login problem** failed with `Failed to construct 'URL': Invalid URL`. System status/time/battery glyphs overlap the header.
* **Reproduction:** On Android open Tavi sign-in, enter `https://api.thebigtree.life`, tap Connect and wait for discovery; separately leave server field empty, expand login problem, send a report. Check status icons above the top bar.
* **Initial source finding:** Discovery used one 12-second AbortController for both GET `/looprd/looprd-social/v1/info` and POST `/looprd/looprd-social/v1/social` capability requests; error lacked stage/network classification. Reporter called `new URL(origin)` without validating the empty form field. Android lacked a reserved minimum top inset for edge-to-edge display.
* **v0.3.42 source fix:** Independent 15-second per-request deadlines with stage-specific timeout messages, safe network-error guidance and distinct 404/503 behavior. Reporter validates the origin before dispatch and shows a useful explanation rather than a raw JavaScript URL error. Android reserves an appropriate top safe-area inset and moves the login form toward the top. Source regression tests in `client/tests/protocol.test.mjs` and `client/tests/bug-report.test.mjs`.
* **Status: SOURCE FIXED; DEVICE ACCEPTANCE OPEN.** A source test does not prove why the actual endpoint timed out on the phone. No device network telemetry, production API uptime, APK or Android-rendered visual acceptance was available. The reporter cannot send a report if there is no configured reachable LoopRD server, by design.
* **Operator acceptance:** Update Android APK; test real valid-host sign-in on Wi-Fi and cellular; check `/info` and `/social` reachability and TLS/cert from phone; verify stage-specific error for a controlled timeout and 503; verify bug report via an otherwise reachable server with a failed login; verify no raw `Invalid URL`; visually verify Android status bar and top header across different insets and after keyboard open. Collect only non-sensitive status/error timings (no tokens or credentials).
* **Follow-up:** If `https://api.thebigtree.life` still times out in v0.3.42, inspect deployed DAPI component status, reverse proxy routes, mobile DNS/TLS and server logs; do not claim a backend fix from this client-only pass.


## LRS-004 — Account recovery and hardened public registration (high; v0.3.43 source candidate)

* **Implemented in source:** Authenticated password-confirmed creation/rotation of eight 160-bit single-use recovery codes; hashed-at-rest, 180-day expiry, status/revocation, five-attempt recovery lockout for 15 minutes, generic rejected recovery responses, account-specific verified recovery, revocation of all prior device sessions, and one fresh session on successful password reset. Public registration receives a configurable global hourly backstop (`LOOPRD_SOCIAL_REGISTRATION_HOURLY_MAX`, default 60) in addition to existing LoopRD admission/rate controls. Users can generate codes in Settings, then recover from the Sign-in screen. The same API is exposed through shared browser/Windows/Android JS SDK. Source tests: `tests/test_account_recovery.py` and browser SDK tests.
* **Deployment:** Additive SQL schema 9; back up Social database first and validate DAPI descriptor/migration before promotion. Recovery codes are visible once only, do not appear in database, report or notifications, and must be saved offline by the account owner. Legacy accounts start without codes until opted in. Registration can still be entirely disabled with `LOOPRD_SOCIAL_ALLOW_REGISTRATION=false`; recovery remains available.
* **Status: REVIEW / OPERATOR ACCEPTANCE OPEN.** Live migration, persistent DB/restart, native Android/Windows screens, codes copied/stored safely, concurrent recovery race and multi-device revoked-session behavior require staging and device verification. The global hourly cap is an additional backstop and does not replace edge-level abuse controls or pre-auth per-origin limits. No email, SMS or external recovery identity is claimed.
* **Operator acceptance:** Confirm old accounts/chats and invitations survive schema 8→9; issue codes on device A after password prompt, store them offline, sign into device B, recover from a signed-out device C, confirm A/B revocation and one fresh C session, verify one-use/rotation/expiry/lockout and a wrong-account code cannot recover another user; verify registration cap without affecting login. Restore from backup on migration failure.
* **Next:** Independent production DAPI migration and real-device acceptance; additional rate-limit/abuse telemetry and operator recovery support if required. Do not mark Done until independently reviewed.


## Multiplayer priority override — Tavi 0.3.44

Operator requested prioritizing shared multiplayer until Life/Atrium/Tavi interoperability is proven. This supersedes the suggested order of LRS-004 and other non-multiplayer work for *new source passes*, but does not mark those tickets Done or alter their acceptance criteria.

- `TAVI-MULTI-044`: reviewed-source candidate for private, game-seat-scoped match conversation and revision-safe roster sync. Requires schema 10, Life backend service, cross-device and role/revocation acceptance.
- `SCL-007`, `TAVI-032`, `SOC-GAME-02B`, `TAVI-031`, `TAVI-AGENT-002`: still open until actual shared multiplayer gameplay and OpenClaw turn API integration are proven.
- `LRS-004` stays Review; recovery/reporting/Android networking operator acceptance not silently closed.

See `TAVI_MULTIPLAYER_MATCH_CHAT.adoc`.
