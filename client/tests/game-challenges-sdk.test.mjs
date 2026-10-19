import {test} from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LooprdSocial} from '../sdk/looprd-social.js';
import {LooprdSocial as NativeApi} from '../src/protocol.js';
test('Web, Windows and Android use same account challenge methods',async()=>{
 assert.equal(LooprdSocial,NativeApi);
 const commands=[];const api=new LooprdSocial('https://example.org','x'.repeat(32),async(_url,opts)=>{
  const body=JSON.parse(opts.body);commands.push(body);return {ok:true,status:200,json:async()=>({ok:true,response:{action:body.action}})};
 });
 await api.challengeContact('acct_2','life');await api.acceptChallenge(10);await api.declineChallenge(11);
 assert.deepEqual(commands.map(x=>x.op),['game_challenge_send','interaction_reply','interaction_reply']);
 assert.equal(commands[0].gameId,'life');assert.equal(commands[0].peer,'acct_2');
 assert.deepEqual(commands.slice(1).map(x=>x.action),['accept-challenge','decline-challenge']);
 assert.throws(()=>api.challengeContact('acct_2','unsafe/url'),/challenge/);
 assert.throws(()=>api.challengeContact('evil','life'),/challenge/);
 assert.equal(commands.length,3);
});
test('native Games surface exposes play and explicit challenge from accepted contacts',()=>{
 const code=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(code,/Play with friends/);
 assert.match(code,/data-challenge-game/);
 assert.match(code,/state\.contacts\.filter\(c=>c\.status==='accepted'\)/);
 assert.match(code,/state\.api\.challengeContact\(peer,gameId\)/);
 assert.match(code,/class="tavi-dock-side" data-action="games"/);
 assert.match(code,/data-launch-game/);
});
