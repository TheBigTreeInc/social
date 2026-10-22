#!/usr/bin/env node
// Operator-reviewed OFFLINE partner snapshot for Tavi's repository-root
// extensions/ registry. NOT a runtime file picker, remote publisher, or
// permission elevation. Dry run exercises the same sync & integrity path.
import {readFile,writeFile,cp,lstat,readdir,mkdtemp,mkdir,rm,rename} from 'node:fs/promises';
import {join,resolve,relative,sep,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {validateExtensionManifest,compareVersions} from '../client/src/extensions/contract.js';
import {syncInternalExtensions,reviewedBundleDigest} from './sync-internal-extensions.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const ASSET=/^[a-zA-Z0-9_/-]+\.(?:html|css|js|png|svg|webp)$/;
const digest=b=>createHash('sha256').update(b).digest('hex');

export async function inspectReviewedBundle(source){
 // Accept file: URL objects without treating URL.pathname as a native path.
 // On Windows, URL.pathname starts with /C:/ and resolve() would produce C:\C:\...
 source=resolve(source instanceof URL?fileURLToPath(source):source);
 const folder=await lstat(source);
 if(!folder.isDirectory()||folder.isSymbolicLink())throw Error('Bundle must be a real source directory');
 const manifest=JSON.parse(await readFile(join(source,'manifest.json'),'utf8'));
 validateExtensionManifest(manifest);
 if(manifest.publisher==='tavi'||manifest.id.startsWith('org.tavi.core.'))throw Error('Partner cannot impersonate first-party/core extensions');
 const files=[];
 async function walk(dir){
  for(const entry of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
   const at=join(dir,entry.name),st=await lstat(at);
   if(st.isSymbolicLink()||(!st.isDirectory()&&!st.isFile()))throw Error('Symlinks and devices are forbidden');
   if(st.isDirectory()){await walk(at);continue;}
   const p=relative(source,at).split(sep).join('/');
   if(p==='manifest.json')continue;
   if(!ASSET.test(p)||p.includes('..')||st.size>1_000_000)throw Error('Invalid partner asset: '+p);
   const b=await readFile(at);files.push({path:p,sha256:digest(b),size:b.length});
  }
 }
 await walk(source);files.sort((a,b)=>a.path.localeCompare(b.path));
 if(!files.length||files.length>60||!files.some(f=>f.path===manifest.entrypoints.panel)||
    (manifest.icon&&!files.some(f=>f.path===manifest.icon)))throw Error('Incomplete reviewed partner bundle');
 return {manifest,files,sha256:reviewedBundleDigest(manifest,files)};
}

export async function importReviewedExtension(source,{root=ROOT,publisher,apply=false}={}){
 root=resolve(root instanceof URL?fileURLToPath(root):root);
 source=resolve(source instanceof URL?fileURLToPath(source):source);
 const info=await inspectReviewedBundle(source);
 const manifest=info.manifest;
 if(publisher!==manifest.publisher)throw Error('Explicit publisher approval does not match bundle publisher');
 const registryPath=join(root,'extensions','registry.json');
 const registry=JSON.parse(await readFile(registryPath,'utf8'));
 if(registry.schema!=='tavi.internal-extensions/v1'||!Array.isArray(registry.extensions))throw Error('Unsupported Tavi extension registry');
 await syncInternalExtensions({root,check:true}); // refuse to hide pending local changes
 const previous=registry.extensions.find(e=>e.id===manifest.id);
 if(previous){
  if(previous.distribution!=='bundled-partner'||previous.publisher!==publisher)throw Error('Extension ID already belongs to a different publisher or first-party module');
  if(compareVersions(manifest.version,previous.version)<0)throw Error('Refusing partner version downgrade');
  if(compareVersions(manifest.version,previous.version)===0&&previous.sha256!==info.sha256)
   throw Error('Same-version partner content changed: publish a new version for review');
 }
 const entry={id:manifest.id,mode:'optional',backend:null,distribution:'bundled-partner',publisher,
  version:manifest.version,sha256:info.sha256};
 const updated={...registry,extensions:[...registry.extensions.filter(e=>e.id!==manifest.id),entry]};
 // Full real compiler in an isolated dry-run tree. Never write user runtime state.
 const temp=await mkdtemp(join(tmpdir(),'tavi-reviewed-partner-'));
 try{
  await cp(join(root,'extensions'),join(temp,'extensions'),{recursive:true,force:true,errorOnExist:false});
  await mkdir(join(temp,'client','public'),{recursive:true});
  await cp(join(root,'client','public','tavi-extensions'),join(temp,'client','public','tavi-extensions'),{recursive:true,force:true});
  const tempModule=join(temp,'extensions',manifest.id);
  await rm(tempModule,{force:true,recursive:true});await cp(source,tempModule,{recursive:true});
  await writeFile(join(temp,'extensions','registry.json'),JSON.stringify(updated,null,2)+'\n');
  await syncInternalExtensions({root:temp});
  await syncInternalExtensions({root:temp,check:true});
  if(!apply)return {...info,applied:false};
  // Install only already-validated, exact reviewed source. No Git, build,
  // deployment or user-private files are touched. In-place stages retain a
  // rollback snapshot so failed publication restores the previous mirror.
  if(previous&&previous.sha256===info.sha256)return {...info,applied:false,unchanged:true};
  const snap=join(temp,'backup');
  await mkdir(snap,{recursive:true});
  await cp(join(root,'extensions'),join(snap,'extensions'),{recursive:true});
  await cp(join(root,'client','public','tavi-extensions'),join(snap,'public'),{recursive:true});
  try{
   await rm(join(root,'extensions',manifest.id),{recursive:true,force:true});
   await cp(tempModule,join(root,'extensions',manifest.id),{recursive:true});
   await writeFile(registryPath,JSON.stringify(updated,null,2)+'\n');
   // Replace the generated mirror with the independently checked result,
   // then prove it still corresponds to the installed source.
   await rm(join(root,'client','public','tavi-extensions'),{recursive:true,force:true});
   await cp(join(temp,'client','public','tavi-extensions'),join(root,'client','public','tavi-extensions'),{recursive:true});
   await syncInternalExtensions({root,check:true});
  }catch(err){
   await rm(join(root,'extensions'),{recursive:true,force:true});
   await cp(join(snap,'extensions'),join(root,'extensions'),{recursive:true});
   await rm(join(root,'client','public','tavi-extensions'),{recursive:true,force:true});
   await cp(join(snap,'public'),join(root,'client','public','tavi-extensions'),{recursive:true});
   throw err;
  }
  return {...info,applied:true};
 }finally{await rm(temp,{recursive:true,force:true});}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),source=args[0];
 const publisherAt=args.indexOf('--publisher'),rootAt=args.indexOf('--root');
 const publisher=publisherAt>=0?args[publisherAt+1]:null;
 const root=rootAt>=0?args[rootAt+1]:ROOT;
 if(!source||source.startsWith('--')||!publisher||!root||args.some((a,i)=>a.startsWith('--')&&!['--publisher','--root','--apply'].includes(a))){
  console.error('Usage: node tools/import-reviewed-extension.mjs BUNDLE_DIRECTORY --publisher PUBLISHER [--root TAVI_CHECKOUT] [--apply]');process.exitCode=2;
 }else importReviewedExtension(source,{root,publisher,apply:args.includes('--apply')}).then(r=>{
  console.log(`TAVI_PARTNER_${r.applied?'IMPORTED':r.unchanged?'UNCHANGED':'DRY_RUN_OK'}: ${r.manifest.id} ${r.manifest.version} publisher=${r.manifest.publisher} sha256=${r.sha256}`);
 }).catch(e=>{console.error('TAVI_PARTNER_IMPORT_FAILED: '+e.message);process.exitCode=1;});
}
