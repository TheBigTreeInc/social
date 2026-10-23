/** Tavi-owned UI components. These are intentionally small dependency-free views.
 * Used by the messenger, native Windows chat, game windows, and extensions host.
 * Never render untrusted extension HTML or pass credentials into these components.
 */
import {uiGlyph} from './glyphs.js';
export const uiEscape=(value)=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const ID=/^[a-z][a-z0-9-]{0,63}$/;
export function uiAction({label,icon='extension',action=null,id=null,variant='quiet',text=null,className=''}={}){
 if(typeof label!=='string'||!label.trim())throw new TypeError('Action needs an accessible label');
 if(action!==null&&!ID.test(action))throw new TypeError('Invalid host action');
 if(id!==null&&!ID.test(id))throw new TypeError('Invalid action id');
 if(!['quiet','primary'].includes(variant))throw new TypeError('Invalid action variant');
 if(className&&!/^[a-z][a-z0-9_-]*(?: [a-z][a-z0-9_-]*)*$/.test(className))throw new TypeError('Invalid action class');
 return `<button type="button" class="tavi-ui-action tavi-ui-action--${variant}${className?` ${uiEscape(className)}`:''}" ${action!==null?`data-action="${uiEscape(action)}"`:''} ${id!==null?`id="${uiEscape(id)}"`:''} aria-label="${uiEscape(label)}" title="${uiEscape(label)}">${uiGlyph(icon)}${text!==null?`<span class="tavi-ui-action__text">${uiEscape(text)}</span>`:''}</button>`;
}
export function uiHeader({title,backAction=null,backLabel='Back',home=false,minimizeId=null,subtitle=null,actions=[],variant='default'}={}){
 if(typeof title!=='string'||!title.trim())throw new TypeError('UI header needs a title');
 if(backAction!==null&&!ID.test(backAction))throw new TypeError('Invalid back action');
 if(!['default','shell','native-chat'].includes(variant))throw new TypeError('Invalid header variant');
 if(!Array.isArray(actions)||actions.length>3)throw new TypeError('Invalid header actions');
 const variantClass=variant==='shell'?' tavi-focus-toolbar tavi-shell-bar':variant==='native-chat'?' tavi-native-chat-head':'';
 return `<header class="tavi-ui-header${variantClass}" aria-label="${uiEscape(title)}">${backAction!==null?uiAction({label:backLabel,icon:'back',action:backAction,className:variant==='shell'?'tavi-shell-bar__back':''}):''}<strong class="tavi-ui-header__title${variant==='shell'?' tavi-shell-bar__title':''}">${uiEscape(title)}</strong>${subtitle?`<small class="tavi-ui-header__subtitle">${uiEscape(subtitle)}</small>`:''}${home?uiAction({label:'Tavi Home',icon:'home',action:'home',className:variant==='shell'?'tavi-shell-bar__home':''}):''}${actions.map(action=>uiAction(action)).join('')}${minimizeId?uiAction({label:'Minimize to Tavi Home',icon:'minimize',id:minimizeId}):''}</header>`;
}
export function uiStatus(text){return `<div class="tavi-ui-status" role="status">${uiEscape(text)}</div>`;}
