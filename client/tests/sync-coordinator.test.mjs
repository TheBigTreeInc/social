import test from 'node:test';
import assert from 'node:assert/strict';
import {createWakeCoordinator} from '../src/sync-coordinator.js';
function harness(sync,isBusy=()=>false){const jobs=[];const c=createWakeCoordinator(sync,{isBusy,schedule(fn){jobs.push(fn);return fn;},cancel(fn){const n=jobs.indexOf(fn);if(n>=0)jobs.splice(n,1);}});return {c,jobs,async tick(){await jobs.shift()();}};}
test('burst of hints performs one mailbox read',async()=>{let n=0;const h=harness(async()=>{n++;});h.c.wake();h.c.wake();h.c.wake();assert.equal(h.jobs.length,1);await h.tick();assert.equal(n,1);h.c.close();});
test('wake during read schedules a new read',async()=>{let finish;let n=0;const h=harness(async()=>{n++;if(n===1)await new Promise(resolve=>finish=resolve);});h.c.wake();const active=h.tick();await Promise.resolve();h.c.wake();finish();await active;assert.equal(h.jobs.length,1);await h.tick();assert.equal(n,2);h.c.close();});
test('busy full-refresh defers rather than drops wake',async()=>{let busy=true,n=0;const h=harness(async()=>n++,()=>busy);h.c.wake();await h.tick();assert.equal(n,0);assert.equal(h.jobs.length,1);busy=false;await h.tick();assert.equal(n,1);h.c.close();});
test('close cancels scheduled work',async()=>{let n=0;const h=harness(async()=>n++);h.c.wake();h.c.close();assert.equal(h.jobs.length,0);assert.equal(n,0);assert.equal(h.c.wake(),false);});
