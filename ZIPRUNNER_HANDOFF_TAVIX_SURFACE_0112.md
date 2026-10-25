# Tavi 0.3.112 — reviewed TaviX game surface (Tavi-only)

## Scope / ownership

Only `looprd-social` source was changed. No Atrium, Life, TaviX repository or LoopRD runtime was modified. Social server descriptor `looprd.yaml` is intentionally unchanged (Social 0.3.107/schema 12). Android internal PackageInstaller/update code and reviewed publisher bytes remain untouched.

## New capabilities

- Official pinned Atrium extensions with `ui.panel` receive `tavix.surface/v1` in `host.info.features`. Other extensions do not.
- SDK's existing `surfaces.requestOpen({...})` now routes to Tavi's validated surface host. It accepts game-only canonical HTTPS targets and optional opaque `context.matchId`, with no credentials, keys or arbitrary URL query.
- The operator confirms the destination origin before game UI opens. Tavi creates an opaque-origin (`allow-scripts allow-forms`, not `allow-same-origin`) sandboxed game iframe.
- Host-owned **← Atrium** and **Home** close only the local UI; no game-match termination, seat change or rules execution is invoked. Browser/Android Back also leaves the embedded surface before leaving Atrium.
- Legacy `ui.requestGameLaunch` remains supported as an external Life fallback until Atrium/real-Life production interoperability is proven.

## Why the sandbox is restrictive

On GitHub Pages, a Life web UI and Tavi can share an origin. Allowing both `allow-scripts` and `allow-same-origin` would enable an embedded game to act as the Tavi origin. This build intentionally does not grant `allow-same-origin`, so any frontend that depends on cookies, localStorage or an unsandboxed WebView must be adapted by the Life project. Do not weaken the sandbox simply to make the first screenshot work. The game backend/session stays entirely with Life/LoopRD; Atrium remains lobby.

## ZipRunner acceptance

1. Install the full 0.3.112 source ZIP over accepted 0.3.111, preserving all private/locally modified state.
2. Run `npm run verify`, `node --test client/tests/tavix-surface-112.test.mjs`, `python tools/generate-looprd.py --check`, and the normal ZipRunner Windows local build.
3. Install verified Atrium, confirm feature advertisement; rogue publisher must be denied.
4. Confirm target user approval, cancelled request remains no-op, game frame has opaque sandbox and no messenger token; exercise Back/Atrium/Home and Android hardware Back.
5. Test a real Life URL only after Atrium supplies its approved target and Life's UI supports opaque sandbox; user-controlled confirmation is not production proof.
6. Confirm unchanged Wallet/Companion behavior and Android internal app installer; inspect actual native build and exact-commit CI before operator approval.

**Status:** Source implementation and tests; no native Windows/Android binary compiled here and no live Life/Atrium match tested.
