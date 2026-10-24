#!/usr/bin/env node
import {readFile,stat,readdir} from 'node:fs/promises';
import {resolve,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateExtensionManifest} from '../client/src/extensions/contract.js';

const SAFE=/^(?!\/)(?!.*(?:^|\/)\.\.?\/)[a-zA-Z0-9_.\/-]+$/;
export async function validateTaviXDirectory(directory){
 const root=resolve(directory);
 const manifestPath=resolve(root,'manifest.json');
 const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
 const compatibility=validateExtensionManifest(manifest);
 if(!compatibility.compatible)throw Error(compatibility.reason);
 const required=[manifest.entrypoints.panel,...(manifest.icon?[manifest.icon]:[])];
 for(const path of required){
  if(!SAFE.test(path))throw Error('Unsafe TaviX asset path');
  const full=resolve(root,path);const rel=relative(root,full).split(sep).join('/');
  if(rel!==path||rel.startsWith('../'))throw Error('TaviX asset escaped package');
  const info=await stat(full);if(!info.isFile())throw Error('TaviX required asset is not a file');
 }
 return {standard:'tavix/1.0',manifest:manifest.id,version:manifest.version,hostApi:manifest.hostApi,requiredAssets:required};
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
 const dir=process.argv[2];
 if(!dir){console.error('usage: node tools/tavix-validate.mjs <package-directory>');process.exit(2);}
 try{console.log(JSON.stringify(await validateTaviXDirectory(dir),null,2));}
 catch(error){console.error('TaviX validation failed: '+(error?.message||error));process.exit(1);}
}
