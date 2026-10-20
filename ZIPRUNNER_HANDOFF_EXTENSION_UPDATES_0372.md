# Tavi 0.3.72 — Extension updates & compact Home

Source update over 0.3.71 (not a deployment). Server LoopRD descriptor remains at 0.3.58/schema 10 with byte-exact link. The new `tools/index-tavi-looprd.py` publisher tool scans nested descriptor metadata without requiring private LoopRD registry access.

See `docs/TAVI_EXTENSION_UPDATES_NESTED_LOOPRD_0372.adoc`. No automatic workflow deployment or installed local JS cache is claimed.

Source checks: `npm run verify`, `python -m unittest discover -s tests -p 'test_*.py'`, `python tools/generate-looprd.py --check`, `python tools/check-social-package.py <source ZIP>`, plus optional browser UI. Operator needs native Windows/Android/Web visual and hosted-publisher update validation before marking review items Done. Preserve all prior workboard IDs/statuses and don't auto-push GitHub.
