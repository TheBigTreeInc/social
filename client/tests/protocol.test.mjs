import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeServer,componentPath,LooprdSocial,parseGameActivity,gameActivity,newTurnKeys} from '../src/protocol.js';
import {readConfig,writeConfig,portraitStorageKey,seenStorageKey,previousTurnKeys} from '../src/persistence.js';

const server='https://social.example.org';
test('HTTPS origin accepted, remote HTTP and injected paths/tokens rejected',()=>{
  assert.equal(normalizeServer(server+'/'),server);
  assert.equal(normalizeServer('http://127.0.0.1:8080/'),'http://127.0.0.1:8080');
  for(const input of ['http://social.example.org','https://a.example/path','https://guest:password@a.example','https://a.example/#frag','javascript:alert(1)','https://a.example/?token=x'])
    assert.throws(()=>normalizeServer(input));
  assert.equal(componentPath(server,'the-life-loop','activity'),server+'/looprd/the-life-loop/v1/activity');
  for(const bad of ['../admin','http://bad.example','activity?x=1','//evil','%2e%2e']) assert.throws(()=>componentPath(server,'the-life-loop',bad));
  assert.throws(()=>componentPath(server,'../admin','activity'));
});
test('Social credential ONLY sent in Social body; correct profile and lobby operations',async()=>{
  const calls=[];
  const fake=async(url,init)=>{calls.push([url,init]);return {ok:true,json:async()=>({ok:true,profile:{profileId:'user_alex'},messages:[],revision:1})};};
  const client=new LooprdSocial(server,'a'.repeat(32),fake);
  await client.me();await client.feed();await client.send('hello');
  assert.equal(calls.length,3);
  assert(calls.every(([url])=>url===server+'/looprd/looprd-social/v1/social'));
  assert.equal(JSON.parse(calls[2][1].body).text,'hello');
  assert(!JSON.stringify(calls.map(x=>x[0])).includes('a'.repeat(32)));
  assert(calls.every(([,init])=>init.headers.Authorization===undefined));
});
test('Social action error and malformed payload are not silently accepted',async()=>{
  const fake=async()=>({ok:true,status:200,json:async()=>({ok:false,error:'Invalid credential'})});
  await assert.rejects(new LooprdSocial(server,'x'.repeat(24),fake).me(),/Invalid credential/);
});
test('Game polling uses only its own bearer, not a social token',async()=>{
  let called;
  const fake=async(url,opts)=>{called={url,opts};return {ok:true,json:async()=>({schema:'looprd.game.activity/v1',turns:[]})};};
  await gameActivity(server,'the-life-loop','game-only',fake);
  assert.equal(called.url,server+'/looprd/the-life-loop/v1/activity');
  assert.equal(called.opts.headers.Authorization,'Bearer game-only');
});
test('Game activity rejects external/other-game/injected links and oversized shapes',()=>{
  const good={schema:'looprd.game.activity/v1',turns:[{id:'match-1-turn-1',title:'Jones your turn',status:'your-turn',path:'/looprd/jones/v1/game/1'}]};
  assert.equal(parseGameActivity(good,'jones').turns[0].status,'your-turn');
  for(const path of ['https://malicious.example','//example','/looprd/social/v1/chat','/looprd/jones/v1//evil','/looprd/jones/v1/a?token=x']){
    assert.throws(()=>parseGameActivity({...good,turns:[{...good.turns[0],path}]},'jones'));
  }
  assert.throws(()=>parseGameActivity({...good,schema:'wrong'},'jones'));
  assert.throws(()=>parseGameActivity({...good,turns:Array(151).fill(good.turns[0])},'jones'));
});
test('Notify exactly once per distinct actionable turn ID; next turn triggers again',()=>{
 const turns=[{id:'game-42-turn-9',status:'your-turn'},{id:'game-43-turn-2',status:'waiting'}];
 assert.deepEqual(newTurnKeys(turns,[]).newIds,['game-42-turn-9']);
 assert.deepEqual(newTurnKeys(turns,['game-42-turn-9']).newIds,[]);
 assert.deepEqual(newTurnKeys([{id:'game-42-turn-10',status:'your-turn'}],['game-42-turn-9']).newIds,['game-42-turn-10']);
});
test('Settings never serialize tokens; seen-turn and portrait keys scoped to server/user',()=>{
 const data=new Map();const storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};
 writeConfig({server,games:['a','a','the-life-loop'],token:'top-secret'},storage);
 assert.equal(JSON.stringify([...data.values()]).includes('top-secret'),false);
 assert.deepEqual(readConfig(storage).games,['a','the-life-loop']);
 assert.notEqual(portraitStorageKey(server,'user_a'),portraitStorageKey(server,'user_b'));
 assert.notEqual(seenStorageKey(server,'a','user_a'),seenStorageKey('https://different.example','a','user_a'));
 assert.deepEqual(previousTurnKeys(storage,'missing'),[]);
});
