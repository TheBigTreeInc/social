/** TaviX 0.1.10 classification/v1. Metadata is descriptive, never authority. */
export const GAME_CATEGORIES=Object.freeze([
 'action','adventure','arcade','board','cards','casual','educational',
 'multiplayer','puzzle','racing','role-playing','simulation','solitaire',
 'sports','strategy','word'
]);
export const APP_CATEGORIES=Object.freeze([
 'communication','creative','education','entertainment','finance',
 'productivity','social','tools','utility','wellness'
]);
/** Validate optional classification against TaviX's exact allowlists.
 * Legacy manifests are apps, not guessed from their name or icon.
 */
export function resolveTavixClassification(manifest){
 if(!manifest||typeof manifest!=='object'||Array.isArray(manifest))throw Error('Invalid TaviX manifest');
 if(!Object.prototype.hasOwnProperty.call(manifest,'classification'))return {type:'app',categories:[]};
 const value=manifest.classification;
 if(!value||typeof value!=='object'||Array.isArray(value)||
     Object.keys(value).some(k=>!['type','categories'].includes(k)))throw Error('Invalid TaviX classification fields');
 if(!['app','game'].includes(value.type))throw Error('Unsupported TaviX classification type');
 const categories=value.categories===undefined?[]:value.categories;
 if(!Array.isArray(categories)||categories.length>8)throw Error('Invalid TaviX categories');
 const allowed=new Set(value.type==='game'?GAME_CATEGORIES:APP_CATEGORIES);
 if(categories.some(c=>typeof c!=='string'||!allowed.has(c))||new Set(categories).size!==categories.length)
  throw Error('Unsupported or repeated TaviX category');
 return {type:value.type,categories:[...categories]};
}
