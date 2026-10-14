# Looprd Social v0.2.0 workboard

| ID | Status | Evidence or blocker |
|---|---|---|
| LRS-001 | Done | Generated `looprd.yaml`, native SQLAlchemy handler, persistence tests |
| LRS-002 | Done | Local REST-to-Looprd bridge; browser-client contract tested |
| LRS-003 | Done | Per-subject development credential isolation, no public profile/chat resources, refused game tickets |
| LRS-004 | Blocked | Production authentication/ticket exchange requires OIDC issuer, signed audience-scoped credentials, configured game validator and operational policies |

**Scope caution:** Done means source implemented and tests passed, **not** deployed or accepted by a running Looprd installation. LRS-004 must not be treated as completed when importing the v1 workboard manifest.
