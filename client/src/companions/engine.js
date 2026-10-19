/** Consent-first, deterministic offline care state. Never inspects chats/activity outside Companions. */
import {PETS,petById} from './catalog.js';
export const SCHEMA = 'tavi.companions/v1';
export const MODES = Object.freeze(['companion','gentle','classic']);
const ACTIONS=Object.freeze({feed:{fullness:24,energy:2},clean:{cleanliness:28,happiness:3},play:{happiness:21,energy:-9,fullness:-4},rest:{energy:27},pet:{happiness:12}});
const clamp=(v,min=0,max=100)=>Math.min(max,Math.max(min,Math.round(v)));
const yyyyMmDd=now=>new Date(now).toISOString().slice(0,10);
const validTime=now=>Number.isFinite(now)&&now>=0;
export function newCompanion({petId='pebble',now=Date.now()}={}) {
 if(!petById(petId)?.starter||!validTime(now)) throw Error('Starter pet and valid time required');
 return {schema:SCHEMA,enabled:false,petId,name:petById(petId).name,mode:'companion',overlay:'off',reminders:false,
  needs:{fullness:90,cleanliness:90,happiness:90,energy:90,bond:0},lastTick:now,
  engagement:{actions:0,days:[],kinds:[],suggestions:[],dismissed:[]},unlocks:[],lastActionAt:0};
}
export function sanitizeCompanion(raw,{now=Date.now()}={}) {
 if(!validTime(now)||!raw||raw.schema!==SCHEMA||!petById(raw.petId)||!MODES.includes(raw.mode)) return newCompanion({now});
 const clean=newCompanion({now});const needs={};
 for(const k of Object.keys(clean.needs))needs[k]=clamp(Number.isFinite(raw.needs?.[k])?raw.needs[k]:clean.needs[k]);
 const engagement=raw.engagement||{};
 const validDays=(Array.isArray(engagement.days)?engagement.days:[]).filter(x=>typeof x==='string'&&/^\d{4}-\d\d-\d\d$/.test(x)).slice(-90);
 return {...clean,enabled:raw.enabled===true,petId:raw.petId,name:typeof raw.name==='string'&&raw.name.trim()?raw.name.slice(0,24):clean.name,
  mode:raw.mode,overlay:['off','in-app','floating'].includes(raw.overlay)?raw.overlay:'off',reminders:raw.reminders===true,
  needs,lastTick:validTime(raw.lastTick)?Math.min(raw.lastTick,now):now,unlocks:(Array.isArray(raw.unlocks)?raw.unlocks:[]).filter(id=>petById(id)&&!petById(id).starter).slice(0,24),
  engagement:{actions:clamp(engagement.actions||0,0,1e6),days:[...new Set(validDays)],kinds:[...new Set((Array.isArray(engagement.kinds)?engagement.kinds:[]).filter(x=>x in ACTIONS))],suggestions:(Array.isArray(engagement.suggestions)?engagement.suggestions:[]).filter(x=>MODES.includes(x)),dismissed:(Array.isArray(engagement.dismissed)?engagement.dismissed:[]).filter(x=>MODES.includes(x))},
  lastActionAt:validTime(raw.lastActionAt)?Math.min(raw.lastActionAt,now):0};
}
export function tickCompanion(raw,{now=Date.now()}={}) {
 if(!validTime(now)) throw Error('Invalid time');
 const p=sanitizeCompanion(raw,{now});
 if(!p.enabled){return {...p,lastTick:now};}
 if(p.mode==='companion')return {...p,lastTick:now};
 // Cap offline catch-up at 8 hours: returning after an absence must never be a punishment.
 const hours=Math.min(8,Math.max(0,(now-p.lastTick)/3600000));
 if(!hours)return p;
 const mult=p.mode==='gentle'?.45:1;
 const modifiers=petById(p.petId).needs;
 const rates={fullness:1.25,cleanliness:.75,happiness:.8,energy:.9};
 const needs={...p.needs};
 for(const k of Object.keys(rates))needs[k]=clamp(Math.max(20,needs[k]-hours*mult*rates[k]*modifiers[k]));
 return {...p,needs,lastTick:now};
}
export function unlockedPets(p){const e=p.engagement;const ids=new Set(p.unlocks);for(const pet of PETS){if(pet.starter)continue;if(pet.unlock?.kind==='careDays'&&e.days.length>=pet.unlock.value)ids.add(pet.id);if(pet.unlock?.kind==='actions'&&e.actions>=pet.unlock.value)ids.add(pet.id);}return [...ids];}
export function performCare(raw,action,{now=Date.now()}={}){
 if(!(action in ACTIONS))throw Error('Unknown care action');
 const p=tickCompanion(raw,{now});if(!p.enabled)throw Error('Companion is disabled');
 if(now-p.lastActionAt<1500) return p; // prevent accidental double-click farming
 const modifiers=petById(p.petId);const needs={...p.needs};
 for(const [k,v] of Object.entries(ACTIONS[action]))needs[k]=clamp(needs[k]+v*(modifiers.favorite===action?1.15:1));
 needs.bond=clamp(needs.bond+(modifiers.favorite===action?3:2));
 const e=p.engagement;const day=yyyyMmDd(now);
 const engagement={...e,actions:e.actions+1,days:e.days.includes(day)?e.days:[...e.days.slice(-89),day],kinds:e.kinds.includes(action)?e.kinds:[...e.kinds,action]};
 const updated={...p,needs,engagement,lastActionAt:now};
 return {...updated,unlocks:unlockedPets(updated)};
}
export function suggestMode(raw){const p=raw;if(!p.enabled)return null;const e=p.engagement;
 if(p.mode==='companion'&&e.actions>=10&&e.days.length>=3&&e.kinds.length>=3&&!e.dismissed.includes('gentle')&&!e.suggestions.includes('gentle'))return 'gentle';
 if(p.mode==='gentle'&&e.actions>=25&&e.days.length>=5&&e.kinds.length>=4&&!e.dismissed.includes('classic')&&!e.suggestions.includes('classic'))return 'classic';
 return null;
}
export function dismissSuggestion(raw,mode){if(!MODES.includes(mode))throw Error('Unknown care mode');const e=raw.engagement;return {...raw,engagement:{...e,dismissed:[...new Set([...e.dismissed,mode])]}};}
export function changeMode(raw,mode,{now=Date.now()}={}){
 if(!MODES.includes(mode))throw Error('Unknown care mode');const p=tickCompanion(raw,{now});return {...p,mode,lastTick:now,engagement:{...p.engagement,suggestions:[...new Set([...p.engagement.suggestions,mode])]}};
}
export function selectCompanion(raw,id,{now=Date.now()}={}){const p=tickCompanion(raw,{now});const pet=petById(id);if(!pet||( !pet.starter&&!unlockedPets(p).includes(id)))throw Error('Pet not unlocked');return {...p,petId:id,name:pet.name};}
export function updatePreferences(raw,fields,{now=Date.now()}={}){
 const p=tickCompanion(raw,{now});const allowed=['enabled','reminders','overlay','name'];if(Object.keys(fields).some(k=>!allowed.includes(k)))throw Error('Unknown preference');
 const enabled='enabled'in fields?fields.enabled===true:p.enabled;
 const name='name'in fields?String(fields.name).trim().slice(0,24):p.name;
 const overlay='overlay'in fields?fields.overlay:p.overlay;
 if(!['off','in-app','floating'].includes(overlay))throw Error('Invalid overlay');
 return {...p,enabled,name:name||p.name,reminders:'reminders'in fields?fields.reminders===true:p.reminders,overlay:enabled?overlay:'off',lastTick:now};
}
export function storageKey(origin,profileId){if(!/^https:\/\//.test(origin)||!profileId)throw Error('Account scope required');return `tavi.companions.v1.${encodeURIComponent(origin)}.${encodeURIComponent(profileId)}`;}
export function loadCompanion(storage,key,{now=Date.now()}={}){try{const raw=storage.getItem(key);return sanitizeCompanion(raw?JSON.parse(raw):null,{now});}catch{return newCompanion({now});}}
export function saveCompanion(storage,key,record){storage.setItem(key,JSON.stringify(record));}
