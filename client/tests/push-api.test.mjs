import test from 'node:test';
import assert from 'node:assert/strict';
import {LooprdSocial,TAVI_GUEST_CREDENTIAL,discoverSocial,registerSocial,safePushEndpoint} from '../sdk/looprd-social.js';
const origin='https://social.example.test', prefix=origin+'/looprd/looprd-social/v1/';
const id='abcdef0123456789abcdef0123456789', challenge='x'.repeat(43),token='s'.repeat(43);
const response=(data,status=200)=>({ok:status>=200&&status<300,status,json:async()=>data});

test('guest discovery and registration are scoped and never expose password in URL',async()=>{
 const calls=[];
 const fetcher=async(url,opts)=>{
  calls.push({url,opts});
  const op=opts.body?JSON.parse(opts.body).op:'';
  if(url.endsWith('info'))return response({protocol:'looprd.social/1',auth:'social-accounts'});
  if(op==='capabilities')return response({ok:true,schema:'looprd.social.capabilities/v1',accounts:true,registration:true});
  return response({ok:true,token});
 };
 assert.equal((await discoverSocial(origin,fetcher)).registration,true);
 await registerSocial(origin,'alice','test password 1234',fetcher);
 assert(calls.every(c=>c.opts.headers.Authorization==='Bearer '+TAVI_GUEST_CREDENTIAL));
 assert(calls.every(c=>!c.url.includes('password')&&!c.url.includes('test password')));
});

test('verified device API uses the exact LoopRD push endpoints and authenticated header',async()=>{
 const calls=[];
 const fetcher=async(url,opts)=>{calls.push({url,opts});return response(url.endsWith('verify')?{status:'active'}:url.endsWith('_push/devices')?{devices:[]}:{removed:true});};
 const api=new LooprdSocial(origin,token,fetcher);
 await api.pushDevices();await api.registerPushDevice('tavi_installation_abc','https://push.example.test/up_abc');
 await api.verifyPushDevice(id,challenge);await api.removePushDevice(id);
 assert.deepEqual(calls.map(x=>x.url),[prefix+'_push/devices',prefix+'_push/devices',prefix+'_push/devices/'+id+'/verify',prefix+'_push/devices/'+id]);
 assert.deepEqual(calls.map(x=>x.opts.method),['GET','POST','POST','DELETE']);
 assert(calls.every(x=>x.opts.headers.Authorization==='Bearer '+token));
 assert(!calls.some(x=>x.url.includes(token)));
 assert.deepEqual(JSON.parse(calls[1].opts.body),{installationId:'tavi_installation_abc',endpoint:'https://push.example.test/up_abc'});
 assert.deepEqual(JSON.parse(calls[2].opts.body),{challenge});
});

test('disallow unsafe endpoints and forged challenge or device identifiers',async()=>{
 const api=new LooprdSocial(origin,token,async()=>response({}));
 for(const endpoint of ['http://push.example.test/up_x','https://push.example.test/a/b',
                        'https://user:password@push.example.test/up_x',
                        'https://push.example.test/up_x?q=secret','https://push.example.test/up_x#x']){
  assert.equal(safePushEndpoint(endpoint),false);
  assert.throws(()=>api.registerPushDevice('installationABC',endpoint));
 }
 assert.throws(()=>api.registerPushDevice('a','https://push.example.test/up_x'));
 assert.throws(()=>api.verifyPushDevice('../wrong',challenge));
 assert.throws(()=>api.verifyPushDevice(id,'wrong'));
 assert.throws(()=>api.removePushDevice('../wrong'));
});

test('WebSocket subscription uses one-time verified ticket rather than account token in URL',async()=>{
 const api=new LooprdSocial(origin,token,async(url,init)=>{
  assert.equal(url,prefix+'_ws-ticket');
  assert.equal(init.headers.Authorization,'Bearer '+token);
  return response({ticket:'w'.repeat(32),expiresIn:30});
 });
 const ticket=await api.pulseTicket();
 assert.equal(ticket,'w'.repeat(32));
 assert(!api.pulseUrl().includes(token));
});
