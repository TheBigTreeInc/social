# LoopRD Social Client 0.1.0

Game-focused Social client, backed by **one selected LoopRD server**. Windows desktop and Android share the same Tauri v2/WebView source. Identity, devices and user-facing behavior belong to Social and game components, not the LoopRD runtime.

## Current functionality

- Existing LoopRD Social v0.2.2 profile save and lobby chat; numeric portrait codes synchronize through the server for the same account.
- Per-server game component list; optional game-turn status and notifications while the app is running.
- Native notification permission prompt and Windows/Android local notifications.
- TheBigTreeInc/assets **Portrait Library 3.0.0** generator integrated as a responsive workshop. Numeric identity codes are preserved as decimal strings, and live art/metadata come from the canonical online registry.
- No OIDC provider needed. Existing Social development token is session memory only.

**Not production-ready:** current Social development-token auth is unsuitable for a public server; friends/groups/game invitations and background mobile push require additional Social/game backend APIs. See [architecture](docs/ARCHITECTURE.md) and [game activity](docs/GAME_ACTIVITY_CONTRACT.md).

## Try the UI locally (Windows, macOS, Linux)

Install Node.js 22+, then:

```sh
npm install
npm run portrait:sync
npm run test
npm run dev
```

Browse `http://127.0.0.1:5173` for a web preview. Enter the **LoopRD server origin**, for example `https://your-host.example`, not a component URL, and the development credential configured on your Social component. The Social API path is `/looprd/looprd-social/v1/social`. Current Social must already be deployed on that same server. Configure LoopRD `LOOPRD_ORIGINS` / your reverse proxy to permit your actual app origin (`http://127.0.0.1:5173` for browser testing and the native Tauri WebView origin on desktop/mobile). Prefer HTTPS for production.

The portrait sync script retrieves the approved three generator JS modules from `TheBigTreeInc/assets` and writes `public/portrait/vendor` as a reviewable source snapshot. It does **not** embed artwork copies. Every app start fetches the latest upstream registry and SHA-verified selected PNGs. To update source modules, run `npm run portrait:sync`, review the changes, and commit them. The scheduled GitHub workflow can open a PR that advances the audited source pin. The art registry itself is checked online at each launch.

## Native Windows client

With Windows 10/11, Visual Studio C++ build tools and Rust installed:

```powershell
npm install
npm run portrait:sync
npm run tauri -- dev
npm run tauri -- build --bundles nsis
```

Installer: `src-tauri/target/release/bundle/nsis/*.exe`. The GitHub workflow **Windows desktop app** installs tools and uploads this installer as a workflow artifact. The installer is unsigned until a code-signing identity is configured.

## Native Android client

On a machine with Rust, Android SDK/NDK and JDK:

```sh
npm install
npm run portrait:sync
npm run tauri -- android init --ci
npm run tauri -- android build --apk --debug --ci --target aarch64
```

GitHub workflow **Android phone app** generates and uploads an ARM64 debug APK for sideload testing. Android release signing / store publication is a separate operator-controlled task. Android cannot connect to your PC's `localhost`; use your server HTTPS address or the Android emulator's `10.0.2.2` developer address.

## GitHub Actions

- `../.github/workflows/windows.yml`: test + NSIS Windows installer artifact.
- `../.github/workflows/android.yml`: test + ARM64 Android debug APK artifact.
- `../.github/workflows/portrait-updates.yml`: weekly generator source synchronization to a reviewable PR. Upstream sources are not silently executed at runtime.

## ZipRunner

Root project key **`looprd-social`**; the client source is under `client/`. ZIP: `looprd-social-0.2.2-ziprunner.zip`, spec v2.1.1. Repository root `project.zr` provides source intake/build identity, `.ziprunner-workboard-update.json` is mandatory, `ziprunner-manifest.json` adds the v2 interchange work manifest. Keep secrets/local state outside the ZIP. The build gate uses `node --test` and a static source/manifest validator (no Rust SDK necessary for normal ZipRunner intake). Native builds take place in GitHub Actions. Operator review remains mandatory.

`npm run portrait:sync` is separately run by the workflows and by a developer with network access; a ZipRunner source overlay never executes remote code as part of the local build gate.
