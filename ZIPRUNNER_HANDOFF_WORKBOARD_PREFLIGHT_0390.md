# Tavi 0.3.90 — ZipRunner workboard preflight repair

## Failure confirmed

ZipRunner 1.2.304.164 rejected `looprd-social-0.3.89-wallet-extension-looprd-ci-repair-ziprunner.zip` during mandatory workboard validation, **before source overlay or build**. Its exception was:

`Workboard update: TAVI-WALLET-EMBED-089 requires non-empty operator_checks (max 20).`

The next new ticket, `TAVI-CI-COMPANION-BYTES-089`, had the same defect and would have failed after the first one was repaired.

## Repair applied

- Added `operator_checks` to **both** new Review tickets by copying their existing acceptance criteria, five and four checks respectively. No criteria, status, priority, owner decision, or preexisting workboard ticket was changed.
- Retained exactly 138 workboard entries: original 136 from v0.3.88 plus the two Review tickets from the attempted 0.3.89 update.
- Advanced Tavi/ZipRunner client and artifact version to **0.3.90** because 0.3.89 failed preflight and was not installed. Maintained `base_version: 0.3.88` for that reason.
- Preserved every other source asset, including extension-owned Ledger source, reviewed Companion 0.6.11 digest, Git byte-preservation policy, approved extension registry, `looprd.yaml`, and Social server release 0.3.83/schema 11.
- Changed no local runtime configuration, private data, database, account, authenticated session, Git repository, or generated build output.

## Operator actions

1. Import the **new** `looprd-social-0.3.90-workboard-preflight-repair-ziprunner.zip` through the existing `looprd-social` ZipRunner project. The old 0.3.89 ZIP cannot pass its workboard gate.
2. Confirm workboard preflight passes for all 138 items; the existing 136 records remain as operator previously set and both 089 tickets remain in Review.
3. Run the project's configured source verification and local Windows build, then inspect the exact ZIP SHA/results. Build success is not operator acceptance.
4. After explicitly approving source changes, use normal Git review/push and check the **exact pushed commit** Android/source/UI workflows. The Companion CI bytes fix has not been proven on GitHub by this local package.
5. Independently validate deployed LoopRD Social (release 0.3.83/schema 11, existing account data backed up) and Wallet APIs without introducing a second Ledger. The Android native in-app APK update remains `TAVI-UPDATES-003` in Review until tested on a real phone.

## Developer verification

```sh
python tools/generate-looprd.py --check
python -m unittest discover -s tests -p test_wallet_extension_embedding.py -v
python -m unittest discover -s tests -p test_wallet_ledger.py -q
node --test client/tests/reviewed-partner-git-integrity-089.test.mjs
npm run extensions:check
npm run verify
```

The v0.3.89 implementation handoff is preserved as `ZIPRUNNER_HANDOFF_WALLET_EMBED_CI_0389.md`. No automatic push, tag, release or live deployment was performed.
