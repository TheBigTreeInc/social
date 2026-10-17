/** Offline-first turn-based session journal. NO wireless transport or account authority here.
 * Canonical host log, deterministic IDs, bounded payloads; hashes detect corruption,
 * not malicious peers (transport authentication must be provided separately).
 */
export const SCHEMA='tavi.nearby.session/v1';
export const MAX_ACTIONS=2000;
const encoder=new TextEncoder();
const idOk=s=>typeof s==='string'&&/^[a-zA-Z0-9_-]{8,72}$/.test(s);
const encode=o=>JSON.stringify(o);
const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value)))).map(x=>x.toString(16).padStart(2,'0')).join('');
const ensure=(condition,reason)=>{if(!condition)throw Error(reason);};
export function newSession({sessionId,hostId,gameId,players}){
 ensure(idOk(sessionId)&&idOk(hostId)&&idOk(gameId),'Invalid session or game ID');
 ensure(Array.isArray(players)&&players.length>=2&&players.length<=8&&new Set(players).size===players.length&&players.every(idOk),'Invalid player roster');
 ensure(players.includes(hostId),'Host must be a participant');
 return {schema:SCHEMA,sessionId,hostId,gameId,players:[...players],revision:0,head:'0'.repeat(64),actions:[],sync:{ackRevision:0,ackHead:'0'.repeat(64)}};
}
export function validateAction(action){
 ensure(action&&typeof action==='object'&&!Array.isArray(action),'Invalid action');
 ensure(idOk(action.actor)&&typeof action.type==='string'&&/^[a-z][a-z0-9._-]{0,63}$/.test(action.type),'Invalid action type/actor');
 const data=action.payload;
 ensure(data&&typeof data==='object'&&!Array.isArray(data),'Action payload must be object');
 const encoded=encode(data);
 ensure(encoded.length<=8192&&Object.keys(data).length<=32,'Action payload too large');
 // JSON-compatible only, no embedded prototypes, no non-finite values, no deep structures.
 const walk=(v,level=0)=>{ensure(level<=4,'Action payload too deep');if(v===null||typeof v==='string'||typeof v==='boolean')return;
  if(typeof v==='number'){ensure(Number.isFinite(v),'Non-finite payload number');return;}
  ensure(typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype,'Unsupported payload type');
  for(const [k,x] of Object.entries(v)){ensure(/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(k),'Invalid payload key');walk(x,level+1);}};
 walk(data);return true;
}
const actionMaterial=(session,a)=>encode([session.sessionId,a.revision,a.prev,a.actor,a.type,a.payload]);
export async function appendHostAction(session,action,{validateGameAction}={}){
 validateAction(action);
 ensure(session?.schema===SCHEMA&&session.hostId&&session.players.includes(action.actor),'Invalid session/actor');
 ensure(session.actions.length<MAX_ACTIONS,'Journal full: synchronize and checkpoint first');
 if(validateGameAction)await validateGameAction(session,action);
 const entry={revision:session.revision+1,prev:session.head,actor:action.actor,type:action.type,payload:structuredClone(action.payload)};
 entry.hash=await digest(actionMaterial(session,entry));
 return {...session,revision:entry.revision,head:entry.hash,actions:[...session.actions,entry]};
}
export async function verifySession(session){
 ensure(session?.schema===SCHEMA&&idOk(session.sessionId)&&idOk(session.hostId)&&Array.isArray(session.players)&&session.players.includes(session.hostId),'Invalid session');
 ensure(Array.isArray(session.actions)&&session.actions.length<=MAX_ACTIONS,'Invalid journal size');
 let prev='0'.repeat(64),revision=0;
 for(const a of session.actions){validateAction(a);ensure(session.players.includes(a.actor),'Unknown actor');
  ensure(a.revision===revision+1&&a.prev===prev,'Non-contiguous journal');
  ensure(a.hash===await digest(actionMaterial(session,a)),'Journal integrity mismatch');prev=a.hash;revision++;}
 ensure(session.revision===revision&&session.head===prev,'Invalid journal head');return true;
}
/** Server sync MUST verify authorization/game rules and accept an exact prefix only. */
export async function markAcknowledged(session,{revision,head}){
 await verifySession(session);
 ensure(Number.isSafeInteger(revision)&&revision>=session.sync.ackRevision&&revision<=session.revision,'Invalid acknowledgement revision');
 const expected=revision===0?'0'.repeat(64):session.actions[revision-1].hash;
 ensure(expected===head,'Server acknowledgement is not a prefix of local journal');
 return {...session,sync:{ackRevision:revision,ackHead:head}};
}
export function syncIntent(session){return {schema:'tavi.nearby.sync-intent/v1',sessionId:session.sessionId,gameId:session.gameId,baseRevision:session.sync.ackRevision,baseHead:session.sync.ackHead,actions:session.actions.slice(session.sync.ackRevision)};}
/** Never silently merge a diverging remote journal. */
export function compareRemoteHead(session,{revision,head}){
 if(revision===session.revision&&head===session.head)return 'in-sync';
 const prefix=revision===0?'0'.repeat(64):session.actions[revision-1]?.hash;
 if(Number.isSafeInteger(revision)&&revision>=0&&revision<=session.revision&&head===prefix)return 'remote-behind';
 return 'conflict';
}
/** Small session storage prototype; production should move large histories to SQLite/IndexedDB. */
export function createSessionStore(storage,{prefix='tavi.nearby.v1'}={}){
 const key=id=>{ensure(idOk(id),'Invalid session ID');return `${prefix}:${id}`;};
 return {save(session){ensure(session?.schema===SCHEMA&&session.actions.length<=MAX_ACTIONS,'Invalid saved session');storage.setItem(key(session.sessionId),JSON.stringify(session));},
  load(id){const value=storage.getItem(key(id));return value?JSON.parse(value):null;},
  remove(id){storage.removeItem(key(id));}};
}
