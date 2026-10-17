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

Source-delivered in v0.3.34: preserve Windows OS-vault credentials during 403,
429, 5xx and network errors; allow explicit retry or alternate account; bounded
8/16/32/60-second retries and event-based acceleration without overlapping
attempts; cancellation on successful login or sign-out. Node unit tests cover
failure classification and timer behavior. Windows runtime DPAPI/reconnect and
native chat acceptance still require the operator's device.


## Tavi 0.3.34 — GitHub Actions coverage repair

The 0.3.27 GitHub Pages run failed **after successful Vite build** because the GitHub Pages site was not configured: `actions/configure-pages@v5` returned 404. In 0.3.34 the web client is always uploaded as a downloadable build artifact; Pages deployment still requires the repository owner to select **Settings → Pages → Build and deployment → GitHub Actions**. The deployment job is intentionally allowed to fail visibly until Pages is enabled.

The Linux/macOS native workflow now runs on main pushes and relevant PRs, producing a Linux amd64 `.deb` and macOS Apple Silicon `.dmg` subject to CI success. The SDK source-package workflow produces JavaScript, Python, Go, C# and OpenClaw bridge ZIPs, without implying binary distributions for language libraries. Artifacts are retained for 30 days. Native Linux/macOS workflows require remote GitHub runner verification. Social DB schema remains 6.


## Tavi 0.3.34 — Native conversation history fix

Windows chat-window peer validation previously required at least eight characters, but the server issues short IDs such as `acct_1`. Notifications worked through the main roster, while the native chat window rejected those IDs before loading history. The validator now accepts only the server-issued `acct_[1-9][0-9]{0,18}` form (and `lobby`), with regression tests for short IDs and malformed inputs. No schema migration or backend API change.
