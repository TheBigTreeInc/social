import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {bridge,permittedUpstream} from '../bridge.mjs';
async function serverFor(handler){const s=createServer(handler);await new Promise(ok=>s.listen(0,'127.0.0.1',ok));return [s,`http://127.0.0.1:${s.address().port}`];}
const close=s=>new Promise(ok=>s.close(ok));
test('rejects unsupported remote HTTP upstreams and credentialed URL',()=>{
 assert.throws(()=>permittedUpstream('http://malicious.example/social'),/HTTPS/);
 assert.throws(()=>permittedUpstream('http://token@127.0.0.1/social'),/plain Looprd/);
 assert.ok(permittedUpstream('http://127.0.0.1:10010/social').endsWith('/social'));
});
test('bridge presents the existing game REST API but sends social actions to native Looprd',async()=>{
 const received=[];
 const [upstream,origin]=await serverFor(async(req,res)=>{
  let raw='';for await(const piece of req)raw+=piece;
  const input=JSON.parse(raw);received.push(input);
  const output=input.op==='me'?{ok:true,profile:{schema:'looprd.social.profile/v1',profileId:'user_alex',displayName:'Alex',appearance:null}}:
    input.op==='save_profile'?{ok:true,profile:input.profile}:
    input.op==='chat_feed'?{ok:true,messages:[]}:
    {ok:true,message:{id:1,text:input.text,authorId:'user_alex'}};
  res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(output));
 });
 const [http,host]=await serverFor(bridge({upstream:origin+'/social'}));
 const token='a'.repeat(32);
 const call=(path,method='GET',data,secret=token)=>fetch(host+path,{method,headers:{authorization:'Bearer '+secret,origin:'http://localhost:8080',...(data?{'content-type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});
 try{
  assert.equal((await call('/v1/me','GET',undefined,'bad')).status,401);
  const denied=await fetch(host+'/v1/me',{headers:{authorization:'Bearer '+token,origin:'https://evil.example'}});assert.equal(denied.status,403);
  const me=await (await call('/v1/me')).json();assert.equal(me.displayName,'Alex');
  const saved=await (await call('/v1/me','PUT',{displayName:'New',appearance:null})).json();assert.equal(saved.displayName,'New');
  await call('/v1/chat/lobby');
  const chat=await (await call('/v1/chat/lobby','POST',{text:'Hello'})).json();assert.equal(chat.text,'Hello');
  assert.deepEqual(received.map(x=>x.op),['me','save_profile','chat_feed','chat_send']);
  assert.ok(received.every(x=>x.token===token));
  assert.equal((await call('/v1/game-tickets','POST',{})).status,501);
 }finally{await close(http);await close(upstream);}
});
