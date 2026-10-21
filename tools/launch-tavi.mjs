import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {dirname} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const binary=join(root,'client','src-tauri','target','release','looprd-social-client.exe');
if(process.platform!=='win32'){
 console.error('TAVI_LAUNCH_UNAVAILABLE: Tavi Windows client requires Windows.');process.exit(2);
}
if(!existsSync(binary)){
 console.error(`TAVI_LAUNCH_MISSING: ${binary}`);
 console.error('Build in ZipRunner or run BUILD-LOCAL.ps1 -Target Windows; review the build log for TAVI_AUTO_BUILD_FAILED.');process.exit(2);
}
// Optional attach-to-native-client QA: off by default. Never activate remote
// WebView2 debugging on an ordinary client from a merely present port value.
const qaPort=Number(process.env.TAVI_NATIVE_QA_CDP_PORT);
const qaApproved=process.env.TAVI_NATIVE_QA_DISPOSABLE==='1'&&Number.isInteger(qaPort)&&qaPort>=1024&&qaPort<=65535;
const nativeEnv={...process.env};
if(qaApproved){
 nativeEnv.WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=`${process.env.WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS||''} --remote-debugging-port=${qaPort}`.trim();
 console.log('TAVI_NATIVE_QA_OPT_IN: WebView2 local debug port configured for a disposable QA session.');
}else if(process.env.TAVI_NATIVE_QA_CDP_PORT){
 console.warn('TAVI_NATIVE_QA_SKIPPED: Explicit disposable QA approval and a valid port are required.');
}
console.log(`TAVI_LAUNCH_STARTED: ${binary}`);
const child=spawn(binary,[],{cwd:dirname(binary),stdio:'inherit',windowsHide:false,env:nativeEnv});
child.on('error',err=>{console.error('TAVI_LAUNCH_FAILED:',err.message);process.exitCode=1;});
child.on('exit',(code,signal)=>{console.log(`TAVI_LAUNCH_EXITED: code=${code} signal=${signal}`);process.exitCode=code??(signal?1:0);});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{if(!child.killed)child.kill();});
