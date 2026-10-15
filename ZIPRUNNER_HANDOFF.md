# ZIPRUNNER_HANDOFF v1

- Project: `looprd-social`
- Version: `0.2.2`
- File: `looprd-social-0.2.2-ziprunner.zip`
- Scope: additive integration of original LoopRD Social 0.2.1 backend with Tauri Windows/Android client under `client/`; server portrait code support; GitHub build workflows.
- SQLite data migration: **none** (`database.schemaVersion` remains 1).
- Authentication: **development-only**; no OIDC requirement.
- Validations: see `evidence/source-tests.txt`; source-only checks, not native GUI acceptance or live LoopRD deployment.
- Follow-up: upload source to existing `TheBigTreeInc/social` repository and existing ZipRunner project, run GitHub Actions and verify installers/APK. Deploy LoopRD component 0.2.2 only after review.
- Protected: `.git`, `.env`, `.data`, `secrets`, SQLite files, user configuration, build output.
- Workboard: root `.ziprunner-workboard-update.json` is producer evidence only. Operator/QA gates remain mandatory.
