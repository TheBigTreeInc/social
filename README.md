## Tavi 0.3.174 — Store native interaction polish (source candidate)

At the top of the Store, pulling down refreshes TaviX and Assets discovery without reloading the messenger; keyboard users have a footer Refresh action. Simplified four-category layout fits compact windows, profile is borderless and artwork/title open details. Eligible installed apps offer Open, reviewed uninstalled apps offer Install (existing confirmation required), and only trusted free local asset packs offer Install (existing consent required). No Gold checkout or publisher-grant change. The Workboard update is a two-ID delta: see docs/qa/workboard-0.3.173-source-snapshot.json for the preserved old source snapshot; local 239-ticket operator Workboard is not replayed. Windows/Android native acceptance and exact post-update/CI evidence remain pending. See `docs/TAVI_STORE_TOUCH_INTERACTIONS_0174.adoc`.

### LoopRD schema-13 nullability repair (0.3.154)

Fixed `SocialAccount.companionRevision` migration to `INTEGER DEFAULT 0` rather than `INTEGER NOT NULL DEFAULT 0`, matching its optional LoopRD model field. Strict SQLite ADD COLUMN preflight now checks reflected SQL type, VARCHAR length and required/nullability for every modeled addition; a schema-12→13 fixture verifies account preservation and Companion initialization. Generated server descriptor release 0.3.125; database target stays 13, and publication remains approval-gated. See `docs/TAVI_LOOPRD_SCHEMA13_NULLABILITY_0154.adoc`.

## Tavi 0.3.151 — approved Windows/Android release publication

The source includes a separate, **manual** `Publish approved Tavi release` GitHub Actions workflow. The existing candidate preparation workflow remains read-only. Publication requires the exact successful candidate SHA and workflow-run ID, operator acceptance reference and explicit confirmation; the write job targets the protected `tavi-public-release` GitHub environment (required reviewers must be configured in GitHub Settings). It verifies the accepted Windows EXE, signed Android APK, artifact ZIPs, checksums, tag target and source version before creating a release or appending only missing assets. The existing `v0.3.150` empty release can be filled from its accepted candidate without rebuilding or overwriting other files. See `docs/TAVI_APPROVED_RELEASE_PUBLICATION_0151.adoc`. **No publication is performed by installing this ZIP.**

# looprd-social 0.3.150 — Windows + signed Android candidate first

Base: 0.3.149. Introduced an explicitly scoped, manual `windows-android` release-candidate workflow requiring four exact-commit successful push workflows (source, Windows, Android, browser UI QA). It packages two installer ZIPs and direct Windows EXE + Android APK with checksums and review-only metadata. The original eight-workflow `full` profile remains available for later Linux/macOS/SDK delivery. No automatic push, GitHub tag, release publication or LoopRD deployment. See `docs/TAVI_WINDOWS_ANDROID_CANDIDATE_0150.adoc`.

Local tests and native acceptance must be reported separately; real GitHub runs for the **next** pushed commit are pending.

## 0.3.149 — browser QA Notepad navigation repair

`client/tools/ui-qa.mjs` now tests the real Settings-origin App Store Back route after installing Notepad. The previous test incorrectly expected the Apps drawer. Added `client/tests/ui-qa-notepad-back-149.test.mjs` to guard Settings and Apps return contexts. This change is test-only; product navigation and gates are unchanged. Run the five-viewport Playwright QA on ZipRunner's Windows host for operator evidence.

## 0.3.148 — browser QA strict locator repair

The browser QA `Contacts directory and Add friend as action` flow now opens App Store via `#tavi-app-page-1` (the selected All tab). Favorites and All both retain App Store in the DOM, so the former `.tavi-menu-grid [data-action="app-store"]` selector matched two controls and failed Playwright strict mode on all five viewports. A new source regression ensures the active-tab selector stays explicit. No application behavior or approval gates change.

Real five-viewport browser execution remains required in ZipRunner; source tests alone do not prove the browser flow.

## 0.3.146 CI entrypoint and Android release-gate repair

