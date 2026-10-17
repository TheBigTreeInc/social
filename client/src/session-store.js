/** Local remembered-device session, scoped to one LoopRD origin.
 * Stores a revocable Social session token, never an account password.
 * An explicitly remembered session persists across app restarts; otherwise it
 * lives in sessionStorage for reloads within the current tab/webview session.
 * Note: browser storage is accessible to same-origin JavaScript; an OS-backed
 * credential vault is still recommended for a future native-security pass.
 */
import {normalizeServer} from '../sdk/looprd-social.js';
const KEY='tavi.social.session.v1';
const MAX_AGE_MS=29*24*60*60*1000;
function validRecord(v){
 if(!v||v.schema!=='tavi.remembered-session/v1'||typeof v.token!=='string'||v.token.length<24||v.token.length>256||
    typeof v.profileId!=='string'||v.profileId.length>128||!Number.isFinite(v.savedAt)||v.savedAt>Date.now()+60000||Date.now()-v.savedAt>MAX_AGE_MS)return false;
 try{return normalizeServer(v.origin)===v.origin;}catch{return false;}
}
function read(storage){try{const raw=storage.getItem(KEY);if(!raw)return null;const v=JSON.parse(raw);if(validRecord(v))return v;storage.removeItem(KEY);}catch{}return null;}
export function loadRememberedSession(local=localStorage,session=sessionStorage){
 return read(session)||read(local);
}
export function saveRememberedSession({origin,token,profileId,remember},local=localStorage,session=sessionStorage){
 const record={schema:'tavi.remembered-session/v1',origin:normalizeServer(origin),token,profileId,savedAt:Date.now()};
 if(!validRecord(record))throw Error('Invalid device session');
 clearRememberedSession(local,session);
 (remember?local:session).setItem(KEY,JSON.stringify(record));
 return record;
}
export function clearRememberedSession(local=localStorage,session=sessionStorage){
 for(const store of [local,session])try{store.removeItem(KEY);}catch{}
}
export function isPersistentSession(local=localStorage){return !!read(local);}
