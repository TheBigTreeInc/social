import test from 'node:test';
import assert from 'node:assert/strict';
import {LooprdSocial} from '../sdk/looprd-social.js';
const rid='a'.repeat(64);
test('room API sends only authenticated Social commands with validated room IDs',async()=>{
 const calls=[];
 const api=new LooprdSocial('https://example.org','x'.repeat(32),async (url,opts)=>{
  calls.push(JSON.parse(opts.body));return {ok:true,status:200,json:async()=>({ok:true,rooms:[],messages:[]})};
 });
 await api.gameRooms();await api.gameRoomFeed(rid,8);await api.gameRoomSend(rid,'hello from the party');
 assert.deepEqual(calls.map(c=>c.op),['game_room_list','game_room_feed','game_room_send']);
 assert.equal(calls[1].after,8);
 assert.equal(calls[2].roomId,rid);
 assert.throws(()=>api.gameRoomFeed('wrong-room'),/room/i);
 assert.throws(()=>api.gameRoomSend(rid,' '),/room message/i);
 assert.equal(calls.length,3);
});
