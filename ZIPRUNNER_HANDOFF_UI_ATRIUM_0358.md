# ZipRunner import — Tavi 0.3.58

- Project: `looprd-social`; base candidate `0.3.57`; strict source version `0.3.58`.
- Scope: classic information-rich roster, optional first-class profile pet, action-only toolbar, compact game discovery/activity list, server-side same-backend Atrium read route.
- Legacy manual promoted-game links remain functional; Atrium metadata does not manufacture play authorization.
- Preserves all 92 existing operator tickets unchanged; new `TAVI-UX-058` remains Planned, not Done.
- No `.env`, active `ziprunner.config.json`, private key, runtime database, caches or generated build output.
- Server code changed: Social runtime deploy and private `apps:read` are required for live discovery; Windows ZIP import alone cannot activate backend integration.
- LoopRD descriptor generated from source; schema 10 unchanged.
- Maximum 20 post-update stamp entries; full Node and Python tests additionally required.
- Pending Windows NSIS native and Android visual/regression acceptance; no push/release/deploy performed.