CI direct root/client test and web-build routes now execute the same SHA-guarded legacy Companion cleanup before extension integrity checks. This covers Windows, Android, web, browser UI and cross-platform desktop CI without relaxing the approved Companion pin. Android release-candidate Python test now verifies the actual AST inequality and raising guard rather than whitespace formatting. See docs/TAVI_CI_COMPANION_ENTRYPOINT_REPAIR_0146.adoc. Existing assets, Companion, schema-13 operator gate, local data and release restrictions unchanged.

# looprd-social 0.3.145 — Companion ZipRunner overlay repair

Fixes Windows build failure when upgrading from 0.3.143 with ZipRunner's safe `delete_missing=false` overlay. The 0.6.27 Companion `ui/collection.html` and two published mirror copies remained alongside the approved 0.6.43 bundle, changing its SHA-256. ZipRunner and `npm run verify` both run an exact SHA-256-guarded cleanup of only those three obsolete files before verification, including when ZipRunner reuses the previously loaded build command. Modified files and altered publisher pins fail closed; operator/private state is untouched. Includes an exact-Windows-hash regression test. This is a source candidate, not native acceptance; server schema 13 migration still requires explicit approval. See `docs/TAVI_COMPANION_OVERLAY_REPAIR_0145.adoc`.

# looprd-social 0.3.144 — Assets 0.1.9 and Companion 0.6.43 integration

This candidate updates the trusted Tavi Assets host to the 0.1.9 engine, with filtered/grant-scoped object discovery, a hash-verified Hollow Meadow scene pack, explicit optional dependency-status negotiation, and reviewed Companion 0.6.43 source integration. The server adds authenticated single-Companion saves protected by revision+reset-epoch compare-and-swap and **requires approved LoopRD schema 13 migration**. Windows/Android native and real two-device checks are still pending. No public online asset downloads, Gold purchases, deployment or release. See `docs/TAVI_ASSETS_COMPANION_INTEGRATION_0144.adoc`.

# looprd-social 0.3.143 — Assets Store candidate

Adds a first-party Assets Store under Apps and Settings, responsive in-app approval dialogs for free packs and app grants, searchable local pack cards, Installed/Permissions views, and an optional read-only HTTPS Assets 0.1.7 catalog adapter (`TAVI_ASSETS_CATALOG_URL`). No online source is configured by default; no arbitrary remote installation, Gold charges, automatic updates or cross-device sync are enabled. Existing 0.3.142 per-account IndexedDB, TaviX 0.1.11 grants and sample pack remain intact. Source tests are required; Windows/Android/operator QA pending. See `docs/TAVI_ASSETS_STORE_0143.adoc` and `docs/TAVI_ASSETS_TEAM_HANDOFF_0143.adoc`.

## Tavi 0.3.142 — TaviX 0.1.11 Assets grants and live free-pack engine (source candidate)

Connects the exact Tavi Assets 0.1.7 portable engine to account-scoped persistent IndexedDB, accepts TaviX 0.1.11 `assetDependencies` and issues only per-pack, explicitly consented and reverified host-session grants. Settings -> Assets Library can install the bundled free card pack and allow/revoke extension read/customization. No Gold, external downloads, paid ownership, server migration or public release. Actual Windows/Android persistence, verified TaviX consumer and native gameplay are awaiting operator QA. See `docs/TAVI_TAVIX_ASSETS_RUNTIME_0142.adoc`.

## Tavi 0.3.141 — Atrium installed games and Assets 0.1.7 consumer parity (source only)

Adds official Atrium-only `tavix.installed-games/v1` inventory/open backed by the existing approved TaviX game registry, and extends the gated `tavi.assets/v1` adapter/SDK to the Assets 0.1.7 discovery/composition methods. Source-level cross-package integration smoke passed against Atrium 0.5.77 and Assets 0.1.7 fixtures. The production Assets runtime, trusted grants, native storage and Gold entitlements are **not connected**. Windows/Android/web acceptance, a current installed Atrium build and real classified game remain operator-owned. No push or release. See `docs/TAVI_SHARED_SERVICES_COMPATIBILITY_0141.adoc`.

## Tavi 0.3.140 — Tavi Assets host boundary (source only)

Implements the proposed Tavi Assets 0.1.4 gated `tavi.assets/v1` consumer and host adapter, strict approved pack/capability grants, and an honest Assets Library Settings entry. No production Assets engine has been supplied or connected, and no installs, catalog ownership or Wallet purchases are activated. See `docs/TAVI_ASSETS_HOST_INTEGRATION_0140.adoc` and `docs/TAVI_ASSETS_TEAM_HANDOFF_0140.adoc`. Native acceptance pending. No push or release.

