import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isValidChatPeer,chatWindowLabel} from '../src/native-windows.js';
test('native conversation accepts real short server-issued account IDs',()=>{
 for(const peer of ['acct_1','acct_9','acct_10','acct_1234567890123456789']){
  assert.equal(isValidChatPeer(peer),true,peer);
  assert.equal(chatWindowLabel(peer),'chat-'+peer);
 }
 assert.equal(isValidChatPeer('lobby'),true);
});
test('native conversation rejects malformed and forged peer IDs',()=>{
 for(const peer of ['',null,'acct_','acct_0','acct_01','acct_-1','acct_1/../main','admin','acct_12345678901234567890','chat-acct_1']){
  assert.equal(isValidChatPeer(peer),false,String(peer));
  assert.throws(()=>chatWindowLabel(peer));
 }
});
