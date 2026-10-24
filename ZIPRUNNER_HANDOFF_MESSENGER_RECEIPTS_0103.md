# Tavi 0.3.103 — messenger reliability + updater-safe handoff

## Scope

This pass fixes two messenger UX gaps while preserving the repaired Android updater:

1. Private messages over 1000 characters are no longer silently/ambiguously refused. Tavi shows a live count and explicit error, retains the draft, and clears it only after successful persistence.
2. Own direct messages now expose truthful `Sent`, `Delivered`, and `Seen` state.

`Delivered` is not inferred from server storage. It advances only when an authenticated recipient Tavi client fetches the DM feed. `Seen` continues to use the existing read cursor.

## Social change

- Social release: `0.3.103`
- Database schema: `12`
- Migration: additive `deliveredId INTEGER NOT NULL DEFAULT 0` on `SocialConversationRead`
- Existing direct messages/read cursors/accounts/contacts/Wallet rows are not rewritten.
- Back up the deployed Social database before schema 11 -> 12 deployment.

## Android updater preservation

The three native updater implementation files are byte-identical to 0.3.102. The corrected Tauri Kotlin import, PackageInstaller Session flow, APK identity/version/signature validation, self-test, and overlay-safe updater tests remain in place.

The physical updater acceptance target for this release is:

1. Have signed 0.3.102 installed on Android without uninstalling it.
2. Publish/operator-approve a signed 0.3.103 only after local Windows acceptance and exact-SHA CI.
3. Run the in-app updater from 0.3.102.
4. Accept Android's installer confirmation/unknown-source flow as required.
5. Confirm Tavi becomes 0.3.103 and remembered account/session data remains intact.
6. Test cancellation and installation/download failure paths separately.

`TAVI-UPDATES-003` remains Review until that physical test passes.

## Source verification completed before packaging

- Full Node verification: 12 server tests, 261 client tests, 20 OpenClaw tests.
- Full Python suite: 175 tests.
- LoopRD descriptor/handler synchronization: passed.
- Bundled extensions: 3 verified.
- Focused Android updater Node and Python regressions: passed.
- Non-destructive 0.3.102 -> 0.3.103 source overlay: full Node/Python/descriptor/extension verification passed.
- Existing 146 workboard items preserve ID, priority, status, acceptance criteria, and operator checks; new `TAVI-CHAT-004` is the 147th item.

## Operator gates still required

1. Import the exact 0.3.103 source ZIP into ZipRunner.
2. Require the normal Windows NSIS build and launch; do not infer native success from source tests.
3. Verify a 1001+ character DM on Windows retains the draft and displays the explicit limit error.
4. With two real accounts, verify `Sent -> Delivered -> Seen` and that receipt state survives refresh/restart and never moves backwards.
5. Back up Social and validate schema 11 -> 12 before deployment.
6. After operator-approved push, require exact-SHA Windows/Web/Android/source/UI workflows.
7. Perform the signed Android 0.3.102 -> 0.3.103 in-app update described above.

No Git push, tag, GitHub release, LoopRD deployment, database migration, or operator acceptance is performed by this source package.
