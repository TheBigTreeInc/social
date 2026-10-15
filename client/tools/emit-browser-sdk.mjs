/** Bundle a directly importable zero-dependency ES module alongside the Vite web app. */
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname, resolve} from 'node:path';
import {createHash} from 'node:crypto';
const client=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const out=resolve(client,'dist','sdk');
const source=await readFile(resolve(client,'sdk/looprd-social.js'));
await mkdir(out,{recursive:true});
await writeFile(resolve(out,'looprd-social.js'),source);
const p=JSON.parse(await readFile(resolve(client,'package.json'),'utf8'));
const manifest={schema:'looprd.social.browser-sdk/v1',clientVersion:p.version,
  entry:'sdk/looprd-social.js',sha256:createHash('sha256').update(source).digest('hex'),
  imports:['discoverSocial','registerSocial','loginSocial','LooprdSocial','gameActivity']};
await writeFile(resolve(client,'dist','social-client-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('Bundled browser SDK', manifest.entry, manifest.sha256);
