# Tavi Social 0.3.160 — Asset Studio broker and admin contract

Base 0.3.159. Source candidate, not deployed/released. The TaviX 0.1.12 `assets.registry.admin/v1` permission is accepted as a manifest request only. Parent host and server gate it against a reviewed exact digest/source and `ecosystemAdmin`. New Social `/asset-studio` DAPI signs short-lived scoped service delegations to Tavi Assets `/studio` and fails closed until approved backend configuration is present.

**Important blocker:** Assets 0.1.15 has only existing `/admin` service operations; it lacks `/studio`, Gold pricing/audit and signed assertion verification. The separate Assets 0.1.16 implementation/migration and live acceptance are required before the Studio can perform actions. No approved Studio `.tavix` digest exists in this package; default digest allowlist is empty, so no app gains admin rights.

Full contract and required Assets changes: `docs/TAVI_ASSET_STUDIO_ADMIN_0160.adoc`. No existing config, server DB or approval status may be overwritten. Windows/Android acceptance remains pending.
