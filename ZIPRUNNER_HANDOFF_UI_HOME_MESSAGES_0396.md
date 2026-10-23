# Tavi 0.3.96 — Messenger Home / Messages separation

## Owner expectations

* **Home** is the classic messenger buddy list; own profile portrait on the left, reviewed Companion portrait top-right, account presence, Gold button and collapsible online/offline friend groups. The shared host header owns notifications/settings.
* **Messages** is the dedicated conversation inbox, with Community Lobby, recent first DMs and contacts, search plus All/Unread/Friends filters, no Wallet or Companion widgets. Selecting a peer on Windows retains native chat window routing; mobile opens focused chat and Android Back uses 0.3.92 policy.
* Square/low-radius blocks and thin borders; tokens from the shared Tavi UI system.

## Implementation

`client/src/main.js` uses separate `homeContactPane()` and `messageInbox()` renderers; `ui/messenger-model.js` centralizes pure contact sorting and grouping, `ui/message-inbox.js` filters existing DOM rows without tearing down the search input, and `ui/components.css` uses semantic tokens.

Messages excludes Gold, Companion, own profile card and friend-group controls. The core Wallet extension, Companion 0.6.11 reviewed assets and LoopRD schema stay unchanged. Own profile uses the existing Tavi portrait affordance (initial fallback where no locally rendered thumbnail is available); do not reinterpret numeric `portraitCode` as a URL.

## Operator acceptance

* Install 0.3.96 through ZipRunner; verify source version and workboard validation without modifying config, local accounts or generated build output.
* On Windows compact 355x630, Home shows own profile portrait left and Companion portrait right, Gold only in Home; buddy groups show Online and Offline contacts, friend requests and presence indicators.
* Messages has no own profile/Gold/Companion widgets; it shows Community Lobby, direct conversations, live search and All/Unread/Friends filters; selecting conversation still works on Android and Windows native chat windows.
* Test 320px/390px Android and desktop/web widths: touch targets, keyboard, Android Back, bottom navigation, light/dark themes, square edges and no clipping of profiles or Companion.
* Verify npm run verify, descriptor check, Companion publisher digest, Windows/Android native builds and screenshots; keep in Review until operator device acceptance.

## Verification

Run `npm run verify`, `python tools/generate-looprd.py --check`, `node tools/sync-internal-extensions.mjs --check`, and `node --test client/tests/messenger-home-inbox-096.test.mjs`. Real Windows/Android/browser visuals remain an operator acceptance gate.
