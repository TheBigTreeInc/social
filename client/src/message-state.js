/** Client-local, per-server/user read markers. No Social token or message body stored.
 * The Social v1 API exposes only per-peer DM feeds (30 days / 100 messages), so
 * this is a bounded foreground poller rather than a server-side mailbox index.
 */
const MAX_PEERS=150;
const MAX_ID=Number.MAX_SAFE_INTEGER;
const TAG='tavi.chat-read/v1';
const MAX_PREVIEW=100;
export function readStateKey(origin,profileId){
  return `tavi.chat-read.v1:${encodeURIComponent(origin)}:${encodeURIComponent(profileId)}`;
}
export function safeMessageId(v){return Number.isSafeInteger(v)&&v>=0&&v<=MAX_ID?v:0;}
export function loadChatReadState(storage,key){
  try{
    const v=JSON.parse(storage.getItem(key)||'null');
    if(v?.schema!==TAG || !v.peers || typeof v.peers!=='object' || Array.isArray(v.peers))return {};
    const out={};
    for(const [peer,entry] of Object.entries(v.peers).slice(0,MAX_PEERS)){
      if(!/^acct_[0-9]{1,19}$/.test(peer)||!entry||typeof entry!=='object')continue;
      out[peer]={read:safeMessageId(entry.read),notified:safeMessageId(entry.notified)};
    }
    return out;
  }catch{return {};}
}
export function saveChatReadState(storage,key,peers){
  const safe={};
  for(const [peer,v] of Object.entries(peers||{}).slice(0,MAX_PEERS)){
    if(/^acct_[0-9]{1,19}$/.test(peer))safe[peer]={read:safeMessageId(v?.read),notified:safeMessageId(v?.notified)};
  }
  try{storage.setItem(key,JSON.stringify({schema:TAG,peers:safe}));return true;}catch{return false;}
}
/** Derive unread and at most one notification from a feed. First sync seeds a
 * baseline to avoid suddenly notifying about a month's historical messages.
 * Caller separately acknowledges a conversation when it is actually visible.
 */
export function reconcileDirectFeed(messages,myId,cursor,{visible=false}={}){
  const list=Array.isArray(messages)?messages:[];
  const newest=list.reduce((n,m)=>Math.max(n,safeMessageId(m?.id)),0);
  if(!cursor){return {cursor:{read:newest,notified:newest},unread:0,notification:null,latest:newest};}
  const read=safeMessageId(cursor.read),notified=safeMessageId(cursor.notified);
  const nextRead=visible?Math.max(read,newest):read;
  const inbound=list.filter(m=>m?.authorId!==myId&&safeMessageId(m?.id)>nextRead);
  const pending=inbound.filter(m=>safeMessageId(m.id)>notified);
  const incoming=pending.at(-1)||null;
  const nextNotified=Math.max(notified,incoming?safeMessageId(incoming.id):0);
  return {cursor:{read:nextRead,notified:nextNotified},unread:Math.min(99,inbound.length),
    notification:visible?null:incoming?{id:safeMessageId(incoming.id),text:String(incoming.text||'').slice(0,MAX_PREVIEW)}:null,latest:newest};
}
export function acknowledgeDirectFeed(messages,cursor){
  const newest=(Array.isArray(messages)?messages:[]).reduce((n,m)=>Math.max(n,safeMessageId(m?.id)),0);
  return {read:Math.max(safeMessageId(cursor?.read),newest),notified:Math.max(safeMessageId(cursor?.notified),newest)};
}
export function chatPollPeers(contacts,offset=0,limit=12){
  const accepted=(Array.isArray(contacts)?contacts:[]).filter(c=>c?.status==='accepted'&&/^acct_[0-9]{1,19}$/.test(c.id));
  if(!accepted.length)return {peers:[],nextOffset:0,total:0};
  const start=Math.max(0,offset)%accepted.length;
  const count=Math.min(Math.max(1,limit),accepted.length);
  const peers=Array.from({length:count},(_,i)=>accepted[(start+i)%accepted.length]);
  return {peers,nextOffset:(start+count)%accepted.length,total:accepted.length};
}
const NOTIFY_TAG='tavi.message-notifications/v1';
export function notificationPrefsKey(origin,profileId){return `tavi.notify.v1:${encodeURIComponent(origin)}:${encodeURIComponent(profileId)}`;}
export function loadNotificationPrefs(storage,key){
 try{
  const data=JSON.parse(storage.getItem(key)||'null');
  if(data?.schema===NOTIFY_TAG)return {messages:data.messages!==false,preview:data.preview===true,requests:data.requests!==false};
 }catch{}
 return {messages:true,preview:false,requests:true};
}
export function saveNotificationPrefs(storage,key,prefs){
 const v={schema:NOTIFY_TAG,messages:prefs.messages===true,preview:prefs.preview===true,requests:prefs.requests===true};
 try{storage.setItem(key,JSON.stringify(v));return true;}catch{return false;}
}

/** Server-owned mailbox metadata. A notification marker stays local to this
 * installation; the read cursor itself comes from LoopRD and is shared across
 * devices. A fresh device seeds notification state without erasing unread mail.
 */
export function reconcileConversationSummary(summary,myId,previous,{visible=false}={}){
  if(!summary||!/^acct_[0-9]{1,19}$/.test(summary.peer)||!Number.isSafeInteger(summary.readId)||summary.readId<0||
     !Number.isSafeInteger(summary.unread)||summary.unread<0||summary.unread>99)
    throw Error('Invalid Tavi conversation summary');
  const latest=summary.latest;
  if(latest && (!Number.isSafeInteger(latest.id)||latest.id<1||
      !/^acct_[0-9]{1,19}$/.test(latest.authorId)||typeof latest.text!=='string'||
      !Number.isSafeInteger(latest.at)))throw Error('Invalid Tavi latest-message summary');
  const localRead=safeMessageId(previous?.read);
  const read=Math.max(summary.readId,localRead);
  const notified=safeMessageId(previous?.notified);
  const latestId=latest?.id||0;
  const unseen=latest&&latest.authorId!==myId&&latestId>read;
  const notification=!visible&&previous&&unseen&&latestId>notified?
    {id:latestId,text:latest.text.slice(0,100)}:null;
  const cursor={read,notified:Math.max(notified,latestId)};
  // The server's unread count is authoritative once it has acknowledged a
  // device's local cursor; do not invent a count from the last message alone.
  const unread=visible?0:read>summary.readId?0:summary.unread;
  return {cursor,unread,notification};
}
