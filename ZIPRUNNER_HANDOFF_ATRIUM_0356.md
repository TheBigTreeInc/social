# Tavi 0.3.56 — ZipRunner / Atrium discovery handoff

Source-only import for the classic messenger client and Social 0.3.56 backend.

- Import the uniquely versioned `looprd-social-0.3.56-atrium-trusted-discovery-ziprunner.zip`; do not re-import/reuse v0.3.55.
- No private `.env`, token, `ziprunner.config.json`, SQLite data, generated state, or installation outputs are included.
- Run strict workboard, manifest, SHA descriptor and all declared `.ziprunner-post-update-tests.json` checks. Ticket TAVI-ATRIUM-056 is **Planned**, not Done; all previous operator statuses remain intact.
- Source changes: server `atrium_discovery` endpoint with server-only Atrium apps:read token, restricted HTTPS fetch/sanitization; shared Tavi SDK and classic Home/My Games and Games discovery display. Manual promoted game links remain independent. `server/looprd-release.json` and generated `looprd.yaml` move to v0.3.56, schema 10 unchanged.
- Important: ZipRunner local Windows build does not deploy Social server, install service credentials or promote a Life release in Atrium. Operator must deploy the new backend and connect the trusted catalog to see live games.
- New server private runtime configuration: LOOPRD_TAVI_ATRIUM_DISCOVERY_URL, LOOPRD_TAVI_ATRIUM_READ_TOKEN, existing LOOPRD_TAVI_ATRIUM_BASE_URL (optional launcher URL). Keep secrets out of Git and logs. Read docs/TAVI_ATRIUM_DISCOVERY_0356.adoc.
- No automatic Life match creation, public publication or OpenClaw match acceptance claimed.
- Require live v2 Atrium sender/receiver proof, Life withdrawal and desktop/Android visual checks before approving the ticket.
- No Git push, tag, server deploy, release or operator-status changes by this package.
