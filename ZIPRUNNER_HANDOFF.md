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

## Tavi 0.3.131 — Release pipeline refactor (local-only)

Base 0.3.130. Replace repeated `workflow_run` release jobs with one manually
invoked, read-only exact-main-SHA CI candidate collector. A push is not publication.
The candidate gate fails visibly on missing/failed CI and emits six reviewed
artifact bundles, hashes and operator-pending JSON. Pages is also manual-only:
exact SHA, all eight CI checks, explicit confirmation and protected `github-pages`
environment required; repository admin must configure required reviewers.
Correct Windows CRLF Cargo.lock test and obsolete favorite-star UI QA test.
No GitHub Release workflow, new secrets, public push, account/config changes,
server migration, release approval or native acceptance. See `docs/RELEASE_PROCESS.md`.

## Tavi 0.3.130 — Local TaviX preview stylesheet loader

0.3.130 corrects the inline-CSS native CSP mismatch for untrusted local TaviX developer previews, preflights required styles before scripts, and records only bounded anonymous diagnostic codes. Workboard/operator gates are unchanged; no native device QA performed. `docs/TAVI_LOCAL_PREVIEW_CSP_0130.adoc` contains implementation and safety scope. No Git push or public release.

# Tavi 0.3.129 local-only developer shadow

Allow developer-only local previews to shadow protected first-party TaviX application tiles without replacing bundled source or trusted permissions. Revert from app context menu or Developer Mode off. Test with ZipRunner. Windows/Android operator acceptance pending; GitHub release forbidden. See `docs/TAVI_LOCAL_TAVIX_DEVELOPER_SHADOW_0129.adoc`.

# Tavi 0.3.128 local-only developer-gated .tavix installer

Requires server-granted developer permission plus Settings Developer Mode opt-in, with authenticated recheck before installing local packages. Source checks and ZipRunner 0.3.128 post-update tests required. Windows/Android operator review pending; no public push/release. See `docs/TAVI_LOCAL_TAVIX_DEVELOPER_GATE_0128.adoc`.

# Tavi Social 0.3.127 — local offline TaviX file installation

Import through local ZipRunner. No GitHub push, server deployment, or release permission is granted. Apps → Install .tavix; review publisher/permissions/SHA; approve; open from Apps → All. Per-account device-local storage; removal through app context menu. Local Atrium previews have no official game-launch grants. See docs/TAVI_LOCAL_TAVIX_0127.adoc. Windows/Android native checks and operator acceptance pending.

Local 0.3.127 Apps UX: no icon badge clutter; right-click/long-press/Shift+F10 context menu for Favorites and guarded optional-extension removal. No public push. See docs/TAVI_APPS_CONTEXT_MENU_0126.adoc.

Local 0.3.125 Apps UX: Favorites/All, per-account starred shortcuts, contextual Back, responsive/dark-mode styling and six regression tests. No GitHub push, release, or operator sign-off. See docs/TAVI_APPS_FAVORITES_0125.adoc.

Local 0.3.124 UI/Lucide foundation: no GitHub push, public CI or release. See docs/TAVI_UI_LUCIDE_FOUNDATION_0124.adoc. Windows/Android operator acceptance remains pending. Checkers M1 is unchanged.

Local 0.3.123 pass: group QA from explicitly supplied Social and Atrium source ZIPs. No GitHub push, release or operator approval. See docs/DGN_CHECKERS_M1_LOCAL_EXACT_GROUP_QA_0123.adoc.

# Tavi Social 0.3.123 — About version source-of-truth repair

Base 0.3.121. The native Windows build was versioned 0.3.121 in Tauri/Cargo/package metadata, but the browser UI embedded an older hardcoded `CLIENT_VERSION='0.3.117'` for About Tavi and update comparison. Fix with Vite package-version injection and regression tests. Import and test exact source ZIP with ZipRunner, confirm running Windows executable path and About Tavi display, run new exact-commit CI independently. Original 0.3.117 stamp failure is historical and superseded. No local/private config, session, state, build artifacts or operator approvals changed. Social LoopRD release stays 0.3.121 because server code is unchanged. Checkers M1 remains the Group Workboard milestone.

# Tavi Social 0.3.121 — exact-commit CI repair

Base: 0.3.120. Fix the source-controlled extension asset/catalog drift by regenerating the first-party review extension mirror, and repair the historical empty-Atrium UI QA assertion. Checkers M1 Social status operations are unchanged, and no live Checkers match is claimed. No operator permissions, signatures, credentials, private state, or tracked partner bytes are altered. Import into ZipRunner and separately verify exact new Git commit, native builds and operator approval.

# Tavi Social 0.3.120 — Checkers M1 trusted Social/Atrium contract

Source ZIP input based on actual 0.3.119 ZIP. No local config, runtime state, database, credentials or build outputs included. The current Social schema remains 12; the server descriptor adds two service-only read routes. Post-update suite remains at 20 entries with new Checkers Social regression included in an existing entry. Build and operator gates remain separate.

# Tavi 0.3.111 — ZipRunner workboard preflight repair

Import `looprd-social-0.3.111-compact-app-store-workboard-repair-ziprunner.zip` over installed 0.3.109. The 0.3.110 ZIP failed *before* overlay; do not delete or reset the local source checkout, project configuration, data, sessions, installers, or caches.

The source change is limited to mandatory `TAVI-STORE-110.operator_checks`, an additional workboard shape regression test, and advancing version metadata to 0.3.111. The compact store features described in `ZIPRUNNER_HANDOFF_TAVIX_0110.md` remain the same. Social 0.3.107/schema 12 and Android PackageInstaller are unchanged. See `ZIPRUNNER_HANDOFF_TAVIX_0111.md`.