## Tavi 0.3.139 — Classified TaviX games in Apps and Games (local-only)

Accepts the operator-provided TaviX 0.1.10 optional manifest classification, persists approved game metadata, and shows current installed games under Tavi Games for direct launch without server Atrium discovery. Existing app permissions and isolated loader are unchanged. Native acceptance and a real Klondike package are pending. No GitHub push or public release. See `docs/TAVI_TAVIX_GAME_CLASSIFICATION_0139.adoc`.

## Tavi 0.3.138 — Windows-native TaviX file selection (local-only)

Apps > Install .tavix on Windows now calls a dedicated, main-window-only
Win32 system file dialog instead of a WebView2 `<input type="file">`.
File bytes are bounded, never expose the local path to extensions, and
follow the pre-existing LoopRD developer permission, package validation,
and explicit install approval. Web/Android selection is unchanged.
Windows native build and real-dialog acceptance are pending. No public push.
See `docs/TAVI_NATIVE_WINDOWS_TAVIX_DIALOG_0138.adoc`.

## Tavi 0.3.138 — Restore local TaviX picker routing (local-only)

Restores the original synchronous Apps installer button before the swipeable grid,
retaining the Material layout and the LoopRD developer permission gate. A visible
"Browse files directly" fallback and live feedback prevent silent failure when
a native WebView ignores file selection. Native Windows/Android acceptance remains
required. Source-based cause is not fully established; no public release.
See `docs/TAVI_PICKER_ROUTING_REPAIR_0137.adoc`.

## Tavi 0.3.136 — Native developer TaviX chooser repair (local-only)

Base 0.3.135. Apps > Install .tavix now uses an actual file input, with a
transparent native hit target receiving the user's gesture. The previous
button-to-hidden-input .click() path could fail silently in Windows WebView2
or Android. Repeated file selection is supported, while stale/missing LoopRD
developer permission remains fail-closed. Missing extension storage now gives
visible feedback. All local ZIP integrity, approval and sandbox checks remain.
Native OS chooser verification on Windows/Android is pending; no public push.
See `docs/TAVI_NATIVE_TAVIX_PICKER_0136.adoc`.

## Tavi 0.3.135 — Shared Settings & TaviX contribution links (local only)

* Settings -> Apps & extensions -> App sources now owns custom repository configuration and diagnostics. The App Store retains browsing and a subtle Settings link, but no duplicate gear/form.
* Installed, approved TaviX apps may declare one `settings.app` contribution; host Settings links to their isolated app panel with a `launchContext=settings` hint. This adds no permissions and does not migrate game-local preferences into global Settings.
* Server-origin-scoped local repository subscriptions are preserved, along with install/source approval gates. Windows/Android operator acceptance is pending.
* Full contract and acceptance notes: `docs/TAVI_SHARED_SETTINGS_0135.adoc`.

## Tavi 0.3.134 — OpenClaw bridge delivery repair (local-only)

Base 0.3.133. OpenClaw replies no longer silently disappear over 1000 characters:
the bridge splits them into numbered, 900-code-point DM chunks and respects
LoopRD's one-second sender cooldown. OpenClaw CLI input is selected by a
read-only help probe, supporting modern `--message-file -` and the legacy
`--message @file` protocol reported by Pegas. Timeout defaults to 15 minutes.
The watcher persists read receipt retries separately from delivered replies,
without claiming exactly-once delivery. See
`docs/TAVI_OPENCLAW_BRIDGE_COMPATIBILITY_0134.adoc` and
`integrations/openclaw/README.md`.

No schema, client UI, signing, config, credentials, GitHub, release or public
catalog modifications. This source update needs real bot-host CLI acceptance
before restarting Pegas or other production bot processes.

## Tavi 0.3.133 — Contacts and root-tab navigation (local-only)

