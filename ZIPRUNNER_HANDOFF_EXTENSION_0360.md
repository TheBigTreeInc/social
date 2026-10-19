# Tavi 0.3.60 — Decentralized extension repositories

**Base:** Tavi v0.3.59 Extension Platform candidate. **Project:** `looprd-social`. **Delivery:** ZipRunner source update; no server deploy or Git push performed.

## Design correction

The Tavi App Store is not a central marketplace. It is a Dalamud-inspired static JSON repository browser. Publishers only need to host an HTTPS `tavi.repository/v1` index, open source and an embeddable extension UI. A LoopRD operator may optionally suggest catalogs by hosting `/.well-known/tavi-repositories.json`; a user can add/remove their own URLs. Neither has to submit apps to the Tavi project. Catalog discovery never installs code automatically.

## Included

- `client/src/extensions/repositories.js`: catalog validation, optional server recommendations, per-server local subscriptions, no-bearer HTTPS fetch, duplicate handling.
- `client/src/main.js`: App Store repository subscription controls, source/license indicators, hosted extension iframe, explicit permission confirmation, source-pinned install, Home/navigation intact.
- `client/src/extensions/store.js`: pinned repository source and version in account-specific installation grants.
- `docs/TAVI_EXTENSION_PLATFORM_V1.adoc`, `docs/TAVI_EXTENSION_PUBLISHING.adoc`: replaced centralized publisher registry with decentralized static index contract.
- `schemas/tavi.repository*.json`, `docs/extension-examples/*repository*.json`, `client/tests/extension-repositories.test.mjs`: schema/examples and regression tests.
- Existing bundled Notepad, Companions, Atrium, Social server and API contracts retained. Social backend release remains `0.3.58` and migration schema 10 remains untouched.

## Security and limitations

Remote applications use `<iframe sandbox="allow-scripts">`; no Tavi Social bearer, Tauri access or parent DOM access is granted. JSON indexes are fetched with credentials omitted. HTTPS is required; public JSON needs CORS and hosted UI must allow embedding. Third-party hosted content is not hash-pinned or offline-cached; remote owners may alter it. User approval is required for installation and an update that changes the manifest version; extra permissions require new consent. This is an explicit *hosted web extension* model, not `.tavix` installer or native binary support. Existing Companions/Atrium remain built in pending separate migration.

## Verification and operator acceptance

Run `npm run verify`, Python tests and Web/native build in ZipRunner. Source tests include `client/tests/extension-repositories.test.mjs` and continue to test bundled samples. Web/Windows/Android *live HTTPS repo and UI* acceptance is still mandatory. Test CORS, CSP, redirect rejection, malicious catalogs, empty/missing server recommendation JSON, removing subscriptions while installed, cross-server isolation and Home always available.
