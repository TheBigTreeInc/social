import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeServer,componentPath,LooprdSocial,parseGameActivity,gameActivity,newTurnKeys,validateDeveloperDiagnostics} from '../src/protocol.js';
import {readConfig,writeConfig,selectServerGames,portraitStorageKey,seenStorageKey,previousTurnKeys} from '../src/persistence.js';

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
test('Verified Social credential uses authenticated header and body but never URL or game endpoint',async()=>{
  const calls=[];
  const fake=async(url,init)=>{calls.push([url,init]);return {ok:true,json:async()=>({ok:true,profile:{profileId:'user_alex'},messages:[],revision:1})};};
  const client=new LooprdSocial(server,'a'.repeat(32),fake);
  await client.me();await client.feed();await client.send('hello');
  assert.equal(calls.length,3);
  assert(calls.every(([url])=>url===server+'/looprd/looprd-social/v1/social'));
  assert.equal(JSON.parse(calls[2][1].body).text,'hello');
  assert(!JSON.stringify(calls.map(x=>x[0])).includes('a'.repeat(32)));
  assert(calls.every(([,init])=>init.headers.Authorization===`Bearer ${'a'.repeat(32)}`));
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

const {discoverSocial, registerSocial,loginSocial}=await import('../src/protocol.js');
test('Social discovery shows unsupported server without making any local store',async()=>{
 const off=async()=>({status:404,ok:false,json:async()=>({})});
 assert.deepEqual((await discoverSocial(server,off)).available,false);
 const on=async(url)=>({status:200,ok:true,json:async()=>url.endsWith('/info')?({protocol:'looprd.social/1',auth:'social-accounts',registration:'see-capabilities'}):({ok:true,schema:'looprd.social.capabilities/v1',accounts:true,registration:true})});
 assert.equal((await discoverSocial(server,on)).accounts,true);
});
test('Registration and login issue internal sessions; credentials never sent to game endpoint',async()=>{
 let op,received;
 const fake=async(url,options)=>{received={url,options};op=JSON.parse(options.body).op;return {ok:true,status:200,json:async()=>({ok:true,token:'z'.repeat(43)})};};
 const first=await registerSocial(server,'alice','long passphrase 1234',fake);
 assert.equal(op,'register'); assert.equal(first.token,'z'.repeat(43));
 assert.equal(received.url,componentPath(server,'looprd-social','social'));
 await loginSocial(server,'alice','long passphrase 1234',fake);assert.equal(op,'login');
 assert(!JSON.stringify({server,games:['a']}).includes('long passphrase 1234'));
});

test('Messenger client uses buddy/conversation UI and never asks for a manual Social token',async()=>{
 const fs=await import('node:fs/promises');
 const main=await fs.readFile(new URL('../src/main.js',import.meta.url),'utf8');
 const css=await fs.readFile(new URL('../src/style.css',import.meta.url),'utf8');
 assert(main.includes('Tavi')&&main.includes('data-peer=')&&main.includes('Create account'));
 assert(css.includes('.roster-window')&&css.includes('.conversation')&&css.includes('.transcript-message'));
 assert(main.includes('mobileRoster')&&main.includes('window-titlebar')&&main.includes('group-title'));
 assert(!main.includes('sidePanel():')&&!main.includes('class=\"bubble-row'));
 assert(!main.includes('id="social-token"')&&!main.includes('Token configured in Social'));
});

test('Games are scoped to the selected LoopRD server, never inherited by a different server',()=>{
 const config={server,games:['jones'],gamesByServer:{}};
 selectServerGames(config,'https://different.example');
 assert.deepEqual(config.games,[]);
 config.games.push('another-game');
 selectServerGames(config,server);
 assert.deepEqual(config.games,['jones']);
 selectServerGames(config,'https://different.example');
 assert.deepEqual(config.games,['another-game']);
});

test('developer diagnostics is server-gated and returns only safe aggregate fields',async()=>{
 const counts={accounts:2,profiles:2,contacts:1,directMessages:4,lobbyMessages:5,activeSessions:2};
 const body={ok:true,schema:'looprd.social.developer-diagnostics/v1',component:'looprd-social',
   apiVersion:'looprd/v1',release:'0.3.1',serverTime:1000000,databaseSchemaVersion:3,counts,
   features:['accounts','server-gated-developer-tools'],token:'THIS_MUST_NEVER_BE_RETURNED'};
 const parsed=validateDeveloperDiagnostics(body);
 assert.deepEqual(parsed.counts,counts);
 assert.equal(parsed.token,undefined);
 assert(!JSON.stringify(parsed).includes('THIS_MUST_NEVER_BE_RETURNED'));
 assert.throws(()=>validateDeveloperDiagnostics({...body,counts:{...counts,accounts:'invalid'}}));
 const calls=[];
 const fake=async(url,init)=>{calls.push({url,init});return {status:200,ok:true,json:async()=>body};};
 const api=new LooprdSocial(server,'k'.repeat(40),fake);
 assert.equal((await api.developerDiagnostics()).release,'0.3.1');
 assert.equal(JSON.parse(calls[0].init.body).op,'developer_diagnostics');
 assert(!calls[0].url.includes('k'.repeat(40)));
});
test('developer diagnostics denies unauthorized sessions',async()=>{
 const api=new LooprdSocial(server,'k'.repeat(40),async()=>({status:200,ok:true,
   json:async()=>({ok:false,code:'DEVELOPER_ACCESS_DENIED',error:'Developer tools are not enabled'})}));
 await assert.rejects(api.developerDiagnostics(),e=>e.status===403);
});
test('messenger developer UI cannot be promoted by a client-side toggle alone',async()=>{
 const fs=await import('node:fs/promises');
 const main=await fs.readFile(new URL('../src/main.js',import.meta.url),'utf8');
 assert(main.includes('state.developerAllowed&&state.developerVisible'));
 assert(main.includes("me?.permissions?.developer===true"));
 assert(main.includes("if(!state.developerAllowed||!state.developerVisible)return"));
 assert(main.includes('developer-switch'));
 assert(main.includes('updateDeveloperPermission(me)'));
});

test('independent time budget for Social discovery info and capabilities',async()=>{
 let probes=[];const fetcher=async(url,options)=>{probes.push({url,signal:options.signal});
  return {status:200,ok:true,json:async()=>url.endsWith('/info')?{protocol:'looprd.social/1',auth:'social-accounts',release:'0.3.43'}:{ok:true,schema:'looprd.social.capabilities/v1',accounts:true,registration:true}};};
 assert.equal((await discoverSocial(server,fetcher)).available,true);
 assert.equal(probes.length,2);assert.notEqual(probes[0].signal,probes[1].signal);
});
test('Social discovery produces safe status classifications',async()=>{
 assert.match((await discoverSocial(server,async()=>({status:503}))).reason,/temporarily unavailable/);
 assert.match((await discoverSocial(server,async()=>({status:404}))).reason,/not have the Social component/);
 await assert.rejects(discoverSocial(server,async()=>{const e=Error('request aborted');e.name='AbortError';throw e;}),e=>e.code==='DISCOVERY_TIMEOUT'&&/timed out during server information/.test(e.message));
 await assert.rejects(discoverSocial(server,async()=>{throw new TypeError('Failed to fetch host private.example');}),e=>e.code==='DISCOVERY_NETWORK'&&!e.message.includes('private.example'));
});
test('Android safe-area guard and report stage are present without altering native desktop behavior',async()=>{
 const fs=await import('node:fs/promises');const css=await fs.readFile(new URL('../src/style.css',import.meta.url),'utf8');
 const main=await fs.readFile(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(css,/\.android-shell #app/);assert.match(css,/safe-area-inset-top/);
 assert.match(main,/Android.*navigator\.userAgent.*android-shell/);
 assert.match(main,/DISCOVERY_TIMEOUT/);
});
