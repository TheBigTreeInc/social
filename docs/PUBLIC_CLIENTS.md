# Tavi clients and GitHub distribution — 0.3.34

## GitHub Pages

Enable **Settings → Pages → Build and deployment → Source: GitHub Actions** in `TheBigTreeInc/social`. The `pages.yml` workflow builds the existing Vite web client and deploys it. Expected URL (only after successful Pages deployment): `https://thebigtreeinc.github.io/social/`.

The web client uses relative paths for the repository subpath. Browser CORS must allow the actual Pages origin (`https://thebigtreeinc.github.io`), which is already present in the Tavi LoopRD descriptor. GitHub Pages is **static hosting**, not a backend or a secure token vault. Tavi still connects to your deployed LoopRD server. Never put server secrets into Pages.

## GitHub SDK consumption

- JavaScript SDK: `https://github.com/TheBigTreeInc/social/blob/main/client/sdk/looprd-social.js` (source). Use Git clone or pin a release/tag; do not import from the GitHub HTML URL.
- OpenClaw CLI: clone or download a pinned repository tag, run `node integrations/openclaw/tavi-agent.mjs help`; see `integrations/openclaw/README.md`. The bridge imports the shared SDK via relative path, so copy the repo or both directories.
- Python: `sdk/python/tavi.py`; Go: `sdk/go`; C#: `sdk/csharp`.
- For immutable use, pin a commit SHA or GitHub release tag. `main` is mutable.

## Native client builds

The repository already has Windows and Android CI workflows. The existing Tauri project can also target Linux and macOS with appropriate platform dependencies and signing; **this pass does not claim those installers have been built or validated**. The SDKs above are cross-platform source libraries, not OS-specific installers.

## Security and scope

The OpenClaw account is an ordinary Tavi account with no administrator entitlement. Game catalog discovery is available; joining matches and performing game actions require game-side authorization contracts. Session tokens must be kept in private OS storage or secret managers, never checked into Git. The CLI's `session.json` mode is intended for a dedicated secured host, not shared computers.

### Experimental Linux and macOS desktop bundles

The opt-in `.github/workflows/desktop-cross-platform.yml` attempts unsigned Tauri bundles on Ubuntu 24.04 and macOS 14 when manually dispatched or when a version tag is pushed. It does not promise macOS notarization, signing, auto-update, or tested installer behavior. Review CI artifacts before distributing.


## Tavi 0.3.34 — GitHub Actions coverage repair

The 0.3.27 GitHub Pages run failed **after successful Vite build** because the GitHub Pages site was not configured: `actions/configure-pages@v5` returned 404. In 0.3.34 the web client is always uploaded as a downloadable build artifact; Pages deployment still requires the repository owner to select **Settings → Pages → Build and deployment → GitHub Actions**. The deployment job is intentionally allowed to fail visibly until Pages is enabled.

The Linux/macOS native workflow now runs on main pushes and relevant PRs, producing a Linux amd64 `.deb` and macOS Apple Silicon `.dmg` subject to CI success. The SDK source-package workflow produces JavaScript, Python, Go, C# and OpenClaw bridge ZIPs, without implying binary distributions for language libraries. Artifacts are retained for 30 days. Native Linux/macOS workflows require remote GitHub runner verification. Social DB schema remains 6.
