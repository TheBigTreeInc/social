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
