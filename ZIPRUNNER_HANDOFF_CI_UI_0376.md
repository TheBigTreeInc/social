# Tavi 0.3.76 — CI gate + mobile/native QA

Latest operator QA: locally installed 0.3.75, 118 operator tickets. New source package preserves all 118 tickets unchanged and adds two Review candidates. No operator Done tickets.

## Investigation

GitHub push `2ef64c34a7774c970924fd3fe5fc7006da0e4d4a` (0.3.74): nine push workflows; eight passed, `Tavi browser UI QA` failed. Three screenshot cases timed out on obsolete `.tavi-discovered-mini` Home selector; no JS errors. GitHub v0.3.74 was nonetheless published because the old release gate omitted browser UI QA. The 0.3.75 source had already repaired the selector, but its new GitHub CI is not verified.

## 0.3.76 changes

- Future GitHub release gate now *requires browser UI QA* for the exact commit, in addition to seven pre-existing required workflows.
- Read-only `node tools/github-ci-evidence.mjs --sha SHA --output qa-evidence/exact-commit.json` helps ZipRunner distinguish `not_github` ingestion gap from real missing/failed checks.
- Mobile 44px contact touch targets via shared UI tokens; no redundant Home toolbar/search/games.
- Extend native WebView2 QA checks for mutually exclusive classic menus / Escape / Home cleanup (disposable QA only).
- Added focused regression tests and AsciiDoc handoff.

## Remaining

- ZipRunner owns TAVI-QA-047 CI watcher; Tavi evidence helper does not modify ZipRunner software.
- Native Windows and Android device acceptance, release approval and Lite/Lit migration remain pending. Android in-app updater incident remains open.
- No Git push, tag, release or remote deployment was performed.
