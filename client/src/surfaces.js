/** Ephemeral UI-only activity registry. No bearer, chat content, URL or game state. */
export function safeSurfaceId(kind,id){return (kind==='game'&&/^[a-z][a-z0-9-]{1,47}$/.test(id||''))||(kind==='chat'&&(id==='lobby'||/^acct_[1-9][0-9]{0,18}$/.test(id||'')));}
export function createSurfaceRegistry(){
 const items=new Map();
 function key(kind,id){if(!safeSurfaceId(kind,id))throw Error('Invalid activity identity');return kind+':'+id;}
 function minimize(kind,id,title){const keyId=key(kind,id);items.set(keyId,{id:keyId,kind,value:id,title:String(title||id).slice(0,80),minimized:true});return keyId;}
 return Object.freeze({minimize,minimizeChat:(id,title)=>minimize('chat',id,title),minimizeGame:(id,title)=>minimize('game',id,title),activate(id){items.delete(id);},get:id=>items.get(id)||null,remove:id=>items.delete(id),list:()=>[...items.values()],clear:()=>items.clear()});
}
