# Tavi 0.3.106 — Material settings redesign

## Scope

This pass replaces the legacy long Settings accordion with an Android/Material-inspired settings hierarchy while preserving Tavi's existing functionality and update path.

### Implemented

- Android-style Settings index with search, account card, grouped category rows, Material-like icons, cards and switches.
- Dedicated settings pages for Account, Notifications, Chats, Connected devices, Appearance, Privacy & safety, Storage, Companion apps, Extensions and About Tavi.
- Android/system Back behavior is now Settings subpage -> Settings index -> Tavi Home.
- About Tavi contains the directly reachable update path:
  - Check for updates
  - Download and install when a signed Android update is available
  - Android updater status
  - Updater self-test
  - Updater diagnostics
- Existing account profile, recovery codes, remembered-device session, notification preferences, UnifiedPush readiness, theme, diagnostics, extensions and Companion controls were retained.
- Added centralized Material settings CSS and additional first-party SVG glyphs; extension iframes remain isolated.

## Preserved boundaries

- Tavi client/source: 0.3.106
- Social server: 0.3.103
- Social schema: 12
- Companion: 0.6.27, reviewed digest unchanged
- Messenger Sent/Delivered/Seen receipts unchanged
- Android PackageInstaller implementation unchanged byte-for-byte from 0.3.105
- No Git push, release, server deployment or database migration performed by this artifact.

## Verification

- `npm run verify`: PASS
  - server: 13/13
  - client: 268/268
  - OpenClaw: 20/20
- Python suite: completed green at 100%
- `npm run check:looprd`: PASS
- `npm run extensions:check`: PASS, 3 bundled modules
- `.ziprunner-workboard-update.json`: 245351 bytes (< 262144 hard limit)
- Android updater implementation files: byte-identical to 0.3.105

## Operator acceptance

1. Import the exact 0.3.106 ZipRunner ZIP and require Windows build + launch.
2. On Android and desktop, open Settings and verify Material category hierarchy, search, touch targets and dark theme.
3. Open every settings category and verify Back returns to Settings before Home.
4. In About Tavi, use Check for updates; when a newer signed release exists, verify Download and install is directly visible and starts PackageInstaller.
5. Use installed signed 0.3.105 as the source version for the signed 0.3.106 in-app update test; do not uninstall first.
