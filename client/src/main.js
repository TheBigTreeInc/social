import './style.css';
import {LooprdSocial,discoverGames,discoverSocial,loginSocial,registerSocial,componentPath,gameActivity,newTurnKeys} from './protocol.js';
import {readConfig,writeConfig,selectServerGames,seenStorageKey,previousTurnKeys} from './persistence.js';
import {loadRememberedSession,saveRememberedSession,clearRememberedSession,isPersistentSession} from './session-store.js';
import {grantNotifications,notificationPermissionStatus,sendTestNotification,notifyTurn,notifyChat,notifyFriendRequest} from './notifications.js';
import {pushPreferencesKey,readPushPreferences,savePushPreferences,parsePushCapabilities,pushReadiness} from './push-readiness.js';
import {createResumeSync} from './resume-sync.js';
import {createPushWakeupBridge} from './push-bridge.js';
import {readStateKey,loadChatReadState,saveChatReadState,reconcileDirectFeed,acknowledgeDirectFeed,chatPollPeers,reconcileConversationSummary,notificationPrefsKey,loadNotificationPrefs,saveNotificationPrefs} from './message-state.js';
import {isTauri} from '@tauri-apps/api/core';
import {WebviewWindow} from '@tauri-apps/api/webviewWindow';
import {listen, emitTo} from '@tauri-apps/api/event';
import {isValidChatPeer,chatWindowLabel} from './native-windows.js';
import {openUrl} from '@tauri-apps/plugin-opener';

const CLIENT_VERSION='0.3.22';
const app=document.getElementById('app');
const nativeDesktop=isTauri() && !/Android|iPad|iPhone/i.test(navigator.userAgent);
const clientPlatform=nativeDesktop?'windows':isTauri()&&/Android/i.test(navigator.userAgent)?'android':'web';
if(nativeDesktop)document.documentElement.classList.add('native-shell');
const config=readConfig();
const state={authError:'',friendError:'',api:null,profile:null,revision:0,connected:false,serverStatus:'',serverSupportsAccounts:false,
  step:'server',authTab:'register',panel:'messenger',peer:'lobby',contacts:[],lobby:[],direct:[],
  interactions:[],interactionError:'',selectedInteraction:null,inboxFilter:'open',turns:[],gameErrors:{},catalog:[],catalogError:'',gameTokens:new Map(),toast:'',mute:false,draft:'',selectedGame:'',avatarCode:'',busy:false,
  developerAllowed:false,developerVisible:false,developerInfo:null,developerError:'',lastSyncAt:null,pulseState:'disconnected',mobileRoster:true,restoring:false,chatRead:{},unread:{},peerFeeds:new Map(),chatOffset:0,conversationSummaries:[],summarySupported:null,pendingAcks:new Map(),pendingRequestIds:null,notifyPrefs:{messages:true,preview:false,requests:true},pushPrefs:{backgroundEnabled:false},pushCapability:null,pushPermission:'unknown',rosterGroups:{online:true,offline:true,requests:true,pending:true,conversations:true}};
let poll=null,pulse=null,connecting=false,polling=false,toastTimer=null;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stamp=sec=>new Date(sec*1000).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
const initial=name=>esc((name||'?').slice(0,1).toUpperCase());
const nameOf=peer=>state.contacts.find(x=>x.id===peer)?.username||peer;
const unreadTotal=()=>Object.values(state.unread).reduce((n,x)=>n+(Number(x)||0),0);
const pushKey=()=>pushPreferencesKey(state.api.origin,state.profile.profileId);
function backgroundPushState(){return pushReadiness({platform:clientPlatform,preference:state.pushPrefs.backgroundEnabled,capability:state.pushCapability,permission:state.pushPermission,nativeAdapter:false});}
async function refreshPushReadiness(){const api=state.api;if(!api)return;try{const [capability,permission]=await Promise.all([api.command('capabilities'),notificationPermissionStatus()]);if(api!==state.api)return;state.pushCapability=parsePushCapabilities(capability);state.pushPermission=permission;}catch{if(api!==state.api)return;state.pushCapability=null;state.pushPermission=await notificationPermissionStatus();}if(state.panel==='settings')render();}
const readKey=()=>readStateKey(state.api.origin,state.profile.profileId);
function storeRead(){try{saveChatReadState(localStorage,readKey(),state.chatRead);}catch{}}
function markRead(peer,messages){
 if(!state.api||peer==='lobby'||!Array.isArray(messages)||!messages.length)return;
 const next=acknowledgeDirectFeed(messages,state.chatRead[peer]);
 if(next.read<=safeRead(state.chatRead[peer]?.read))return;
 state.chatRead[peer]=next;state.unread[peer]=0;storeRead();
 if(state.summarySupported)void pushRead(state.api,peer,next.read);
}
const safeRead=id=>Number.isSafeInteger(id)&&id>0?id:0;
async function pushRead(api,peer,id){
 if(!id||api!==state.api||!state.summarySupported)return;
 const current=state.pendingAcks.get(peer)||0;
 if(current>=id)return;
 state.pendingAcks.set(peer,id);
 try{await api.markDirectRead(peer,id);}catch(err){if(api===state.api){state.pendingAcks.delete(peer);console.warn('Read state sync failed:',err.message);}}
 finally{if(state.pendingAcks.get(peer)===id)state.pendingAcks.delete(peer);}
}

