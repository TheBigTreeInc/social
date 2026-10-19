# Tavi 0.3.62 — UI/UX browser self-tests in ZipRunner

This source candidate updates 0.3.61. **The LoopRD Social server/descriptor remains release 0.3.58 and schema 10.** Tavi's existing conversations, Atrium, Companions, extension catalog, and SDK behavior are not migrated or reset.

## What is automated now

- ZipRunner re-runs existing source/UI contract tests **and** the new browser UI QA command after each source update. Failure is explicitly surfaced with `attention_on_failure`, not reported as success. Existing 20-command limit is preserved by combining UI verification with the extension command.
- `npm --prefix client run ui:ci` builds the web bundle and launches an actual headless Chromium/Chrome with `playwright-core`. The entire test uses a temporary localhost HTTP server with disposable Social account responses, without real LoopRD credentials or external dependencies.
- Each of desktop 1366×768, Android-like 390×844, and narrow 320×720 exercises server discovery, disposable sign-in, Home, Main menu, App Store, install and open the bundled Private Notepad iframe, Home return, JavaScript errors, and horizontal overflow.
- Failure artifacts: `client/qa-artifacts/report.json` and full-page PNG screenshots, one per failed viewport; `TAVI_QA_CAPTURE=1` also saves successful screenshots. The artifact directory is gitignored. No real messages, usernames, or tokens appear in QA fixtures.
- `.github/workflows/ui-qa.yml` runs browser QA as a blocking CI job on PRs and main pushes and uploads screenshots/results on failures. GitHub Action status is the web UI QA gate. Native Windows/Android operator acceptance remains separate.

## Prerequisites and result semantics

1. `npm install --prefix client` (installs Vite and playwright-core).
2. Have a Chromium/Chrome executable installed and usable in headless mode, or set `TAVI_QA_BROWSER_PATH` to the executable; the CI job installs a Playwright Chromium browser.
3. `npm --prefix client run ui:ci` (build + real-browser test). No running Tavi server or login account is required.
4. A missing build, npm dependency, or browser produces a **nonzero UI QA BLOCKED** result, not a fake pass; inspect ZipRunner attention and `client/qa-artifacts/report.json`.
5. Since ZipRunner's post-update test command is non-gating, do not regard a new release as UI-accepted merely because ZipRunner installed its source. Require green UI CI and Windows/Android checks before calling the UI/UX tasks Done.

## Limitations / remaining QA

- This suite validates actual browser interactions and layout bounds but is not yet a pixel-by-pixel visual baseline or color-contrast audit.
- The Social backend is simulated; real permission prompts, native WebView2, Android safe areas, notifications, window drag/resize, real wallet state and remote LoopRD instance binding require separate integration/operator tests.
- A failed UI test must not authorize resetting or deleting the user's account, local storage, or runtime data. All test sessions use isolated fresh browser contexts.
