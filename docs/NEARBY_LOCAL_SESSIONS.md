# Tavi Nearby / Atrium local-session contract — foundation v0.3.39

**Status:** offline journal implemented and tested, BLE transport / device pairing / account trust / UI / game integrations / cloud upload NOT implemented. No LoopRD database/API changes.

## Intent
A family or friend group can play supported turn-based games on a train without internet. One device is the session host and is authoritative for a single ordered game-action history. Participating peers should retain verified copies. Messages will use a separate encrypted chat channel, not be stored in game history.

## Contract
`client/src/nearby/local-session.js` defines `tavi.nearby.session/v1`: random session ID, host ID, game ID, explicit 2–8 player roster, revision, chain head, append-only action list and last acknowledged online revision/head. `appendHostAction` requires a game-specific validation hook for real games; applications MUST NOT omit it in production. Each action is serialized in deterministic field order and SHA-256 chained to the prior revision. `verifySession` detects accidental corruption but **is not authentication or a digital signature**. Nothing accepts actions merely because they contain a valid hash.

`syncIntent` packages pending actions against a server-acknowledged prefix. `compareRemoteHead` reports matching / behind / conflict. A divergent server head **must stop the upload**, be displayed to a human, and never overwrite server history. `markAcknowledged` accepts only a verified journal prefix. No sync network endpoint is assumed or created. Server must authenticate member identity, authorize session, validate game rules, protect against replay, check prefix and atomically record accepted revisions.

## Local transport boundary (planned, not shipped)
- Android: mutually approved nearby pairing, ephemeral discoverability, platform Nearby Connections or BLE discovery + Wi-Fi Direct data channel.
- Perform authenticated key agreement with a short pairing code or QR check; encrypted payloads, rotation, replay protection and explicit revoke/disconnect.
- Separate local transport from game actions: messages (`chat/v1`), host commands (`game-action/v1`), acknowledgements (`game-ack/v1`) and snapshots (`snapshot/v1`) with bounded frames.
- Never use Bluetooth PAN tethering as a prerequisite. Sharing internet is an optional Android OS setting, not an app-operated proxy.
- No persistent background discovery or exposure of usernames by default. Children can participate under parent-authorized temporary local identities without internet registration.

## Resilience / future storage
This initial prototype uses a bounded browser-compatible key-value storage adapter (maximum 2,000 actions). Do not trust it for large production saves. Move to native SQLite / IndexedDB with atomic writes, checksums and snapshots before exposing live user sessions. On app restart, load then `verifySession` before resuming. A host disconnect pauses authoritative play until verified host migration or original host returns; never invent peer election.

## Atrium integration prerequisites
Atrium supplies an authoritative game-rule reducer and serializable game-state snapshots; per-game opt-in to nearby; online session ID mapping and transactional sync endpoint with conflict response; deterministic versioned move schema. No claim that existing games have these capabilities today.

## Acceptance milestones
1. Offline engine: hash-chain, history persistence and divergent-sync regressions — v0.3.39.
2. Two Android devices: pairing, channel encryption, discovery permissions and secure chat — pending native builds / device acceptance.
3. One Atrium turn-based game using this engine and rules validator — pending game contract.
4. Airplane-mode train scenario: resume after device restart, host reconnect and eventual server sync without duplicate moves — pending end-to-end validation.