const peerVisible=peer=>!nativeDesktop && state.panel==='messenger' && state.peer===peer && !state.mobileRoster && document.visibilityState!=='hidden';
const toast=(msg)=>{state.toast=String(msg);render();clearTimeout(toastTimer);toastTimer=setTimeout(()=>{state.toast='';render();},5000)};
function avatar(name,online=false){return `<span class="avatar ${online?'active':''}">${initial(name)}</span>`;}
function header(){return `<header class="top"><span class="brand-icon" aria-hidden="true"></span><strong>Tavi</strong><span class="top-version">Games &amp; friends</span><span class="server-chip"><span class="presence ${state.connected?'online':''}"></span>${state.connected?esc(new URL(state.api.origin).host):'Disconnected'}</span><button type="button" class="chrome-button" data-action="settings" title="Options" aria-label="Options">⚙</button></header>`;}
function menuBar(compact=false){return `<nav class="menubar" aria-label="Messenger menu"><details class="menu-drop"><summary>File</summary><div class="menu-options"><button data-action="settings">Options…</button><button data-action="signout">Sign out</button></div></details><details class="menu-drop"><summary>Contacts</summary><div class="menu-options"><button data-action="contacts">Contact list</button><button data-action="add-friend">Add a contact…</button></div></details><details class="menu-drop"><summary>Actions</summary><div class="menu-options"><button data-action="messenger">Conversations</button><button data-action="games">Games &amp; alerts</button><button data-action="inbox">Interactive inbox</button><button data-action="notifications">Enable alerts</button></div></details><details class="menu-drop"><summary>Tools</summary><div class="menu-options"><button data-action="portrait">Change portrait…</button><button data-action="settings">Settings…</button>${state.developerAllowed&&state.developerVisible?'<button data-action="developer">Admin / Debug</button>':''}</div></details><details class="menu-drop"><summary>Help</summary><div class="menu-options"><button data-action="about">About Tavi</button></div></details></nav>`;}
function windowCaption(title,actions=''){return `<div class="window-titlebar"><span class="caption-mark" aria-hidden="true"></span><strong>${esc(title)}</strong><span class="window-actions">${actions}</span></div>`;}
function signIn(){return `<div class="login-desktop"><section class="welcome classic-window" aria-label="Sign in to Tavi">${windowCaption('Tavi · Sign in')}<nav class="menubar" aria-label="Sign in menu"><button class="auth-menu-action" type="button" data-action="about">Help</button></nav><div class="welcome-body"><div class="welcome-icon" aria-hidden="true"><span class="welcome-mark"></span></div><div class="welcome-brand">Tavi</div><p class="welcome-caption">Games. Friends. Together.</p><form id="server-form" class="auth-form"><label>LoopRD server address<input name="server" type="url" placeholder="https://your-server.example" required value="${esc(config.server)}" autocomplete="url"></label><div class="right-actions"><button class="solid" ${connecting?'disabled':''}>Connect…</button></div></form>${state.serverStatus?`<div class="notice" role="status">${esc(state.serverStatus)}</div>`:''}${state.step==='account'?`<div class="loginbox"><div class="switch"><button type="button" data-auth="login" class="${state.authTab==='login'?'picked':''}">Sign in</button><button type="button" data-auth="register" class="${state.authTab==='register'?'picked':''}">Create account</button></div><form id="auth-form" class="auth-form"><label>Username<input name="username" minlength="3" maxlength="24" required autocomplete="username" placeholder="Username"></label><label>Password<input name="password" type="password" minlength="12" maxlength="128" required autocomplete="${state.authTab==='register'?'new-password':'current-password'}"></label><label class="remember-device"><input name="remember" type="checkbox" value="yes"> Keep me signed in on this device</label><p class="small-help">Use 3–24 lowercase letters, digits or underscores; start with a letter. Password: 12–128 characters.</p>${state.authError?`<p class="notice" role="alert">${esc(state.authError)}</p>`:''}<div class="right-actions"><button class="solid" ${connecting?'disabled':''}>${state.authTab==='register'?'Create account':'Sign in'}</button></div></form><p class="small-help">Remembering this device saves a revocable sign-in token locally, never your password. Only enable it on a trusted device.</p><p class="small-help">Accounts and chats belong to the Social component on this server. No developer token or external identity provider needed.</p></div>`:''}</div><div class="window-status">${state.step==='account'?'Server found — sign in or create an account':'Enter your community server to continue'}</div></section></div>`;}
function buddyRow(peer){const isCurrent=state.peer===peer.id&&state.panel==='messenger';const badge=peer.status==='pending'?peer.direction==='incoming'?'Wants to add you':'Invitation sent':peer.online?'Online':'Offline';const unread=peer.status==='accepted'?(state.unread[peer.id]||0):0;const summary=state.conversationSummaries.find(x=>x.peer===peer.id);const preview=summary?.latest?(state.notifyPrefs.preview?String(summary.latest.text).slice(0,65):'Recent message · '+stamp(summary.latest.at)):'';return `<button class="buddy ${isCurrent?'chosen':''}" data-peer="${esc(peer.id)}" data-contact-name="${esc(peer.username.toLowerCase())}">${avatar(peer.username,peer.online&&peer.status==='accepted')}<span class="buddy-copy"><strong>${esc(peer.username)}</strong><small>${esc(preview||badge)}</small></span>${unread?`<span class="unread-badge" aria-label="${unread} unread messages">${unread===99?'99+':unread}</span>`:''}${peer.status==='pending'&&peer.direction==='incoming'?'<span class="req-badge">!</span>':''}</button>`;}
function rosterGroup(id,title,peers,empty=''){return `<div class="roster-group"><button type="button" class="group-title" data-group="${id}" aria-expanded="${state.rosterGroups[id]!==false?'true':'false'}"><span class="arrow">${state.rosterGroups[id]!==false?'▾':'▸'}</span>${esc(title)} (${peers.length})</button><div class="group-entries" ${state.rosterGroups[id]===false?'hidden':''}>${peers.map(buddyRow).join('')||`<span class="empty-buddies">${esc(empty)}</span>`}</div></div>`;}
function compactGames(){const turns=state.turns.filter(t=>t.status==='your-turn');return `<div class="games-strip"><div class="roster-label"><strong>My Games</strong><button data-action="add-game" title="Add game component" aria-label="Add game component">＋</button></div>${config.games.length?config.games.map(game=>`<button type="button" class="mini-game" data-game="${esc(game)}"><span aria-hidden="true">♟</span><span>${esc(game)}</span><small>${state.turns.filter(t=>t.game===game&&t.status==='your-turn').length||''}</small></button>`).join(''):'<p class="roster-note">Add a game to watch your turns.</p>'}${turns.slice(0,3).map(t=>`<button class="mini-alert" data-route="${esc(t.path||'')}" ${!t.path?'disabled':''}><span class="alert-dot">!</span>${esc(t.title)}</button>`).join('')}<div class="roster-quick"><button data-action="games">Games</button><button data-action="notifications">Turn alerts</button></div></div>`;}
function contactPane(){const accepted=state.contacts.filter(x=>x.status==='accepted');const recent=state.conversationSummaries.filter(x=>x.latest).map(x=>state.contacts.find(c=>c.id===x.peer)).filter(Boolean);const recentIds=new Set(recent.map(c=>c.id));const online=accepted.filter(x=>x.online&&!recentIds.has(x.id)),offline=accepted.filter(x=>!x.online&&!recentIds.has(x.id));const incoming=state.contacts.filter(x=>x.status==='pending'&&x.direction==='incoming');const pending=state.contacts.filter(x=>x.status==='pending'&&x.direction==='outgoing');return `<aside class="classic-window roster-window ${state.mobileRoster?'mobile-active':''}" aria-label="Contact list">${windowCaption('Tavi', '<button class="chrome-button" data-action="settings" title="Settings">⚙</button>')}${menuBar()}<div class="roster-profile">${avatar(state.profile?.displayName||'Me',true)}<div><strong>${esc(state.profile?.displayName||'Me')}</strong><small><span class="presence online"></span>Available</small><span class="personal-message">${esc(state.profile?.profileId||'')} · ${esc(new URL(state.api.origin).host)}</span></div><button title="Edit profile" data-action="settings" class="chrome-button">▾</button></div><div class="roster-toolbar"><button data-action="add-friend" title="Add a contact"><span>♧</span> Add</button><button data-action="messenger" title="Open lobby"><span>✉</span> Chat${unreadTotal()?` (${unreadTotal()})`:``}</button><button data-action="portrait" title="Your portrait"><span>☺</span> Picture</button><button data-action="inbox" title="Interactive notifications"><span>✉</span> Inbox${state.interactions.filter(e=>e.status==='open').length?` (${state.interactions.filter(e=>e.status==='open').length})`:``}</button><button data-action="refresh" title="Refresh"><span>⟳</span> Sync</button></div><div class="roster-search"><span aria-hidden="true">⌕</span><input type="search" id="roster-filter" aria-label="Find a contact" placeholder="Search for a contact…" autocomplete="off"></div><div class="roster-scroll"><div class="roster-group"><button type="button" class="group-title" data-group="conversations" aria-expanded="${state.rosterGroups.conversations!==false}"><span class="arrow">${state.rosterGroups.conversations!==false?'▾':'▸'}</span>Conversations</button><div class="group-entries" ${state.rosterGroups.conversations===false?'hidden':''}><button data-peer="lobby" data-contact-name="community lobby" class="buddy ${state.peer==='lobby'&&state.panel==='messenger'?'chosen':''}"><span class="avatar lobby-icon">✉</span><span class="buddy-copy"><strong>Community Lobby</strong><small>Public server chat</small></span></button>${recent.map(buddyRow).join('')}</div></div>${rosterGroup('online','Online',online,'No friends online')}${rosterGroup('offline','Offline',offline,'No offline contacts')}${incoming.length?rosterGroup('requests','Friend requests',incoming):''}${pending.length?rosterGroup('pending','Pending',pending):''}</div>${compactGames()}<div class="window-status"><span class="presence online"></span>${online.length} online · ${accepted.length} contacts · ${unreadTotal()} unread<span class="status-right">Social connected</span></div></aside>`;}
function activePeer(){return state.contacts.find(x=>x.id===state.peer);}
function conversation(){const peer=activePeer();const lobby=state.peer==='lobby';const pending=!lobby&&peer?.status!=='accepted';const messages=lobby?state.lobby:state.direct;const title=lobby?'Community Lobby':(peer?.username||'Conversation');return `<section class="conversation classic-window" aria-label="Conversation with ${esc(title)}">${windowCaption(title+' – Conversation', '<button data-action="contacts" class="chrome-button mobile-back" title="Contacts">←</button>')}${menuBar(true)}<div class="conversation-tools"><button data-action="add-friend"><span>♧</span> Invite</button><button data-action="games"><span>♟</span> Games</button><button data-action="notifications"><span>♬</span> Alerts</button><button data-action="portrait"><span>☺</span> Picture</button>${!lobby&&peer?'<button data-action="remove-friend"><span>×</span> Remove</button>':''}</div><div class="chat-heading"><div class="chat-heading-left">${avatar(lobby?'#':title,peer?.online)}<div><h2>${esc(title)}</h2><small>${lobby?'Shared conversation on this server':pending?'Contact invitation pending':peer?.online?'Online':'Offline'}</small></div></div></div>${pending?`<div class="request-panel"><h3>${peer?.direction==='incoming'?'Friend request received':'Friend request sent'}</h3><p>${peer?.direction==='incoming'?'Accept to start a private conversation.':'Waiting for your friend to accept.'}</p>${peer?.direction==='incoming'?'<button class="solid" data-action="accept-friend">Accept request</button>':''}</div>`:`<div class="chat-content"><div class="chat-scroll" id="chat-scroll" role="log" aria-label="Messages" aria-live="off">${messages.length?messages.map(m=>{const mine=m.authorId===state.profile?.profileId;return `<div class="transcript-message"><div class="transcript-heading"><strong class="${mine?'mine':''}">${mine?'You':esc(m.displayName||title)}</strong><time>${stamp(m.at)}</time></div><div class="transcript-text">${esc(m.text)}</div></div>`;}).join(''):'<div class="empty-chat"><strong>Welcome to this conversation</strong><p>Messages will appear here.</p></div>'}</div><div class="participant-pane"><div class="participant-avatar">${avatar(lobby?'#':title,peer?.online)}</div><span>${esc(lobby?'Lobby':title)}</span><small>${lobby?'Community':peer?.online?'Online':'Contact'}</small></div></div><div class="compose-toolbar"><button title="Message formatting" type="button" data-action="format-help"><b style="font-family:Georgia,serif;font-size:17px">A</b> ▾</button><button type="button" data-action="portrait" title="Character portrait">☺ ▾</button><span>Enter to send · Shift+Enter for a new line</span></div><form id="message-form" class="composer"><textarea name="message" id="message" rows="3" maxlength="${lobby?'320':'1000'}" placeholder="Type your message here…" required>${esc(state.draft)}</textarea><div class="send-controls"><button class="solid" ${state.busy?'disabled':''}>Send</button></div></form>`}<div class="window-status"><span class="presence ${lobby||peer?.online?'online':''}"></span>${esc(lobby?'Public server lobby':'Private message')}${state.lastSyncAt?`<span class="status-right">Last update ${new Date(state.lastSyncAt).toLocaleTimeString()}</span>`:''}</div></section>`;}
function addFriend(){return `<section class="utility"><h2>Add a friend</h2><p>Find someone on this Tavi server by username. Federation between servers is planned, but not enabled yet.</p><form id="friend-form" class="auth-form"><label>Friend's username<input name="username" required minlength="3" maxlength="24" pattern="[a-z][a-z0-9_]{2,23}" placeholder="e.g. alex_42" autocomplete="off"></label>${state.friendError?`<p class="notice" role="alert">${esc(state.friendError)}</p>`:''}<div class="row-actions"><button class="solid">Send friend request</button><button type="button" data-action="contacts">Cancel</button></div></form><p class="fineprint">Friends must accept before private messages become available. A username on a different server cannot be added yet.</p></section>`;}
function gameSettings(){return `<section class="utility"><h2>Games on this server</h2><p>Your server decides which games to promote. Select Play in Tavi for a separate game window and persistent Tavi lobby chat.</p>${state.catalogError?`<p class="notice" role="alert">${esc(state.catalogError)}</p>`:''}${state.catalog.length?state.catalog.map(g=>`<div class="utility-row"><span>♟ &nbsp; <strong>${esc(g.name)}</strong></span><span>${g.embedded?'Browser game':'External browser only'}</span>${g.embedded?`<button data-launch-game="${esc(g.id)}">Play in Tavi</button>`:''}<button data-open-promoted="${esc(g.id)}">Open browser</button></div>`).join(''):'<p>No games are currently promoted by this server.</p>'}<h3>Turn monitoring</h3><div class="row-actions"><button data-action="add-game">+ Add component</button><button data-action="notifications">Enable notifications</button></div>${config.games.map(g=>`<div class="utility-row"><span>${esc(g)}</span><span>${esc(state.gameErrors[g]||'Monitoring')}</span><button data-game-token="${esc(g)}">Credential</button><button data-remove-game="${esc(g)}">Remove</button></div>`).join('')}<p class="fineprint">Game sessions do not receive your Social token. Native game launching and overlays are future work.</p></section>`;}
function portrait(){return `<section class="utility portrait"><h2>Your character</h2><p>Portraits use the latest metadata from the official Portrait Library; the generator's executable source is reviewed and pinned to an upstream revision.</p><iframe title="Character portrait workshop" id="portrait-frame" src="./portrait/index.html" loading="lazy"></iframe><p>Portrait code saved in your Social profile: <code>${esc(state.avatarCode||'Not set')}</code></p></section>`;}
function inbox(){
 const filter=state.inboxFilter;
 const selected=state.interactions.find(e=>e.id===state.selectedInteraction);
 const open=state.interactions.filter(e=>e.status==='open').length;
 const visible=state.interactions.filter(e=>filter==='all'||(filter==='open'?e.status==='open':e.status!=='open'));
 return `<section class="interaction-inbox" aria-label="Interactive inbox"><div class="inbox-header"><h2>Inbox <span class="inbox-counter">${open}</span></h2><button type="button" data-action="refresh" title="Refresh inbox">↻ Refresh</button></div><p class="fineprint">Requests from ${esc(new URL(state.api.origin).host)}. Permissions are checked on each action.</p><div class="inbox-filters" role="group" aria-label="Filter notifications">${[['open','Needs action'],['history','History'],['all','All']].map(([id,title])=>`<button type="button" data-inbox-filter="${id}" aria-pressed="${filter===id}" class="${filter===id?'picked':''}">${title}</button>`).join('')}</div>${state.interactionError?`<p class="notice" role="alert">${esc(state.interactionError)}</p>`:''}<div class="interaction-list">${visible.length?visible.map(e=>`<button type="button" class="interaction-entry ${selected?.id===e.id?'chosen':''}" data-interaction="${e.id}" aria-expanded="${selected?.id===e.id}"><span><strong>${esc(e.title)}</strong><small>${esc(e.topic)} · ${esc(e.status)} · ${new Date(e.created*1000).toLocaleDateString()}</small></span><span>›</span></button>`).join(''):'<p class="fineprint">No notifications in this view.</p>'}</div>${selected?interactionDetail(selected):''}</section>`;
}
function interactionDetail(e){
 const active=e.status==='open';
 return `<div class="interaction-detail"><h3>${esc(e.title)}</h3><p>${esc(e.body||'')}</p><p class="fineprint">From ${esc(e.publisher)} · ${esc(e.status)} · Expires ${esc(new Date(e.expires*1000).toLocaleString())}</p>${active?'<div class="interaction-commands"><button type="button" data-interaction-dismiss="'+e.id+'">Dismiss</button></div>':''}${active?(e.actions||[]).map(a=>a.type==='reply'?`<form class="interaction-reply" data-interaction-reply="${e.id}" data-reply-action="${esc(a.id)}"><h4>${esc(a.label)}</h4>${(a.fields||[]).map(field=>`<label>${esc(field.label)}${field.type==='select'?`<select name="${esc(field.id)}">${field.options.map(opt=>`<option value="${esc(opt)}">${esc(opt)}</option>`).join('')}</select>`:field.type==='textarea'?`<textarea name="${esc(field.id)}" maxlength="2000"></textarea>`:`<input name="${esc(field.id)}" maxlength="2000">`}</label>`).join('')}<button class="solid" type="submit">${esc(a.label)}</button></form>`:`<button type="button" class="interaction-link" data-interaction-link="${e.id}" data-link-action="${esc(a.id)}">${esc(a.label)} ↗</button>`).join(''):'<p class="fineprint">This interaction can no longer be answered.</p>'}</div>`;
}
function settings(){return `<section class="utility"><h2>Settings &amp; account</h2><p>Signed in as <b>${esc(state.profile?.profileId)}</b> on <b>${esc(state.api?.origin)}</b>.</p><p class="fineprint">Remember this device: <b>${isPersistentSession()?'On':'Off'}</b>. Sign out revokes this device session. Other devices retain separate sessions.</p><form id="profile-form" class="auth-form"><label>Display name<input name="displayName" maxlength="24" required value="${esc(state.profile?.displayName)}"></label><button class="solid">Save profile</button></form><div class="notification-options"><h3>Chat notifications</h3><label><input type="checkbox" data-notify-pref="messages" ${state.notifyPrefs.messages?'checked':''}> Private messages</label><label><input type="checkbox" data-notify-pref="requests" ${state.notifyPrefs.requests?'checked':''}> Friend requests</label><label><input type="checkbox" data-notify-pref="preview" ${state.notifyPrefs.preview?'checked':''}> Show message previews on lock screen</label><p class="fineprint">System notifications require permission. Android and desktop alerts work while Tavi is running.</p></div><div class="notification-options push-readiness"><h3>Background delivery (UnifiedPush / Web Push)</h3><label><input type="checkbox" id="push-opt-in" ${state.pushPrefs.backgroundEnabled?'checked':''}> Remember my preference for background alerts on this device</label><p class="push-status" role="status">${esc(backgroundPushState().label)}</p><p class="fineprint">${clientPlatform==='android'?'LoopRD now provides enrollment and verification APIs. Android still needs an installed UnifiedPush distributor adapter to obtain an endpoint.':'This setting does not install a push service or enable background delivery.'} No endpoint is registered until a distributor provides one and you explicitly enable background alerts. Messages and credentials never travel in push payloads.</p><div class="row-actions"><button type="button" data-action="push-check">Check push support</button><button type="button" data-action="test-notification">Test OS notification</button></div></div><div class="row-actions"><button data-action="notifications">Enable OS notifications</button><button data-action="toggle-mute">${state.mute?'Unmute':'Mute'} alerts</button><button data-action="remember-device">${isPersistentSession()?'Stop remembering this device':'Remember this device'}</button><button data-action="signout">Sign out of this device</button></div>${state.developerAllowed?`<div class="dev-toggle"><label class="dev-switch"><input id="developer-switch" type="checkbox" ${state.developerVisible?'checked':''}><span>Show developer tools</span></label><p>Access is granted by the Social server operator. This switch only controls visibility; it does not grant permission.</p></div>`:''}<p class="fineprint">You can log into the same account on a second device using its own session. Your password is never saved. A remembered device stores a revocable session token in this client's local storage. This does not sign you in to unrelated websites or games. There is no OIDC requirement.</p></section>`;}
function developerPanel(){
 if(!state.developerAllowed || !state.developerVisible) return settings();
 const info=state.developerInfo;
 const status=state.developerError?`<p class="dev-error" role="alert">${esc(state.developerError)}</p>`:'';
 const count=(label,value)=>`<div class="dev-stat"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;
 return `<section class="utility dev-panel"><div class="dev-head"><div><h2>Admin / Debug</h2><p>Authorized diagnostics for this Social component. Read-only; no LoopRD administrator access.</p></div><button data-action="developer-refresh">↻ Refresh</button></div>
 <div class="dev-stats">
 ${count('Social connection',state.connected?'connected':'offline')}
 ${count('LoopRD server',state.api?.origin||'—')}
 ${count('Client app',CLIENT_VERSION)}${count('Social release',info.release)}
 ${count('WebSocket',state.pulseState)}
 ${count('Last client sync',state.lastSyncAt?new Date(state.lastSyncAt).toLocaleString():'Not yet')}
 ${count('Configured games',config.games.length)}
 ${count('Game API failures',Object.keys(state.gameErrors).length)}
 </div>
 <h3>Server diagnostics</h3>${status}
 ${info?`<div class="dev-stats">
 ${count('Component',info.component)}${count('Release',info.release)}${count('Platform API',info.apiVersion)}
 ${count('Social schema',info.databaseSchemaVersion)}${count('Server time',new Date(info.serverTime*1000).toLocaleString())}
 ${Object.entries(info.counts).map(([key,value])=>count(key,value)).join('')}
 </div><p class="fineprint">Available capabilities: ${esc(info.features.join(', '))}</p>`:'<p class="fineprint">Use Refresh to retrieve permitted server diagnostics.</p>'}
 <p class="fineprint">Passwords, session tokens, direct messages, environment variables and LoopRD management keys are never returned by this endpoint.</p>
 </section>`;
}
function updateDeveloperPermission(me){
 const allowed=me?.permissions?.developer===true;
 state.developerAllowed=allowed;
 if(!allowed){state.developerVisible=false;state.developerInfo=null;state.developerError='';if(state.panel==='developer')state.panel='settings';}
}
async function updateDeveloperInfo(){
 if(!state.api||!state.developerAllowed||!state.developerVisible)return;
 const api=state.api;
 try {const info=await api.developerDiagnostics();if(state.api===api) {state.developerInfo=info;state.developerError='';}}
 catch(e){if(state.api!==api)return;state.developerInfo=null;state.developerError=e.message;
   if(e.status===403||/DEVELOPER_ACCESS_DENIED/.test(e.message)) {state.developerAllowed=false;state.developerVisible=false;state.developerError='';if(state.panel==='developer')state.panel='settings';}}
}
function dashboard(){
 const chatting=state.panel==='messenger';
 const body=chatting?conversation():`<section class="classic-window auxiliary-window">${windowCaption(({games:'Games & turn alerts',inbox:'Interactive inbox',portrait:'Your character',settings:'Options',developer:'Admin / Debug'})[state.panel]||'Social')} ${menuBar()}<div class="aux-content">${state.panel==='add-friend'?addFriend():state.panel==='inbox'?inbox():state.panel==='games'?gameSettings():state.panel==='portrait'?portrait():state.panel==='settings'?settings():developerPanel()}</div><div class="window-status">Tavi · ${esc(state.api?.origin||'')}</div></section>`;
 // A real Windows messenger is a narrow, independent buddy list, NOT a fixed 1060px dashboard.
 // Conversations are separate OS webview windows. Browser/mobile retain the shared responsive UI.
 if(nativeDesktop)return `<div class="desktop-workspace native-workspace">${chatting?contactPane():`<section class="classic-window auxiliary-window">${windowCaption('Tavi · '+state.panel, '<button data-action="contacts" class="chrome-button">← Contacts</button>')}${menuBar()}<div class="aux-content">${state.panel==='add-friend'?addFriend():state.panel==='inbox'?inbox():state.panel==='games'?gameSettings():state.panel==='portrait'?portrait():state.panel==='settings'?settings():developerPanel()}</div></section>`}</div>`;
 return `<div class="desktop-workspace"><div class="messenger ${state.mobileRoster?'show-roster':'show-conversation'}">${contactPane()}<main class="center">${body}</main></div><nav class="bottom-nav" aria-label="Mobile navigation"><button data-action="contacts" class="${state.mobileRoster?'on':''}">Contacts</button><button data-action="messenger" class="${!state.mobileRoster&&chatting?'on':''}">Chat${unreadTotal()?` · ${unreadTotal()}`:``}</button><button data-action="games" class="${state.panel==='games'?'on':''}">Games</button><button data-action="settings" class="${state.panel==='settings'?'on':''}">Options</button></nav></div>`;
}
function render(){const entry=document.getElementById('message');if(entry&&document.activeElement===entry)state.draft=entry.value;const oldFrame=document.getElementById('portrait-frame');const filter=document.getElementById('roster-filter');const search=filter?.value||'';const focused=document.activeElement===entry?{start:entry.selectionStart,end:entry.selectionEnd}:null;const oldScroll=document.getElementById('chat-scroll');const nearBottom=!oldScroll||oldScroll.scrollHeight-oldScroll.scrollTop-oldScroll.clientHeight<90;const oldTop=oldScroll?.scrollTop;document.title=unreadTotal()?`(${unreadTotal()}) Tavi`:'Tavi';app.innerHTML=(nativeDesktop?'':header())+(state.connected?dashboard():signIn())+(state.toast?`<div class="toast" role="status">${esc(state.toast)}</div>`:'');if(oldFrame&&state.panel==='portrait')document.getElementById('portrait-frame')?.replaceWith(oldFrame);wire();const newFilter=document.getElementById('roster-filter');if(newFilter){newFilter.value=search;applyContactFilter(search);}if(focused){const field=document.getElementById('message');if(field){field.focus();field.setSelectionRange(focused.start,focused.end);}}if(state.panel==='messenger'){const scroll=document.getElementById('chat-scroll');if(scroll){scroll.scrollTop=nearBottom?scroll.scrollHeight:oldTop;}}}
function applyContactFilter(query){const term=query.trim().toLowerCase();document.querySelectorAll('[data-contact-name]').forEach(node=>{node.hidden=!!term&&!node.dataset.contactName.includes(term);});}
function stop(){if(pulse){pulse.onclose=null;pulse.close();pulse=null;}clearInterval(poll);poll=null;state.api=null;state.connected=false;state.profile=null;state.lobby=[];state.direct=[];state.contacts=[];state.avatarCode='';state.gameTokens.clear();state.turns=[];state.interactions=[];state.selectedInteraction=null;state.interactionError='';state.catalog=[];state.catalogError='';state.draft='';state.developerAllowed=false;state.developerVisible=false;state.developerInfo=null;state.developerError='';state.lastSyncAt=null;state.pulseState='disconnected';state.chatRead={};state.unread={};state.peerFeeds.clear();state.chatOffset=0;state.conversationSummaries=[];state.summarySupported=null;state.pendingAcks.clear();state.pendingRequestIds=null;state.notifyPrefs={messages:true,preview:false,requests:true};state.pushPrefs={backgroundEnabled:false};state.pushCapability=null;state.pushPermission='unknown';state.step='server';state.panel='messenger';state.mobileRoster=true;render();}
async function activate(api){const me=await api.me();if(!me?.profile?.profileId)throw Error('Social did not return your profile');stop();state.api=api;state.connected=true;state.profile=me.profile;state.revision=me.revision;updateDeveloperPermission(me);state.avatarCode=me.profile.portraitCode||'';selectServerGames(config,api.origin);writeConfig(config);state.peer='lobby';state.mobileRoster=true;try{state.chatRead=loadChatReadState(localStorage,readKey());state.notifyPrefs=loadNotificationPrefs(localStorage,notificationPrefsKey(api.origin,me.profile.profileId));state.pushPrefs=readPushPreferences(localStorage,pushKey());}catch{}render();void refreshPushReadiness();await loadCatalog();await refresh();startPulse();poll=setInterval(refresh,25000);}
async function refresh(){if(!state.api||polling)return;polling=true;try{const api=state.api;
 const me=await api.me();if(api!==state.api)return;updateDeveloperPermission(me);
 const [lobby,contacts]=await Promise.all([api.feed(),api.contacts()]);if(api!==state.api)return;
 state.lastSyncAt=Date.now();
 if(state.developerVisible && state.panel==='developer')await updateDeveloperInfo();
 state.lobby=lobby.messages||[];state.contacts=contacts.contacts||[];await synchronizeMailbox(api);if(api!==state.api)return;
 const incoming=state.contacts.filter(c=>c.status==='pending'&&c.direction==='incoming').map(c=>c.id);
 if(state.pendingRequestIds!==null&&!state.mute&&state.notifyPrefs.requests){for(const c of state.contacts){if(incoming.includes(c.id)&&!state.pendingRequestIds.includes(c.id))void notifyFriendRequest(c.username);}}
 state.pendingRequestIds=incoming;
 try {const result=await api.interactions();if(api===state.api)state.interactions=result.events||[];state.interactionError='';}catch(e){state.interactionError='Interactive inbox unavailable: '+e.message;}
 if(state.peer!=='lobby'&&activePeer()?.status==='accepted'){const messages=state.peerFeeds.get(state.peer);state.direct=messages||[];}
 else state.direct=[];
 let turns=[],errors={};for(const game of config.games){try{const {turns:feed}=await gameActivity(api.origin,game,state.gameTokens.get(game)||'');const active=feed.map(x=>({...x,game}));turns.push(...active);const key=seenStorageKey(api.origin,game,state.profile.profileId);const saved=previousTurnKeys(localStorage,key);const {newIds,activeIds}=newTurnKeys(active,saved);for(const id of newIds)if(!state.mute){const t=active.find(x=>x.id===id);await notifyTurn('Your turn · '+game,t.title);}localStorage.setItem(key,JSON.stringify(activeIds));}catch(error){errors[game]=error.message;}}
 if(api===state.api){state.turns=turns;state.gameErrors=errors;render();}
 }catch(error){if(state.api)toast('Sync failed: '+error.message);}finally{polling=false;}}
/** Server-side summaries remove the O(number-of-friends) polling cost. On an
 * older server, preserve the v0.3.17 bounded scanner until it is upgraded.
 */
async function synchronizeMailbox(api){
 if(state.summarySupported!==false){
  try{
   const response=await api.conversations();
   if(response.schema!=='tavi.dm-summaries/v1'||!Array.isArray(response.conversations)||response.conversations.length>500)
     throw Error('Invalid conversation summary response');
   state.summarySupported=true;
   const accepted=new Set(state.contacts.filter(c=>c.status==='accepted').map(c=>c.id));
   state.conversationSummaries=[];
   const migrate=[];
   const nextUnread={};
   for(const item of response.conversations){
    if(!accepted.has(item.peer))continue;
    const old=state.chatRead[item.peer];
    const result=reconcileConversationSummary(item,state.profile.profileId,old,{visible:false});
    state.chatRead[item.peer]=result.cursor;
    nextUnread[item.peer]=result.unread;
    state.conversationSummaries.push(item);
    if(old?.read>item.readId)migrate.push({peer:item.peer,id:old.read});
    if(result.notification&&!state.mute&&state.notifyPrefs.messages)
     void notifyChat(nameOf(item.peer),result.notification.text,{preview:state.notifyPrefs.preview});
   }
   state.unread=nextUnread;storeRead();
   // Migration of existing local read markers is bounded to avoid flooding the server.
   for(const {peer,id} of migrate.slice(0,20))void pushRead(api,peer,id);
   // Use the full DM feed only for the conversation currently in view.
   if(state.peer!=='lobby'&&activePeer()?.status==='accepted'){
    const result=await api.directFeed(state.peer);
    if(api!==state.api)return;
    state.peerFeeds.set(state.peer,result.messages||[]);
    if(peerVisible(state.peer))markRead(state.peer,result.messages||[]);
   }
   return;
  }catch(e){
   if(api!==state.api)return;
   if(e.message==='Unknown operation'){
    state.summarySupported=false;state.conversationSummaries=[];
   }else{throw e;}
  }
 }
 await scanDirectMessages(api);
}
/** Poll accepted contacts in a rotating bounded batch. The current Social API has no
 * mailbox-summary endpoint, so this works while the client is active and never
 * sends more than 12 per-contact DM feed requests in a scan (+ active chat).
 */
async function scanDirectMessages(api){
 const batch=chatPollPeers(state.contacts,state.chatOffset,12);
 state.chatOffset=batch.nextOffset;
 const peers=[...batch.peers];
 if(state.peer!=='lobby'&&activePeer()?.status==='accepted'&&!peers.some(p=>p.id===state.peer))peers.push(activePeer());
 const results=await Promise.allSettled(peers.map(p=>api.directFeed(p.id)));
 if(api!==state.api)return;
 let dirty=false;
 for(let i=0;i<peers.length;i++){
  const result=results[i];if(result.status!=='fulfilled'||!Array.isArray(result.value?.messages))continue;
  const peer=peers[i],messages=result.value.messages;
  state.peerFeeds.set(peer.id,messages);
  const visible=peerVisible(peer.id);
  const prior=state.chatRead[peer.id];
  const reconciled=reconcileDirectFeed(messages,state.profile.profileId,prior,{visible});
  state.chatRead[peer.id]=reconciled.cursor;
  state.unread[peer.id]=reconciled.unread;
  dirty=true;
  if(reconciled.notification&&!state.mute&&state.notifyPrefs.messages){
   void notifyChat(peer.username,reconciled.notification.text,{preview:state.notifyPrefs.preview});
  }
 }
 if(dirty)storeRead();
}
const resumeForeground=createResumeSync(()=>refresh(),{minIntervalMs:4000});
document.addEventListener('visibilitychange',()=>resumeForeground({signedIn:!!state.api,visible:document.visibilityState==='visible'}));
globalThis.addEventListener?.('focus',()=>resumeForeground({signedIn:!!state.api,visible:document.visibilityState!=='hidden'}));
// Future Android UnifiedPush distributor plugin may forward a *content-free*
// wake hint through this trusted local event. The only operation is to ask the
// currently authenticated Social server for fresh state. No token in payload.
const pushWakeup=createPushWakeupBridge(()=>refresh());
if(clientPlatform==='android')void listen('tavi-push-wakeup',e=>pushWakeup(e.payload,{signedIn:!!state.api})).catch(()=>{});
function startPulse(){const api=state.api;let delay=1000;const open=async()=>{if(state.api!==api)return;let ws;try{const ticket=await api.pulseTicket();if(state.api!==api)return;ws=new WebSocket(api.pulseUrl()+'?ticket='+encodeURIComponent(ticket));}catch{state.pulseState='reconnecting';if(state.api===api)setTimeout(open,delay);delay=Math.min(delay*2,30000);return;}pulse=ws;state.pulseState='connecting';ws.onopen=()=>{state.pulseState='connected';delay=1000;ws.send(JSON.stringify({subscribe:'pulses'}));};ws.onmessage=e=>{try{if(JSON.parse(e.data).resource==='pulses')refresh();}catch{}};ws.onclose=()=>{state.pulseState='reconnecting';if(state.api===api){setTimeout(open,delay);delay=Math.min(delay*2,30000);}};};open();}
async function loadCatalog(){if(!state.api)return;const api=state.api;try{const games=await discoverGames(api.origin);if(state.api!==api)return;state.catalog=games;state.catalogError='';}catch(e){if(state.api!==api)return;state.catalog=[];state.catalogError='Game catalog unavailable: '+e.message;}render();}
let nativeGameBridgeReady=false;
async function initializeGameBridge(){
 if(!nativeDesktop||nativeGameBridgeReady)return;
 nativeGameBridgeReady=true;
 await listen('tavi-game-request',async e=>{
  const {label,gameId,kind,text,requestId}=e.payload||{};
  if(!/^[a-z][a-z0-9-]{1,47}$/.test(gameId||'')||label!=='game-'+gameId||!Number.isSafeInteger(requestId))return;
  try{
   const game=state.catalog.find(x=>x.id===gameId&&x.embedded);
   if(!state.api||!game)throw Error('Game is not published for this server.');
   if(kind==='send'){
    if(typeof text!=='string'||!text.trim()||text.length>320)throw Error('Invalid lobby message.');
    await state.api.send(text.trim());
   }else if(kind!=='snapshot')throw Error('Unsupported game action');
   const feed=await state.api.feed();
   await emitTo(label,'tavi-game-response',{requestId,ok:true,snapshot:{game,server:new URL(state.api.origin).host,messages:(feed.messages||[]).slice(-40)}});
  }catch(err){await emitTo(label,'tavi-game-response',{requestId,ok:false,error:err.message||'Game error'}).catch(()=>{});}
 });
}
async function launchPromoted(id,embedded){
 const game=state.catalog.find(g=>g.id===id);if(!game)return toast('Game no longer published by server.');
 if(!embedded||!game.embedded){return openExternalGame(game.url);}
 if(!nativeDesktop){return openExternalGame(game.url);}
 try{
  await initializeGameBridge();
  const label='game-'+id;
  const prior=await WebviewWindow.getByLabel(label);
  if(prior){await prior.setFocus();return;}
  const windowHandle=new WebviewWindow(label,{url:'game.html?game='+encodeURIComponent(id),title:game.name+' — Tavi',width:1100,height:730,minWidth:650,minHeight:480,resizable:true,center:true});
  windowHandle.once('tauri://error',e=>toast('Game window failed: '+String(e.payload)));
 }catch(e){toast('Unable to open game: '+e.message);}
}
async function openExternalGame(url){try{if(isTauri())await openUrl(url);else window.open(url,'_blank','noopener,noreferrer');}catch(e){toast('Could not open game: '+e.message);}}
async function openGame(path){if(!state.api||!path)return;const url=state.api.origin+path;try{if(isTauri())await openUrl(url);else window.open(url,'_blank','noopener,noreferrer');}catch{toast('Could not open game.');}}
async function action(name){if(name==='developer'){if(!state.developerAllowed||!state.developerVisible)return;state.panel=name;await updateDeveloperInfo();render();return;}
 if(name==='developer-refresh'){await updateDeveloperInfo();render();return;}
 if(name==='inbox'){state.panel='inbox';state.mobileRoster=false;render();return;}
 if(name==='contacts'){state.panel='messenger';state.mobileRoster=true;render();return;}
 if(name==='about'){toast('Tavi '+CLIENT_VERSION+' · powered by Social on LoopRD');return;}
 if(name==='format-help'){toast('Plain text messages · Shift+Enter inserts a new line.');return;}
 if(name==='settings'||name==='messenger'||name==='games'||name==='portrait'){if(name==='settings')void refreshPushReadiness();if(name==='messenger'&&nativeDesktop){await openChatWindow(state.peer||'lobby');return;}state.panel=name;state.mobileRoster=false;render();return;}
 if(name==='refresh'){await loadCatalog();return refresh();}
 if(name==='notifications'){const ok=await grantNotifications();state.pushPermission=await notificationPermissionStatus();toast(ok?'OS alerts enabled while Tavi is running.':'Notification permission not granted.');return;}
 if(name==='push-check'){
   await refreshPushReadiness();
   if(state.pushCapability && state.api){
    try{const list=await state.api.pushDevices();toast(`${(list.devices||[]).length} push device(s) registered. ${backgroundPushState().label}`);}
    catch(e){toast(`Push status: ${e.message}`);}
   }else toast(backgroundPushState().label);
   return;
 }
 if(name==='test-notification'){const ok=await sendTestNotification();state.pushPermission=await notificationPermissionStatus();toast(ok?'Test notification sent to the OS.':'Grant OS notification permission first.');return;}
 if(name==='toggle-mute'){state.mute=!state.mute;render();return;}
 if(name==='remember-device'){if(!state.api)return;const remember=!isPersistentSession();saveRememberedSession({origin:state.api.origin,token:state.api.token,profileId:state.profile.profileId,remember});toast(remember?'This device will stay signed in.':'Persistent sign-in disabled.');return;}
 if(name==='signout'){const api=state.api;clearRememberedSession();stop();try{await api?.logout();}catch{}toast('Signed out of this device.');return;}
 if(name==='add-friend'){state.panel='add-friend';state.mobileRoster=false;state.friendError='';render();return;}
 if(name==='accept-friend'){try{await state.api.acceptContact(state.peer);await refresh();}catch(e){toast(e.message);}return;}
 if(name==='remove-friend'){if(!confirm('Remove this contact?'))return;try{await state.api.removeContact(state.peer);state.peer='lobby';await refresh();}catch(e){toast(e.message);}return;}
 if(name==='add-game'){const game=prompt('Game component ID on this LoopRD server:');if(!game)return;try{componentPath(state.api.origin,game,'activity');if(!config.games.includes(game)){if(config.games.length>=20)throw Error('Maximum 20 game components');config.games.push(game);writeConfig(config);}await refresh();}catch(e){toast(e.message);}return;}}
async function openInteractionLink(eventId,actionId){
 const event=state.interactions.find(e=>e.id===eventId&&e.status==='open');
 const selected=event?.actions?.find(a=>a.id===actionId&&a.type==='open-url');
 if(!selected)return toast('This link is no longer available.');
 const {isSafePublishedGameUrl}=await import('./protocol.js');
 if(!isSafePublishedGameUrl(selected.url))return toast('Unsafe URL blocked.');
 // External sites never receive a Social bearer or an implied admin grant.
 // Until LoopRD supports scoped handoff, open links without SSO.
 await openExternalGame(selected.url);
}
function wire(){
 document.querySelectorAll('[data-notify-pref]').forEach(el=>el.addEventListener('change',()=>{const key=el.dataset.notifyPref;if(!['messages','preview','requests'].includes(key))return;state.notifyPrefs[key]=el.checked;saveNotificationPrefs(localStorage,notificationPrefsKey(state.api.origin,state.profile.profileId),state.notifyPrefs);render();}));
 const pushOptIn=document.getElementById('push-opt-in');if(pushOptIn)pushOptIn.addEventListener('change',()=>{state.pushPrefs.backgroundEnabled=pushOptIn.checked;savePushPreferences(localStorage,pushKey(),state.pushPrefs);render();});
 document.querySelectorAll('[data-inbox-filter]').forEach(el=>el.addEventListener('click',()=>{state.inboxFilter=el.dataset.inboxFilter;state.selectedInteraction=null;render();}));
 document.querySelectorAll('[data-interaction-dismiss]').forEach(el=>el.addEventListener('click',async()=>{if(!state.api)return;const id=Number(el.dataset.interactionDismiss);try{await state.api.dismissInteraction(id);state.selectedInteraction=null;await refresh();toast('Notification dismissed.');}catch(err){state.interactionError=err.message||'Dismiss failed';render();}}));
 document.querySelectorAll('[data-interaction]').forEach(el=>el.addEventListener('click',()=>{state.selectedInteraction=Number(el.dataset.interaction);render();}));
 document.querySelectorAll('[data-interaction-link]').forEach(el=>el.addEventListener('click',()=>openInteractionLink(Number(el.dataset.interactionLink),el.dataset.linkAction)));
 document.querySelectorAll('[data-interaction-reply]').forEach(form=>form.addEventListener('submit',async e=>{e.preventDefault();if(!state.api)return;const id=Number(form.dataset.interactionReply),actionId=form.dataset.replyAction;const values=Object.fromEntries(new FormData(form).entries());try{await state.api.replyInteraction(id,actionId,values);await refresh();toast('Response recorded.');}catch(err){state.interactionError=err.message||'Response failed';render();}}));document.querySelectorAll('[data-group]').forEach(el=>el.addEventListener('click',()=>{const id=el.dataset.group;state.rosterGroups[id]=state.rosterGroups[id]===false;render();}));
 const rosterFilter=document.getElementById('roster-filter');if(rosterFilter)rosterFilter.addEventListener('input',e=>applyContactFilter(e.target.value));
 document.querySelectorAll('[data-action]').forEach(el=>el.addEventListener('click',()=>action(el.dataset.action)));
 document.querySelectorAll('[data-auth]').forEach(el=>el.addEventListener('click',()=>{state.authTab=el.dataset.auth;state.authError='';render();}));
 document.querySelectorAll('[data-peer]').forEach(el=>el.addEventListener('click',async()=>{const peer=el.dataset.peer;if(nativeDesktop){await openChatWindow(peer);return;}state.peer=peer;state.panel='messenger';state.mobileRoster=false;state.draft='';markRead(peer,state.peerFeeds.get(peer)||[]);render();await refresh();}));
 document.querySelectorAll('[data-remove-game]').forEach(el=>el.addEventListener('click',()=>{config.games=config.games.filter(x=>x!==el.dataset.removeGame);writeConfig(config);refresh();}));
 document.querySelectorAll('[data-game-token]').forEach(el=>el.addEventListener('click',()=>{const text=prompt('Game bearer token (blank for public; held in memory only):');if(text!==null){state.gameTokens.set(el.dataset.gameToken,text);refresh();}}));
 document.querySelectorAll('[data-route]').forEach(el=>el.addEventListener('click',()=>openGame(el.dataset.route)));
 document.querySelectorAll('[data-launch-game]').forEach(el=>el.addEventListener('click',()=>launchPromoted(el.dataset.launchGame,true)));
 document.querySelectorAll('[data-open-promoted]').forEach(el=>el.addEventListener('click',()=>launchPromoted(el.dataset.openPromoted,false)));
 document.querySelectorAll('[data-game]').forEach(el=>el.addEventListener('click',()=>{state.panel='games';render();}));
 const devSwitch=document.getElementById('developer-switch');if(devSwitch)devSwitch.addEventListener('change',async()=>{if(!state.developerAllowed)return;state.developerVisible=devSwitch.checked;state.developerInfo=null;state.developerError='';if(!state.developerVisible&&state.panel==='developer')state.panel='settings';if(state.developerVisible)await updateDeveloperInfo();render();});
 const server=document.getElementById('server-form');if(server)server.addEventListener('submit',async e=>{e.preventDefault();if(connecting)return;connecting=true;const origin=new FormData(server).get('server');state.serverStatus='';try{const capability=await discoverSocial(origin);if(!capability.available){state.step='server';state.serverStatus=capability.reason;}else if(!capability.accounts){state.step='server';state.serverStatus='This Social component requires an upgrade for account registration.';}else{state.step='account';state.serverStatus='Social is available on this server.';state.authTab=capability.registration?'register':'login';state.proposedServer=new URL(origin).origin;}}catch(err){state.step='server';state.serverStatus=err.message||'Server unavailable.';}finally{connecting=false;render();}});
 const auth=document.getElementById('auth-form');if(auth)auth.addEventListener('submit',async e=>{e.preventDefault();if(connecting)return;connecting=true;const data=new FormData(auth);state.authError='';try{const fn=state.authTab==='register'?registerSocial:loginSocial;const api=await fn(state.proposedServer,data.get('username'),data.get('password'));await activate(api);saveRememberedSession({origin:api.origin,token:api.token,profileId:state.profile.profileId,remember:data.get('remember')==='yes'});toast('Welcome to Tavi!');}catch(e){state.authError=e.message||'Registration failed';render();}finally{connecting=false;}});
 const friend=document.getElementById('friend-form');if(friend)friend.addEventListener('submit',async e=>{e.preventDefault();const handle=new FormData(friend).get('username');try{await state.api.requestContact(handle);state.friendError='';state.panel='messenger';state.mobileRoster=true;await refresh();toast('Friend request sent to '+handle+'.');}catch(err){state.friendError=err.message||'Could not send friend request';render();}});
 const msg=document.getElementById('message-form');if(msg)msg.addEventListener('submit',async e=>{e.preventDefault();if(state.busy)return;const value=msg.elements.message.value.trim();if(!value)return;state.busy=true;try{if(state.peer==='lobby')await state.api.send(value);else await state.api.directSend(state.peer,value);state.draft='';await refresh();}catch(e){toast(e.message);}finally{state.busy=false;}});
 const entry=document.getElementById('message');if(entry){entry.addEventListener('input',()=>{state.draft=entry.value;});entry.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();entry.form?.requestSubmit();}});}
 const profile=document.getElementById('profile-form');if(profile)profile.addEventListener('submit',async e=>{e.preventDefault();try{const result=await state.api.saveProfile({schema:'looprd.social.profile/v1',profileId:state.profile.profileId,displayName:profile.elements.displayName.value,appearance:state.profile.appearance||null,portraitCode:state.profile.portraitCode||null},state.revision);state.profile=result.profile;state.revision=result.revision;toast('Profile saved.');}catch(e){toast(e.message);}});
}
// Native chat windows NEVER receive Social credentials. The main webview is their
// authenticated broker. Client-side identifiers are checked before every request;
// Social still authorizes every private read/write on the server.
let nativeBridgeReady=false;
async function nativeChatSnapshot(peer){
 if(!state.api)throw Error('Please sign in again from the contact list.');
 if(!isValidChatPeer(peer))throw Error('Invalid conversation');
 const contact=peer==='lobby'?null:state.contacts.find(c=>c.id===peer);
 if(peer!=='lobby'&&!contact)throw Error('Contact not available on this account.');
 const pending=peer!=='lobby'&&contact.status!=='accepted';
 const result=pending?{messages:[]}:peer==='lobby'?await state.api.feed():await state.api.directFeed(peer);
 if(peer!=='lobby'&&!pending)state.peerFeeds.set(peer,result.messages||[]);
 return {peer,title:peer==='lobby'?'Community Lobby':contact.username,online:!!contact?.online,
   pending:pending?(contact.direction==='incoming'?'incoming':'outgoing'):null,
   messages:(result.messages||[]).slice(-100).map(m=>({id:m.id,authorId:m.authorId,displayName:m.displayName||(m.authorId===state.profile.profileId?state.profile.displayName:contact?.username)||'Friend',text:m.text,at:m.at})),
   myId:state.profile.profileId,server:new URL(state.api.origin).host};
}
async function initializeNativeChatBridge(){
 if(!nativeDesktop||nativeBridgeReady)return;
 nativeBridgeReady=true;
 await listen('social-chat-viewed',e=>{const {peer,label,upToId}=e.payload||{};if(!state.api||!isValidChatPeer(peer)||peer==='lobby'||chatWindowLabel(peer)!==label||!state.contacts.some(c=>c.id===peer&&c.status==='accepted'))return;const messages=state.peerFeeds.get(peer)||[];if(!messages.some(m=>m.id===upToId))return;markRead(peer,messages.filter(m=>m.id<=upToId));render();});
 await listen('social-chat-request',async e=>{
   const {label,peer,kind,text,requestId}=e.payload||{};
   if(!/^chat-[a-zA-Z0-9_-]{1,72}$/.test(label||'')||chatWindowLabel(peer)!==label||!Number.isSafeInteger(requestId))return;
   try{
     if(!state.api)throw Error('Disconnected from Social.');
     if(kind==='send'){
       if(typeof text!=='string'||!text.trim()||text.length>1000)throw Error('Invalid message.');
       if(peer==='lobby')await state.api.send(text.trim());
       else {if(!state.contacts.some(c=>c.id===peer&&c.status==='accepted'))throw Error('Contact request not accepted.');await state.api.directSend(peer,text.trim());}
     } else if(kind==='accept'){
       if(!state.contacts.some(c=>c.id===peer&&c.status==='pending'&&c.direction==='incoming'))throw Error('No incoming request.');
       await state.api.acceptContact(peer);
     } else if(kind!=='snapshot')throw Error('Unknown conversation action.');
     const snapshot=await nativeChatSnapshot(peer);
     await emitTo(label,'social-chat-response',{requestId,ok:true,snapshot});
     if(kind!=='snapshot')void refresh();
   }catch(err){await emitTo(label,'social-chat-response',{requestId,ok:false,error:err.message||'Request failed.'}).catch(()=>{});}
 });
}
async function openChatWindow(peer){
 if(!nativeDesktop)return;
 if(!state.api||!isValidChatPeer(peer)){toast('Conversation is not available.');return;}
 if(peer!=='lobby'&&!state.contacts.some(c=>c.id===peer)){toast('Contact not found.');return;}
 try{
   await initializeNativeChatBridge();
   const label=chatWindowLabel(peer);
   const existing=await WebviewWindow.getByLabel(label);
   if(existing){await existing.setFocus();return;}
   const title=peer==='lobby'?'Community Lobby':(state.contacts.find(c=>c.id===peer)?.username||'Conversation');
   const windowHandle=new WebviewWindow(label,{url:`chat.html?peer=${encodeURIComponent(peer)}`,title:`${title} - Tavi`,
     width:585,height:525,minWidth:415,minHeight:370,resizable:true,center:true});
   windowHandle.once('tauri://error',e=>toast('Could not open conversation window: '+String(e.payload)));
 }catch(e){toast('Could not open conversation: '+e.message);}
}
window.addEventListener('message',async e=>{if(e.origin!==location.origin||e.source!==document.getElementById('portrait-frame')?.contentWindow||e.data?.type!=='looprd.portrait.selected/v1'||!state.api)return;const code=e.data.code;try{const result=await state.api.saveProfile({schema:'looprd.social.profile/v1',profileId:state.profile.profileId,displayName:state.profile.displayName,appearance:state.profile.appearance||null,portraitCode:code},state.revision);state.profile=result.profile;state.revision=result.revision;state.avatarCode=code;toast('Portrait saved to Social.');}catch(error){toast(error.message);}});
window.addEventListener('focus',()=>{if(state.api)refresh();});
async function restoreSession(){
 const saved=loadRememberedSession();
 if(!saved)return;
 state.restoring=true;state.serverStatus='Restoring your Tavi session…';render();
 try{
  const api=new LooprdSocial(saved.origin,saved.token);
  await activate(api); // validates token against the server before presenting a signed-in UI
 }catch(error){
  clearRememberedSession();
  state.step='server';state.serverStatus='Saved sign-in expired or unavailable. Connect and sign in again.';
  state.authError='';
  render();
 }finally{state.restoring=false;}
}
render();void restoreSession();
