// Shared host navigation chrome. Template output is only for Tavi-owned
// controls; untrusted extension content must remain sandboxed in its iframe.
const allowedActions=new Set(['minimize-view','home','app-store']);
const escapeHtml=value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
export function hostToolbar(title,{action='minimize-view',backLabel='Home'}={}){
 if(!allowedActions.has(action))throw new TypeError('Unsupported Tavi host navigation action');
 return `<div class="tavi-focus-toolbar tavi-shell-bar"><button type="button" class="tavi-shell-bar__back" data-action="${action}" aria-label="Back to ${escapeHtml(backLabel)}">← ${escapeHtml(backLabel)}</button><strong class="tavi-shell-bar__title">${escapeHtml(title)}</strong></div>`;
}
export const uiTokens=Object.freeze({density:'compact',themes:['light','dark'],owner:'tavi-host'});
