# Tavi Extension SDK (source preview)

Small ESM/TypeScript declarations for isolated Tavi panels and authorized LoopRD service components.

```js
import {createTaviExtensionSDK} from '@tavi/extension-sdk';
const tavi = createTaviExtensionSDK();
const supported = await tavi.capabilities();
if (supported.includes('wallet.read')) {
  const balance = await tavi.wallet.balance({currencyId:'tavi:cash'});
}
```

For a trusted backend (not from an iframe):

```js
import {createTaviServiceSDK} from '@tavi/extension-sdk/service';
const sdk = createTaviServiceSDK({call: ({capability,operation,args}) => approvedLooprdTransport(capability,operation,args)});
```

**Feature status:** Tavi 0.3.61 only implements UI, storage and `host.capabilities`. Wallet, pets, contacts, messaging and cross-server service facades are *contracts* and will reject until the corresponding host and LoopRD adapters exist. The service client is transport-neutral and cannot create authorization on its own.

Run `npm pack` in this directory to produce a distributable npm tarball. The repository owner must choose/declare an open-source license and own the npm scope before publishing to a public npm registry. A source-only repository or GitHub/Forgejo release may distribute it independently of npm.

Complete design: [`../../docs/TAVI_SHARED_SERVICES_LEDGER_SDK_V2.adoc`](../../docs/TAVI_SHARED_SERVICES_LEDGER_SDK_V2.adoc).
