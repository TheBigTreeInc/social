ZIPRUNNER_HANDOFF v1|project=looprd-social|version=0.3.22|file=looprd-social-0.3.22-ecosystem-admin-ziprunner.zip

# Tavi 0.3.22 — LoopRD ecosystem administrator event delivery

This is a **full source overlay** for the existing `looprd-social` ZipRunner project. Source repository is **https://github.com/TheBigTreeInc/social**, `main`; LoopRD source spec reference is **https://github.com/pac-labs/dapi**. The Tavi application identity and paths remain unchanged. Do not create a new ZipRunner project or auto-push from this package.

## Delivered source functionality

- LoopRD `management.data` declaration: Tavi accounts list, safe projection and audited `promote-admin` / `revoke-admin` actions using the existing Data & actions UI. No persistent admin panels in Tavi.
- `SocialAccount.ecosystemAdmin` boolean, default false, with additive schema 6 migration. Account tokens/password hashes stay excluded from operator projections and the service API.
- The verified Tavi identity bridge supports explicit machine service identities via privately mounted secret references. No plaintext service secrets or LoopRD management key are bundled.
- `tavi-admin-notify/v1`: trusted same-runtime LoopRD service contract fans out recipient-bound inbox interactions with an optional HTTPS link to the current promoted admins; opaque event emission and `ctx.notify` occur in one transaction.
- `tavi-admin-role/v1`: trusted same-runtime role lookup; role revocation prevents a demoted user from seeing or acting on service-issued events.
- Tests in `tests/test_ecosystem_admin.py`, canonical docs `docs/ECOSYSTEM_ADMIN.adoc`, generated `looprd.yaml`, matching `ziprunner.looprd.json` digest, verified 0.3.22 metadata and workboard.

## Operator deployment steps (requires Git push)

1. Import this ZIP into the existing `looprd-social` project and allow ZipRunner verification/Windows auto-build. No automatic push or production DB modification occurs inside this ZIP.
2. Compare the Git diff. Review `looprd.yaml`, `server/looprd_verifier.py`, `server/admin_event_service.py`, `server/admin_role_service.py`, `server/looprd_handler.py` and `tools/generate-looprd.py` before committing.
3. Back up the existing LoopRD Social SQLite database, including runtime-owned push and operator-audit tables. Do not delete it or reset secrets. The application schema changes from **5 to 6**; `SocialAccount.ecosystemAdmin` defaults to false for old/new users.
4. Commit and push to the existing Git repository. LoopRD will detect/reconcile only when its configured sources actually point to this revision. Confirm active component release **0.3.22** and schema **6** in the LoopRD management console. The runtime requires `management.data`, `service.contracts`, verified authentication, durable events and UnifiedPush. Trusted Python must be enabled.
5. Register an account through Tavi; in LoopRD `/_looprd/panel/` select **Data & actions -> looprd-social -> Tavi accounts**. Use the named **Promote to ecosystem admin** action, include a reason and confirm. The account's Inbox automatically becomes eligible for trusted application events.
6. For each app allowed to send admin events, privately mount a strong service credential and configure `LOOPRD_SOCIAL_SERVICE_SECRETS_JSON` mapping caller component ID to that secret reference. Add the appropriate `dependencies` entries to that app's descriptor, with the same secret reference. See `docs/ECOSYSTEM_ADMIN.adoc` for the example and service schema.
7. Submit a test `tavi-admin-notify` call through the configured caller's `ctx.call`, then verify admin-only Inbox receipt, correct HTTPS link, LoopRD operator audit and immediate role revocation. Tavi user credentials and admin management key must never enter other apps.

## Validation scope

Author-side tests: **7 Node server, 61 Node client, 72 Python**; descriptor generation and ZipRunner package consistency pass. Native Web/Windows/Android compilation and live LoopRD/ntfy delivery were not run here. The normal Tavi chat behavior and Web/Android client targets are retained, and the Android UnifiedPush native receiver remains a separate pending feature.

## Limits and follow-up

* LoopRD's own bug-report and runtime alerts are **not automatically routed** through this release. Approved applications must call `tavi-admin-notify`; wiring LoopRD-native events requires a LoopRD-side producer.
* No third-party SSO, privileged embedded WebView or automatic game-action authorization is included.
* One service call is capped at 100 current admin recipients; larger deployments need a pagination/fanout architecture.
* Please confirm an actual Web/Windows build and LoopRD active release before regarding deployment as accepted.

## Versioning policy

Every source, metadata or packaging modification increments the Tavi release. Version 0.3.22 supersedes the failed 0.3.21 ZipRunner intake; the application schema stays 6. The workboard validation error is fixed in the package.
