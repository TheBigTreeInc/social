import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {classifySessionFailure, createSessionRetry} from '../src/session-recovery.js';

test('invalid credentials alone clear remembered sessions; 403 preserves for operator repair',()=>{
  assert.equal(classifySessionFailure({status:401}),'rejected');
  assert.equal(classifySessionFailure({status:403}),'blocked');
  assert.equal(classifySessionFailure({status:503}),'temporary');
  assert.equal(classifySessionFailure({status:429}),'temporary');
  assert.equal(classifySessionFailure(new Error('offline')),'temporary');
});

test('automatic retry is bounded, coalesced and cancelled on login/sign-out',async()=>{
  const callbacks = new Map();let next=0;const waits=[],attempts=[];
  const schedule=(cb,delay)=>{const key=++next;callbacks.set(key,cb);waits.push(delay);return key;};
  const cancel=key=>callbacks.delete(key);
  const coordinator=createSessionRetry({retry:async()=>{attempts.push(1);},schedule,cancel,initialDelayMs:5,maxDelayMs:20});
  coordinator.enable();coordinator.enable();
  assert.equal(callbacks.size,1);
  assert.deepEqual(waits,[5]);
  assert.equal(await coordinator.trigger(),true);
  assert.equal(attempts.length,1);
  assert.deepEqual(waits,[5,10]);
  assert.equal(callbacks.size,1);
  await coordinator.trigger();await coordinator.trigger();
  assert.deepEqual(waits,[5,10,20,20]);
  coordinator.disable();
  assert.equal(callbacks.size,0);
  assert.equal(await coordinator.trigger(),false);
  coordinator.enable();
  assert.equal(waits.at(-1),5);
});

test('a retry callback failure does not leave the retry guard locked',async()=>{
  const pending=new Map();let i=0,called=0;
  const coordinator=createSessionRetry({retry:async()=>{called++;throw Error('connection offline')},
    schedule:(cb)=>{pending.set(++i,cb);return i;},cancel:id=>pending.delete(id)});
  coordinator.enable();
  await assert.rejects(coordinator.trigger(),/connection offline/);
  await assert.rejects(coordinator.trigger(),/connection offline/);
  assert.equal(called,2);
  coordinator.disable();
});

test('recovery screen exposes actionable retry/account switch and online/focus hooks',()=>{
  const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
  assert.match(main,/retry-session/);
  assert.match(main,/switch-account/);
  assert.match(main,/window\.addEventListener\('online'/);
  assert.match(main,/sessionRetry\.disable\(\)/);
  assert.match(main,/classifySessionFailure\(error\)/);
});
