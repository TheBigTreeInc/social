import test from 'node:test';
import assert from 'node:assert/strict';
import {enrollPushDevice,confirmPushDevice,revokePushDevice} from '../src/push-enrollment.js';

test('enrollment requires opt-in, returns pending until endpoint challenge is proven',async()=>{
 const calls=[],device='a'.repeat(32);
 const api={registerPushDevice:async(...args)=>{calls.push(args);return {id:device,status:'pending',expiresAt:10000,verificationExpiresAt:100};},
   verifyPushDevice:async(id,proof)=>{assert.equal(id,device);assert.equal(proof,'b'.repeat(43));return {id,status:'active',expiresAt:10000};},
   removePushDevice:async id=>({removed:id===device})};
 await assert.rejects(enrollPushDevice(api,{installationId:'installation_abcd',endpoint:'https://push.example/up_abcd'}),/consent/);
 assert.equal(calls.length,0);
 const result=await enrollPushDevice(api,{installationId:'installation_abcd',endpoint:'https://push.example/up_abcd',consented:true});
 assert.equal(result.status,'pending');assert.equal(result.id,device);
 const proof=await confirmPushDevice(api,{deviceId:device,challenge:'b'.repeat(43)});
 assert.equal(proof.status,'active');
 assert.equal(await revokePushDevice(api,device),true);
 assert(!JSON.stringify(result).includes('https://push.example'));
});
test('provider outage and invalid proof remain observable errors, never fake success',async()=>{
 const api={registerPushDevice:async()=>{throw Error('HTTP 503: provider not configured');},
  verifyPushDevice:async()=>({status:'pending'}), removePushDevice:async()=>({removed:false})};
 await assert.rejects(enrollPushDevice(api,{installationId:'installation_abcd',endpoint:'https://push.example/up_abcd',consented:true}),/503/);
 await assert.rejects(confirmPushDevice(api,{deviceId:'a'.repeat(32),challenge:'b'.repeat(43)}),/did not activate/);
 assert.equal(await revokePushDevice(api,'a'.repeat(32)),false);
});
