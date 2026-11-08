/** TaviX 0.1.10 / Atrium 0.5.77 installed-games contract.
 * This module holds DTO and request validation; the messenger host owns
 * approval, current account/installation verification and navigation.
 */
export const INSTALLED_GAMES_FEATURE='tavix.installed-games/v1';
const ID=/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+){2,}$/;
const VERSION=/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const CATEGORY=/^[a-z][a-z0-9-]{0,39}$/;
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
export function trustedInstalledGameInventory(rows){
 if(!Array.isArray(rows)||rows.length>150)throw Error('Invalid installed games source');
 const ids=new Set(),games=[];
 for(const row of rows){
  const m=row?.entry?.manifest,c=row?.classification;
  if(!object(m)||!object(c)||typeof m.id!=='string'||m.id.length>120||!ID.test(m.id)||m.id==='inc.thebigtree.tavi.atrium'||
     !VERSION.test(m.version)||typeof m.name!=='string'||!m.name.trim()||m.name.length>60||
     c.type!=='game'||!Array.isArray(c.categories)||c.categories.length>8||
     c.categories.some(x=>typeof x!=='string'||!CATEGORY.test(x))||new Set(c.categories).size!==c.categories.length||ids.has(m.id))
   throw Error('Invalid installed game descriptor');
  ids.add(m.id);
  games.push({id:m.id,version:m.version,name:m.name,classification:{type:'game',categories:[...c.categories]}});
 }
 return {schema:'tavix.installed-games.inventory/v1',games};
}
export function requestedInstalledGame(input,inventory){
 if(!object(input)||Object.keys(input).sort().join(',')!=='expectedVersion,id'||
    typeof input.id!=='string'||!ID.test(input.id)||input.id.length>120||
    typeof input.expectedVersion!=='string'||!VERSION.test(input.expectedVersion))
  throw Error('Invalid installed game launch request');
 const found=inventory?.games?.find(game=>game.id===input.id&&game.version===input.expectedVersion);
 if(!found)throw Error('Installed game unavailable or version changed');
 return found;
}
