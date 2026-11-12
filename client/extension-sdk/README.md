# TaviX SDK 1.0

This directory is the source-distributed JavaScript/TypeScript SDK for the **TaviX 1.0** application standard.

```js
import {createTaviXSDK} from '@tavi/tavix-sdk';

const tavi = createTaviXSDK();
const host = await tavi.conformance();
const grants = await tavi.capabilities();

if (grants.includes('ui.toast')) await tavi.ui.toast('Hello from TaviX');
```

Host-owned navigation is portable across Windows, Android and web:

```js
await tavi.navigation.back();
```

Existing source using `createTaviExtensionSDK()` remains supported; it is an alias of `createTaviXSDK()`.

## Optional modules

The SDK can expose typed facades before a host implements a module. **Always use feature/capability discovery.** Unsupported methods fail closed.

```js
const info = await tavi.info();
if (info.features.includes('tavix.surface/v1')) {
  await tavi.surfaces.requestOpen({
    schema: 'tavix.surface/v1',
    id: 'life.loop',
    kind: 'game',
    target: 'https://approved.example/life/',
    context: {matchId: 'opaque-match-id'},
    presentation: 'auto'
  });
}
```

Tavi 0.3.108 defines the generic surface contract but intentionally does **not** advertise it yet. The existing Atrium/Life launch bridge remains compatibility-only until the coordinated Atrium migration.

For trusted backend/service code, use `./service`; that facade is transport-neutral and never creates authorization itself.

Normative specification: [`../../docs/TAVIX_1_0_SPEC.adoc`](../../docs/TAVIX_1_0_SPEC.adoc).

## UI/UX developer contract (Tavi 0.3.162 first pass)

Tavi owns navigation, window chrome, OS orientation policy and messenger access. An application owns only its internal tabs, content, editor/reader views and app-specific dialogs. Consult `docs/TAVI_UI_UX_DEVELOPER_CONTRACT_0162.adoc` in the Tavi source package for the capability contract and phone/tablet/desktop matrix.

Use `sdk.info().features.includes('tavix.ui/v1')` before `sdk.uiContext()`. The `tavix.ui/v1` response includes theme, form factor, orientation, optional viewport and chat/game policy metadata, with no credential or privilege. Subscribe to `sdk.on('ui.contextChanged', ...)` for host theme/embedded resize updates. Import `@tavi/tavix-sdk/ui.css` and `applyTaviUI` from `@tavi/tavix-sdk/ui` into the *sandboxed application bundle*; host CSS never crosses the frame. Do not duplicate Tavi's Back, Home or app-window title bar.

Canonical presentation names: `embedded`, `native-window`, `split-pane`, `floating-panel`. Deployed `detached` remains a legacy wire alias for `native-window`. Query `sdk.workspace.info()` to see what the host **actually supports**. Phone chat is portrait by product policy; games may use landscape. Tablet chat centers in portrait and defaults left/center in landscape. The Android-native orientation lock and full tablet workspace manager remain future work.

## Standard icon and typography kit (0.3.165)

Use `@tavi/tavix-sdk/icons`, `@tavi/tavix-sdk/ui` and `@tavi/tavix-sdk/ui.css` inside an app's bundled sandbox. Icons are static, named, locally available SVGs; typography uses platform-native fonts. The UI kit is not a host capability or an authorization. See `docs/TAVI_UI_KIT_001.adoc` for sizes, accessibility, identity icon guidance and the packable TaviX example.

## App viewport lifecycle (0.3.166)

```js
import {createTaviXSDK} from '@tavi/tavix-sdk';
import {createTaviUIController} from '@tavi/tavix-sdk/ui';
import '@tavi/tavix-sdk/ui.css';

const sdk=createTaviXSDK();
const view=createTaviUIController(document.body,{sdk});
await view.ready; // 'host' only when tavix.ui/v1 is advertised
window.addEventListener('pagehide',()=>{view.dispose();sdk.dispose();},{once:true});
```

`data-tavi-layout` is compact (<600px), medium (600–959px) or wide (>=960px) from the *application's own* viewport, even in a small detached desktop window. The controller does not manage application navigation or orientation. A standalone local preview can pass no SDK and still use system theme and responsive layout.
