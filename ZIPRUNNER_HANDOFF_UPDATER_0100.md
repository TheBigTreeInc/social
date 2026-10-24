# Tavi 0.3.100 — Android in-app update repair

Ticket: `TAVI-UPDATES-003` (Review). Source-only client pass from 0.3.99.

- Replaced APK `ACTION_VIEW` (system app chooser) with native `PackageInstaller.Session` and an explicit non-exported manifest callback for Android 14+.
- Reuse official GitHub signed release URL; preflight APK package/version/signing certificate; reject downgrade on real update. Android still prompts for approval.
- Added **Settings → Android updater & self-test**, which checks the latest signed release APK and deletes it **without installation**; show safe status and error codes and a copy-diagnostics option.
- Only the main Tauri window can initiate installer commands; iframe games/extensions cannot.
- `looprd.yaml`, Social handler, schema 11, version 0.3.99 server release and reviewed Companion/Wallet assets are unchanged.

Run `npm run verify`, `npm run check:looprd`, `npm run extensions:check`, `node --test client/tests/android-updater-100.test.mjs`, and `python -m unittest discover -s tests -p test_android_updater.py -v`. Then inspect the exact pushed GitHub Android build and five viewport browser QA.

**Device acceptance is outstanding.** Install 0.3.100 signed APK normally once. Run updater self-test against published official APK; expected stage `verified` and **no install prompt**. After 0.3.101 is signed and published, use Tavi's normal in-app Update action and confirm Android approval, increased version and preserved accounts/data. Do not uninstall. `ZRB-9297228324E24D42` remains linked to this ticket. No automatic source push, release or approval.