Base 0.3.132. The Apps launcher now has Contacts rather than Add friend;
Contacts displays existing LoopRD friends and requests and contains an Add friend
action. Apps, Games and Chats root screens use the persistent bottom navigation
without redundant top Back bars, while deeper panels retain contextual Back.
The Apps/Games segmented tabs retain fully rounded outlines. No native
acceptance, device address book access, backend/API change or publication.
See `docs/TAVI_CONTACTS_ROOT_NAV_0133.adoc`.

## Tavi 0.3.132 — Compact Games and Material-style Apps (local-only)

Base 0.3.131. Games now uses **My games** and **Discover** tabs; current turns,
rooms, invitation navigation, trusted launch/invite actions and Atrium
catalog discovery remain present and retain their permissions. The default
My games view replaces large empty dashboard boxes with a compact empty state;
raw Atrium connection diagnostics stay in Developer Mode. Games uses the host
Back/navigation bar instead of a duplicated page heading.

Apps retains the established Favorites/All swipe, long-press/right-click
context menu and icon identity. It now uses material-inspired rounded tonal
tabs, predictable spacing, subtle touch states, a browse-App-Store row and
compact account-gated developer package control. The swipe area's height
follows its selected tab to avoid blank space below Favorites.

The source/descriptor and Workboard operator status are unchanged; no
GitHub push, automated publication, developer privilege change, game backend,
new migration, or native acceptance. See `docs/TAVI_MATERIAL_APPS_GAMES_0132.adoc`.

## 0.3.131 — Review-only release candidates

Pushing Tavi no longer automatically invokes public release or Pages deployment
through these workflows. Use local ZipRunner acceptance first; GitHub release
publication is disabled and Pages requires explicit manual confirmation plus
protected-environment review. See `docs/RELEASE_PROCESS.md`. The Windows CRLF and
browser Favorites context-menu CI regressions are corrected in source, pending
remote run and native acceptance. No Git push or public release performed.

**Tavi 0.3.130 (local preview loader CSP repair):** Fix local developer TaviX CSS preparation using offline inline styles, rejecting missing/unsafe CSS before scripts can execute. Keep global CSP and trusted first-party services unchanged. Node safe-fixture QA only; real native WebView2/Android and memory containment remain pending. Do **not** reopen Companion 0.6.37 on the affected PC. See `docs/TAVI_LOCAL_PREVIEW_CSP_0130.adoc`. No GitHub push or publication.

**Tavi 0.3.129 developer shadow for protected apps:** LoopRD-approved Developer Mode can temporarily shadow a first-party TaviX UI (including Companion) from a local SHA-verified `.tavix` archive. The original app remains pinned, restoring is explicit, and no trusted core capability is granted. Native Windows/Android acceptance pending; no public release. See `docs/TAVI_LOCAL_TAVIX_DEVELOPER_SHADOW_0129.adoc`.

**Tavi 0.3.128 local TaviX developer gate:** The Apps install button is visible only when LoopRD grants `permissions.developer` and the signed-in account enables Developer Mode in Settings. Import and approval recheck LoopRD and fail closed on revoked/offline grants; Windows/Android acceptance remains pending. No GitHub push or release. See `docs/TAVI_LOCAL_TAVIX_DEVELOPER_GATE_0128.adoc`.

**Tavi 0.3.127 — local `.tavix` installer (source-only):** Apps → Install .tavix opens a Windows/Android file chooser, verifies the ZIP/lockfile SHA-256 and manifest, reviews permissions, then stores an explicitly approved package in per-account IndexedDB. Only local sandboxed app APIs are available: no publisher privileges, no network access, no GitHub push or public publication. See `docs/TAVI_LOCAL_TAVIX_0127.adoc`.

Local 0.3.126 Apps UX: no icon badge clutter; right-click/long-press/Shift+F10 context menu for Favorites and guarded optional-extension removal. No public push. See docs/TAVI_APPS_CONTEXT_MENU_0126.adoc.

**Local 0.3.125 Apps UX:** Favorites/All two-tab drawer, personal on-device star preferences, contextual Back, and App Store icon layout fix; no GitHub publication. See docs/TAVI_APPS_FAVORITES_0125.adoc.

**Tavi 0.3.124 local UX foundation:** Host navigation, settings, launcher and Home now use reviewed, locally bundled Lucide icons (ISC/Feather notices included); Apps tab uses a grid distinct from Store; Home groups, Companion placeholder and privacy-respecting recent-message snippets receive compact touch improvements. No hosted Checkers game activated, no Git push/public release. See `docs/TAVI_UI_LUCIDE_FOUNDATION_0124.adoc`.

