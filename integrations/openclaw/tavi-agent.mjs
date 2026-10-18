#!/usr/bin/env node
/** Headless Tavi account bridge for OpenClaw exec/tools. No third-party dependencies. */
import {readFile, writeFile, mkdir, rename, chmod} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join, dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {LooprdSocial, loginSocial, registerSocial, discoverSocial, discoverGames} from '../../client/sdk/looprd-social.js';

const DEFAULT_STATE=join(homedir(),'.config','tavi-openclaw');
export const stateDir=()=>resolve(process.env.TAVI_AGENT_STATE_DIR||DEFAULT_STATE);
const statePath=(name)=>join(stateDir(),name);
export const safeOutput=(data)=>JSON.stringify(data,null,2);
async function readJson(path, fallback){try{return JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}}
async function privateWrite(path,data){await mkdir(dirname(path),{recursive:true,mode:0o700});const temp=`${path}.${randomUUID()}.tmp`;await writeFile(temp,JSON.stringify(data,null,2)+'\n',{mode:0o600,flag:'wx'});await chmod(temp,0o600);await rename(temp,path);await chmod(path,0o600);}
function getOrigin(){const origin=process.env.TAVI_SERVER; if(!origin)throw Error('Set TAVI_SERVER to the HTTPS LoopRD origin');return origin;}
async function session(){const origin=getOrigin();const saved=await readJson(statePath('session.json'),{});if(!process.env.TAVI_TOKEN&&saved.origin&&saved.origin!==origin)throw Error('Saved Tavi session belongs to another server; login again');const token=process.env.TAVI_TOKEN || saved.token;if(!token)throw Error('No Tavi session: run login/register or set TAVI_TOKEN');return new LooprdSocial(origin,token);}
export function filteredEvents(events,cursors={}){const updated={...cursors};const fresh=[];for(const item of events){const scope=item.scope;const id=Number(item.id);if(!Number.isSafeInteger(id)||id<=0||typeof scope!=='string')continue;if(id>(updated[scope]||0)){fresh.push(item);updated[scope]=Math.max(id,updated[scope]||0);}}return {events:fresh,cursors:updated};}
async function getUpdates(api,previous){const contacts=(await api.contacts()).contacts||[];const inbox=[];const lobby=await api.feed();for(const m of lobby.messages||[])inbox.push({scope:'lobby',id:m.id,authorId:m.authorId,text:m.text,at:m.at});for(const c of contacts){if(c.status!=='accepted')continue;const feed=await api.directFeed(c.id);for(const m of feed.messages||[])inbox.push({scope:`dm:${c.id}`,peer:c.id,peerName:c.username,id:m.id,authorId:m.authorId,text:m.text,at:m.at});}const me=await api.me();const mine=me?.profile?.profileId||me?.profile?.subjectId||me?.subject||'';return {...filteredEvents(inbox.filter(e=>e.authorId!==mine),previous),account:mine};}
export async function run(args){const [cmd,...rest]=args;if(!cmd||cmd==='help')return {commands:['discover','register USERNAME','login USERNAME','me','contacts','request USERNAME','accept ACCOUNT_ID','remove ACCOUNT_ID','dm ACCOUNT_ID TEXT','lobby TEXT','updates','games','game-events [AFTER_ID]','game-invite-accept ID','game-invite-decline ID','game-grant PUBLISHER GAME_ID MATCH_ID','logout'],note:'TAVI_SERVER required; TAVI_PASSWORD is used only for register/login; TAVI_TOKEN overrides session file.'};
 if(cmd==='discover')return discoverSocial(getOrigin());
 if(cmd==='login'||cmd==='register'){const name=rest[0],password=process.env.TAVI_PASSWORD;if(!name||!password)throw Error(`Usage: ${cmd} USERNAME with TAVI_PASSWORD set`);const api=cmd==='login'?await loginSocial(getOrigin(),name,password):await registerSocial(getOrigin(),name,password);await privateWrite(statePath('session.json'),{origin:getOrigin(),token:api.token});return {ok:true,account:name,stored:'private session.json (0600)',tokenReturned:false};}
 if(cmd==='games')return {games:await discoverGames(getOrigin()),agentPlaySupported:false};
 if(cmd==='game-events'){const after=rest.length?Number(rest[0]):0;if(!Number.isSafeInteger(after)||after<0)throw Error('Provide a nonnegative game-event cursor');const api=await session();return api.gameEvents(after);}
 const api=await session();if(cmd==='game-invite-accept'||cmd==='game-invite-decline'){
  const id=Number(rest[0]);if(!Number.isSafeInteger(id)||id<=0)throw Error('Invalid invitation ID');
  return cmd==='game-invite-accept'?api.acceptGameInvitation(id):api.declineGameInvitation(id);
 }if(cmd==='game-grant'){
  if(rest.length!==3)throw Error('Usage: game-grant PUBLISHER GAME_ID MATCH_ID');
  const result=await api.issueGameGrant(...rest);
  const pathname=statePath('game-grants/'+randomUUID()+'.json');
  await privateWrite(pathname,result);
  return {ok:true,grantFile:pathname,expiresAt:result.expiresAt,audience:result.audience,
    gameId:result.gameId,matchId:result.matchId,secretReturned:false};
 }if(cmd==='me')return api.me();if(cmd==='contacts')return api.contacts();if(cmd==='request')return api.requestContact(rest[0]);if(cmd==='accept')return api.acceptContact(rest[0]);if(cmd==='remove')return api.removeContact(rest[0]);if(cmd==='dm'){if(!rest[0]||!rest.slice(1).join(' '))throw Error('Usage: dm ACCOUNT_ID TEXT');return api.directSend(rest[0],rest.slice(1).join(' '));}if(cmd==='lobby'){if(!rest.length)throw Error('Usage: lobby TEXT');return api.send(rest.join(' '));}
 if(cmd==='updates'){const file=statePath('cursors.json');const previous=await readJson(file,{});const result=await getUpdates(api,previous);await privateWrite(file,result.cursors);return {events:result.events,account:result.account};}
 if(cmd==='logout'){await api.logout();await privateWrite(statePath('session.json'),{});return {ok:true};}throw Error(`Unknown command: ${cmd}`);
}
const self=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(self)run(process.argv.slice(2)).then(result=>process.stdout.write(safeOutput(result)+'\n')).catch(error=>{process.stderr.write(`Tavi bridge: ${error.message}\n`);process.exitCode=1;});
