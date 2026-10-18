import {test} from 'node:test';import assert from 'node:assert/strict';
import {reconcileChallenges} from '../tavi-watch.mjs';
import {createChallengeConsumer,allowedGames} from '../tavi-openclaw-service.mjs';
const proposal={id:42,topic:'game.challenge.requested',status:'open',challenge:{schema:'tavi.game-challenge/v1',sender:'acct_2',gameId:'life',gameName:'Life'},expires:9999999};
test('approved game IDs only',()=>assert.deepEqual([...allowedGames('life, bad! ,other')],['life','other']));
test('challenge intake is account-scoped, acknowledges only after callback, and deduplicates',async()=>{
 const api={interactions:async()=>({events:[proposal,{...proposal,id:11,status:'responded'},{...proposal,id:44,challenge:{...proposal.challenge,sender:'untrusted'}}]})};
 const checkpoint={challenges:[]},got=[];
 await reconcileChallenges({api,checkpoint,onChallenge:async e=>got.push(e)});
 assert.deepEqual(got.map(x=>x.id),[42]);assert.deepEqual(checkpoint.challenges,[42]);
 await reconcileChallenges({api,checkpoint,onChallenge:async e=>got.push(e)});assert.equal(got.length,1);
});
test('failed challenge consumer leaves checkpoint unchanged for retry',async()=>{
 const checkpoint={challenges:[]};
 await assert.rejects(reconcileChallenges({api:{interactions:async()=>({events:[proposal]})},checkpoint,onChallenge:async()=>{throw Error('agent unavailable')}}),/agent unavailable/);
 assert.deepEqual(checkpoint.challenges,[]);
});
test('auto-accept needs explicit opt-in, accepted peer and allowed game',async()=>{
 const actions=[];const api={acceptChallenge:async id=>actions.push(id)};
 const args={api,peers:new Set(['acct_2']),games:new Set(['life'])};
 await createChallengeConsumer({...args,autoAccept:false})({id:42,peer:'acct_2',gameId:'life'});
 await createChallengeConsumer({...args,autoAccept:true})({id:43,peer:'acct_3',gameId:'life'});
 await createChallengeConsumer({...args,autoAccept:true})({id:44,peer:'acct_2',gameId:'unknown'});
 await createChallengeConsumer({...args,autoAccept:true})({id:45,peer:'acct_2',gameId:'life'});
 assert.deepEqual(actions,[45]);
});