**Tavi 0.3.123 local Checkers M1 group QA:** exact Social/Atrium ZIP-based coordinator with provenance, bounded evidence, fail-closed checks and no network/Git/publishing. See `docs/DGN_CHECKERS_M1_LOCAL_EXACT_GROUP_QA_0123.adoc`. This is NOT a live match activation.

## Tavi 0.3.123 — correct displayed version of the running application

The 0.3.121 source packaged a hardcoded `const CLIENT_VERSION='0.3.117'` in `client/src/main.js`, making About Tavi and its stable-release comparison report 0.3.117 even when the compiled Tauri binary was newer. This client-only fix injects the canonical `client/package.json` version into the Vite build for Windows/Android/Web and adds source regression checks against Tauri/Cargo/ZipRunner metadata. The local ZipRunner build/start recipe remains `node tools/auto-build.mjs` / `node tools/launch-tavi.mjs`. No LoopRD service/schema change, no updater behavior change, no game authority, and no automatic release. See `docs/TAVI_0_3_122_CLIENT_VERSION_SOURCE_FIX.adoc`.

## Tavi 0.3.121 — exact-commit CI extension mirror and catalog UI QA repair

0.3.120 GitHub Actions at SHA `9e8f3688ad4d5d0d3103746f8a5bfcec1e673c09` produced seven failed workflows (two passed). The exact Git commit tracked first-party extension files differed from the canonical ZIP (published catalog stale, `ui/app.js` size mismatch); the source ZIP itself passed internal extension checks. This repair stages a changed first-party review app copy and regenerates its committed mirror/catalog, and updates the five-viewport Life-withdrawn smoke assertion to Tavi's current connected-but-empty message. The reviewed Companion remains SHA-pinned and unchanged. Cross-platform GitHub push CI, ZipRunner Windows acceptance, actual Android update and Checkers M1 live play remain separate gates. Details: `docs/TAVI_0_3_121_EXACT_COMMIT_CI_REPAIR.adoc`.

## Tavi 0.3.120 — Checkers M1 Social/Atrium service contract

Additive privileged original-challenge and current-contact lookup routes make the existing Checkers game invitation flow consumable by Atrium's strict service adapters. Source-only and operator-gated: no public Checkers match authority, no live two-client acceptance. See `docs/CHECKERS_M1_SOCIAL_ATRIUM_CONTRACT_0120.adoc`.

# Tavi 0.3.119 — ZipRunner review host support

Adds an optional read-only bridge for the included optional ZipRunner review app (also supplied as a separate TaviX package). It stays locked until you load the existing current ZipRunner web-connection .zrmobile file inside Tavi. The host sends its exact file digest and bearer only to that file's HTTPS issuer. No credentials are persisted; clearing/closing the panel removes the grant. Requires ZipRunner .188 review endpoints. Existing sandbox/network restrictions and all other applications remain unchanged. Install/test manually; no accounts or active configuration are replaced by this source package.

> **Tavi 0.3.111 — Compact App Store workboard repair:** fixes missing ZipRunner `operator_checks` before installation. The 0.3.110 marketplace implementation is unchanged. See `ZIPRUNNER_HANDOFF_TAVIX_0111.md`.

> **Tavi 0.3.110 — Compact TaviX App Store:** phone-first app rows, search/filter/details, visible alternative-source newer releases and explicit publisher-matched source migration. Existing app pins, private data, Wallet, LoopRD backend and Android updater stay protected. See `ZIPRUNNER_HANDOFF_TAVIX_0110.md`.

> **Tavi 0.3.109 — Central TaviX App Store:** Tavi now discovers official extensions from `https://thebigtreeinc.github.io/tavix/tavi.repository.json` by default. Existing Atrium and bundled Companion installations retain their source pins; new installations still require approval. No Social backend migration or Android updater change. See `ZIPRUNNER_HANDOFF_TAVIX_0109.md`.

