# Tavi 0.3.107 — LoopRD 0.4 Wallet subcomponent handoff

## Purpose

This pass makes Wallet a first-class LoopRD 0.4 **independent subcomponent service** without silently moving existing Gold balances/history out of the Social database.

- Tavi/client/source version: **0.3.107**
- Social LoopRD release: **0.3.107**
- Social database schema: **12 (unchanged)**
- Wallet child component: **`tavi-wallet`**
- Companion: **0.6.27 (unchanged)**
- Android PackageInstaller implementation: **unchanged from 0.3.106**
- Upstream LoopRD design baseline: `pac-labs/dapi` commit `c2b486bc7f526e71d8c26d77cb56bff9270d3347`, LoopRD 0.4 `subcomponents` + typed service contracts.

## Architecture

The root Social descriptor now requires `spec.subcomponents` and declares:

```yaml
subcomponents:
  - source: extensions/org.tavi.core.wallet/looprd/looprd.yaml
```

LoopRD 0.4 therefore mounts the child at:

`/looprd/looprd-social/tavi-wallet/v1`

Only the Social parent belongs in the operator source registry. Do **not** register `tavi-wallet` as a second flat root source.

The child owns independent database-auth keys/scopes and exposes service-only contracts:

- `tavi-wallet-merchant` v1 — scope `wallet:merchant`
- `tavi-wallet-reward` v1 — scope `wallet:reward`

The child forwards the verified caller component ID through `ctx.call()` to `looprd-social` contract `tavi-wallet-ledger-broker` v1. The parent broker permits only immediate caller `tavi-wallet`. The original game/service identity is then used by the existing Wallet policy/ledger code.

## Compatibility / storage boundary

The authoritative Wallet tables remain in **Social schema 12**. There is **no SQL migration** in 0.3.107 and the child database does not contain Gold balances/history.

This intentionally preserves:

- existing Tavi `/wallet` calls authenticated with Social user sessions;
- existing Gold balances, journal IDs, restricted/play-only provenance, orders and reward idempotency;
- legacy direct Social merchant/reward contracts while games are migrated to the child service.

`TAVI-WALLET-SPLIT-082` remains the future explicit, backed-up storage migration into an independent Ledger database. Do not delete the Social Wallet tables after deploying 0.3.107.

## Private deployment requirement

Before enabling child-to-parent settlement, create/mount a private secret reference named:

`tavi-wallet-social-service-key`

Configure Social's existing verified service adapter so that credential is bound to service identity `tavi-wallet`, for example via the operator-owned `LOOPRD_SOCIAL_SERVICE_SECRETS_JSON` mapping. The secret value must remain outside Git/ZIP.

For a game/service to call the child, issue a **`tavi-wallet` component database key bound to that caller's component ID** and only the required scope. Ordinary unbound API keys are rejected by the service-only contracts. Revoke the key to prove calls fail closed.

The child dependency on the Social broker is optional: missing private credential must not prevent Social/Tavi user Wallet startup; service settlement instead returns `ledger_unavailable`.

## Deployment gate

1. **Upgrade the host to LoopRD/DAPI 0.4+ before activating this descriptor.** Older strict hosts do not understand `subcomponents`.
2. Back up the Social DB plus LoopRD data/checkpoints.
3. If Python trust restrictions are enabled, explicitly trust both `looprd-social` and `tavi-wallet`.
4. Import the exact source ZIP through ZipRunner and require normal Windows build/launch.
5. Run the installed host's official LoopRD validator against the root descriptor before server promotion.
6. Activate the root only; verify both `/looprd/looprd-social/v1` and the nested child are independently healthy.
7. Verify existing Tavi Gold balance/history with a normal account.
8. Provision one caller-bound test service key and exercise reward + merchant fulfillment/refund through `tavi-wallet`.
9. Revoke/block the child key/component and verify Social messaging and existing user Wallet stay healthy.
10. Require exact-SHA CI, Windows/Android acceptance and signed Android updater verification before release promotion.

## Source verification performed here

- `npm run verify`: 13 server + 268 client + 20 OpenClaw tests passed.
- Full Python suite: 181 tests passed.
- Focused LoopRD 0.4 Wallet tests passed, including caller identity forwarding and parent-broker restriction.
- `python tools/generate-looprd.py --check` passed for both parent and child descriptors.
- All 3 bundled extensions verified.
- Android updater implementation files are byte-identical to 0.3.106.
- Companion 0.6.27 manifest/UI bytes checked unchanged.
- Workboard update remains below ZipRunner's 256 KiB ingestion limit.

The author environment does not contain the upstream `looprd` CLI package, so **official runtime semantic validation and live LoopRD 0.4 activation remain operator gates**. The new service-contract shapes are source-checked against the pinned 0.4 supported structural subset.

No Git push, production deployment, secret provisioning, database migration, or release was performed by this source pass.
