# Tavi 0.3.63 — execute TAVI-ATRIUM-056 (read-only discovery)

- **Scope:** Tavi-only discovery QA and Games UX; no Atrium/Life changes and no Social DB/schema/descriptor update. LoopRD server remains **0.3.58/schema 10**.
- **Source improvements:** Games refresh and accurate no-reviewed-games state; client/browser fixture shows The Life Loop on Home and Games, never with Play/Invite, then removes it on withdrawn metadata; same UI/extension QA continues.
- **Operator acceptance:** `node tools/verify-atrium-live.mjs --origin <operator-approved-HTTPS-LoopRD-origin>` using an already authorized disposable Social test session passed in `TAVI_SOCIAL_QA_TOKEN`. Negative/withdrawal check: append `--expect-absent` after deliberately removing the *test* trusted observation. Script never modifies database or runtime config.
- **Config:** server-only `LOOPRD_TAVI_ATRIUM_BACKEND_ORIGIN` + `LOOPRD_TAVI_ATRIUM_READ_TOKEN` (`apps:read`); upstream Atrium trusted v2 observation of `life.loop` required. Do not copy the token into a ZIP or browser.
- **Tests:** Node JS unit and SQL Python suites, no simulated production acceptance; `npm --prefix client run ui:ci` requires Vite deps and Chromium. ZipRunner source tests are not native GUI evidence. UI QA intentionally BLOCKED if browser/build prerequisites are absent.
- **Workboard:** preserve 99 local tickets and statuses. `TAVI-ATRIUM-056` remains Review until deployed server/Atrium, real session, Windows/Android/Web UI and CI/SHA acceptance. Do not mark Done, do not automatically push/tag/deploy.

See `docs/TAVI_ATRIUM_DISCOVERY_EXECUTION_0363.adoc` for the detailed sequence and evidence boundaries.
