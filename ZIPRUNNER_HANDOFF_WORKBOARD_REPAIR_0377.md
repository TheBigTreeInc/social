# Tavi 0.3.77 — pre-overlay workboard metadata repair

## Reproduction

ZipRunner 1.2.304.152 rejected `looprd-social-0.3.76-ci-release-gate-native-qa-ziprunner.zip` before source overlay with `Workboard update: summary must be non-empty text (max 2000 chars).` The archive contained 58 `implemented` tickets without `summary`. The previous 0.3.75 source held valid summaries.

## Repair

- Preserve 118 existing operator QA ticket IDs and their current statuses/acceptance criteria, restoring missing summary and priority information from the older valid 0.3.75 snapshot only when absent.
- Keep both 0.3.76 review candidates unchanged. Add `TAVI-ZR-WORKBOARD-077` in Review, with operator confirmation outstanding.
- New source package version is 0.3.77, based on the last locally installed 0.3.75, because 0.3.76 was rejected before overlay.
- Strengthen `tools/check-social-package.py` to reject missing, blank, non-text, or >2000-character summaries in either workboard list. Add negative regression cases.
- The 0.3.76 application/release-gate features remain intact. No server schema, application config, local runtime data, installed database or secrets were modified.

## Acceptance

1. Feed the exact 0.3.77 ZIP into the existing `looprd-social` ZipRunner project, not the failed 0.3.76 ZIP.
2. Confirm workboard validation passes before source overlay, then build and project-local checks run.
3. Confirm no prior workboard ticket was marked Done, no local private data was overwritten, and the installed version becomes 0.3.77.
4. Native Windows/Android visual QA and new release CI checks still require separate evidence and operator approval.
