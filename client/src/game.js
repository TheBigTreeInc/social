/** Separate game window. The game iframe is untrusted; it never receives Social credentials. */
import './game.css';
import {emitTo,listen} from '@tauri-apps/api/event';
import {isSafePublishedGameUrl} from '../sdk/looprd-social.js';
const gameId=new URL(location.href).searchParams.get('game');
if(!/^[a-z][a-z0-9-]{1,47}$/.test(gameId||''))throw Error('Invalid game ID');
const label='game-'+gameId;
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let current=null,sequence=0,pending=new Map(),chatOpen=true,chatDraft='';
function request(kind='snapshot',text=''){
 return new Promise((resolve,reject)=>{
  const requestId=++sequence;
  const timeout=setTimeout(()=>{pending.delete(requestId);reject(Error('Tavi roster unavailable'));},12000);
  pending.set(requestId,{resolve,reject,timeout});
  emitTo('main','tavi-game-request',{label,gameId,kind,text,requestId}).catch(e=>{clearTimeout(timeout);pending.delete(requestId);reject(e)});
 });
}
await listen('tavi-game-response',e=>{
 const d=e.payload||{};const t=pending.get(d.requestId);if(!t)return;
 clearTimeout(t.timeout);pending.delete(d.requestId);
 d.ok?t.resolve(d.snapshot):t.reject(Error(d.error||'Game service unavailable'));
});
const host=$('game-app');
function draw(snapshot){
 const prev=$('game-frame');const same=prev?.dataset.url===snapshot.game.url;
 const messages=(snapshot.messages||[]).slice(-40);
 host.innerHTML=`<div class="tavi-player"><header><strong>✦ Tavi · ${esc(snapshot.game.name)}</strong><span>${esc(snapshot.server)}</span><button id="toggle-chat">${chatOpen?'Hide chat':'Show chat'}</button></header><section class="player-body"><div class="game-stage" id="game-stage"></div>${chatOpen?`<aside class="game-chat"><strong>Community chat</strong><div class="game-messages">${messages.map(m=>`<p><b>${esc(m.displayName)}</b>: ${esc(m.text)}</p>`).join('')||'<p>No messages yet.</p>'}</div><form id="game-chat-form"><textarea id="game-message" maxlength="320" rows="2" placeholder="Message the lobby…">${esc(chatDraft)}</textarea><button>Send</button></form></aside>`:''}</section><footer>Game identity and Social identity are separate. Game framing depends on the game's embedding policy.</footer></div>`;
 const stage=$('game-stage');
 if(snapshot.game.embedded){
  if(same)stage.append(prev);
  else{const frame=document.createElement('iframe');frame.id='game-frame';frame.title=snapshot.game.name;frame.dataset.url=snapshot.game.url;frame.referrerPolicy='no-referrer';frame.setAttribute('sandbox','allow-scripts allow-forms allow-same-origin allow-popups');frame.src=snapshot.game.url;stage.append(frame);}
 }else stage.innerHTML='<p>This server does not allow embedding this game. Open it in your regular browser from Tavi.</p>';
 $('toggle-chat').onclick=()=>{chatOpen=!chatOpen;draw(current)};
 const form=$('game-chat-form');if(form){form.onsubmit=async e=>{e.preventDefault();const field=$('game-message');const msg=field.value.trim();if(!msg)return;field.disabled=true;try{current=await request('send',msg);chatDraft='';draw(current)}catch(e){field.disabled=false;field.title=e.message}};}
 $('game-message')?.addEventListener('input',e=>chatDraft=e.target.value);
 const history=document.querySelector('.game-messages');if(history)history.scrollTop=history.scrollHeight;
}
// This frame is a display surface only; it has no message bridge or Tauri command access.
async function refresh(){if(document.activeElement===$('game-message'))return;try{const result=await request();if(!result?.game||!isSafePublishedGameUrl(result.game.url))throw Error('Unsafe catalog entry');if(!current||JSON.stringify(result)!==JSON.stringify(current)){current=result;draw(result)}}catch(e){if(!current)host.textContent='Unable to open game: '+e.message;}}
await refresh();setInterval(refresh,7000);
