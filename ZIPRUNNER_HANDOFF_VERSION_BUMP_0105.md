# Tavi 0.3.105 — ZipRunner retry version bump

Tavi 0.3.105 is a packaging/version retry of the corrected 0.3.104 Companion 0.6.27 candidate. No new product feature, Social server change, database migration, extension permission, or Android updater implementation change is introduced by this bump.

## Preserved behavior

- Companion remains 0.6.27 with the same reviewed publisher/version/digest and sandbox permissions.
- Messenger Sent / Delivered / Seen receipts remain backed by Social 0.3.103 / schema 12.
- Android PackageInstaller updater/self-test/signature/version guards remain unchanged.
- The compact ZipRunner workboard handoff remains below the 256 KiB preflight limit.

## Operator gate

Import the exact 0.3.105 source ZIP through ZipRunner and require the normal Windows verification, NSIS build, install/launch, and operator acceptance. Do not push or publish solely from source verification. After Windows acceptance and a signed Android build, use 0.3.105 as the next in-app updater candidate.
