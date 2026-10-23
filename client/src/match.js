/** Isolated native match conversation. Never receives or stores Social credentials. */
import './style.css';
import './chat.css';
import './ui/design-tokens.css';
import './ui/components.css';
import {uiHeader} from './ui/components.js';
import {readConfig} from './persistence.js';
import {emitTo,listen} from '@tauri-apps/api/event';
import {isValidMatchRoom,matchWindowLabel} from './match-windows.js';

// Cosmetic theme contract shared with the main host (not an authentication channel).
try { document.documentElement.dataset.theme=readConfig().theme; } catch {}
void listen('tavi-ui-theme',({payload})=>{if(payload?.theme==='light'||payload?.theme==='dark')document.documentElement.dataset.theme=payload.theme;});
const roomId=new URL(location.href).searchParams.get('room');
if(!isValidMatchRoom(roomId))throw Error('Invalid match window');
const label=matchWindowLabel(roomId);
const app=document.getElementById('match-app');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stamp=t=>{const d=new Date(Number(t)*1000);return Number.isFinite(d.getTime())?d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):''};
let sequence=0,active=null,refreshing=false,lastError='',pending=new Map();
function redraw(){
 const oldField=document.getElementById('match-message');
 const draft=oldField?.value||'';
 const focused=document.activeElement===oldField;
 const selection=focused?{start:oldField.selectionStart,end:oldField.selectionEnd}:null;
 const history=document.getElementById('match-history');
 const atBottom=!history||history.scrollHeight-history.scrollTop-history.clientHeight<100;
 const scrollTop=history?.scrollTop||0;
 const room=active?.room;
 const messages=active?.messages||[];
 app.innerHTML=`<div class="pop-chat">${uiHeader({title:'Tavi · Private match conversation'})}
 <div class="pop-tools"><span class="pop-contact">♟</span><div><strong>${esc(room?room.gameId:'Match chat')}</strong><small> ${room?esc(room.matchId):'Awaiting verified player seat'} · ${room?Number(room.participants)||0:0} seats</small></div></div>
 <div class="pop-transcript" id="match-history" role="log" aria-label="Private match messages">${messages.map(m=>`<div class="transcript-message"><span class="transcript-heading"><strong class="${m.authorId===active?.myId?'mine':''}">${esc(m.authorId===active?.myId?'You':m.displayName)}</strong><time>${esc(stamp(m.at))}</time></span><div class="transcript-text">${esc(m.text)}</div></div>`).join('')||'<div class="empty-chat">No match messages yet.</div>'}</div>
 ${room?`<div class="pop-format">Only verified, consenting seats may write <span>Enter sends · Shift+Enter new line</span></div><form id="match-form" class="pop-composer"><textarea id="match-message" required maxlength="1000" placeholder="Message your match…">${esc(draft)}</textarea><button class="solid" type="submit">Send</button></form>`:'<div class="pop-request">You are not currently authorized for this match conversation.</div>'}
 <div class="window-status" id="match-status">${esc(lastError||'Private room · Game rules remain with Life')}</div></div>`;
 const field=document.getElementById('match-message');
 field?.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();e.target.form?.requestSubmit();}});
 document.getElementById('match-form')?.addEventListener('submit',async e=>{
  e.preventDefault();const input=document.getElementById('match-message');
  const text=input?.value.trim();if(!text)return;
  input.disabled=true;
  try{const result=await request('send',text);active=result;lastError='';input.value='';redraw();}
  catch(err){lastError=err.message;input.disabled=false;const status=document.getElementById('match-status');if(status)status.textContent=lastError;}
 });
 const newHistory=document.getElementById('match-history');
 if(newHistory)newHistory.scrollTop=atBottom?newHistory.scrollHeight:scrollTop;
 if(focused&&field){field.focus();field.setSelectionRange(selection.start,selection.end);}
}
function request(kind='snapshot',text=''){
 return new Promise((resolve,reject)=>{
  const requestId=++sequence;
  const timeout=setTimeout(()=>{pending.delete(requestId);reject(Error('Match chat unavailable; keep Tavi open.'));},12000);
  pending.set(requestId,{resolve,reject,timeout});
  emitTo('main','social-match-request',{requestId,kind,text,roomId,label})
    .catch(err=>{clearTimeout(timeout);pending.delete(requestId);reject(err);});
 });
}
await listen('social-match-response',e=>{
 const result=e.payload||{};
 if(result.label!==label||result.roomId!==roomId)return;
 const ticket=pending.get(result.requestId);if(!ticket)return;
 clearTimeout(ticket.timeout);pending.delete(result.requestId);
 if(result.ok)ticket.resolve(result.snapshot);
 else ticket.reject(Error(result.error||'No match access'));
});
async function update(){
 if(refreshing)return;refreshing=true;
 try{
  const next=await request();
  if(JSON.stringify(next)!==JSON.stringify(active)){active=next;redraw();}
  lastError='';
 }catch(e){
  // Do not keep showing private messages after consent or seat removal.
  active=null;lastError=e.message||'Match access unavailable';redraw();
 }finally{refreshing=false;}
}
window.addEventListener('focus',()=>void update());
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void update();});
redraw();await update();setInterval(()=>void update(),3500);
