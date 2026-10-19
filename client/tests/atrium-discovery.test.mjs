import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {discoverAtriumGames,ProtocolError} from '../sdk/looprd-social.js';
test('discovered Life appears but never becomes a playable legacy game',async()=>{
 const calls=[];
 const api={command:async op=>{calls.push(op);return {ok:true,schema:'tavi.atrium-discovery/v1',status:'connected',games:[
 {gameId:'life.loop',publisher:'thebigtreeinc',title:'The Life Loop',status:'discovered',instances:1,hostingConfigured:true,playable:false}]}}};
 const response=await discoverAtriumGames(api);
 assert.deepEqual(calls,['atrium_discovery']);
 assert.equal(response.games[0].title,'The Life Loop');
 assert.equal(response.games[0].playable,false);
 assert.equal(response.games[0].url,undefined);
 assert(Object.isFrozen(response.games[0]));
});
test('rejects forged/invalid data and absent Tavi identity',async()=>{
 await assert.rejects(()=>discoverAtriumGames(null),ProtocolError);
 for(const item of [{gameId:'life.loop',publisher:'thebigtreeinc',title:'Life',status:'discovered',instances:1,hostingConfigured:true,playable:true},
  {gameId:'../x',publisher:'thebigtreeinc',title:'Life',status:'discovered',instances:1,hostingConfigured:true,playable:false}]){
  await assert.rejects(()=>discoverAtriumGames({command:async()=>({schema:'tavi.atrium-discovery/v1',status:'connected',games:[item]})}),ProtocolError);
 }
});
test('home and Games show discovered titles, not an unapproved play or challenge',async()=>{
 const main=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(main,/discoverAtriumGames\(api\)/);
 assert.match(main,/Discover games/);
 assert.match(main,/tavi-discovered-mini/);
 assert.match(main,/Not playable yet/);
 assert.match(main,/state\.atriumGames=\[\]/);
 assert.doesNotMatch(main,/data-launch-game="\$\{esc\(g\.gameId\)\}"/);
});
