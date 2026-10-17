import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as sdk from '../sdk/looprd-social.js';
import * as nativeFacade from '../src/protocol.js';

const origin='https://looprd.example.test';
const base=`${origin}/looprd/looprd-social/v1/`;
test('browser SDK is the canonical module used by Windows, Android, and browser',()=>{
  for(const name of ['discoverSocial','registerSocial','loginSocial','LooprdSocial','gameActivity','newTurnKeys']){
    assert.equal(typeof sdk[name], 'function',name);
    assert.equal(sdk[name],nativeFacade[name],`Client-native must use shared ${name}`);
  }
});
test('independent browser and native sign-ins use same account with distinct revocable sessions',async()=>{
  let seq=0; const sessions=new Map(),observed=[]; const users=new Map();
  const fetcher=async (url,options={})=>{
    assert(url.startsWith(base), 'No request may leave the selected LoopRD component');
    let payload=options.body?JSON.parse(options.body):{};
    observed.push({url,op:payload.op});
    const response=body=>({ok:true,status:200,json:async()=>body});
    if(url===base+'info')return response({protocol:'looprd.social/1',auth:'social-accounts'});
    if(payload.op==='capabilities')return response({ok:true,schema:'looprd.social.capabilities/v1',accounts:true,registration:true});
    if(payload.op==='register'||payload.op==='login'){
      if(payload.op==='register')users.set(payload.username,payload.password);
      assert.equal(users.get(payload.username),payload.password);
      const token=`token-${++seq}-${'x'.repeat(36)}`;
      sessions.set(token,payload.username);
      return response({ok:true,token});
    }
    if(payload.op==='logout'){sessions.delete(payload.token);return response({ok:true});}
    const username=sessions.get(payload.token);
    return username?response({ok:true,profile:{profileId:username,displayName:'Alice'},revision:1}):response({ok:false,error:'Session revoked'});
  };
  const capabilities=await sdk.discoverSocial(origin,fetcher);assert.equal(capabilities.accounts,true);
  const browser=await sdk.registerSocial(origin,'alice','long strong test password',fetcher);
  const windows=await nativeFacade.loginSocial(origin,'alice','long strong test password',fetcher);
  assert.notEqual(browser.token,windows.token,'Devices must not share session tokens');
  assert.equal((await browser.me()).profile.profileId,(await windows.me()).profile.profileId);
  await browser.logout();
  await assert.rejects(browser.me(),/Session revoked/);
  assert.equal((await windows.me()).profile.profileId,'alice', 'Other device remains signed in');
  assert(observed.every(x=>x.url.startsWith(base)));
});
test('standalone JS SDK contains no native/Node dependency; web workflow is mandatory',async()=>{
 const sdkSource=await readFile(new URL('../sdk/looprd-social.js',import.meta.url),'utf8');
 assert(!sdkSource.includes('@tauri-apps/'));
 assert(!sdkSource.includes('node:'));
 const workflow=await readFile(new URL('../../.github/workflows/web.yml',import.meta.url),'utf8');
 assert(workflow.includes('npm run web:build')&&workflow.includes('npm run web:verify'));
 const docs=await readFile(new URL('../../docs/DESIGN.adoc',import.meta.url),'utf8');
 assert(docs.includes('Mandatory client parity')&&docs.includes('Same account on every device'));
 const portrait=await readFile(new URL('../public/portrait/index.html',import.meta.url),'utf8');
 assert(!portrait.includes('src="/portrait/') && !portrait.includes('href="/portrait/'));
});

// Regression: some Windows WebView2 implementations reject a detached fetch function.
test('native WebView2 fetch retains its browser invocation context through registration and session calls', async () => {
  const previous = globalThis.fetch;
  const ops = [];
  globalThis.fetch = async function(url, options = {}) {
    if (this !== globalThis) throw new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation");
    const op = options.body ? JSON.parse(options.body).op : 'info';
    ops.push(op);
    const data = op === 'info' ? {protocol:'looprd.social/1',auth:'social-accounts'}
      : op === 'capabilities' ? {ok:true,schema:'looprd.social.capabilities/v1',accounts:true,registration:true}
      : op === 'register' ? {ok:true,token:'x'.repeat(36)}
      : op === 'me' ? {ok:true,profile:{profileId:'alice'},revision:1}
      : {ok:true};
    return {ok:true,status:200,json:async()=>data};
  };
  try {
    const capability = await sdk.discoverSocial(origin);
    assert.equal(capability.registration,true);
    const account = await sdk.registerSocial(origin,'alice','long enough password');
    assert.equal((await account.me()).profile.profileId,'alice');
    assert.deepEqual(ops,['info','capabilities','register','me']);
  } finally {globalThis.fetch = previous;}
});
