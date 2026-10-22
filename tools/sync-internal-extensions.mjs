#!/usr/bin/env node
// Source of truth: extensions/registry.json + extensions/<manifest.id>/.
// Only the generated static mirror belongs in client/public/tavi-extensions/.
// No network requests, remote repositories, credentials or LoopRD deployments.
import {readFile,readdir,lstat,mkdir,writeFile,copyFile,rm} from 'node:fs/promises';
import {dirname,join,resolve,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {validateCatalog,validateExtensionManifest} from '../client/src/extensions/contract.js';

const project=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const ID=/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+){2,}$/;
const ASSET=/^[a-zA-Z0-9_/-]+\.(?:html|css|js|png|svg|webp)$/;
const digest=b=>createHash('sha256').update(b).digest('hex');
const decode=buffer=>JSON.parse(buffer.toString('utf8'));
const equal=(a,b)=>Buffer.compare(a,b)===0;
// Reviewed partner digest pins manifest and EVERY delivered asset; changing even
// one script or chunk requires a new explicit import/review. The publisher stays
// the one declared by the independent source project.
export function reviewedBundleDigest(manifest,files){
 return digest(Buffer.from(JSON.stringify({manifest,files})+'\n'));
}


export async function syncInternalExtensions({root=project,check=false}={}) {
 const source=join(root,'extensions'),out=join(root,'client','public','tavi-extensions');
 const registry=decode(await readFile(join(source,'registry.json')));
 if(registry?.schema!=='tavi.internal-extensions/v1'||!Array.isArray(registry.extensions)||registry.extensions.length<1||registry.extensions.length>50)
  throw Error('Invalid internal extension registry');
 const seen=new Set(),entries=[];
 for(const item of registry.extensions){
  if(!item||Object.keys(item).some(k=>!['id','mode','backend','distribution','publisher','version','sha256'].includes(k))||typeof item.id!=='string'||!ID.test(item.id)||seen.has(item.id)||!['core','optional'].includes(item.mode))
   throw Error('Invalid or duplicate internal extension registry entry');
  seen.add(item.id);
  if(item.backend!==null&&!(item.backend&&Object.keys(item.backend).sort().join(',')==='component,kind'&&item.backend.kind==='looprd-component'&&typeof item.backend.component==='string'&&/^[a-z][a-z0-9-]{1,79}$/.test(item.backend.component)))
   throw Error('Invalid backend ownership declaration');
  if(item.id==='org.tavi.core.wallet'&&item.mode!=='core')throw Error('Wallet must remain a permanent core extension');
  const partner=item.distribution==='bundled-partner';
  if(partner){
   if(item.mode!=='optional'||typeof item.publisher!=='string'||item.publisher==='tavi'||!/^[-a-z0-9]{2,64}$/.test(item.publisher)||
      typeof item.version!=='string'||!/^\d+\.\d+\.\d+$/.test(item.version)||
      typeof item.sha256!=='string'||!/^[a-f0-9]{64}$/.test(item.sha256)||item.id.startsWith('org.tavi.core.'))
    throw Error('Invalid reviewed partner provenance or privileged ID');
  }else if(['distribution','publisher','version','sha256'].some(k=>Object.hasOwn(item,k))){
   throw Error('First-party modules cannot declare partner ownership fields');
  }
  const dir=join(source,item.id);
  const dst=await lstat(dir);
  if(!dst.isDirectory()||dst.isSymbolicLink())throw Error(`Unsafe internal extension directory: ${item.id}`);
  const manifest=decode(await readFile(join(dir,'manifest.json')));
  validateExtensionManifest(manifest);
  if(manifest.id!==item.id||(partner?(manifest.publisher!==item.publisher||manifest.version!==item.version):manifest.publisher!=='tavi'))
   throw Error(`Extension publisher/identity mismatch: ${item.id}`);
  const files=[];
  async function walk(folder){
   for(const record of (await readdir(folder,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
    const abs=join(folder,record.name),st=await lstat(abs);
    if(st.isSymbolicLink()||(!st.isFile()&&!st.isDirectory()))throw Error(`Unsafe internal extension file: ${record.name}`);
    if(st.isDirectory()){
     if(folder===dir && ['looprd','docs','tests'].includes(record.name))continue;
     await walk(abs);continue;
    }
    const path=relative(dir,abs).split(sep).join('/');
    if(path==='manifest.json')continue;
    if(!ASSET.test(path)||path.includes('..')||path.startsWith('/')||st.size>1_000_000)throw Error(`Unsupported internal extension asset: ${path}`);
    const bytes=await readFile(abs);
    files.push({path,sha256:digest(bytes),size:bytes.length});
    const published=join(out,item.id,path);
    if(check){
     const output=await readFile(published).catch(()=>null);
     if(!output||!equal(output,bytes))throw Error(`Published extension asset stale or absent: ${item.id}/${path}. Run npm run extensions:sync.`);
     // Tauri 2 modifies bundled .html at compile time for its CSP. A second,
     // non-HTML resource preserves the original source bytes for runtime SHA-256.
     if(path.endsWith('.html')){
      const raw=await readFile(published+'.bytes').catch(()=>null);
      if(!raw||!equal(raw,bytes))throw Error(`Published extension raw HTML stale or absent: ${item.id}/${path}. Run npm run extensions:sync.`);
     }
    }
   }
  }
  await walk(dir);
  files.sort((a,b)=>a.path.localeCompare(b.path));
  if(partner && reviewedBundleDigest(manifest,files)!==item.sha256)
   throw Error(`Reviewed partner bundle integrity changed: ${item.id}`);
  if(files.length<1||files.length>60)throw Error(`Invalid file count in ${item.id}`);
  const paths=new Set(files.map(f=>f.path));
  if(!paths.has(manifest.entrypoints.panel)||manifest.icon&&!paths.has(manifest.icon))throw Error(`Missing entrypoint/icon: ${item.id}`);
  // Publish only *after* digest, identity, size and entrypoint validation.
  // A tampered partner bundle cannot partially overwrite a known-good mirror.
  if(!check)for(const asset of files){
   const to=join(out,item.id,asset.path);
   await mkdir(dirname(to),{recursive:true});await copyFile(join(dir,asset.path),to);
   // The .bytes URL is a verification-only transport, NOT a separately
   // approved asset, executable entrypoint or change to the reviewed digest.
   if(asset.path.endsWith('.html'))await copyFile(join(dir,asset.path),to+'.bytes');
  }
  const manifestBytes=await readFile(join(dir,'manifest.json'));
  if(check){
   const current=await readFile(join(out,item.id,'manifest.json')).catch(()=>null);
   if(!current||!equal(current,manifestBytes))throw Error(`Published manifest stale: ${item.id}`);
  }else{
   await mkdir(join(out,item.id),{recursive:true});await copyFile(join(dir,'manifest.json'),join(out,item.id,'manifest.json'));
  }
  // Never allow untracked source files to ride along in the published app.
  const publishedAssets=[];
  async function listPublished(dir2){
   for(const record of await readdir(dir2,{withFileTypes:true})){
    const abs=join(dir2,record.name),st=await lstat(abs);
    if(st.isSymbolicLink())throw Error('Symlink in published extension directory');
    if(st.isDirectory())await listPublished(abs);
    else if(st.isFile())publishedAssets.push(relative(join(out,item.id),abs).split(sep).join('/'));
    else throw Error('Unexpected published extension file');
   }
  }
  await listPublished(join(out,item.id));
  const expected=new Set(['manifest.json',...files.flatMap(f=>f.path.endsWith('.html')?[f.path,f.path+'.bytes']:[f.path])]);
  const unexpected=publishedAssets.filter(x=>!expected.has(x));
  if(unexpected.length){
   if(check)throw Error(`Stale published extension assets: ${item.id}: ${unexpected.join(', ')}`);
   for(const name of unexpected)await rm(join(out,item.id,name));
  }
  entries.push({manifest,files});
 }
 const catalog={schema:'tavi.store.catalog/v1',extensions:entries};
 validateCatalog(catalog);
 const expected=Buffer.from(JSON.stringify(catalog,null,2)+'\n');
 if(check){
  const current=await readFile(join(out,'catalog.v1.json')).catch(()=>null);
  if(!current||!equal(current,expected))throw Error('Published catalog stale: run npm run extensions:sync.');
  }else{
  await mkdir(out,{recursive:true});
  await writeFile(join(out,'catalog.v1.json'),expected);
 }
 // Do not inadvertently deploy orphaned extensions or old publisher content.
 // Detect, rather than delete, files that may originate in an operator checkout.
 const directories=await readdir(out,{withFileTypes:true});
 const extra=directories.filter(x=>x.name!=='catalog.v1.json'&&!seen.has(x.name));
 if(extra.length)throw Error('Unexpected published extension entries: '+extra.map(x=>x.name).join(', '));
 return {count:entries.length,ids:entries.map(x=>x.manifest.id)};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);
 if(args.some(a=>!['--check'].includes(a))){console.error('Usage: node tools/sync-internal-extensions.mjs [--check]');process.exitCode=2;}
 else syncInternalExtensions({check:args.includes('--check')})
  .then(result=>console.log(`TAVI_INTERNAL_EXTENSIONS_${args.includes('--check')?'VERIFIED':'SYNCED'}: ${result.count} bundled modules (${result.ids.join(', ')})`))
  .catch(err=>{console.error('TAVI_INTERNAL_EXTENSIONS_FAILED: '+err.message);process.exitCode=1;});
}
