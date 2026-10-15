/** Approved upstream executable workshop sources are updated by reviewable PRs, never silent runtime JS. */
import {mkdir, writeFile, readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import process from 'node:process';
const check=process.argv.includes('--check');
const latest=process.argv.includes('--latest');
const pin=JSON.parse(await readFile('portrait-source.lock.json','utf8'));
let ref=pin.ref;
if(latest){
  const head=await fetch('https://api.github.com/repos/TheBigTreeInc/assets/commits/main',{headers:{'Accept':'application/vnd.github+json','User-Agent':'looprd-social-client-sync'},signal:AbortSignal.timeout(30000)});
  if(!head.ok)throw Error('Could not resolve upstream HEAD');
  ref=(await head.json()).sha;
}
if(process.env.PORTRAIT_SOURCE_REF)ref=process.env.PORTRAIT_SOURCE_REF;
if (!/^(main|[a-f0-9]{40})$/.test(ref)) throw Error('Untrusted portrait ref.');
const base=`https://raw.githubusercontent.com/TheBigTreeInc/assets/${ref}`;
const sources={
  'portrait-kit.js':'clients/javascript/src/portrait-kit.js',
  'portraits.js':'clients/javascript/src/portraits.js',
  'portrait-wizard.js':'clients/javascript/src/portrait-wizard.js',
};
const vendor='public/portrait/vendor';
await mkdir(vendor,{recursive:true});
const hashes={schema:'looprd.portrait.upstream/v1',repository:'TheBigTreeInc/assets',ref,verifiedAt:new Date().toISOString(),files:{}};
let changed=false;
for(const [name,path] of Object.entries(sources)){
  const response=await fetch(`${base}/${path}`,{signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error(`${path}: upstream HTTP ${response.status}`);
  const body=await response.text();
  if(body.length<1000||body.length>1000000||!body.includes('Portrait') && !body.includes('portrait'))throw Error(`${name}: unexpected upstream JavaScript`);
  const digest=createHash('sha256').update(body).digest('hex');
  hashes.files[name]=digest;
  const dest=join(vendor,name);
  let existing='';try{existing=await readFile(dest,'utf8');}catch{}
  if(existing!==body){changed=true;if(!check)await writeFile(dest,body);}
  console.log(`${name}: ${digest} ${existing===body?'unchanged':'changed'}`);
}
if(check){if(changed)throw Error('Pinned portrait generator differs from source. Run sync and review.');}
else{const lock=join(vendor,'upstream.json');let existingLock=null;try{existingLock=JSON.parse(await readFile(lock,'utf8'));}catch{}
 if(!existingLock || existingLock.ref!==ref || JSON.stringify(existingLock.files)!==JSON.stringify(hashes.files))await writeFile(lock,JSON.stringify(hashes,null,2)+'\n');
 if(latest && pin.ref!==ref){pin.ref=ref;pin.updatedAt=new Date().toISOString().slice(0,10);await writeFile('portrait-source.lock.json',JSON.stringify(pin,null,2)+'\n');}
}
