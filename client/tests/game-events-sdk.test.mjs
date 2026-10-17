import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LooprdSocial} from '../sdk/looprd-social.js';
import {LooprdSocial as NativeLooprdSocial} from '../src/protocol.js';

test('Tavi browser/Windows/Android use one game-inbox SDK and never send credentials to games',async()=>{
 const calls=[];
 const fetcher=async(url,request)=>{
   calls.push({url,body:JSON.parse(request.body)});
   return {ok:true,status:200,json:async()=>({ok:true,schema:'tavi.game-events/v1',events:[],next:0,hasMore:false})};
 };
 const api=new LooprdSocial('https://social.example.org','t'.repeat(42),fetcher);
 assert.equal(NativeLooprdSocial,LooprdSocial);
 await api.setGameNotification('the-life-loop','life.loop','match_test_012345',true);
 await api.gameEvents(0);
 assert.deepEqual(calls.map(c=>c.body.op),['game_subscription_set','game_event_feed']);
 assert(calls.every(c=>c.url==='https://social.example.org/looprd/looprd-social/v1/social'));
 assert(calls.every(c=>c.body.token==='t'.repeat(42)));
 assert.equal(calls[0].body.recipient,undefined);
 assert.throws(()=>api.setGameNotification('the-life-loop','life.loop','https://evil.example',true),/Invalid/);
 assert.throws(()=>api.gameEvents(-1),/Invalid/);
 assert.equal(calls.length,2);
});
