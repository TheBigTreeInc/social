import test from 'node:test';
import assert from 'node:assert/strict';
import {checkTaviAtrium} from '../tools/verify-atrium-live.mjs';
const origin='https://example.org';
const token='qa_disposable_social_token_not_real_12345678';
const item={gameId:'life.loop',publisher:'thebigtreeinc',title:'The Life Loop',status:'discovered',instances:1,hostingConfigured:true,playable:false};
const reply=(games=[item],status='connected')=>new Response(JSON.stringify({ok:true,schema:'tavi.atrium-discovery/v1',status,games}),{status:200,headers:{'Content-Type':'application/json'}});
test('live probe uses the same authenticated Social boundary as Tavi and returns no secrets',async()=>{
 const fetcher=async(url,init)=>{
  assert.equal(url,origin+'/looprd/looprd-social/v1/social');
  assert.equal(init.headers.Authorization,'Bearer '+token);
  assert.equal(JSON.parse(init.body).op,'atrium_discovery');
  assert.equal(JSON.parse(init.body).token,token);
  return reply();
 };
 const result=await checkTaviAtrium({origin,token,fetcher});
 assert.deepEqual(result,{status:'connected',expected:'life.loop',found:true,gameCount:1,title:'The Life Loop',playable:false});
 assert(!JSON.stringify(result).includes(token));
});
test('probe accepts confirmed withdrawal but rejects stale entry',async()=>{
 assert.equal((await checkTaviAtrium({origin,token,absent:true,fetcher:async()=>reply([])})).found,false);
 await assert.rejects(()=>checkTaviAtrium({origin,token,absent:true,fetcher:async()=>reply()}),/remains/);
 await assert.rejects(()=>checkTaviAtrium({origin,token,fetcher:async()=>reply([])}),/missing/);
});
test('probe fails closed on catalog outage, premature playable grant, and unrelated identity',async()=>{
 await assert.rejects(()=>checkTaviAtrium({origin,token,fetcher:async()=>reply([],'unavailable')}),/not connected/);
 await assert.rejects(()=>checkTaviAtrium({origin,token,fetcher:async()=>reply([{...item,playable:true}])}),/metadata/);
 await assert.rejects(()=>checkTaviAtrium({origin,token,expected:'../invalid',fetcher:async()=>reply()}),/identifier/);
});
