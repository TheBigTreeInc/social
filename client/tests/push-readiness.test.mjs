import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pushPreferencesKey,readPushPreferences,savePushPreferences,parsePushCapabilities,pushReadiness,validPushWakeup,checkUnifiedPushEndpoint,getInstallationId,installationKey} from '../src/push-readiness.js';
import {createResumeSync} from '../src/resume-sync.js';
import {createPushWakeupBridge} from '../src/push-bridge.js';

function storage(){const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};}
test('background delivery requires explicit, scoped, device-local consent',()=>{
 const db=storage(),key=pushPreferencesKey('https://social.example.org','acct_21');
 assert.deepEqual(readPushPreferences(db,key),{backgroundEnabled:false});
 assert.notEqual(key,pushPreferencesKey('https://social.example.org','acct_22'));
 assert.notEqual(key,pushPreferencesKey('https://another.example.org','acct_21'));
 savePushPreferences(db,key,{backgroundEnabled:true,endpoint:'https://secret.example/push',token:'secret',message:'private'});
 assert.deepEqual(readPushPreferences(db,key),{backgroundEnabled:true});
 assert.ok(!db.getItem(key).includes('secret'));
 assert.throws(()=>pushPreferencesKey('https://host/path','acct_21'));
});
test('LoopRD push contract is recognized only when verified-device registration is explicit',()=>{
 assert.equal(parsePushCapabilities({ok:true,registration:true,accounts:true}),null);
 assert.equal(parsePushCapabilities({push:{schema:'tavi.push-capabilities/v1',registration:true,providers:['unifiedpush']}}),null);
 assert.equal(parsePushCapabilities({push:{schema:'looprd-push/v1',transport:'fcm',deviceRegistration:true,requiresVerifiedSession:true}}),null);
 const good=parsePushCapabilities({push:{schema:'looprd-push/v1',transport:'unifiedpush',deviceRegistration:true,requiresVerifiedSession:true}});
 assert.deepEqual(good,{schema:'looprd-push/v1',providers:['unifiedpush']});
 assert.equal(pushReadiness({platform:'android',preference:true}).code,'server');
 assert.equal(pushReadiness({platform:'android',preference:true,capability:good}).code,'device');
 assert.equal(pushReadiness({platform:'android',preference:true,capability:good,nativeAdapter:true,permission:'granted'}).code,'pending-enrollment');
 assert.equal(pushReadiness({platform:'web',preference:true,capability:good}).code,'provider');
 assert.equal(pushReadiness({platform:'android',preference:false,capability:good}).code,'off');
 assert.equal(pushReadiness({platform:'windows',preference:true}).code,'windows');
});
test('LoopRD v1 wake hint contains no content, identity, link or replay secrets',()=>{
 const ok={apiVersion:'looprd-push/v1',type:'sync'};
 assert.equal(validPushWakeup(ok),true);
 for(const x of [{...ok,token:'secret'},{...ok,message:'hello'},{...ok,url:'https://somewhere.example'},
                {...ok,eventId:'an-event'}, {...ok,type:'verify'}, {...ok,apiVersion:'wrong'}])
   assert.equal(validPushWakeup(x),false);
 assert.equal(checkUnifiedPushEndpoint('https://ntfy.example.org/up_opaque'),true);
 for(const url of ['http://ntfy.example.org/a','https://user:password@ntfy.example.org/x',
                   'https://ntfy.example.org/x#fragment','https://ntfy.example.org/up/opaque','not a url'])
   assert.equal(checkUnifiedPushEndpoint(url),false);
});
test('installation identifiers are stable and account-bound without saving the endpoint',()=>{
 const data=storage(),key=installationKey('https://social.example.org','acct_22');
 const first=getInstallationId(data,key,()=>'tavi_device_abcdefgh');
 assert.equal(getInstallationId(data,key,()=>{throw Error('must not regenerate')}),first);
 assert.notEqual(key,installationKey('https://social.example.org','acct_23'));
 assert.equal(data.getItem(key).includes('https://push'),false);
});
test('foreground recovery is throttled and only runs with visible authenticated Tavi',async()=>{
 let clock=1000, count=0;
 const resume=createResumeSync(()=>{count++;},{now:()=>clock,minIntervalMs:4000});
 assert.equal(resume({signedIn:false}),false);
 assert.equal(resume({signedIn:true,visible:false}),false);
 assert.equal(resume({signedIn:true,visible:true}),true);
 await Promise.resolve();assert.equal(count,1);
 assert.equal(resume({signedIn:true,visible:true}),false);
 clock+=4100;assert.equal(resume({signedIn:true,visible:true}),true);
 await Promise.resolve();assert.equal(count,2);
});
test('Android push prep is visibly off until LoopRD and adapter support it',()=>{
 const src=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(src,/pushPreferencesKey/);
 assert.match(src,/parsePushCapabilities/);
 assert.match(src,/pushReadiness/);
 assert.match(src,/nativeAdapter:false/);
 assert.match(src,/No endpoint is registered until a distributor/);
 assert.match(src,/visibilitychange/);
 assert.match(src,/test-notification/);
});

test('LoopRD wake bridge throttles bursts and requires a live sign-in',async()=>{
 let clock=10,count=0;const onWake=createPushWakeupBridge(()=>{count++;},{now:()=>clock,minIntervalMs:1500});
 const payload={apiVersion:'looprd-push/v1',type:'sync'};
 assert.equal(onWake(payload,{signedIn:false}),false);
 assert.equal(onWake({...payload,token:'secret'},{signedIn:true}),false);
 assert.equal(onWake(payload,{signedIn:true}),true);await Promise.resolve();assert.equal(count,1);
 assert.equal(onWake(payload,{signedIn:true}),false);
 clock+=1600;assert.equal(onWake(payload,{signedIn:true}),true);await Promise.resolve();assert.equal(count,2);
});
