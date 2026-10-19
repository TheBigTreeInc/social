#!/usr/bin/env node
// Curated, repository-backed extension registration. This is NOT a live
// self-publication service or a signature authority.
import {readFile,readdir,lstat,mkdir,writeFile,copyFile} from 'node:fs/promises';
import {resolve,relative,join,dirname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {validateExtensionManifest,validateCatalog} from '../client/src/extensions/contract.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const publicRoot=resolve(root,'client/public/tavi-extensions');
export async function registerExtension(source,{target=publicRoot}={}){
 source=resolve(source);
 const manifest=JSON.parse(await readFile(join(source,'manifest.json'),'utf8'));
 validateExtensionManifest(manifest);
 const files=[];
 async function walk(dir){
  for(const item of await readdir(dir,{withFileTypes:true})){
   const abs=join(dir,item.name);
   const stat=await lstat(abs);
   if(stat.isSymbolicLink()||(!stat.isFile()&&!stat.isDirectory()))throw Error('Extension symlinks/devices forbidden');
   if(stat.isDirectory()){await walk(abs);continue;}
   const path=relative(source,abs).split(sep).join('/');
   if(path==='manifest.json')continue;
   if(!/^[a-zA-Z0-9_/-]+\.(?:html|css|js|png|svg|webp)$/.test(path)||path.startsWith('/')||path.includes('..'))throw Error(`Invalid package asset: ${path}`);
   if(stat.size>1_000_000)throw Error('Extension asset too large');
   const data=await readFile(abs);
   files.push({path,sha256:createHash('sha256').update(data).digest('hex'),size:data.length});
  }
 }
 await walk(source);
 if(files.length===0||files.length>60)throw Error('Invalid extension bundle file count');
 files.sort((a,b)=>a.path.localeCompare(b.path));
 if(!files.some(f=>f.path===manifest.entrypoints.panel))throw Error('Entrypoint missing');
 if(manifest.icon&&!files.some(f=>f.path===manifest.icon))throw Error('Extension icon asset missing');
 const dest=resolve(target,manifest.id);if(!dest.startsWith(resolve(target)+sep))throw Error('Unsafe destination');
 // Read existing catalog before copying. Updating a publisher needs review.
 const catalogPath=join(target,'catalog.v1.json');
 let catalog={schema:'tavi.store.catalog/v1',extensions:[]};
 try{catalog=JSON.parse(await readFile(catalogPath,'utf8'));validateCatalog(catalog);}catch(e){if(e.code!=='ENOENT')throw e;}
 const prior=catalog.extensions.find(e=>e.manifest.id===manifest.id);
 if(prior && prior.manifest.publisher!==manifest.publisher)throw Error('Publisher ownership mismatch');
 if(!prior&&!manifest.icon)throw Error('New extension publications require an icon asset');
 const entry={manifest,files};
 catalog.extensions=catalog.extensions.filter(e=>e.manifest.id!==manifest.id);
 catalog.extensions.push(entry);catalog.extensions.sort((a,b)=>a.manifest.id.localeCompare(b.manifest.id));
 validateCatalog(catalog);
 await mkdir(dest,{recursive:true});
 for(const item of files){const to=join(dest,item.path);await mkdir(dirname(to),{recursive:true});await copyFile(join(source,item.path),to);}
 await writeFile(join(dest,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 await writeFile(catalogPath,JSON.stringify(catalog,null,2)+'\n');
 return entry;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.length!==3){console.error('Usage: node tools/register-tavi-extension.mjs path/to/extension');process.exitCode=2;}
 else registerExtension(process.argv[2]).then(e=>console.log(`Registered ${e.manifest.id}@${e.manifest.version} in curated source catalog (not live-published)`)).catch(e=>{console.error(e.message);process.exitCode=1;});
}
