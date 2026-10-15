# ZIPRUNNER_HANDOFF v1

- Project: `looprd-social`
- Version: `0.2.3`
- File: `looprd-social-0.2.3-ziprunner.zip`
- Scope: GitHub native workflow preflight fixes (.gitattributes LF policy; Android SDK setup v4); no change to deployed LoopRD component, app identity or SQLite schema.
- SQLite data migration: **none** (`database.schemaVersion` remains 1).
- Authentication: **development-only**; no OIDC requirement.
- Validations: see `evidence/ci-repair.md` and `evidence/source-tests.txt`; source tests only, not a successful native GUI build.
- Follow-up: review PR / upload source to existing `TheBigTreeInc/social` repository and existing ZipRunner project, run both native GitHub Actions and verify installer/APK on devices. LoopRD source watcher may reload the 0.2.3 release descriptor; it uses the same handler and unchanged SQLite schema.
- Protected: `.git`, `.env`, `.data`, `secrets`, SQLite files, user configuration, build output.
- Workboard: root `.ziprunner-workboard-update.json` is producer evidence only. Operator/QA gates remain mandatory.
