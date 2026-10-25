# Tavi 0.3.109 — Central TaviX App Store adoption

## What changed

- Official first-party source: `https://thebigtreeinc.github.io/tavix/tavi.repository.json`; existing legacy Atrium feed is fetched only for old installed source pins or a user subscription, and remains an exact allowlisted compatibility source.
- Prefer the central catalog for new Atrium installations. Prefer its Companion 0.6.30 only for accounts that have not installed the older reviewed bundled Companion 0.6.27. Existing installation source/version and private per-account data are retained; changing sources requires deliberate removal and reinstallation, which can affect application-specific data.
- Only an exact first-party Atrium source may request the temporary Life external-browser confirmation handoff. No new game rights, no embedded Life yet, and the generic TaviX surface API is still disabled.
- Host Wallet remains bundled-only and cannot be overridden by repository publications. Hosted Companion does not receive the special pinned bundled Companion preview privilege.
- Offline/stale repository entries never authorize automatic installs or upgrades; installs remain user-consent gated. Legacy Atrium repository stays available as a compatibility fallback.
- Client-only change. Server remains Social 0.3.107/schema 12, LoopRD 0.4 Wallet subcomponent and Android PackageInstaller native implementation unchanged.

## Operator acceptance

1. Import `looprd-social-0.3.109-tavix-central-repository-ziprunner.zip` over working 0.3.108, keeping project configuration, build outputs and user sessions.
2. Run the unchanged normal ZipRunner build and source checks. Test App Store on Windows and Android with live Pages index and asset URLs.
3. On a new profile: Atrium 1.0.2 and Companion 0.6.30 show with manual install approval, Home/Back work and no Social bearer leaves Tavi.
4. On an existing profile: prior bundled Companion 0.6.27 and installed Atrium source remain pinned, no automatic re-consent or silent source takeover.
5. Offline/invalid repository, spoofed sender, changed publisher and permission tests must fail closed. Core Wallet unaffected.
6. Validate signed in-app Android update 0.3.108 -> 0.3.109 and exact-push GitHub Windows/Android/Web checks independently. This source author environment does not perform native acceptance.

## Verification commands

```bash
npm run verify
node --test client/tests/extension-repositories.test.mjs client/tests/extension-life-launch.test.mjs
python -m unittest discover -s tests -v
```

Published Pages endpoint was confirmed by project operator, but this author environment cannot directly reach GitHub Pages due to DNS restrictions; fixture is the exact 0.1.1 repository catalog packaged here and previously confirmed on GitHub main. No Git push/release/deployment performed.
