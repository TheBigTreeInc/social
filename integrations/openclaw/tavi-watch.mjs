#!/usr/bin/env node
/** Long-running Tavi inbox wake consumer. Bridge events to an OpenClaw channel/agent host. */
import {readFile,writeFile,mkdir,rename,chmod} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {LooprdSocial} from '../../client/sdk/looprd-social.js';
import {stateDir} from './tavi-agent.mjs';

const ID=/^acct_[0-9]{1,19}$/;
const DEFAULT_POLL_MS=30000;
const MAX_BATCH=100;
export function clampPoll(value){const n=Number(value);return Number.isFinite(n)?Math.min(300000,Math.max(5000,Math.floor(n))):DEFAULT_POLL_MS;}
export function inboundFromFeed(peer, feed, selfId, previous=0){
 if(!ID.test(peer)||!ID.test(selfId)||!Array.isArray(feed))throw Error('Invalid authenticated inbox feed');
 const seen=new Set();
 return feed.filter(m=>Number.isSafeInteger(m?.id)&&m.id>previous&&
  m.authorId===peer&&typeof m.text==='string'&&m.text.length<=1000&&
  !seen.has(m.id)&&seen.add(m.id)).sort((a,b)=>a.id-b.id)
  .slice(0,MAX_BATCH).map(m=>({scope:`dm:${peer}`,peer,id:m.id,text:m.text,at:m.at}));
}
export function acceptedPeers(contacts){return (Array.isArray(contacts)?contacts:[]).filter(c=>c?.status==='accepted'&&ID.test(c.id));}
export async function readCheckpoint(path){try{const x=JSON.parse(await readFile(path,'utf8'));if(x?.schema!=='tavi.openclaw.inbox/v1'||!ID.test(x?.selfId)||typeof x.origin!=='string'||typeof x.peers!=='object'||Array.isArray(x.peers))throw Error('Invalid inbox checkpoint');return x;}catch(e){if(e.code==='ENOENT')return null;throw e;}}
export async function persistCheckpoint(path,checkpoint){await mkdir(dirname(path),{recursive:true,mode:0o700});const temp=`${path}.${randomUUID()}.tmp`;await writeFile(temp,JSON.stringify(checkpoint)+'\n',{mode:0o600,flag:'wx'});await chmod(temp,0o600);await rename(temp,path);await chmod(path,0o600);}
/** Do not advance a cursor until the asynchronous consumer explicitly acknowledges the event. */
export async function reconcileInbox({api,checkpoint,onMessage,bootstrap='latest',path}){
 const [me, roster]=await Promise.all([api.me(),api.contacts()]);
 const selfId=me?.profile?.profileId;
 if(!ID.test(selfId))throw Error('Tavi session lacks a verified account');
 if(checkpoint&&(checkpoint.selfId!==selfId||checkpoint.origin!==api.origin))throw Error('Inbox checkpoint belongs to another Tavi account or origin');
 const next=checkpoint||{schema:'tavi.openclaw.inbox/v1',origin:api.origin,selfId,peers:{}};
 for(const c of acceptedPeers(roster?.contacts)){
  const response=await api.directFeed(c.id);
  if(!Array.isArray(response?.messages))throw Error('Invalid Tavi inbox response');
  const latest=response.messages.reduce((max,m)=>Number.isSafeInteger(m?.id)?Math.max(max,m.id):max,0);
  if(!Object.hasOwn(next.peers,c.id)){
   // Default bootstrap avoids treating old conversation history as newly received instructions.
   next.peers[c.id]=bootstrap==='history'?0:latest;
   if(path)await persistCheckpoint(path,next);
   if(bootstrap!=='history')continue;
  }
  const messages=inboundFromFeed(c.id,response.messages,selfId,next.peers[c.id]);
  for(const item of messages){
   await onMessage({...item,peerName:c.displayName||c.username,peerUsername:c.username});
   next.peers[c.id]=item.id;
   if(path)await persistCheckpoint(path,next);
  }
 }
 return next;
}
/** Poll only account-scoped, pending game proposals; never consume service-owned seat invites. */
export async function reconcileChallenges({api,checkpoint,onChallenge,path}){
 if(typeof onChallenge!=='function')return checkpoint;
 const feed=await api.interactions();
 if(!Array.isArray(feed?.events))throw Error('Invalid Tavi challenge inbox');
 checkpoint.challenges ||= [];
 if(!Array.isArray(checkpoint.challenges))throw Error('Invalid challenge checkpoint');
 const handled=new Set(checkpoint.challenges);
 const events=feed.events.filter(e=>e?.topic==='game.challenge.requested'&&e.status==='open'&&
   Number.isSafeInteger(e.id)&&e.id>0&&e.challenge?.schema==='tavi.game-challenge/v1'&&
   ID.test(e.challenge.sender)&&typeof e.challenge.gameId==='string'&&
   /^[a-z][a-z0-9-]{1,47}$/.test(e.challenge.gameId)&&!handled.has(e.id))
   .sort((a,b)=>a.id-b.id);
 for(const event of events){
   await onChallenge({id:event.id,peer:event.challenge.sender,gameId:event.challenge.gameId,
     gameName:String(event.challenge.gameName||event.challenge.gameId).slice(0,64),expires:event.expires});
   handled.add(event.id);
   checkpoint.challenges=[...handled].slice(-200);
   if(path)await persistCheckpoint(path,checkpoint);
 }
 return checkpoint;
}
export function pulseWake(event){try{return JSON.parse(typeof event==='string'?event:event?.data).resource==='pulses';}catch{return false;}}
/** WebSocket signals are non-authoritative wake hints: always reconcile over authenticated HTTP. */
export async function runWatcher({api,onMessage,onChallenge=null,signal,pollMs=DEFAULT_POLL_MS,WebSocketImpl=globalThis.WebSocket,checkpointFile=join(stateDir(),'inbox.json'),onStatus=()=>{}}){
 let checkpoint=await readCheckpoint(checkpointFile),pending=true,running=false,closed=false,ws=null;
 const interval=clampPoll(pollMs);
 const reconcile=async()=>{
  if(running||closed)return;
  running=true;
  try{while(pending&&!closed){pending=false;checkpoint=await reconcileInbox({api,checkpoint,onMessage,path:checkpointFile});checkpoint=await reconcileChallenges({api,checkpoint,onChallenge,path:checkpointFile});}}
  catch(e){pending=true;onStatus('reconcile-error',e.message);}
  finally{running=false;}
 };
 const wake=()=>{pending=true;void reconcile();};
 const abort=()=>{closed=true;try{ws?.close();}catch{}};
 signal?.addEventListener('abort',abort,{once:true});
 try{
  while(!closed&&!signal?.aborted){
   await reconcile();
   if(typeof WebSocketImpl==='function'){
    try{
     const ticket=await api.pulseTicket();
     ws=new WebSocketImpl(`${api.pulseUrl()}?ticket=${encodeURIComponent(ticket)}`);
     await new Promise((resolve)=>{
      const timer=setTimeout(resolve,interval);
      const finish=()=>{clearTimeout(timer);resolve();};
      ws.addEventListener('open',()=>{try{ws.send(JSON.stringify({subscribe:'pulses'}));onStatus('connected');}catch{finish();}});
      ws.addEventListener('message',e=>{if(pulseWake(e))wake();});
      ws.addEventListener('error',finish);ws.addEventListener('close',finish);
      signal?.addEventListener('abort',finish,{once:true});
     });
    }catch(e){onStatus('websocket-unavailable',e.message);}
    finally{try{ws?.close();}catch{}ws=null;}
   }
   if(!closed&&!signal?.aborted)await new Promise(resolve=>{const t=setTimeout(resolve,interval);signal?.addEventListener('abort',()=>{clearTimeout(t);resolve();},{once:true});});
   pending=true;
  }
 }finally{abort();signal?.removeEventListener('abort',abort);}
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const origin=process.env.TAVI_SERVER,token=process.env.TAVI_TOKEN;
 if(!origin||!token){console.error('Set TAVI_SERVER and TAVI_TOKEN using private environment secrets.');process.exitCode=2;}
 else{
  const ctrl=new AbortController();process.on('SIGINT',()=>ctrl.abort());process.on('SIGTERM',()=>ctrl.abort());
  const api=new LooprdSocial(origin,token);
  runWatcher({api,signal:ctrl.signal,onMessage:async msg=>{process.stdout.write(JSON.stringify(msg)+'\n');},onStatus:(s,detail)=>console.error('tavi-watch:',s,detail||'')}).catch(e=>{console.error('tavi-watch failed:',e.message);process.exitCode=1;});
 }
}
