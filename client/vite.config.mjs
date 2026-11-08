import {defineConfig} from 'vite';
import {resolve,dirname} from 'node:path';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=dirname(fileURLToPath(import.meta.url));
const clientPackage=JSON.parse(readFileSync(resolve(root,'package.json'),'utf8'));
export default defineConfig({define:{__TAVI_CLIENT_VERSION__:JSON.stringify(clientPackage.version),__TAVI_ASSETS_CATALOG_URL__:JSON.stringify(process.env.TAVI_ASSETS_CATALOG_URL||'')},build:{rollupOptions:{input:{main:resolve(root,'index.html'),chat:resolve(root,'chat.html'),match:resolve(root,'match.html'),game:resolve(root,'game.html'),companion:resolve(root,'companion.html')}}}});
