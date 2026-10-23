// Shared host navigation chrome. Template output is only for Tavi-owned
// controls; untrusted extension content must remain sandboxed in its iframe.
import {uiGlyph} from './glyphs.js';
import {uiHeader} from './components.js';
const allowedActions=new Set(['minimize-view','home','app-store','back']);
const escapeHtml=value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
export function hostToolbar(title,{action='minimize-view',backLabel='Home'}={}){
 if(!allowedActions.has(action))throw new TypeError('Unsupported Tavi host navigation action');
 return uiHeader({title,backAction:action,backLabel:`Back to ${backLabel}`,home:true,variant:'shell'});
}
/** The messenger Home uses the same semantic header as every focused screen. */
export function homeToolbar(){
 return uiHeader({title:'Tavi',actions:[{label:'Notifications',icon:'bell',action:'inbox'},{label:'Settings',icon:'settings',action:'settings'}],variant:'shell'});
}
/** These are the navigation actions controlled by the messenger host, not by an iframe. */
export function mobileTabs(panel,{unread=0}={}){
 const current=panel==='messenger'?'contacts':panel==='menu'?'main-menu':panel;
 const tabs=[['home','Home','home'],['contacts','Chats','messages'],['games','Games','games'],['main-menu','Apps','store']];
 return `<nav class="tavi-mobile-tabs" aria-label="Tavi navigation">${tabs.map(([action,label,glyph])=>`<button type="button" data-action="${action}" aria-label="${label}" ${current===action?'aria-current="page"':''}>${uiGlyph(glyph)}<span>${label}</span>${action==='contacts'&&unread?`<b aria-label="${Math.min(unread,99)} unread">${Math.min(unread,99)}</b>`:''}</button>`).join('')}</nav>`;
}

export const uiTokens=Object.freeze({density:'compact',themes:['light','dark'],owner:'tavi-host'});
