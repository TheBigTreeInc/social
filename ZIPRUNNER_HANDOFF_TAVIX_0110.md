# Tavi 0.3.110 — Compact App Store & source review

## Base and implementation
- Import `looprd-social-0.3.110-compact-app-store-ziprunner.zip` on top of the installed 0.3.109 project. Non-destructive ZipRunner overlay.
- Source-only client UX update: rows display 3–5 apps on compact 355×630 Windows and phone widths. Search and All/Installed/Updates filters, detail view, long metadata in details, repositories collapsed.
- The central TaviX repository remains first-party. Existing installed Companion 0.6.27 and Atrium 1.0.0 remain pinned; TaviX 0.6.30/1.0.2 are shown as *other-source releases*.
- Changing source is NEVER automatic. User reviews current/new source, publisher, versions, permissions, then approves. Host re-fetches central catalog, checks publisher identity and new version before changing per-account installed metadata. Account-local extension storage is retained; disabled state preserved.
- The existing sandbox remains opaque (`allow-scripts` only), Social credentials never enter publisher URLs, and Wallet is never migratable as a catalog app.
- Social version remains 0.3.107, schema 12 and LoopRD descriptor unchanged. Android PackageInstaller files unchanged. Existing workboard IDs/statuses/criteria retained; TAVI-STORE-110 added as Review.

## Source verification
- `npm run verify`
- `python -m unittest discover -s tests -v`
- `python tools/generate-looprd.py --check`
- `node tools/sync-internal-extensions.mjs --check`
- `node --test client/tests/marketplace-110.test.mjs`
- Browser five-viewport QA (`npm --prefix client run ui:ci`); on-device Windows/Android final acceptance required.

## Operator review
- In the App Store on Windows 355×630, count visible rows and confirm no horizontal scrollbar. Test search and filters in mobile 320/390 widths and a wider desktop viewport.
- Open Companion and Atrium details: 0.6.27/1.0.0 stay installed, 0.6.30/1.0.2 should appear as other-source offers. Click Review then Cancel; source/version must stay unchanged.
- If opting to switch, inspect permission/publisher differences carefully and approve only deliberately. Test app state retained and re-open; for Companion check pet preview behavior separately because reviewed bundled host features may not automatically apply to publisher-hosted code.
- Verify standalone messenger, Wallet, Android updater, extension installation approval and App Store reloading. Preserve existing local state and active config.
- This package does not push to GitHub, deploy a backend, publish a release or mark review items Done.