> **Tavi 0.3.108 TaviX 1.0:** the existing `tavi.extension/v1` application host is now formalized as the TaviX 1.0 standard with `@tavi/tavix-sdk` 1.0.0, core conformance/validation, host-owned navigation aliases and deterministic `.tavix` package tooling. Existing Companion 0.6.27, Wallet and Atrium manifests remain wire-compatible; generic `tavix.surface/v1` is specified but intentionally not advertised until the coordinated Atrium/Life migration. Social remains 0.3.107/schema 12 and the Android updater implementation is unchanged. See `docs/TAVIX_1_0_SPEC.adoc`.

> **Tavi 0.3.107 LoopRD 0.4 Wallet service:** the first-party Wallet now has an independent `tavi-wallet` LoopRD 0.4 subcomponent for caller-bound merchant/reward service contracts. Existing Gold balances and history remain authoritative in Social schema 12 until the explicit storage migration; current Tavi user Wallet calls remain on the Social session broker. LoopRD/DAPI 0.4+ and private service credential provisioning are required before server activation. See `docs/TAVI_WALLET_LOOPRD_04_SUBCOMPONENT.adoc`.

> **Tavi 0.3.83 core Wallet:** Wallet is always available and cannot be installed or removed through App Store. The profile label under your name shows the authoritative Gold balance and opens Wallet on click or tap; unavailable backend is explicit. No new wallet tables or spending rules. See `ZIPRUNNER_HANDOFF_CORE_WALLET_0383.md`.

> **Tavi 0.3.82 pre-launch Wallet + mobile safe areas:** Gold accounting now uses a single clean Wallet schema 11 for new deployments without experimental backfill. Free Gold remains game-entry-only; earned Gold buys items and converts; refunds preserve provenance. Android/phone root now owns system safe areas and the round Home Main Menu stays inside its reserved dock instead of overlapping roster text. The full operator/device gate is in `ZIPRUNNER_HANDOFF_WALLET_MOBILE_0382.md`. Do not apply this schema to a running schema-12 database in place.

> **Tavi 0.3.81 Wallet protection:** free refill/welcome Gold is **game-entry-only** and cannot pay shop items or be converted. Earned Gold is tracked separately and can be minted only by explicitly approved, rate-limited game services; refunds retain their funding class. Adds additive schema 12 with conservative protection of legacy Wallet funds. Back up and stage any LoopRD database migration. See `docs/TAVI_GOLD_WALLET_PROTECTED_PLAY_CREDIT_0381.adoc`.

> **Tavi 0.3.80 first-party Gold Wallet:** bundled isolated Wallet, account-owned Gold ledger with free refill to 100, server-priced game entry/item checkout (including free games), opt-in operator exchange policies, pending merchant fulfillment and idempotent audit. **Social schema 10→11 must be backed up and deployed separately with operator approval.** See `docs/TAVI_GOLD_WALLET_CORE_0380.adoc`.

> **0.3.78 exact-commit UI QA repair:** The 0.3.77 GitHub UI workflow failed five viewports because the browser test skipped the Tavi-hosted extension installation approval and touch rows were 30px. This source candidate adds explicit touch sizing and approval/cancellation coverage. It preserves the 121-ticket operator QA workboard and existing messaging/backend behavior. Full GitHub UI QA and Windows/Android acceptance remain pending. See `docs/TAVI_0378_EXACT_CI_BROWSER_QA_REPAIR.adoc`.

> **Tavi 0.3.78 ZipRunner metadata repair:** repairs the pre-overlay workboard summary validation failure in the 0.3.76 archive; preserves all 118 latest operator QA tickets and the two 0.3.76 Review additions, strengthens archive preflight, and leaves application/server behavior unchanged. See `ZIPRUNNER_HANDOFF_WORKBOARD_REPAIR_0377.md`.

> **Tavi 0.3.76 CI and native UI QA:** Requires exact-commit browser UI QA to succeed before future GitHub releases; adds read-only GitHub CI evidence collection, 44px coarse-pointer contact targets and native menu interaction checks. Preserves messenger-first Home, stable LoopRD descriptor and installed extensions. Source candidate, native acceptance pending. See `docs/TAVI_0376_EXACT_CI_RELEASE_GATE_AND_NATIVE_UI_QA.adoc`.

