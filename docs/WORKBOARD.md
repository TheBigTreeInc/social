# LoopRD Social shared repository workboard — 0.2.2

This release retains `looprd-social` as both the LoopRD component and ZipRunner project key. Server code is at the repository root; the native app is in `client/`.

Existing stable IDs: LRS-001/002/003/005 source implemented previously; do not recreate or reset their operator-verified states. LRS-004 remains outstanding but **OIDC is NOT required**: Social owns user sessions and validation as the implementer. New LRS-006 stores canonical numeric portrait identity in the existing profile JSON. Client implementation evidence is SCL-001 through SCL-006, with private/group chat, game contracts, push, and device-native acceptance still outstanding.

ZipRunner source build/import evidence is not QA or operator acceptance. Data, secrets and git history are preserved. See root `.ziprunner-workboard-update.json` for accepted work IDs and required operator checks.
