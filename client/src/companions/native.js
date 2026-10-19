/** The desktop companion has no Social account, bearer, message or game authority. */
export const PET_WINDOW_LABEL = 'companion';
export const PET_COMMANDS = Object.freeze(['ready','hide','open','feed','clean','play','rest','pet','reset-position']);
export const PET_SIZE = Object.freeze({width:186,height:226});
export function canShowFloating(companion,{windows=false,authenticated=false}={}) {
  return windows===true && authenticated===true && companion?.enabled===true && companion.overlay==='floating';
}
export function parsePetWindowCommand(data){
  if(!data || typeof data!=='object' || Array.isArray(data))return null;
  if(!PET_COMMANDS.includes(data.action))return null;
  // No arbitrary strings or data from an unprivileged auxiliary webview are persisted.
  if(Object.keys(data).some(key=>key!=='action'))return null;
  return data.action;
}
export function normalizePetPosition(raw){
  if(!raw || !Number.isSafeInteger(raw.x) || !Number.isSafeInteger(raw.y))return null;
  if(Math.abs(raw.x)>16384 || Math.abs(raw.y)>16384)return null;
  return {x:raw.x,y:raw.y};
}
export function petWindowSnapshot(record){
  if(!record?.enabled || record?.overlay!=='floating')return null;
  const n=record.needs||{};
  return {schema:'tavi.companion-window/v1',petId:record.petId,
    name:String(record.name||'Companion').slice(0,24),mode:record.mode,
    needs:Object.fromEntries(['fullness','cleanliness','happiness','energy','bond'].map(k=>[k,Math.max(0,Math.min(100,Math.round(Number(n[k])||0)))]))};
}
