## v0.3.30 — GitHub release gate

Import into existing `looprd-social` project. Adds `.github/workflows/release.yml`, `tools/release-gate.py` and `docs/RELEASE_PROCESS.md`; SDK workflows now run on every main push. Once seven required workflows pass on the same current SHA, a GitHub Release and v0.3.30 tag will be created with six bundles. Pages remains independently configured. No LoopRD schema migration.

ZIPRUNNER_HANDOFF v1|project=looprd-social|version=0.3.30|file=looprd-social-0.3.30-native-chat-history-fix-ziprunner.zip

# Tavi 0.3.30 — Remembered session recovery

This source ZIP supersedes v0.3.24. Import it into the existing **looprd-social**
ZipRunner project. Every packaged source/manifest release label is 0.3.30.

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

Server release label changes to 0.3.30 but schema remains **6**, with no new SQL
migration. No private secrets, local configuration, runtime state or generated
build output are included. Git publishing remains a separate operator decision.


## OpenClaw integration v0.3.30

A standalone headless Tavi account CLI and copyable OpenClaw agent instructions are in `integrations/openclaw/`. Use a dedicated Tavi user and private session. Chat and contacts are supported; game discovery is read-only until games implement agent-specific player/action contracts. The integration is a CLI adapter (not yet a native OpenClaw channel plugin). LoopRD schema 6 unchanged.

## v0.3.30 — GitHub distribution

Includes `.github/workflows/pages.yml`, SDKs for Python/Go/C#, and OpenClaw GitHub install instructions. No new database migration; schema 6. After Git push enable GitHub Actions Pages in repository settings. Pages deployment and native cross-OS installers have not been executed here.


## Tavi 0.3.30 — GitHub Actions coverage repair

The 0.3.27 GitHub Pages run failed **after successful Vite build** because the GitHub Pages site was not configured: `actions/configure-pages@v5` returned 404. In 0.3.30 the web client is always uploaded as a downloadable build artifact; Pages deployment still requires the repository owner to select **Settings → Pages → Build and deployment → GitHub Actions**. The deployment job is intentionally allowed to fail visibly until Pages is enabled.

The Linux/macOS native workflow now runs on main pushes and relevant PRs, producing a Linux amd64 `.deb` and macOS Apple Silicon `.dmg` subject to CI success. The SDK source-package workflow produces JavaScript, Python, Go, C# and OpenClaw bridge ZIPs, without implying binary distributions for language libraries. Artifacts are retained for 30 days. Native Linux/macOS workflows require remote GitHub runner verification. Social DB schema remains 6.


## Tavi 0.3.30 — Native conversation history fix

Windows chat-window peer validation previously required at least eight characters, but the server issues short IDs such as `acct_1`. Notifications worked through the main roster, while the native chat window rejected those IDs before loading history. The validator now accepts only the server-issued `acct_[1-9][0-9]{0,18}` form (and `lobby`), with regression tests for short IDs and malformed inputs. No schema migration or backend API change.
