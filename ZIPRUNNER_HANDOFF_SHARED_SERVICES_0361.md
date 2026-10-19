# Tavi 0.3.61 — Shared services, ledger and SDK specification

## Basis and install

Layer this complete source ZIP on the existing Tavi 0.3.60 source as an ordinary ZipRunner update. `project.zr` and protected runtime data remain untouched. Client version increments to 0.3.61. **Social LoopRD server remains 0.3.58/schema 10; `looprd.yaml` is unchanged.** No database migration or backend wallet service is shipped.

## Implemented now

- `docs/TAVI_SHARED_SERVICES_LEDGER_SDK_V2.adoc`: messenger-first, server-authoritative shared resources and events; wallet double-entry ledger and idempotency; optional on-home or independent external LoopRD service bindings; SDK split; explicit security, migration and acceptance gates.
- `schemas/tavi.shared-resource.v1.schema.json`, `tavi.shared-event.v1.schema.json`, `tavi.ledger-transfer.v1.schema.json`, `tavi.service.v1.schema.json`, `tavi.extension.v2.schema.json` plus examples (v2 is future only).
- `client/extension-sdk`: packable ESM browser SDK with TypeScript definitions, service transport SDK at subpath `/service`, `capabilities()` feature discovery and future typed facades. Local source packaging supported by SDK distributions workflow.
- `client/src/extensions/host.js`: `host.capabilities` exposes only existing locally granted working UI/storage capabilities. Future data APIs still produce 'Unsupported extension method'.
- New tests + ZipRunner metadata with unfinished workboard statuses preserved.

## Explicitly NOT implemented

No Ledger LoopRD component, wallet UI, currency mint/transfer API, Pet persistence migration, service-to-service federation/delegation, new Social chat/contacts grant broker, installable manifest v2, remote npm publication or native platform acceptance. Production backends and user consent/grants must be implemented *before* allowing SDK requests to mutate or read private data. **Never wire untrusted extension iframes directly to the Social bearer or external service secrets.**

## Operator checks

1. `npm run verify` and `python tools/generate-looprd.py --check`; run all schema validations in `tests/test_tavi_shared_schemas.py` and `npm pack` inside `client/extension-sdk`.
2. Verify existing messenger/Companions/Atrium paths remain intact after import and existing 0.3.60 extensions retain their installed state.
3. Run `node --test client/tests/shared-services-sdk.test.mjs`: SDK capability handshake should return only `ui.panel`/`ui.toast`/`storage.private` as granted; wallet, pets, contacts and messages remain unavailable from untrusted frames.
4. Use new spec to plan the Ledger LoopRD component as a separate service update with own migrations, authoritative transfer/reward validation, durable events and real device/game acceptance.

