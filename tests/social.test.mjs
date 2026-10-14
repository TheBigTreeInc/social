import {test} from 'node:test';import assert from 'node:assert/strict';import {handler,profile} from '../server.mjs';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {createServer} from 'node:http';
test('profile presentation data only; rejects wrong profile and malformed colors',()=>{
 const ok=profile('account1',{displayName:'Alex',appearance:null});assert.equal(ok.profileId,'account1');
 assert.throws(()=>profile('a',{schema:'wrong',displayName:'x'}));
 assert.throws(()=>profile('a',{displayName:'<>',appearance:null}));
});
test('local service isolates profile writes and offers social chat',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'social-test-'));const web=createServer(handler({tokens:{user_alex:'aaaaaaaaaaaaaaaaaaaaaaaa',user_bob:'bbbbbbbbbbbbbbbbbbbbbbbb'},dataDir:dir,origin:'http://localhost:8080'}));
 await new Promise(resolve=>web.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+web.address().port;
 const call=(token,path,method='GET',body)=>fetch(base+path,{method,headers:{authorization:'Bearer '+token,'content-type':'application/json',origin:'http://localhost:8080'},body:body?JSON.stringify(body):undefined});
 try{
  assert.equal((await (await call('aaaaaaaaaaaaaaaaaaaaaaaa','/v1/me')).json()).profileId,'user_alex');
  assert.equal((await call('bad','/v1/me')).status,401);
  assert.equal((await call('aaaaaaaaaaaaaaaaaaaaaaaa','/v1/me','PUT',{displayName:'Alex',profileId:'user_bob'})).status,403);
  const put=await call('aaaaaaaaaaaaaaaaaaaaaaaa','/v1/me','PUT',{displayName:'Alex!',appearance:null});assert.equal(put.status,200);
  const chat=await call('aaaaaaaaaaaaaaaaaaaaaaaa','/v1/chat/lobby','POST',{text:'Hello'});assert.equal(chat.status,200);
  const feed=await (await call('bbbbbbbbbbbbbbbbbbbbbbbb','/v1/chat/lobby')).json();assert.equal(feed.messages[0].text,'Hello');
  assert.equal((await call('aaaaaaaaaaaaaaaaaaaaaaaa','/v1/game-tickets','POST',{game:'the-life-loop'})).status,501);
 }finally{await new Promise(resolve=>web.close(resolve));rmSync(dir,{recursive:true,force:true});}
});
