
## v0.3.38 — DAPI notification efficiency

New `client/src/sync-coordinator.js` coalesces WebSocket and push wake hints and retries a wake deferred by a concurrent full refresh. `refresh({mailboxOnly:true})` avoids unrelated per-game polling; periodic full reconciliation remains in place. Validate Android foreground incoming messages and Windows native chats on actual devices; no background UnifiedPush distributor added. LoopRD descriptor release advances to 0.3.38, schema remains 6.
ZIPRUNNER_HANDOFF v1|project=looprd-social|version=0.3.38|file=looprd-social-0.3.38-nearby-foundation-ziprunner.zip

## v0.3.38 — LoopRD bug reports

Import this full source ZIP into `looprd-social`. Deploy regenerated `looprd.yaml` with requires `reports.bugs` only after updating LoopRD runtime. Android login errors may be submitted before login, using the public Tavi guest verifier token and no login credentials. Verify 202 receipt and check LoopRD management > Bug reports. No Social SQL schema change. Android login itself remains to be diagnosed.

## v0.3.38 — GitHub release gate

Import into existing `looprd-social` project. Adds `.github/workflows/release.yml`, `tools/release-gate.py` and `docs/RELEASE_PROCESS.md`; SDK workflows now run on every main push. Once seven required workflows pass on the same current SHA, a GitHub Release and v0.3.38 tag will be created with six bundles. Pages remains independently configured. No LoopRD schema migration.

ZIPRUNNER_HANDOFF v1|project=looprd-social|version=0.3.38|file=looprd-social-0.3.38-native-chat-history-fix-ziprunner.zip

# Tavi 0.3.38 — Remembered session recovery

This source ZIP supersedes v0.3.24. Import it into the existing **looprd-social**
ZipRunner project. Every packaged source/manifest release label is 0.3.38.

## Delivered

* New bounded (8/16/32/60 second) auto-reconnect on temporary startup failure,
  and explicit Retry saved sign-in / Use another account controls in the narrow login window.
* Saved session is retained on HTTP 403 and temporary errors, cleared on confirmed
  401 invalid credential. Restored identity still comes from the server.
* Coalescing/cancellation of retries on sign-in, sign-out and account switching.
* Corrected duplicated trusted-device copy; no changes to DPAPI file format,
  server authentication handlers or Social data model.

## Acceptance on Windows

1. Import the ZIP and observe the ZipRunner build. Confirm the pre-build shutdown
   from v0.3.24 still runs and Cargo/NSIS can build successfully.
2. Log in and select Remember this device. Close Tavi, disconnect your network,
   reopen Tavi. Confirm saved sign-in warning and Retry button without losing vault.
3. Restore network; verify the roster reconnects without restarting or entering a
   password. Click Retry for an immediate manual test.
4. Sign out and reopen; verify session was revoked and is no longer restored.
5. Confirm normal chat, contacts, interactive inbox and separate chat windows still work.

## Validation boundary

Run `npm run verify`, `python tools/generate-looprd.py --check`, and
`python -m unittest discover -s tests -p 'test_*.py' -q`. Native Windows
compilation/DPAPI and live LoopRD acceptance are **not** claimed by author-side
tests. The new source file is `client/src/session-recovery.js`; tests are in
`client/tests/session-recovery.test.mjs`.

Server release label changes to 0.3.38 but schema remains **6**, with no new SQL
migration. No private secrets, local configuration, runtime state or generated
build output are included. Git publishing remains a separate operator decision.


## OpenClaw integration v0.3.38

A standalone headless Tavi account CLI and copyable OpenClaw agent instructions are in `integrations/openclaw/`. Use a dedicated Tavi user and private session. Chat and contacts are supported; game discovery is read-only until games implement agent-specific player/action contracts. The integration is a CLI adapter (not yet a native OpenClaw channel plugin). LoopRD schema 6 unchanged.

## v0.3.38 — GitHub distribution

Includes `.github/workflows/pages.yml`, SDKs for Python/Go/C#, and OpenClaw GitHub install instructions. No new database migration; schema 6. After Git push enable GitHub Actions Pages in repository settings. Pages deployment and native cross-OS installers have not been executed here.


## Tavi 0.3.38 — GitHub Actions coverage repair

The 0.3.27 GitHub Pages run failed **after successful Vite build** because the GitHub Pages site was not configured: `actions/configure-pages@v5` returned 404. In 0.3.38 the web client is always uploaded as a downloadable build artifact; Pages deployment still requires the repository owner to select **Settings → Pages → Build and deployment → GitHub Actions**. The deployment job is intentionally allowed to fail visibly until Pages is enabled.

The Linux/macOS native workflow now runs on main pushes and relevant PRs, producing a Linux amd64 `.deb` and macOS Apple Silicon `.dmg` subject to CI success. The SDK source-package workflow produces JavaScript, Python, Go, C# and OpenClaw bridge ZIPs, without implying binary distributions for language libraries. Artifacts are retained for 30 days. Native Linux/macOS workflows require remote GitHub runner verification. Social DB schema remains 6.


## Tavi 0.3.38 — Native conversation history fix

Windows chat-window peer validation previously required at least eight characters, but the server issues short IDs such as `acct_1`. Notifications worked through the main roster, while the native chat window rejected those IDs before loading history. The validator now accepts only the server-issued `acct_[1-9][0-9]{0,18}` form (and `lobby`), with regression tests for short IDs and malformed inputs. No schema migration or backend API change.

## v0.3.38 Android update pass

Requires GitHub Actions Android signing secrets before release pipeline can pass. Signed APK is a direct GitHub Release asset; current Android client opens the system download, not an in-app installer. See `docs/ANDROID_UPDATES.md`.

## v0.3.38 Android native in-app updater
CI patches Tauri-generated Kotlin Android plugin and FileProvider on each build. UI calls Rust main-window-only command for exact authenticated GitHub APK release URL. Device permission and Android installation approval required. APK installs have NOT been hardware-tested here. Signed APK release secrets remain mandatory.

Signed release workflow also exports TAVI_ANDROID_KEYSTORE_PATH within its current shell before applying the Gradle signing configuration (not merely on subsequent steps).

## v0.3.38 GitHub Actions Android correction
GitHub run 39053886663 compiled the Android release APK successfully but failed at `Verify signed release APK exists` because the workflow used `outputs/apk/release/`. Correct path is `outputs/apk/universal/release/app-universal-release.apk`. This pass verifies the signed APK and stages the upload under `outputs/tavi-release/`. Rebuild on GitHub; local author cannot validate Android signing or phone installation.


## v0.3.38 — Nearby/offline gameplay foundation

Added `client/src/nearby/local-session.js` offline turn journal with chain verification, local persistence, explicit server sync prefix and conflict detection. See `docs/NEARBY_LOCAL_SESSIONS.md`. **No Bluetooth pairing, nearby chat, game adapter or cloud synchronization is implemented in this release.** No Social schema migration.

## 0.3.38 OpenClaw notification-driven bridge
Persistent Tavi WebSocket pulse consumer with authenticated DM reconciliation and opt-in OpenClaw CLI agent reply service. See integrations/openclaw/README.md. This is not an installed native OpenClaw channel; live Gateway acceptance outstanding.
