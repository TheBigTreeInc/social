/** Presentation-only selectors shared by the Tavi Home buddy list and Messages inbox.
 * Never alter Social contact/session objects, message text, or server-side read state. */
export function buddyGroups(contacts=[]) {
  const accepted=contacts.filter(contact=>contact.status==='accepted');
  return {
    online:accepted.filter(contact=>contact.online),
    offline:accepted.filter(contact=>!contact.online),
    incoming:contacts.filter(contact=>contact.status==='pending'&&contact.direction==='incoming'),
    pending:contacts.filter(contact=>contact.status==='pending'&&contact.direction==='outgoing')
  };
}
export function conversationThreads(contacts=[],summaries=[],unread={}) {
  const byPeer=new Map(summaries.filter(s=>s?.peer).map(s=>[s.peer,s]));
  return contacts.filter(c=>c.status==='accepted').map(contact=>{
    const latest=byPeer.get(contact.id)?.latest||null;
    return {contact,latest,unread:Math.max(0,Number(unread[contact.id])||0)};
  }).sort((a,b)=> (Number(b.latest?.at)||0)-(Number(a.latest?.at)||0) ||
    String(a.contact.displayName||a.contact.username).localeCompare(String(b.contact.displayName||b.contact.username)));
}
export function messageVisible(thread,{query='',filter='all'}={}) {
  const q=String(query).trim().toLocaleLowerCase();
  const matches=!q || String(thread.label||'').toLocaleLowerCase().includes(q);
  const matchesFilter=filter==='unread'?Number(thread.unread)>0:filter==='friends'?thread.kind==='direct':true;
  return matches && matchesFilter;
}
