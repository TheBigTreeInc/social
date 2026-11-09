# Tavi 0.3.158 — ZipRunner version parity repair

Base: 0.3.157 (previous ZIP failed ZipRunner version-parity verification).

Correct `.ziprunner-workboard-update.json` version and release summary to match the source and source ZIP. Synchronize native/client/package-lock and ZipRunner manifest/verification metadata to 0.3.158, and add regression coverage so the mismatch is caught before delivery.

The one-shot GitHub release workflow and its approval gates are unchanged. Keep local configuration, private runtime files and stable installers untouched. No direct push, tag, deployment or release. Verify and accept in ZipRunner first.
