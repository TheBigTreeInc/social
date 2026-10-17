import {test} from 'node:test';
import assert from 'node:assert/strict';
import {filteredEvents,run} from '../tavi-agent.mjs';
test('per-conversation cursor suppresses repeated inbound events',()=>{
 const messages=[{scope:'dm:acct_2',id:3,text:'hello'},{scope:'lobby',id:5,text:'hi'},{scope:'dm:acct_2',id:2,text:'older'}];
 const result=filteredEvents(messages,{'dm:acct_2':2});
 assert.equal(result.events.length,2);assert.equal(result.cursors['dm:acct_2'],3);assert.equal(result.cursors.lobby,5);
 assert.equal(filteredEvents(messages,result.cursors).events.length,0);
});
test('help is credential free and advertises actual operations',async()=>{const result=await run(['help']);assert(result.commands.some(x=>x.startsWith('dm ')));assert(!JSON.stringify(result).includes('Bearer'));});
test('unknown command requires a session, no silent public access',async()=>{await assert.rejects(run(['unknown']),/TAVI_SERVER/);});
