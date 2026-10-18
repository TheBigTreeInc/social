## Tavi 0.3.48 — visible Atrium launcher in Games

ZIPRUNNER_HANDOFF v1|project=looprd-social|version=0.3.48|file=looprd-social-0.3.48-atrium-launcher-ziprunner.zip

**Base:** exact source bytes of TheBigTreeInc/social `f37d91084aba53d71cb777d3c5325bf9fea7727c` (v0.3.47). **Scope:** UI and safety tests for existing operator-reviewed `LOOPRD_TAVI_ATRIUM_BASE_URL`; no DAPI or Atrium server change and no Life match/agent action claims. Source ZIP contains complete source, generated Looprd release descriptor and all original 74-ticket operator snapshot history; only `TAVI-ATRIUM-048` added as source candidate requiring Review. Preserve all previous original priorities/statuses and the user's multiplayer priority override.

### Release QA gates

* `npm run verify`, `python tools/generate-looprd.py --check`, plus all 14 `.ziprunner-post-update-tests.json` commands against extracted ZIP.
* Confirm `ziprunner.looprd.json` SHA equals exact packaged `looprd.yaml`. Server schema remains 10.
* Windows live Atrium launch, Web/Android smoke, real Life registration and OpenClaw native channel are not independently accepted by source tests.

### Manual runtime integration

The Social server already exposes `capabilities.atriumUrl` from `LOOPRD_TAVI_ATRIUM_BASE_URL`; set that variable **on the actual server** to a reviewed public HTTPS Atrium URL with trailing slash. v0.3.48 client displays a prominent disabled card if unconfigured and opens approved Atrium in an external browser if configured. Legacy `TAVI_GAME_CATALOG_JSON` is retained for old Play/Challenge until the Atrium reviewed catalog is live. No token forwarding or URL inference from portable manifests. See `docs/TAVI_ATRIUM_LAUNCH_0348.adoc` for acceptance checks.

**No automated Git push, tag, release, migration or deployment authorized.**
