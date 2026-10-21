# Tavi 0.3.79 — GitHub UI QA geometry repair

- Source base: installed 0.3.78; full source overlay for ZipRunner.
- Trigger: pushed SHA `7a91ff72df15d346a1cf36f512df830f1a3ec8aa` failed browser UI QA at 320px/390px/tablet due reported transient 0px hit-target snapshots; desktop and compact 355px passed. Workflow: https://github.com/TheBigTreeInc/social/actions/runs/39596927675.
- The new helper atomically measures the section and buddies after a non-zero layout, with strict 44px assertions for visible elements and diagnostics for real undersize.
- Source checks: `npm run verify`, `python -m unittest discover -s tests -p 'test_*.py'`, `python tools/generate-looprd.py --check` and `python tools/check-social-package.py <ZIP>`.
- Browser fixture command: `npm --prefix client run ui:ci`; missing browser/dependencies is BLOCKED, never PASS.
- Workboard: all 122 latest operator entries preserved; new `TAVI-UI-CI-079` stays Review. Do not mark any ticket Done without operator approval.
- No credentials, runtime data, installed state, LoopRD API or `looprd.yaml` changes. No Git push, tag, release or deployment.
- Upstream CI and Windows/Android device acceptance remain pending for 0.3.79.
