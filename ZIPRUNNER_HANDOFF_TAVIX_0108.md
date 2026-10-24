# Tavi 0.3.108 — TaviX 1.0 standard/SDK pass

This source candidate formalizes the existing Tavi extension/application implementation as TaviX 1.0. It does not rewrite existing v1 manifests and does not migrate Social data.

## Implemented
- Normative `docs/TAVIX_1_0_SPEC.adoc`.
- Existing `tavi.extension/v1` manifest and RPC channel frozen as TaviX 1.0 wire compatibility.
- `@tavi/tavix-sdk` 1.0.0 with `createTaviXSDK`, compatibility alias, conformance detection and host-owned navigation.
- `navigation.back` / `navigation.close`; `ui.close` retained.
- Generic `tavix.surface/v1` SDK/spec defined but Tavi 0.3.108 does not advertise it; unsupported calls fail closed.
- Deterministic `.tavix` ZIP package format with `tavix.package/v1` SHA-256 lock and pack/validate tooling.
- Conformance tests for legacy compatibility, navigation, fail-closed optional surfaces and deterministic packages.

## Preserved
- Companion 0.6.27.
- Material Settings and messenger receipts.
- Social 0.3.107 / schema 12 and LoopRD 0.4 Wallet child.
- Android PackageInstaller updater implementation.
- Existing Atrium `ui.requestGameLaunch` bridge as compatibility-only until Atrium migrates.

## Operator gate
Run the exact ZIP through ZipRunner Windows build/launch. Verify existing Companion, Wallet and Atrium install/open without forced migration or permission changes. Verify host Back from a root TaviX app. Then use signed Android 0.3.107 to update to signed 0.3.108 and confirm remembered session/update behavior. No push/release is performed by this package.
