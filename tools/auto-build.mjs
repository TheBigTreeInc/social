// ZipRunner post-test local build for Tavi. No GitHub dependency, no Git writes.
import {readFile,writeFile,mkdir,readdir,stat,cp,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,resolve,relative,extname} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {dirname} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const target=join(root,'client','src-tauri','target');
const cache=join(target,'tavi-ziprunner-build-state.json');
const cfg=JSON.parse(await readFile(join(root,'tavi-build.json'),'utf8'));
if(cfg.schema!=='tavi.auto-build-config/v1'||!cfg.targets||Object.values(cfg.targets).some(v=>typeof v!=='boolean'))throw Error('Invalid tavi-build.json target configuration');
const state={schema:'tavi.local-build/v1',timestamp:new Date().toISOString(),results:{}};
const files=[];
const sources=['client/src','client/sdk','client/src-tauri/src','client/src-tauri/capabilities','client/src-tauri/icons','client/public','client/tools','client/index.html','client/chat.html','client/game.html','client/vite.config.mjs','client/package.json','client/src-tauri/Cargo.toml','client/src-tauri/build.rs','client/src-tauri/tauri.conf.json','client/src-tauri/tauri.android.conf.json','tavi-build.json','BUILD-LOCAL.ps1','tools/auto-build.mjs'];
async function walk(path){const st=await stat(path).catch(()=>null);if(!st)return;if(st.isDirectory()){for(const entry of (await readdir(path)).sort())await walk(join(path,entry));}else if(st.isFile())files.push(path)}
for(const path of sources)await walk(join(root,path));
const hash=createHash('sha256');for(const path of files.sort()){hash.update(relative(root,path).replaceAll('\\','/'));hash.update(await readFile(path))}const digest=hash.digest('hex');
const previous=await readFile(cache,'utf8').then(JSON.parse).catch(()=>({}));
await mkdir(target,{recursive:true});
if(process.platform!=='win32'){
  console.log('TAVI_AUTO_BUILD_SKIPPED: native Windows build requires Windows; source tests can still run here.');
  process.exit(0);
}
const enabled=['Windows','Web','Android'].filter(name=>cfg.targets?.[name]===true);
if(!enabled.length){console.log('TAVI_AUTO_BUILD_SKIPPED: no targets enabled in tavi-build.json');process.exit(0)}
for(const kind of enabled){
  const artifactPath=kind==='Windows'?join(target,'release','bundle','nsis'):kind==='Web'?join(root,'client','dist'):join(root,'client','src-tauri','gen','android','app','build','outputs','apk');
  const prior=previous.results?.[kind];
  const hasOutput=async()=>{if(kind==='Windows')return (await readdir(artifactPath).catch(()=>[])).some(f=>f.toLowerCase().endsWith('.exe')) && (await stat(join(target,'release','looprd-social-client.exe')).catch(()=>null))?.isFile()===true;return (await readdir(artifactPath).catch(()=>[])).length>0};
  if(!cfg.force && prior?.digest===digest && prior.status==='passed' && await hasOutput()){
    console.log(`TAVI_AUTO_BUILD_CACHED: ${kind} (${digest.slice(0,12)})`);state.results[kind]=prior;continue;
  }
  // Backup known-good NSIS installers before invoking Tauri, restore on failure.
  const backup=join(target,'tavi-last-good-nsis');
  if(kind==='Windows'){
    await rm(backup,{recursive:true,force:true});await mkdir(backup,{recursive:true});
    for(const f of await readdir(artifactPath).catch(()=>[]))if(f.toLowerCase().endsWith('.exe'))await cp(join(artifactPath,f),join(backup,f));
  }
  const args=['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',join(root,'BUILD-LOCAL.ps1'),'-Target',kind,'-SkipTests'];
  console.log(`TAVI_AUTO_BUILD_STARTED: ${kind}`);
  const result=spawnSync('powershell.exe',args,{cwd:root,stdio:'inherit',windowsHide:true,timeout:45*60*1000});
  if(result.error||result.status!==0 || !(await hasOutput())){
    if(kind==='Windows'){
      for(const f of await readdir(artifactPath).catch(()=>[]))if(f.toLowerCase().endsWith('.exe'))await rm(join(artifactPath,f),{force:true});
      for(const f of await readdir(backup).catch(()=>[]))await cp(join(backup,f),join(artifactPath,f));
    }
    state.results[kind]={status:'failed',digest,error:String(result.error?.message??`exit ${result.status}`)};
    await writeFile(cache,JSON.stringify(state,null,2));
    console.error(`TAVI_AUTO_BUILD_FAILED: ${kind}; previous Windows installer preserved`);
    process.exit(1);
  }
  state.results[kind]={status:'passed',digest,output:relative(root,artifactPath)};
  console.log(`TAVI_AUTO_BUILD_PASSED: ${kind}; ${relative(root,artifactPath)}`);
  if(kind==='Windows')console.log(`TAVI_EXECUTABLE_READY: ${relative(root,join(target,'release','looprd-social-client.exe'))}`);
}
await writeFile(cache,JSON.stringify(state,null,2));
console.log('TAVI_AUTO_BUILD_COMPLETE: no Git push; review looprd.yaml separately with CHECK-LOOPRD-DEPLOY.ps1');
