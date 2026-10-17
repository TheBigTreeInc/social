## TAVI-ADMIN-001 — Ecosystem administrator event delivery (0.3.22)

Implemented in source: LoopRD protected Tavi accounts management declarations,
operator-audited promote/revoke actions, additive schema 6 administrator flag,
verified machine service principals loaded from private secret references,
`tavi-admin-notify/v1` and `tavi-admin-role/v1` service contracts, per-admin inbox
fanout and transaction-bound opaque event/UnifiedPush notifications. De-promotion
immediately removes access to service-issued inbox events; existing Tavi chat UI
remains unchanged. Python regression coverage added in
`tests/test_ecosystem_admin.py`; live LoopRD reconciliation and production machine
credential provisioning must be validated by operator. See `docs/ECOSYSTEM_ADMIN.adoc`.

# Work board — Social 0.3.2

- SCL-019: classic slim Windows Messenger UI in source; awaiting native/operator visual acceptance.
- SCL-018: server-gated developer mode implemented in 0.3.1 and preserved; no privilege changes this pass.
- SCL-010: native GitHub Windows/Android build and device acceptance pending for this release.
- LRS-004: account recovery / hardened public registration remains open.
- SCL-007: private groups and trusted invites remain open.
- SCL-009: Android background notifications remain open.
- SCL-011: game activity contracts depend on game components.
- SCL-017: secure remembered-device login remains open.


## TAVI-CHAT-001 — Foreground chat notifications, unread state and mobile usability (0.3.17)

Implemented in source: per-contact unread badges, bounded rotating DM feed scans, local per-account read state, private-by-default OS notifications, separate-window seen acknowledgments, chat composer live refresh, Android safe-area/touch improvements. Awaiting Windows installer and Android foreground acceptance. Background mobile push and server inbox summaries remain future work.

## TAVI-CHAT-002 — Server inbox and synced read cursors (0.3.18)

Implemented producer-side in schema 5. Client syncs one mailbox summary per
refresh and obtains full chat only for the open peer; older server fallback
retained. SQL ownership, monotonic cursor and client reconciliation tested.
Must undergo operator two-device verification before Done.

## TAVI-CHAT-003 — Android closed-app push (pending)

Client preparation v0.3.19 now includes default-off per-device consent, strict capability parsing, OS notification test, content-free wakeup validation and foreground resume sync. LoopRD-owned UnifiedPush/ntfy enrollment, distributor discovery/receiver, rotation/revocation and *real suspended/closed-app delivery* remain open and require Android device acceptance. FCM is optional.

## TAVI-PUSH-001 — Provider-independent push client preparation (0.3.19)

Implemented client-side readiness and tests; no new server operations or database changes. **Do not mark as verified** before checking OS notification UI and Android resume behavior on devices. See `docs/PUSH_TRANSPORT.adoc` and `client/tests/push-readiness.test.mjs`.
