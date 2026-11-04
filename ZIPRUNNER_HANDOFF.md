# Tavi Social 0.3.120 — Checkers M1 trusted Social/Atrium contract

Source ZIP input based on actual 0.3.119 ZIP. No local config, runtime state, database, credentials or build outputs included. The current Social schema remains 12; the server descriptor adds two service-only read routes. Post-update suite remains at 20 entries with new Checkers Social regression included in an existing entry. Build and operator gates remain separate.

# Tavi 0.3.111 — ZipRunner workboard preflight repair

Import `looprd-social-0.3.111-compact-app-store-workboard-repair-ziprunner.zip` over installed 0.3.109. The 0.3.110 ZIP failed *before* overlay; do not delete or reset the local source checkout, project configuration, data, sessions, installers, or caches.

The source change is limited to mandatory `TAVI-STORE-110.operator_checks`, an additional workboard shape regression test, and advancing version metadata to 0.3.111. The compact store features described in `ZIPRUNNER_HANDOFF_TAVIX_0110.md` remain the same. Social 0.3.107/schema 12 and Android PackageInstaller are unchanged. See `ZIPRUNNER_HANDOFF_TAVIX_0111.md`.
