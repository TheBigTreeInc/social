# Tavi Git targets

This is a **new local ZipRunner project** (`looprd-social`) while the deployed LoopRD component ID stays `looprd-social`.

- Product source (push target): https://github.com/TheBigTreeInc/social.git — `main`
- Infrastructure reference (read-only): https://github.com/pac-labs/dapi.git — `main`

The targets are prefilled in `ziprunner-git-targets.json`. This is explicit project metadata, **not a claim that every ZipRunner release automatically imports these target entries into its Git account UI**. If your ZipRunner version does not consume this file, select your existing Git account and add the URLs above manually. Do not auto-push before testing. No SSH keys, passwords or access tokens are included.

The `looprd-social` project is distinct from `looprd-social` locally. The source repository is still TheBigTreeInc/social; do not create a second independent codebase unless intentionally migrating the repository.
