import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto,createHash} from 'node:crypto';
import {createZipRunnerReview,ZIPRUNNER_ID,ZIPRUNNER_PERMISSION} from '../src/extensions/ziprunner-review.js';
import {createExtensionHost} from '../src/extensions/host.js';
const secret='zrmd_'+'a'.repeat(64);
const content=()=>JSON.stringify({schema:'ziprunner.mobile-device-credential-file.v2',secret,public_origin:'https://ziprunner.example',expires_at:Math.floor(Date.now()/1000)+3600});
const bytes=text=>Array.from(new TextEncoder().encode(text));
const snapshot={ok:true,mode:'read_only',actions_enabled:false,projects:[]};
const response=(data=snapshot,status=200)=>({ok:status===200,status,text:async()=>JSON.stringify(data)});

test('no network or review before the authentication file is loaded',async()=>{
 let calls=0;const bridge=createZipRunnerReview({fetchImpl:async()=>{calls++;return response();},cryptoImpl:webcrypto});
 await assert.rejects(bridge.review(),/authentication file/);assert.equal(calls,0);
});
test('exact imported bytes and bearer go only to the file HTTPS origin; no cookies',async()=>{
 const calls=[];const bridge=createZipRunnerReview({fetchImpl:async(...args)=>{calls.push(args);return response();},cryptoImpl:webcrypto});
 const raw=content()+'\n';const result=await bridge.importCredential(bytes(raw));
 assert.deepEqual(result.data,snapshot);assert(!JSON.stringify(result).includes(secret));
 assert.equal(calls[0][0],'https://ziprunner.example/api/tavi/review');
 assert.equal(calls[0][1].headers['X-ZipRunner-Credential-SHA256'],createHash('sha256').update(raw).digest('hex'));
 assert.equal(calls[0][1].headers.Authorization,'Bearer '+secret);
 assert.equal(calls[0][1].credentials,'omit');assert.equal(calls[0][1].redirect,'error');
 await bridge.review('gamestate');assert.equal(calls[1][0],'https://ziprunner.example/api/tavi/project?project=gamestate');
 bridge.clear();await assert.rejects(bridge.review(),/authentication file/);
});
test('malformed, expired, v1 and unsafe-origin files never request data',async()=>{
 let calls=0;const bridge=createZipRunnerReview({fetchImpl:async()=>{calls++;return response();},cryptoImpl:webcrypto});
 for(const transform of [()=>'{'+secret,f=>({...f,schema:'ziprunner.mobile-device-credential-file.v1'}),f=>({...f,expires_at:1}),f=>({...f,public_origin:'http://ziprunner.example'}),f=>({...f,public_origin:'https://user:pass@ziprunner.example'}),f=>({...f,public_origin:'https://ziprunner.example/redirect'})]){
  const value=transform(JSON.parse(content()));await assert.rejects(bridge.importCredential(bytes(typeof value==='string'?value:JSON.stringify(value))),error=>!error.message.includes(secret));
 }
 assert.equal(calls,0);
});
test('revocation or unexpected response clears the grant and exports no stale data',async()=>{
 let denied=false;const bridge=createZipRunnerReview({fetchImpl:async()=>response(snapshot,denied?401:200),cryptoImpl:webcrypto});
 await bridge.importCredential(bytes(content()));denied=true;
 await assert.rejects(bridge.review(),/unavailable/);await assert.rejects(bridge.review(),/authentication file/);
});
test('clear during an in-flight read rejects a late authorized result',async()=>{
 let release;const bridge=createZipRunnerReview({fetchImpl:()=>new Promise(resolve=>{release=resolve;}),cryptoImpl:webcrypto});
 const pending=bridge.importCredential(bytes(content()));
 while(!release)await new Promise(resolve=>setTimeout(resolve,1));
 bridge.clear();release(response());await assert.rejects(pending,/unavailable/);
 await assert.rejects(bridge.review(),/authentication file/);
});
test('host bridge is limited to the exact extension/frame and declared review permission',async()=>{
 const listeners=new Map(),messages=[],frame={contentWindow:{postMessage:m=>messages.push(m)}};
 const host=createExtensionHost({windowRef:{addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:()=>{}},storage:{},notify:()=>{},close:()=>{}});
 function send(source,method,id=1){listeners.get('message')({source,origin:'null',data:{channel:'tavi.extension/v1',direction:'request',id,method}});}
 host.mount(frame,{id:'org.tavi.other.app',permissions:['ui.panel',ZIPRUNNER_PERMISSION],scope:'test'});
 send(frame.contentWindow,'ziprunner.review');assert.equal(messages.at(-1).ok,false);
 host.mount(frame,{id:ZIPRUNNER_ID,permissions:['ui.panel'],scope:'test'});
 send(frame.contentWindow,'ziprunner.clear');assert.equal(messages.at(-1).ok,false);
 host.mount(frame,{id:ZIPRUNNER_ID,permissions:['ui.panel',ZIPRUNNER_PERMISSION],scope:'test',source:'https://unrelated.example'});
 send(frame.contentWindow,'ziprunner.clear');assert.equal(messages.at(-1).ok,false);
 host.mount(frame,{id:ZIPRUNNER_ID,permissions:['ui.panel',ZIPRUNNER_PERMISSION],scope:'test'});
 const before=messages.length;send({},'ziprunner.clear');assert.equal(messages.length,before);
 send(frame.contentWindow,'host.info');assert(messages.at(-1).result.features.includes('ziprunner.review/v1'));
 send(frame.contentWindow,'ziprunner.clear');assert.equal(messages.at(-1).ok,true);
 host.dispose();
});

test('overlapping review selections serialize and retain the authenticated session',async()=>{
 let calls=0,release;const bridge=createZipRunnerReview({fetchImpl:async()=>{calls++;if(calls===2)return new Promise(resolve=>{release=()=>resolve(response());});return response();},cryptoImpl:webcrypto});
 await bridge.importCredential(bytes(content()));
 const first=bridge.review('first'),second=bridge.review('second');
 await new Promise(resolve=>setImmediate(resolve));const duringFirst=calls;
 release();await Promise.all([first,second]);assert.equal(duringFirst,2);assert.equal(calls,3);
 await bridge.review('third');assert.equal(calls,4);
});

test('queued reads cannot cross clear and a newly imported authentication session',async()=>{
 let calls=0,release;const bridge=createZipRunnerReview({fetchImpl:async()=>{calls++;if(calls===2)return new Promise(resolve=>{release=()=>resolve(response());});return response();},cryptoImpl:webcrypto});
 await bridge.importCredential(bytes(content()));const first=bridge.review('first'),second=bridge.review('second');
 const rejected=[assert.rejects(first),assert.rejects(second)];await new Promise(resolve=>setImmediate(resolve));
 bridge.clear();await bridge.importCredential(bytes(content()));release();await Promise.all(rejected);
 assert.equal(calls,3);await bridge.review('current');assert.equal(calls,4);
});