> **Tavi 0.3.75 UI foundation:** semantic forest-green light/dark tokens, shared host navigation bar and opt-in QA for the actual Windows WebView2 client. Browser smoke expectations now match the duplicate-free Home. Latest local 116-ticket operator board preserved, plus two Review candidates. Full plan in `docs/TAVI_UNIFIED_UI_FOUNDATION_AND_NATIVE_QA_0375.adoc`; no production CI/native acceptance claimed.
> **Tavi 0.3.74 video QA and UI shell repair:** identical compact roster on Home and Messages, single-open classic menus, no second Tavi Home button above Atrium, and a new staged Lit/Web Components + semantic forest-green design-system plan in `docs/TAVI_UNIFIED_UI_VIDEO_AUDIT_0374.adoc`. All 110 previously exported ZipRunner tickets preserved; native device acceptance pending.
> **Tavi 0.3.73 compact home cleanup:** removes the duplicate Games box from Home, moves app update awareness into the profile area/App Store flow, removes the duplicate quick-action row and contact search, keeps conversations and presence closer together, and adds a light-green / dark-green theme setting. Nested publisher `looprd.yaml` files still feed App Store metadata discovery. Native acceptance pending. See `docs/TAVI_EXTENSION_UPDATES_NESTED_LOOPRD_0372.adoc`.

> **Tavi 0.3.66 hosted Life launch broker:** safe first-party Atrium handoff requires explicit Tavi Open Life click; no credentials or proofs in URL. Atrium 0.5.24 live publication/adapter and authenticated Life resume remain pending. See `docs/TAVI_ATRIUM_HOSTED_LIFE_LAUNCH_0366.adoc`.

> **Tavi 0.3.65 first-party Atrium repository:** built-in optional Atrium catalog source. Publication and device acceptance pending. See `docs/TAVI_FIRST_PARTY_ATRIUM_REPOSITORY_0365.adoc`.

> **Tavi 0.3.64 exact-commit CI repair:** Windows LF integrity for bundled extensions, fixed visible Games navigation in browser QA, preserved 100-ticket operator board, and triaged Android in-app updater report (no unproven native change). See `ZIPRUNNER_HANDOFF_CI_0364.md`.

> **Tavi 0.3.63 Atrium discovery:** TAVI-ATRIUM-056 source QA now exercises Life discovery/withdrawal and includes a read-only authenticated Social operator probe. Social release remains 0.3.58/schema 10; live Atrium observation/private apps:read binding and native acceptance still required. See `ZIPRUNNER_HANDOFF_ATRIUM_0363.md`.

> **Tavi 0.3.62 UI QA:** `npm --prefix client run ui:ci` runs a real Chromium smoke suite at desktop and phone sizes against a disposable local Social fixture. ZipRunner runs it on post-update; CI requires it. Missing browser/build is BLOCKED, never a pass. This is not Windows/Android native or pixel-baseline acceptance. See `ZIPRUNNER_HANDOFF_UI_QA_0362.md`.

> **v0.3.49 Companion MVP:** Optional 16-bit-style pet panel, 8 species, local account-scoped state, 5 actions, manually selected Companion/Gentle/Classic modes and voluntary engagement-based invitations. Works in Windows/Android/Web Tavi views. OS-wide overlays are **not** implemented; Social server stays 0.3.48/schema 10. See `docs/TAVI_COMPANIONS_0349.adoc`.

> **v0.3.48 Atrium launcher visibility pass:** The Windows Games view now displays a first-class Atrium launch card based on the existing server-advertised reviewed URL; Tavi remains chat-first and the v0.3.46 legacy challenge flow remains supported. No new Life `/play` or DAPI discovery delivery is implemented. See `docs/TAVI_ATRIUM_LAUNCH_0348.adoc`.

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


### Windows desktop Companions (0.3.53)

After signing in, explicitly enable Companions and select **Show an independent floating Windows desktop companion** to open a small separate pet window. Drag by its handle; × hides, ↺ resets position, and Open in Tavi opens the full care panel. Nothing is enabled by default. This client-only source candidate requires a real Windows NSIS build and device acceptance. See `docs/TAVI_COMPANIONS_DESKTOP_0350.adoc`.

### v0.3.58 — Sketch-matched bottom navigation

On Home only, Games and Messages are compact side icon controls, while Main menu is a raised, circular middle button. The Home dock never appears inside a focused conversation or embedded game. See `docs/TAVI_HOME_DOCK_0354.adoc`.


