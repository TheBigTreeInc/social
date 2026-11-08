#!/usr/bin/env node
// ZipRunner preserves absent source files (delete_missing=false). Companion
// 0.6.27 shipped collection.html; 0.6.43 deliberately does not. Remove only
// the three known, byte-identical obsolete files before bundle verification.
// Never delete an unknown/modified file, follow symlinks or touch user state.
import {readFile,lstat,unlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname,join,relative,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const ID='org.tavi.community.companion';
const OLD_SHA='23a70090a94a0cc8be34081721b87a5180bfb62a7efa0f35ebecb9b721131dce';
const REVIEWED_SHA='0773809d7c61c079f18325f69f3deabf134d8abc34a3c9fd5ef555b80168e948';
const OBSOLETE=[
 `extensions/${ID}/ui/collection.html`,
 `client/public/tavi-extensions/${ID}/ui/collection.html`,
 `client/public/tavi-extensions/${ID}/ui/collection.html.bytes`,
];
const sha256=b=>createHash('sha256').update(b).digest('hex');
async function inspectPath(root,rel){
 const path=resolve(root,rel),under=relative(root,path);
 if(under.startsWith('..'+sep)||under==='..'||under.startsWith(sep))throw Error('Cleanup path escaped project root');
 let parent=dirname(path);
 while(parent!==root){
  const stat=await lstat(parent);
  if(!stat.isDirectory()||stat.isSymbolicLink())throw Error(`Unsafe legacy parent: ${rel}`);
  parent=dirname(parent);
 }
 let stat;
 try{stat=await lstat(path);}catch(err){if(err.code==='ENOENT')return null;throw err;}
 if(!stat.isFile()||stat.isSymbolicLink())throw Error(`Unsafe legacy file: ${rel}`);
 const data=await readFile(path);
 if(data.length!==206||sha256(data)!==OLD_SHA)throw Error(`Refusing to remove modified legacy source: ${rel}`);
 return path;
}
export async function pruneCompanionLegacyOverlay({root=ROOT,check=false}={}){
 root=resolve(root);
 const registry=JSON.parse(await readFile(join(root,'extensions','registry.json'),'utf8'));
 const record=registry.extensions?.find(x=>x.id===ID);
 const manifest=JSON.parse(await readFile(join(root,'extensions',ID,'manifest.json'),'utf8'));
 if(record?.sha256!==REVIEWED_SHA||record?.version!=='0.6.43'||manifest.id!==ID||manifest.version!=='0.6.43')
  throw Error('Companion review pin/version changed; cleanup requires a new review');
 // Preflight *all* candidates first: a modified last file cannot cause a
 // partial cleanup of the other copies.
 const candidates=[];
 for(const rel of OBSOLETE){const path=await inspectPath(root,rel);if(path)candidates.push(path);}
 if(check&&candidates.length)throw Error('Stale Companion 0.6.27 files remain: '+candidates.length);
 if(!check)for(const path of candidates)await unlink(path);
 return {removed:check?0:candidates.length,obsolete:OBSOLETE.length};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);
 if(args.some(a=>a!=='--check')){console.error('Usage: node tools/prune-companion-legacy-overlay.mjs [--check]');process.exitCode=2;}
 else pruneCompanionLegacyOverlay({check:args.includes('--check')})
  .then(r=>console.log(`TAVI_COMPANION_LEGACY_OVERLAY_OK: removed=${r.removed}`))
  .catch(err=>{console.error('TAVI_COMPANION_LEGACY_OVERLAY_BLOCKED: '+err.message);process.exitCode=1;});
}
