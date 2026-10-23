/** Independent native conversation window. All authenticated operations stay in main. */
import './style.css';
import './chat.css';
import './ui/design-tokens.css';
import './ui/components.css';
import {uiHeader} from './ui/components.js';
import {readConfig} from './persistence.js';
import {emitTo,listen} from '@tauri-apps/api/event';
import {isValidChatPeer,chatWindowLabel} from './native-windows.js';

// Theme preference is cosmetic only, independent of the authenticated main broker.
try { document.documentElement.dataset.theme=readConfig().theme; } catch {}
// Cosmetic Tavi host theme follows the main messenger while this window is open.
void listen('tavi-ui-theme',({payload})=>{if(payload?.theme==='light'||payload?.theme==='dark')document.documentElement.dataset.theme=payload.theme;});
const $=id=>document.getElementById(id);
const peer=new URL(location.href).searchParams.get('peer');
if(!isValidChatPeer(peer))throw Error('Unknown conversation');
const label=chatWindowLabel(peer);
let sequence=0,pending=new Map(),lastScroll=true;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stamp=t=>{const d=new Date(Number(t)*1000);return Number.isFinite(d.getTime())?d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):''};
let current=null;
function redraw(){
 const oldField=$('message');const draft=oldField?.value||'';
 const hadFocus=document.activeElement===oldField;
 const selection=hadFocus?{start:oldField.selectionStart,end:oldField.selectionEnd}:null;
 const prevHistory=$('history');
 const nearBottom=!prevHistory||prevHistory.scrollHeight-prevHistory.scrollTop-prevHistory.clientHeight<90;
 const previousTop=prevHistory?.scrollTop||0;
 const title=current?.title||'Conversation';
 const pendingInvite=current?.pending;
 $('chat-app').innerHTML=`<div class="pop-chat">${uiHeader({title:title+' · Tavi',minimizeId:'minimize-chat',variant:'native-chat'})}
 <div class="pop-tools"><span class="pop-contact">☻</span><strong>${esc(title)}</strong><small>${esc(current?.online?'● Online':current?.server||'Social Messenger')}</small></div>
 <div class="pop-transcript" id="history" role="log" aria-label="Conversation history">${(current?.messages||[]).map(m=>`<div class="transcript-message"><span class="transcript-heading"><strong class="${m.authorId===current?.myId?'mine':''}">${esc(m.authorId===current?.myId?'You':m.displayName)}</strong><time>${esc(stamp(m.at))}</time></span><div class="transcript-text">${esc(m.text)}</div></div>`).join('')||'<div class="empty-chat">No messages yet.</div>'}</div>
 ${pendingInvite?`<div class="pop-request">${pendingInvite==='incoming'?'This person would like to add you.':'Friend request awaiting acceptance.'}${pendingInvite==='incoming'?'<button data-accept>Accept</button>':''}</div>`:`<div class="pop-format">A &nbsp; ☺ &nbsp; ♡ <span>Enter sends · Shift+Enter new line</span></div><form id="chat-form" class="pop-composer"><textarea id="message" required maxlength="${peer==='lobby'?320:1000}" aria-label="Your message" placeholder="Type a message…">${esc(draft)}</textarea><button type="submit" class="solid">Send</button></form>`}
 <div class="window-status" id="chat-status">${esc(current?.server||'Connecting to Social…')}</div></div>`;
 if($('message')){$('message').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();e.target.form?.requestSubmit();}});}
 $('chat-form')?.addEventListener('submit',async e=>{e.preventDefault();const field=$('message');const text=field.value.trim();if(!text)return;field.disabled=true;try{current=await request('send',text);field.value='';redraw();}catch(err){field.disabled=false;$('chat-status').textContent=err.message;}});
 $('minimize-chat')?.addEventListener('click',()=>emitTo('main','tavi-surface-minimize',{kind:'chat',id:peer}).catch(()=>{}));
 document.querySelector('[data-accept]')?.addEventListener('click',async()=>{try{current=await request('accept');redraw();}catch(err){$('chat-status').textContent=err.message;}});
 const history=$('history');if(history)history.scrollTop=nearBottom?history.scrollHeight:previousTop;
 if(hadFocus&&$('message')){$('message').focus();$('message').setSelectionRange(selection.start,selection.end);}
}
function request(kind='snapshot',text=''){
 return new Promise((resolve,reject)=>{
  const requestId=++sequence;
  const timeout=setTimeout(()=>{pending.delete(requestId);reject(Error('Social is unavailable — is the contact list open?'));},12000);
  pending.set(requestId,{resolve,reject,timeout});
  emitTo('main','social-chat-request',{requestId,kind,text,peer,label}).catch(err=>{clearTimeout(timeout);pending.delete(requestId);reject(err);});
 });
}
await listen('social-chat-response',e=>{
 const data=e.payload||{};const ticket=pending.get(data.requestId);if(!ticket)return;
 clearTimeout(ticket.timeout);pending.delete(data.requestId);
 if(data.ok)ticket.resolve(data.snapshot);
 else ticket.reject(Error(data.error||'Conversation error'));
});
async function acknowledgeViewed(){
 if(peer==='lobby'||document.visibilityState==='hidden'||!document.hasFocus()||!current?.messages?.length)return;
 const last=current.messages.at(-1);
 if(!Number.isSafeInteger(last?.id))return;
 await emitTo('main','social-chat-viewed',{peer,label,upToId:last.id}).catch(()=>{});
}
let refreshing=false;
async function update(){
 if(refreshing)return;
 refreshing=true;
 try{
  const snapshot=await request();
  if(JSON.stringify(snapshot)!==JSON.stringify(current)){current=snapshot;redraw();}
  await acknowledgeViewed();
 }catch(err){if($('chat-status'))$('chat-status').textContent=err.message;}
 finally{refreshing=false;}
}
window.addEventListener('focus',()=>void update());
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void update();});
redraw();await update();setInterval(update,3500);
