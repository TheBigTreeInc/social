# Tavi 0.3.64 — CI repair / local workboard preservation

**Source candidate only.** Fixes Windows CRLF vs pinned extension asset hash and the browser QA hidden Games selector; no messaging/server/Android updater behavior changes.

- Prior exact push SHA: `4f4578c22f98b2cac90f40878d28ade8f88c5385` (9 public GitHub push workflow runs).
- Failed Windows: https://github.com/TheBigTreeInc/social/actions/runs/39318552767
- Failed UI QA: https://github.com/TheBigTreeInc/social/actions/runs/39318552582
- Bug report ZRB-9297228324E24D42 maps to existing `TAVI-UPDATES-003`; no unproven native fix.
- Full local operator 100-ticket snapshot is preserved; all Done/review decisions remain operator-owned.
- ZipRunner's `not_github` collector and stale post-update evidence still require correction in ZipRunner itself (`TAVI-QA-047`).
- No automatic push, merge, tag, operator secrets, production runtime action or release.

See `docs/TAVI_CI_REPAIR_ANDROID_TRIAGE_0364.adoc`.