## Tavi Extension Platform (0.3.60 decentralized repository source candidate)

Tavi remains a messenger first. The App Store is a *decentralized repository browser*: LoopRD operators can optionally suggest repository catalog URLs through a public `/.well-known/tavi-repositories.json` file, and users may subscribe to their own HTTPS `tavi.repository/v1` JSON indexes. No publisher registration, approval service, marketplace server or database is needed. Installation requires a user choice; extensions run as isolated hosted web frames with limited host permissions and no Tavi bearer. A developer can host static UI and a catalog on GitHub Pages, Forgejo Pages or an ordinary HTTPS server. The repo list is scoped to the known LoopRD server, and installed permissions are scoped to a particular account/server/device. Bundled Private Notepad remains available; built-in Companions and Atrium are not yet migrated.

Documentation: `docs/TAVI_EXTENSION_PLATFORM_V1.adoc` and `docs/TAVI_EXTENSION_PUBLISHING.adoc`. Schemas and examples: `schemas/tavi.repository*.json` and `docs/extension-examples/`. Hosted pages must support iframe embedding; indexes require CORS. Remote page HTML is not hash-pinned or downloaded offline; the author controls their hosted content. Never enter Tavi credentials in third-party extensions. The LoopRD Social server descriptor remains 0.3.58; no new Social API is required for this optional client feature.


## Tavi 0.3.61 — Shared Services / Ledger / SDK contract (source candidate)

Design and SDK foundation for shared wallet, currencies, pets, contacts, messages, notifications and game integration across trusted LoopRD components. Maintains Tavi as the messenger; individual games/apps can deploy their own LoopRD component or an explicitly trusted external instance. No central marketplace or global server directory.

`docs/TAVI_SHARED_SERVICES_LEDGER_SDK_V2.adoc` is the complete spec; `client/extension-sdk` contains ESM and TypeScript browser+trusted service contract packages, and `schemas/tavi.extension.v2.schema.json` is **future**, not an installable 0.3.61 manifest. Only `host.capabilities` is activated in the iframe broker; shared data APIs fail closed until new server services and grants are implemented. Social server and database remain release 0.3.58/schema 10.

## ZipRunner CI parity (0.3.147)

`node tools/ci-parity.mjs --profile prebuild` is required by `project.zr` before native build. The version-controlled `ci-parity-plan.json` maps checks to GitHub workflows. It runs root JavaScript source verification, the complete Python unittest suite, installs the browser dependencies, then Playwright UI smoke at five viewports using only a loopback disposable fixture. Reports/logs are written to `qa-artifacts/ci-parity/` and must remain local, not distributed. Missing dependencies fail closed. Native Windows/Android operator acceptance, exact pushed-commit GitHub CI, and release remain independent gates.

### LoopRD `specification_invalid` repair (client 0.3.152 / server spec 0.3.123)

The operator `reset-companion` action's three write targets are now explicitly represented as non-editable managed fields. This fixes a root-level LoopRD management contract validation failure introduced in client 0.3.144. CI parity runs the management preflight; operators must still validate with their installed LoopRD runtime and approve descriptor promotion separately. Database schema 13 and the approved-release workflow are unchanged. See `docs/TAVI_LOOPRD_SPECIFICATION_VALIDATION_0152.adoc`.

### LoopRD schema-13 string-length compatibility (0.3.153)

Fixed schema-13 `SocialAccount.companionSnapshot` migration: use `VARCHAR(8192)` to match the model, instead of SQLite `TEXT`, which LoopRD rejects on length comparison. Release spec `0.3.124`, database schema target 13. See `docs/TAVI_LOOPRD_SCHEMA13_VARCHAR_0153.adoc`. Approval and staging-db validation required before server deployment; public releases remain separately gated.

### TaviX icon and font UI kit (0.3.165)

See `docs/TAVI_UI_KIT_001.adoc`, `docs/contracts/tavix-ui-kit-v1.json`, and `client/extension-sdk/icons.js`. The offline 50-icon set and platform native fonts are bundled per application; this is not a host permission or a guaranteed tablet window capability. TaviX 0.1.14 ships the matching kit and reference `.tavix` app.
