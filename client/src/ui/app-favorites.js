/** Personal, local-only Apps drawer preferences. Never registers, enables or trusts an extension. */
export const DEFAULT_APP_FAVORITES=Object.freeze([
 'builtin:inbox','builtin:wallet','builtin:app-store'
]);
const PREFIX='tavi.apps.favorites/v1:';
const VALID_ID=/^(?:builtin:[a-z][a-z0-9-]{0,63}|extension:[a-z0-9][a-z0-9.-]{0,190})$/;
const MAX=64;
export function appFavoriteId(app){
 if(app?.kind==='builtin'&&typeof app.action==='string')return `builtin:${app.action}`;
 if((app?.kind==='extension'||app?.kind==='developer-preview')&&typeof app.id==='string')return `extension:${app.id}`;
 return null;
}
export function favoritesStorageKey(scope){
 if(typeof scope!=='string'||!scope||scope.length>240)throw new TypeError('An account scope is required');
 return PREFIX+scope;
}
export function readAppFavorites(storage,scope){
 const key=favoritesStorageKey(scope);
 let raw;
 try{raw=storage.getItem(key);}catch{return [...DEFAULT_APP_FAVORITES];}
 if(raw===null)return [...DEFAULT_APP_FAVORITES];
 try{
  const parsed=JSON.parse(raw);
  if(parsed?.schema!=='tavi.apps.favorites/v1'||!Array.isArray(parsed.ids))return [...DEFAULT_APP_FAVORITES];
  return [...new Set(parsed.ids.filter(id=>typeof id==='string'&&VALID_ID.test(id)))].slice(0,MAX);
 }catch{return [...DEFAULT_APP_FAVORITES];}
}
export function toggleAppFavorite(storage,scope,id){
 if(typeof id!=='string'||!VALID_ID.test(id))throw new TypeError('Invalid app favorite identifier');
 const current=readAppFavorites(storage,scope);
 const next=current.includes(id)?current.filter(x=>x!==id):[...current,id];
 if(next.length>MAX)throw new RangeError('Too many favorites');
 storage.setItem(favoritesStorageKey(scope),JSON.stringify({schema:'tavi.apps.favorites/v1',ids:next}));
 return next;
}
export function favoriteApplications(apps,ids){
 const byId=new Map(apps.map(app=>[appFavoriteId(app),app]));
 return ids.map(id=>byId.get(id)).filter(Boolean);
}
