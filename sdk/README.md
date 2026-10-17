# Tavi client SDKs (v0.3.38)

All SDKs target the **same** `POST /looprd/looprd-social/v1/social` endpoint. They run on Windows, macOS, and Linux wherever their language runtime is installed; this is not a claim of compiled OS binaries.

| SDK | Location | Runtime | Status |
| --- | --- | --- | --- |
| JavaScript / TypeScript-compatible JS | `client/sdk/looprd-social.js` | Node 22+, browsers with CORS, Tauri | Existing full SDK; TS declarations not yet shipped |
| Python | `sdk/python/tavi.py` | Python 3.10+ | Account and messaging client |
| Go | `sdk/go` | Go 1.21+ | Account and messaging client |
| C# | `sdk/csharp` | .NET 8+ | Account and messaging client |
| OpenClaw CLI | `integrations/openclaw` | Node 22+ | Existing headless polling bridge |

## Examples

**JavaScript (Node)**:

```js
import {loginSocial} from './client/sdk/looprd-social.js';
const api = await loginSocial(process.env.TAVI_SERVER, process.env.TAVI_USER, process.env.TAVI_PASSWORD);
console.log(await api.contacts());
```

**Python**:

```python
import os
from sdk.python.tavi import Tavi
api = Tavi(os.environ['TAVI_SERVER'])
api.login(os.environ['TAVI_USER'], os.environ['TAVI_PASSWORD'])
print(api.contacts())
```

**Go**: import `github.com/TheBigTreeInc/social/sdk/go` as `tavi` from a Go project, call `tavi.New(origin, "")`, `Login`, `Contacts`.

**C#**: add a project reference to `sdk/csharp/Tavi.Client.csproj`, construct `new Tavi.TaviClient(origin)`, call `LoginAsync` and `ContactsAsync`.

Never put a Tavi session token in a Pages site, committed source, browser URL, or third-party game iframe. HTTPS is required outside local development. All SDKs require a server running a compatible Social release; they are not standalone servers.
