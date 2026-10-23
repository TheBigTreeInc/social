/** DOM-only inbox filtering keeps the search field focused during typing and
 * does not re-render or mark the selected conversation as read. */
import {messageVisible} from './messenger-model.js';
export function applyInboxFilter(root,{query='',filter='all'}={}){
  if(!root)return 0;
  let visible=0;
  root.querySelectorAll('[data-message-thread]').forEach(row=>{
    const show=messageVisible({kind:row.dataset.messageKind,label:row.dataset.messageName,unread:Number(row.dataset.messageUnread)}, {query,filter});
    row.hidden=!show;
    if(show)visible++;
  });
  const empty=root.querySelector('[data-message-empty]');
  if(empty)empty.hidden=visible>0;
  return visible;
}
