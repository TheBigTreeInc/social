# Tavi 0.3.111 — ZipRunner preflight repair

## Failure addressed

ZipRunner 1.2.304.178 rejected the 0.3.110 candidate *before source overlay* with `Workboard update: TAVI-STORE-110 requires non-empty operator_checks (max 20).` Because detected/installed version remained 0.3.109, this repair advances directly to 0.3.111 and sets `base_version` to `0.3.109`.

## Exact repair

- Add all five existing acceptance criteria as explicit `operator_checks` for `TAVI-STORE-110`, preserving that ticket's ID, `review` status, priority, summary, and acceptance criteria.
- Add a Node regression test that validates non-empty 1–20 operator checks on every item in `implemented` before packaging.
- Update the source client/package and ZipRunner candidate version consistently to `0.3.111`. The previous App Store UI/source functionality is unchanged.
- Preserve the other 152 workboard items and all prior operator decisions.
- Preserve Social 0.3.107/schema 12, `looprd.yaml`, the extension publisher assets, and the Android PackageInstaller implementation byte-for-byte.
- Preserve the local Windows Git checkout, sessions, settings and generated installers; this is a non-destructive overlay. No Git operation is performed.

## Operator steps

1. Import `looprd-social-0.3.111-compact-app-store-workboard-repair-ziprunner.zip` into the existing `looprd-social` project. Do not delete the failed 0.3.110 ZIP or reset project state.
2. Confirm ZipRunner workboard preflight passes and records the detected version 0.3.111.
3. Confirm normal build steps pass and the Windows client launches as Tavi 0.3.111.
4. Open App Store at 355×630, check at least three compact rows, search/filter/details, no horizontal scroll, and central TaviX alternative release offers for Companion 0.6.30 and Atrium 1.0.2.
5. Verify a cancelled source switch retains 0.6.27/1.0.0 installation/source pins; test Android update and personal app storage without approval being assumed.
6. Inspect exact-commit CI separately if pushed by ZipRunner. Source build success does not approve native/UI behavior or release.

## Checks

`node --test tests/ziprunner-workboard-size.test.mjs`

`npm run verify`

`python tools/generate-looprd.py --check`

`python -m unittest discover -s tests -v`

`node tools/sync-internal-extensions.mjs --check`
