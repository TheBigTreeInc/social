ZIPRUNNER_HANDOFF v1|project=looprd-social|version=0.3.24|file=looprd-social-0.3.24-windows-build-lock-fix-ziprunner.zip

# Tavi 0.3.24 — Windows build executable lock fix

This source update replaces v0.3.23, whose ZipRunner build failed when Cargo could not replace `client/src-tauri/target/release/looprd-social-client.exe` because the previous executable was running (Windows error 5). All 70 client tests and the Vite build passed in the failing user log. The error was confined to native Windows executable replacement.

## Fix

- `BUILD-LOCAL.ps1` now calls `tools/stop-running-tavi.ps1` immediately before Windows Tauri/NSIS compilation.
- The helper identifies Windows processes by their full executable path, **not by process name alone**. Only the project's `target/release/looprd-social-client.exe` may be stopped. An independently installed Tavi process elsewhere is untouched.
- It attempts to close the native window normally for up to five seconds. Only if that exact process remains does it force termination of the matching PID. Unsaved drafts in a previously running development build may be lost if it must be forced closed; close Tavi normally first when possible.
- No program files, installers, user data, private configuration, `.env`, databases, or generated Rust target files are deleted. The existing auto-build backup of last-good NSIS installers remains.
- Changes to the stop helper invalidate the existing native build cache. Version advanced to **0.3.24** throughout project/client/Cargo/Tauri/LoopRD metadata. The Social database remains **schema 6**; no migration.

## ZipRunner operator acceptance

1. Import `looprd-social-0.3.24-windows-build-lock-fix-ziprunner.zip` into the existing project (do not create a second project).
2. Optionally start the prior built `client/src-tauri/target/release/looprd-social-client.exe` to reproduce the former lock. A running installed copy at another location does not need to close.
3. Watch ZipRunner's build log for `TAVI_BUILD_STOP_REQUESTED`, `TAVI_BUILD_STOP_CLOSED` or `TAVI_BUILD_STOP_FORCED`, then `TAVI_BUILD_STOP_READY`. If no matching process is running, READY reports zero.
4. Confirm the Rust/NSIS build produces v0.3.24, then launch Tavi. Retest Windows DPAPI remembered sign-in, which has not changed since v0.3.23.
5. If error 5 continues without a matched running executable, inspect Defender/antivirus quarantine, ACLs and open handles. Do not delete `target/`, loosen file permissions globally, or kill unrelated apps.
6. A Git push is not necessary to test this local Windows fix. If keeping LoopRD active release in sync, review/push source and `looprd.yaml` after a successful build; schema 6 is unchanged.

## Validation boundaries

Run `npm run verify`, `python tools/generate-looprd.py --check` and `python -m unittest discover -s tests -p 'test_*.py' -q`. The new source-level `client/tests/windows-build-lifecycle.test.mjs` verifies helper call order and restrictive process selection. A native Windows Rust/NSIS build still must be executed and accepted on your ZipRunner host.

No private credentials, runtime state or generated build output are bundled.
