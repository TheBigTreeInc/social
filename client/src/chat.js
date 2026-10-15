/** Independent native conversation window. All authenticated operations stay in main. */
import './style.css';
import './chat.css';
import {emitTo,listen} from '@tauri-apps/api/event';
import {isValidChatPeer,chatWindowLabel} from './native-windows.js';

const $=id=>document.getElementById(id);
const peer=new URL(location.href).searchParams.get('peer');
if(!isValidChatPeer(peer))throw Error('Unknown conversation');
const label=chatWindowLabel(peer);
let sequence=0,pending=new Map(),messages=[],lastScroll=true;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stamp=t=>{const d=new Date(Number(t)*1000);return Number.isFinite(d.getTime())?d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):''};
let current=null;
function redraw(){
 const draft=$('message')?.value||'';
 const title=current?.title||'Conversation';
 const pendingInvite=current?.pending;
 $('chat-app').innerHTML=`<div class="pop-chat"><nav class="menubar"><span class="pop-menu">File &nbsp; Edit &nbsp; Actions &nbsp; Help</span></nav>
 <div class="pop-tools"><span class="pop-contact">☻</span><strong>${esc(title)}</strong><small>${esc(current?.online?'● Online':current?.server||'Social Messenger')}</small></div>
 <div class="pop-transcript" id="history" role="log" aria-label="Conversation history">${(current?.messages||[]).map(m=>`<div class="transcript-message"><span class="transcript-heading"><strong class="${m.authorId===current?.myId?'mine':''}">${esc(m.authorId===current?.myId?'You':m.displayName)}</strong><time>${esc(stamp(m.at))}</time></span><div class="transcript-text">${esc(m.text)}</div></div>`).join('')||'<div class="empty-chat">No messages yet.</div>'}</div>
 ${pendingInvite?`<div class="pop-request">${pendingInvite==='incoming'?'This person would like to add you.':'Friend request awaiting acceptance.'}${pendingInvite==='incoming'?'<button data-accept>Accept</button>':''}</div>`:`<div class="pop-format">A &nbsp; ☺ &nbsp; ♡ <span>Enter sends · Shift+Enter new line</span></div><form id="chat-form" class="pop-composer"><textarea id="message" required maxlength="${peer==='lobby'?320:1000}" aria-label="Your message" placeholder="Type a message…">${esc(draft)}</textarea><button type="submit" class="solid">Send</button></form>`}
 <div class="window-status" id="chat-status">${esc(current?.server||'Connecting to Social…')}</div></div>`;
 if($('message')){$('message').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();e.target.form?.requestSubmit();}});}
 $('chat-form')?.addEventListener('submit',async e=>{e.preventDefault();const field=$('message');const text=field.value.trim();if(!text)return;field.disabled=true;try{current=await request('send',text);redraw();}catch(err){field.disabled=false;$('chat-status').textContent=err.message;}});
 document.querySelector('[data-accept]')?.addEventListener('click',async()=>{try{current=await request('accept');redraw();}catch(err){$('chat-status').textContent=err.message;}});
 const history=$('history');if(history&&lastScroll)history.scrollTop=history.scrollHeight;
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
async function update(){if(document.activeElement===$('message'))return;try{const snapshot=await request();if(JSON.stringify(snapshot)!==JSON.stringify(current)){current=snapshot;redraw();}}catch(err){if($('chat-status'))$('chat-status').textContent=err.message;}}
redraw();await update();setInterval(update,6000);
