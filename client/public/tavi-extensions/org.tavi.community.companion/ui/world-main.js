'use strict';
(()=>{
const __modules=Object.create(null);
const __inlineConfigurations={"cat-clips.json":{"idle":{"schema":1,"rig":"cat-v1","duration":4,"loop":true,"tracks":[{"part":"torso","channel":"y","keys":[[0,0],[2,-1],[4,0]]},{"part":"head","channel":"y","keys":[[0,0],[2,-1],[4,0]]},{"part":"tail","channel":"angle","keys":[[0,-5],[2,7],[4,-5]]},{"part":"earRight","channel":"angle","keys":[[0,0],[2.8,0],[3,12],[3.2,0],[4,0]]}]},"walk":{"schema":1,"rig":"cat-v1","duration":0.8,"loop":true,"tracks":[{"part":"torso","channel":"y","keys":[[0,0],[0.2,-1],[0.4,0],[0.6,-1],[0.8,0]]},{"part":"torso","channel":"angle","keys":[[0,3],[0.8,3]]},{"part":"legLeft","channel":"x","keys":[[0,-7],[0.4,7],[0.8,-7]]},{"part":"legRight","channel":"x","keys":[[0,7],[0.4,-7],[0.8,7]]},{"part":"legLeft","channel":"y","keys":[[0,0],[0.2,-5],[0.4,0],[0.8,0]]},{"part":"legRight","channel":"y","keys":[[0,0],[0.4,0],[0.6,-5],[0.8,0]]},{"part":"armLeft","channel":"angle","keys":[[0,-8],[0.4,8],[0.8,-8]]},{"part":"armRight","channel":"angle","keys":[[0,8],[0.4,-8],[0.8,8]]},{"part":"forearmLeft","channel":"angle","keys":[[0,6],[0.4,-4],[0.8,6]]},{"part":"forearmRight","channel":"angle","keys":[[0,-4],[0.4,6],[0.8,-4]]},{"part":"tail","channel":"angle","keys":[[0,-5],[0.4,5],[0.8,-5]]}]},"wave":{"schema":1,"rig":"cat-v1","duration":2.4,"loop":false,"tracks":[{"part":"armRight","channel":"angle","keys":[[0,0],[0.4,-115],[1.7,-115],[2.4,0]]},{"part":"forearmRight","channel":"angle","keys":[[0,0],[0.4,-40],[0.7,-65],[1,-40],[1.3,-65],[1.6,-40],[1.8,-40],[2.4,0]]},{"part":"head","channel":"angle","keys":[[0,0],[0.5,-6],[1.8,-6],[2.4,0]]},{"part":"tail","channel":"angle","keys":[[0,0],[1,9],[2.4,0]]}]}},"cat-painted-layout.json":{"schema":1,"species":"cat","colors":{"label":"Cat colors","defaultPreset":"ginger","preserveDefaults":true,"defaults":{"coat":"#dba36a","markings":"#ac6038","cream":"#fae4b6","innerEar":"#dca6ab"},"channels":[{"id":"coat","label":"Fur"},{"id":"markings","label":"Stripes"},{"id":"cream","label":"Muzzle & paws"},{"id":"innerEar","label":"Inner ears"}],"presets":{"ginger":{"label":"Ginger","colors":{"coat":"#dba36a","markings":"#ac6038","cream":"#fae4b6","innerEar":"#dca6ab"}},"silver":{"label":"Silver","colors":{"coat":"#a8adb8","markings":"#53606d","cream":"#f2ecdf","innerEar":"#cf9da8"}},"lavender":{"label":"Lavender","colors":{"coat":"#b497ca","markings":"#6d527d","cream":"#f2e8e7","innerEar":"#d6a3bd"}}},"materials":{"fur":[{"channel":"cream","hue":[30,65],"lightness":[0.78,0.98],"saturation":[0.18,1],"sourceLightness":0.85},{"channel":"markings","hue":[0,28],"lightness":[0.26,0.62],"saturation":[0.22,1],"sourceLightness":0.45},{"channel":"coat","hue":[10,58],"lightness":[0.26,0.96],"saturation":[0.2,1],"sourceLightness":0.64}],"earFur":[{"channel":"innerEar","hue":[330,360],"saturation":[0.12,1],"lightness":[0.35,0.94],"sourceLightness":0.76},{"channel":"innerEar","hue":[0,15],"saturation":[0.12,1],"lightness":[0.35,0.94],"sourceLightness":0.76},{"channel":"cream","hue":[30,65],"lightness":[0.78,0.98],"saturation":[0.18,1],"sourceLightness":0.85},{"channel":"markings","hue":[0,28],"lightness":[0.26,0.62],"saturation":[0.22,1],"sourceLightness":0.45},{"channel":"coat","hue":[10,58],"lightness":[0.26,0.96],"saturation":[0.2,1],"sourceLightness":0.64}]}},"width":1254,"height":1254,"parts":{"legSideLeft":{"atlas":"profileLegs","source":[77,19,142,218],"size":[25,32],"pivot":[9,10],"recolor":"fur"},"legSideRight":{"atlas":"profileLegs","source":[310,20,134,218],"size":[25,32],"pivot":[9,10],"recolor":"fur"},"earSideNear":{"atlas":"profileEars","source":[35,29,154,205],"size":[27,24],"pivot":[13.5,20],"recolor":"earFur"},"earSideFar":{"atlas":"profileEars","source":[247,66,104,168],"size":[12,18],"pivot":[6,16],"recolor":"earFur"},"front":{"source":[4,50,310,240],"size":[74,56],"pivot":[37,28],"recolor":"fur","protectedRegions":[{"center":[0.35,0.5],"radius":[0.085,0.14],"hue":[35,150]},{"center":[0.7,0.5],"radius":[0.085,0.14],"hue":[35,150]}]},"side":{"source":[346,49,276,241],"size":[74,56],"pivot":[37,28],"recolor":"fur","protectedRegions":[{"center":[0.73,0.49],"radius":[0.1,0.15],"hue":[35,150]}]},"front-blink":{"source":[627,50,314,238],"size":[74,56],"pivot":[37,28],"recolor":"fur"},"side-blink":{"source":[960,49,286,241],"size":[74,56],"pivot":[37,28],"recolor":"fur"},"torso-front":{"source":[36,324,278,292],"size":[57,66],"pivot":[28.5,33],"recolor":"fur"},"torso-side":{"source":[372,323,241,300],"size":[53,66],"pivot":[26.5,33],"recolor":"fur"},"armLeft":{"source":[704,348,141,253],"size":[20,42],"pivot":[10,5],"recolor":"fur"},"armRight":{"source":[1031,346,141,255],"size":[20,42],"pivot":[10,5],"recolor":"fur"},"legLeft":{"source":[74,635,170,270],"size":[25,32],"pivot":[12.5,10],"recolor":"fur"},"legRight":{"source":[410,635,168,270],"size":[25,32],"pivot":[12.5,10],"recolor":"fur"},"tail":{"source":[640,627,296,285],"size":[66,64],"pivot":[62,55],"recolor":"fur"},"earLeft":{"source":[1010,670,189,225],"size":[24,30],"pivot":[12,26],"recolor":"earFur"},"earRight":{"source":[74,955,194,224],"size":[24,30],"pivot":[12,26],"recolor":"earFur"},"happy":{"source":[314,941,313,245],"size":[74,56],"pivot":[37,28],"recolor":"fur"},"curious":{"source":[630,941,311,247],"size":[74,56],"pivot":[37,28],"recolor":"fur"},"sleepy":{"source":[941,941,313,247],"size":[74,56],"pivot":[37,28],"recolor":"fur"}},"atlases":{"profileLegs":{"width":512,"height":256},"profileEars":{"width":384,"height":256}}},"unicorn-layout.json":{"schema":1,"species":"unicorn","rig":"cat-v1","colors":{"label":"Unicorn colors","defaultPreset":"pearl","defaults":{"coat":"#e9e5df","mane":"#aa89d9","horn":"#e4bd6b","hooves":"#645275"},"channels":[{"id":"coat","label":"Coat"},{"id":"mane","label":"Mane & tail"},{"id":"horn","label":"Horn"},{"id":"hooves","label":"Hooves"}],"presets":{"pearl":{"label":"Pearl","colors":{"coat":"#e9e5df","mane":"#aa89d9","horn":"#e4bd6b","hooves":"#645275"}},"twilight":{"label":"Twilight","colors":{"coat":"#53617c","mane":"#d592bb","horn":"#efc575","hooves":"#40364f"}},"meadow":{"label":"Meadow","colors":{"coat":"#bfd1ae","mane":"#548e94","horn":"#e2c17a","hooves":"#526b57"}}},"materials":{"coat":[{"channel":"coat","chroma":[0,0.18],"lightness":[0.13,1],"sourceLightness":0.86}],"limb":[{"channel":"hooves","hue":[145,205],"saturation":[0.2,1],"lightness":[0.1,1],"sourceLightness":0.42},{"channel":"coat","chroma":[0,0.18],"lightness":[0.13,1],"sourceLightness":0.86}],"mane":[{"channel":"mane","lightness":[0.1,1],"sourceLightness":0.58}],"horn":[{"channel":"horn","lightness":[0.1,1],"sourceLightness":0.62}]}},"width":1280,"height":1024,"parts":{"front":{"source":[25,61,250,188],"size":[74,56],"pivot":[37,28],"recolor":"coat"},"side":{"source":[298,64,255,187],"size":[80,56],"pivot":[40,28],"recolor":"coat"},"front-blink":{"source":[556,62,251,187],"size":[74,56],"pivot":[37,28],"recolor":"coat"},"side-blink":{"source":[819,64,263,189],"size":[80,56],"pivot":[40,28],"recolor":"coat"},"horn":{"source":[1117,45,113,210],"size":[12,30],"pivot":[6,27],"recolor":"horn"},"torso-front":{"source":[25,267,263,253],"size":[57,66],"pivot":[28.5,33],"recolor":"coat"},"torso-side":{"source":[311,266,242,255],"size":[53,66],"pivot":[26.5,33],"recolor":"coat"},"armLeft":{"source":[581,282,155,233],"size":[20,42],"pivot":[10,5],"recolor":"limb"},"armRight":{"source":[809,281,153,234],"size":[20,42],"pivot":[10,5],"recolor":"limb"},"tail":{"source":[998,277,268,256],"size":[42,52],"pivot":[38,26],"recolor":"mane"},"legLeft":{"source":[51,531,164,229],"size":[25,32],"pivot":[12.5,10],"recolor":"limb"},"legRight":{"source":[314,531,166,229],"size":[25,32],"pivot":[12.5,10],"recolor":"limb"},"legSideLeft":{"source":[559,533,169,222],"size":[25,32],"pivot":[9,10],"recolor":"limb"},"legSideRight":{"source":[774,532,169,223],"size":[25,32],"pivot":[9,10],"recolor":"limb"},"maneFront":{"atlas":"unicornMane","source":[34,68,224,120],"size":[56,23],"pivot":[28,31],"recolor":"mane"},"earLeft":{"source":[39,773,177,216],"size":[16,36],"pivot":[8,32],"recolor":"coat"},"earRight":{"source":[310,772,177,216],"size":[16,36],"pivot":[8,32],"recolor":"coat"},"earSideNear":{"source":[545,767,154,229],"size":[15,32],"pivot":[7.5,28],"recolor":"coat"},"earSideFar":{"source":[782,772,175,224],"size":[11,27],"pivot":[5.5,24],"recolor":"coat"},"maneSide":{"atlas":"unicornMane","source":[59,226,147,252],"size":[31,82],"pivot":[41,27],"recolor":"mane"},"maneSideForelock":{"atlas":"unicornMane","source":[294,66,191,132],"size":[44,20],"pivot":[22,32],"recolor":"mane"},"maneFrontBack":{"atlas":"unicornMane","source":[297,312,168,133],"size":[60,34],"pivot":[30,14],"recolor":"mane"}},"atlases":{"unicornMane":{"width":512,"height":512}}}};
const __bundledJSON=async name=>{const key=String(name).replace(/^\.\//,'');if(!Object.hasOwn(__inlineConfigurations,key))throw Error('Unknown painted layout');return structuredClone(__inlineConfigurations[key]);};
const __loadBundledImage=async name=>{const chunks=globalThis.__taviCompanionImageChunks?.[name];if(!Array.isArray(chunks)||!chunks.length)throw Error('Missing painted artwork: '+name);const img=new Image();img.src='data:image/png;base64,'+chunks.join('');await img.decode();return img;};
// world/object-catalog.mjs
__modules["world/object-catalog.mjs"]=(()=>{
const __moduleURL=new URL("./world/object-catalog.mjs",document.baseURI).href;
// Tavi-authored, data-driven world objects. The supplied Creatures COBs are
// design references only: no third-party CAOS, binary assets or original rules
// are shipped or executed here.
const OBJECT_CATALOG_SCHEMA='tavi.world-objects/v1';
const NEEDS=new Set(['fullness','cleanliness','happiness','energy','affection']);
const allowedActions=new Set(['eat','sit','bathe','sleep','play']);

const entries=[
  {id:'snack',label:'Fruit bowl',room:'kitchen',x:230,category:'food',action:'eat',duration:6,effects:{fullness:22},need:'fullness'},
  {id:'table',label:'Dining table',room:'dining',x:710,category:'social',action:'sit',duration:6,effects:{affection:22},need:'affection'},
  {id:'honey',label:'Honey jar',room:'dining',x:870,category:'food',action:'eat',duration:4,effects:{fullness:15,happiness:5},need:'fullness',capacity:10,refillable:true},
  {id:'bath',label:'Warm spring',room:'bathroom',x:1190,category:'comfort',action:'bathe',duration:6,effects:{cleanliness:22,happiness:3},need:'cleanliness'},
  {id:'bed',label:'Little bed',room:'bedroom',x:1660,category:'rest',action:'sleep',duration:10,effects:{energy:22},need:'energy'},
  {id:'toy',label:'Garden ball',room:'garden',x:2140,category:'play',action:'play',duration:6,effects:{happiness:22},need:'happiness'},
];

function validateObjectCatalog(list){
  if(!Array.isArray(list)||!list.length)throw Error('Object catalog must be a nonempty array');
  const ids=new Set();
  for(const item of list){
    if(!/^[a-z][a-z0-9-]{1,39}$/.test(item.id??'')||ids.has(item.id))throw Error('Invalid or duplicate object ID');
    ids.add(item.id);
    if(typeof item.label!=='string'||!item.label.trim()||typeof item.room!=='string'||!item.room.trim()||!Number.isFinite(item.x)||item.x<0)throw Error('Invalid object placement');
    if(!allowedActions.has(item.action)||!Number.isFinite(item.duration)||item.duration<=0||item.duration>30)throw Error('Invalid object action');
    if(!NEEDS.has(item.need)||!item.effects||typeof item.effects!=='object')throw Error('Invalid object needs');
    for(const [need,value]of Object.entries(item.effects))if(!NEEDS.has(need)||!Number.isFinite(value)||value<0||value>100)throw Error('Invalid object effect');
    if(item.capacity!==undefined&&(!Number.isSafeInteger(item.capacity)||item.capacity<1||item.capacity>100))throw Error('Invalid object capacity');
    if(item.refillable&&!item.capacity)throw Error('Refillable object must have a capacity');
  }
  return true;
}
validateObjectCatalog(entries);
const objects=Object.freeze(entries.map(entry=>Object.freeze({...entry,effects:Object.freeze({...entry.effects})})));
const objectById=id=>objects.find(item=>item.id===id);
const initialObjectState=()=>Object.fromEntries(objects.filter(item=>item.capacity).map(item=>[item.id,{usesRemaining:item.capacity}]));
function isObjectAvailable(s,id){
  const obj=objectById(id);
  return Boolean(obj&&(!obj.capacity||(s.objectState?.[id]?.usesRemaining??obj.capacity)>0));
}
function refillObject(s,id){
  const obj=objectById(id);
  if(!obj?.refillable)return false;
  if(!s.objectState)s.objectState=initialObjectState();
  if(s.objectState[id]?.usesRemaining===obj.capacity)return false;
  s.objectState[id]={usesRemaining:obj.capacity};
  s.message=`The ${obj.label.toLowerCase()} has been refilled.`;
  return true;
}
function completeObjectUse(s,id){
  const obj=objectById(id);
  if(!isObjectAvailable(s,id))return false;
  for(const [need,benefit]of Object.entries(obj.effects))s.needs[need]=Math.max(0,Math.min(100,s.needs[need]+benefit));
  if(obj.capacity){
    const left=(s.objectState?.[id]?.usesRemaining??obj.capacity)-1;
    s.objectState[id]={usesRemaining:left};
    s.message=left>0?`Enjoyed some honey. ${left} servings remain.`:'Enjoyed the last honey. The jar is empty.';
  }
  return true;
}

return {OBJECT_CATALOG_SCHEMA,validateObjectCatalog,objects,objectById,initialObjectState,isObjectAvailable,refillObject,completeObjectUse};
})();
// world/genetics.mjs
__modules["world/genetics.mjs"]=(()=>{
const __moduleURL=new URL("./world/genetics.mjs",document.baseURI).href;
/**
 * Tavi companion adaptive genetics v2. The ONE creature's genes change during
 * its lifetime as a bounded, deterministic consequence of experienced events.
 * No breeding, parents, mating, pedigree or species appearance inference.
 * This is original simulation logic, NOT a decoder of Creatures .gen/.EXP.
 * Pure JSON API suitable for porting to Rust/native engine adapters.
 */
const GENOME_SCHEMA='tavi.companion.genome/v2';
const LEGACY_GENOME_SCHEMA='tavi.companion.genome/v1';
const TRAIT_KEYS=Object.freeze(['curiosity','sociability','playfulness','calmness','appetite','stamina']);
const EVOLUTION_EVENTS=Object.freeze(['explore','play','rest','nourish','bathe','bond']);
const TRAITS=new Set(TRAIT_KEYS),EVENTS=new Set(EVOLUTION_EVENTS);
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const match=(v,keys)=>record(v)&&Object.keys(v).length===keys.length&&Object.keys(v).every(k=>keys.includes(k));
const boundInt=(x,min,max)=>Number.isSafeInteger(x)&&x>=min&&x<=max;
const seedValid=x=>boundInt(x,0,0xffffffff);
const maxCount=1000000;
function seededRandom(seed){
  if(!seedValid(seed))throw Error('Invalid genetic seed');
  let state=seed>>>0;
  return ()=>{
    state=(state+0x6D2B79F5)>>>0;
    let t=state;
    t=Math.imul(t^(t>>>15),t|1);
    t^=t+Math.imul(t^(t>>>7),t|61);
    return ((t^(t>>>14))>>>0)/4294967296;
  };
}
function assemble(genes,revision=0,exposures=Object.fromEntries(EVOLUTION_EVENTS.map(e=>[e,0]))){
  const result={schema:GENOME_SCHEMA,revision,genes,exposures};validateGenome(result);return result;
}
function validateGenome(genome){
  if(!match(genome,['schema','revision','genes','exposures'])||genome.schema!==GENOME_SCHEMA||!boundInt(genome.revision,0,maxCount)||!match(genome.genes,TRAIT_KEYS)||!match(genome.exposures,EVOLUTION_EVENTS))throw Error('Invalid adaptive genome');
  if(TRAIT_KEYS.some(key=>!boundInt(genome.genes[key],0,510)))throw Error('Invalid adaptive gene');
  if(EVOLUTION_EVENTS.some(key=>!boundInt(genome.exposures[key],0,maxCount)))throw Error('Invalid evolution exposure');
  const total=EVOLUTION_EVENTS.reduce((sum,key)=>sum+genome.exposures[key],0);
  if(total!==genome.revision)throw Error('Evolution revision / exposure mismatch');
  return true;
}
function neutralGenome(){return assemble(Object.fromEntries(TRAIT_KEYS.map(key=>[key,256])));}
function createGenome(seed=0x54415649){
  const next=seededRandom(seed);
  return assemble(Object.fromEntries(TRAIT_KEYS.map(key=>[key,Math.floor(next()*511)])));
}
/** Convert the ONLY supported pre-evolution 0.6.9 genome, preserving exact
 * expressed allele means (sum/510). Generation and parentage are discarded.
 */
function migrateLegacyGenome(genome){
  if(!match(genome,['schema','generation','alleles'])||genome.schema!==LEGACY_GENOME_SCHEMA||!boundInt(genome.generation,0,maxCount)||!match(genome.alleles,TRAIT_KEYS))throw Error('Invalid legacy genome');
  const genes={};
  for(const key of TRAIT_KEYS){
    const a=genome.alleles[key];
    if(!Array.isArray(a)||a.length!==2||!a.every(x=>boundInt(x,0,255)))throw Error('Invalid legacy alleles');
    genes[key]=a[0]+a[1];
  }
  return assemble(genes);
}
function phenotypeFor(genome){
  validateGenome(genome);
  return Object.fromEntries(TRAIT_KEYS.map(key=>[key,genome.genes[key]/510]));
}
function traitFor(world,key){
  if(!TRAITS.has(key))throw Error('Unknown companion trait');
  return world?.phenotype?.[key]??0.5;
}
// Change applies only after a completed experience, never because time passed.
// Repeated events have diminishing influence but are still bounded and auditable.
const CHANGES=Object.freeze({
  explore:{curiosity:4,calmness:-1},
  play:{playfulness:5,curiosity:2,stamina:1},
  rest:{calmness:3,stamina:4},
  nourish:{appetite:2,calmness:1},
  bathe:{calmness:4},
  bond:{sociability:5,calmness:1},
});
function evolveGenome(genome,event){
  validateGenome(genome);
  if(!EVENTS.has(event))throw Error('Unknown evolution event');
  if(genome.revision===maxCount||genome.exposures[event]===maxCount)return structuredClone(genome);
  const exposures={...genome.exposures,[event]:genome.exposures[event]+1};
  const count=exposures[event];
  const scale=count<=4?1:count<=12?0.75:count<=32?0.5:0.25;
  const genes={...genome.genes};
  for(const [key,base] of Object.entries(CHANGES[event])){
    const diff=Math.sign(base)*Math.max(1,Math.round(Math.abs(base)*scale));
    genes[key]=Math.max(0,Math.min(510,genes[key]+diff));
  }
  return assemble(genes,genome.revision+1,exposures);
}
function evolveCompanion(world,event){
  if(!world||!record(world))throw Error('Invalid evolving companion');
  const next=evolveGenome(world.genome,event);
  if(next.revision===world.genome.revision)return false;
  world.genome=next;
  world.phenotype=phenotypeFor(next);
  return true;
}

return {GENOME_SCHEMA,LEGACY_GENOME_SCHEMA,TRAIT_KEYS,EVOLUTION_EVENTS,seededRandom,validateGenome,neutralGenome,createGenome,migrateLegacyGenome,phenotypeFor,traitFor,evolveGenome,evolveCompanion};
})();
// world/creature-profile.mjs
__modules["world/creature-profile.mjs"]=(()=>{
const __moduleURL=new URL("./world/creature-profile.mjs",document.baseURI).href;
// Session-local creature personality, separate from painted character choice.
// This is a Tavi design contract, NOT a decoded Creatures .GEN/.EXP genome.
const {traitFor}=__modules["world/genetics.mjs"];
const PROFILE_SCHEMA='tavi.creature-profile/v1';
const PERSONALITY_KEYS=Object.freeze(['curiosity','sociability','playfulness','calmness']);
function createProfile(preferences={}){
  const profile={schema:PROFILE_SCHEMA,preferences:{},experience:{}};
  for(const [id,value]of Object.entries(preferences)){
    if(!/^[a-z][a-z0-9-]{1,39}$/.test(id)||!Number.isFinite(value)||value< -1||value>1)throw Error('Invalid companion preference');
    profile.preferences[id]=value;
  }
  return profile;
}
function preferenceFor(state,id){
  const value=state.profile?.preferences?.[id];
  return Number.isFinite(value)?Math.max(-1,Math.min(1,value)):0;
}
function rememberExperience(s,id){
  if(!s.profile?.experience)return;
  const previous=s.profile.experience[id]??0;
  s.profile.experience[id]=Math.min(50,previous+1);
}
function selectAutonomousObject(s,candidates,random=Math.random){
  if(!candidates.length)return null;
  // In opt-in care mode urgent needs take precedence; personality only adjusts
  // tie/near-tie choices, preserving the companion's current autonomy model.
  if(s.care){
    return [...candidates].sort((a,b)=>{
      const score=item=>100-(s.needs[item.need]??100)+preferenceFor(s,item.id)*10
        +(item.action==='play'?traitFor(s,'playfulness')*4:0);
      return score(b)-score(a);
    })[0];
  }
  // A bounded weighted draw: interests matter without requiring an LLM or
  // any external AI services. random() is injectable for deterministic QA.
  const weights=candidates.map(item=>{
    const novelty=1+traitFor(s,'curiosity')*(s.visits?.[item.id]?0:.5);
    const playful=item.action==='play'?0.6+traitFor(s,'playfulness')*.8:1;
    const restful=item.action==='sleep'?1.2-traitFor(s,'calmness')*.4:1;
    return Math.max(.25,(1+preferenceFor(s,item.id))*novelty*playful*restful);
  });
  const sum=weights.reduce((a,b)=>a+b,0);
  let draw=Math.min(1-Number.EPSILON,Math.max(0,Number(random())||0))*sum;
  for(let i=0;i<candidates.length;i++){draw-=weights[i];if(draw<0)return candidates[i];}
  return candidates.at(-1);
}

return {PROFILE_SCHEMA,PERSONALITY_KEYS,createProfile,preferenceFor,rememberExperience,selectAutonomousObject};
})();
// world/simulation.mjs
__modules["world/simulation.mjs"]=(()=>{
const __moduleURL=new URL("./world/simulation.mjs",document.baseURI).href;
const {objects,objectById,isObjectAvailable,initialObjectState,completeObjectUse,refillObject}=__modules["world/object-catalog.mjs"];
const {createProfile,rememberExperience,selectAutonomousObject}=__modules["world/creature-profile.mjs"];
const {createGenome,validateGenome,phenotypeFor,traitFor,evolveCompanion}=__modules["world/genetics.mjs"];

const WORLD_WIDTH = 2400;
const rooms = [
  { id:'kitchen', name:'Kitchen', x:0, color:'#e4d5ac' },
  { id:'dining', name:'Dining room', x:480, color:'#d5d8b4' },
  { id:'bathroom', name:'Bathroom', x:960, color:'#c3dbd2' },
  { id:'bedroom', name:'Bedroom', x:1440, color:'#d6cad9' },
  { id:'garden', name:'Garden', x:1920, color:'#acc8a0' },
];
function createWorld({preferences={},genome=null,genomeSeed=0x54415649}={}) {
  const initialGenome=genome??createGenome(genomeSeed);
  validateGenome(initialGenome);
  const safeGenome=structuredClone(initialGenome);
  return {x:690,facing:1,target:null,action:'idle',time:0,remaining:4,decisionIn:5,
    care:false,paused:false,lookUntil:0,nextBondEvolutionAt:0,emotion:'content',message:'Taking in the new home.',
    needs:{fullness:76,cleanliness:86,happiness:82,energy:72,affection:78},
    form:'cat',genome:safeGenome,phenotype:phenotypeFor(safeGenome),profile:createProfile(preferences),objectState:initialObjectState(),visits:{},memories:[],lastVisited:null,requests:0};
}
const clamp=n=>Math.max(0,Math.min(100,n));
function remember(s,text) {s.memories=[text,...s.memories.filter(m=>m!==text)].slice(0,6);}
function finishVisit(s) {
  const object=objectById(s.target);
  if(!object)return;
  if(!completeObjectUse(s,object.id)){
    s.target=null;s.action='idle';s.remaining=3;return;
  }
  rememberExperience(s,object.id);
  // A successful completed interaction changes this individual's genome.
  const event=object.action==='eat'?'nourish':object.action==='sit'?'bond':object.action==='sleep'?'rest':object.action==='bathe'?'bathe':'play';
  evolveCompanion(s,event);
  if(!s.visits[object.id])evolveCompanion(s,'explore');
  s.visits[object.id]=(s.visits[object.id]??0)+1;
  s.lastVisited=object.id;
  if(s.visits[object.id]===2)remember(s,`Visited the ${object.label.toLowerCase()} twice. A small routine is forming.`);
  else if(s.visits[object.id]===1)remember(s,`Discovered the ${object.label.toLowerCase()}.`);
  s.target=null;s.action='idle';s.remaining=3;s.emotion='content';
}
function requestObject(s,id) {
  const object=objectById(id);
  if(!object)return false;
  if(!isObjectAvailable(s,id)){s.message=`The ${object.label.toLowerCase()} is empty. Refill it first.`;return false;}
  s.requests++;
  if(s.action==='sleep' && s.remaining>2) {s.message='Still enjoying a nap. Maybe in a moment.';s.emotion='sleepy';return false;}
  if(s.action==='bathe' && s.remaining>2) {s.message='Not quite finished in the bath yet.';return false;}
  // Deterministic occasional refusal makes the prototype reviewable and testable.
  if(s.requests%4===0 && s.action==='walk') {s.message='A curious glance… then back to the current plan.';s.emotion='curious';return false;}
  s.target=id;s.action='walk';s.emotion='curious';s.message=`An invitation to the ${object.label.toLowerCase()}. On the way.`;return true;
}
function express(s,action) {
  if(action==='look') {
    if(s.action==='sleep'){s.message='Eyes still closed. Let’s let this nap finish.';return false;}
    s.lookUntil=s.time+4;s.emotion='curious';s.message='Turns to look at you, with a curious little glance.';return true;
  }
  if(action==='pet') {s.lookUntil=s.time+4;s.emotion='happy';s.needs.affection=clamp(s.needs.affection+6+4*traitFor(s,'sociability'));s.message='Leans into your hand.';remember(s,'Shared a quiet moment together.');
    // Petting is immediate, but it cannot farm infinite evolution in one frame.
    if(!s.paused&&s.time>=s.nextBondEvolutionAt){evolveCompanion(s,'bond');s.nextBondEvolutionAt=s.time+30;}
    return true;}
  if(action==='wave') {
    if(s.action==='sleep'||s.action==='bathe'){s.message='A dance can wait until this is finished.';return false;}
    s.target=null;s.action='wave';s.remaining=6;s.emotion='happy';s.message='A little wave, just for you.';return true;
  }
  return false;
}
function tick(s,seconds,random=Math.random) {
  if(s.paused)return;
  const dt=Math.max(0,Math.min(.1,Number.isFinite(seconds)?seconds:0));s.time+=dt;
  if(s.care) for(const key of ['fullness','cleanliness','happiness','energy']){
    // Tiny optional on-screen metabolic effects. No offscreen/offline catch-up.
    const multiplier=key==='fullness'?0.75+traitFor(s,'appetite')*.5:key==='energy'?1.25-traitFor(s,'stamina')*.5:1;
    s.needs[key]=clamp(s.needs[key]-dt*.035*multiplier);
  }
  if(s.action==='walk') {
    const object=objectById(s.target);
    if(!object||!isObjectAvailable(s,object.id)){s.action='idle';s.target=null;return;}
    const delta=object.x-s.x;s.facing=delta<0?-1:1;
    s.x=Math.max(50,Math.min(WORLD_WIDTH-50,s.x+Math.sign(delta)*Math.min(Math.abs(delta),dt*76)));
    if(Math.abs(object.x-s.x)<1){s.action=object.action;s.remaining=object.duration;s.message=`Spending a moment at the ${object.label.toLowerCase()}.`;s.emotion=object.action==='sleep'?'sleepy':'happy';}
    return;
  }
  s.remaining-=dt;
  if(s.remaining>0)return;
  if(s.target)finishVisit(s);
  else if(s.action==='wave'){s.action='idle';s.remaining=3;s.emotion='content';return;}
  else {
    const available=objects.filter(o=>isObjectAvailable(s,o.id));
    const alternatives=available.filter(o=>o.id!==s.lastVisited);
    const choice=selectAutonomousObject(s,alternatives.length?alternatives:available,random);
    if(!choice){s.action='idle';s.remaining=3;return;}
    s.target=choice.id;s.action='walk';s.message=`A little curiosity about the ${choice.label.toLowerCase()}.`;s.emotion='curious';
  }
}

return {WORLD_WIDTH,rooms,createWorld,requestObject,express,tick,objects,isObjectAvailable,refillObject};
})();
// world/forms.mjs
__modules["world/forms.mjs"]=(()=>{
const __moduleURL=new URL("./world/forms.mjs",document.baseURI).href;
// Only completed painted character packs can be selected in the main world.
const startingForms={
  cat:{label:'Cat',description:'Detailed painted fur, whiskers and an animated tail'},
  unicorn:{label:'Unicorn',description:'Detailed painted coat, flowing mane and gentle horn'}
};
function applyForm(state,id){
  if(!Object.hasOwn(startingForms,id))return false;
  state.form=id;
  return true;
}

return {startingForms,applyForm};
})();
// world/engine-port.mjs
__modules["world/engine-port.mjs"]=(()=>{
const __moduleURL=new URL("./world/engine-port.mjs",document.baseURI).href;
/**
 * Language-neutral companion-engine boundary.
 * JS is just the local reference adapter; a Rust/C#/native implementation can
 * consume the same serializable requests without owning Tavi's UI or identity.
 */
const {createWorld,tick,requestObject,express,refillObject}=__modules["world/simulation.mjs"];
const {applyForm}=__modules["world/forms.mjs"];
const ENGINE_PROTOCOL='tavi.companion.engine/v1';
const COMMANDS=new Set(['invite','express','choose-form','set-care','set-paused','refill']);
const EXPRESSIONS=new Set(['look','pet','wave']);
const ID=/^[a-z][a-z0-9-]{1,39}$/;
const keysMatch=(request,keys)=>Object.keys(request).every(key=>keys.includes(key));

function validateEngineRequest(request){
  if(!request||typeof request!=='object'||Array.isArray(request)||request.schema!==ENGINE_PROTOCOL)throw Error('Unsupported companion engine protocol');
  if(request.op==='advance'){
    if(!keysMatch(request,['schema','op','seconds'])||!Number.isFinite(request.seconds)||request.seconds<0||request.seconds>0.1)throw Error('Invalid engine step');
    return true;
  }
  if(request.op==='read'){if(!keysMatch(request,['schema','op']))throw Error('Invalid engine read');return true;}
  if(request.op!=='command'||!COMMANDS.has(request.command))throw Error('Unsupported engine operation');
  if(request.command==='invite'||request.command==='refill'){
    if(!keysMatch(request,['schema','op','command','id'])||typeof request.id!=='string'||!ID.test(request.id))throw Error('Invalid object ID');
  }else if(request.command==='express'){
    if(!keysMatch(request,['schema','op','command','action'])||!EXPRESSIONS.has(request.action))throw Error('Invalid expression');
  }else if(request.command==='choose-form'){
    if(!keysMatch(request,['schema','op','command','form'])||typeof request.form!=='string'||!ID.test(request.form))throw Error('Invalid form');
  }else if(!keysMatch(request,['schema','op','command','enabled'])||typeof request.enabled!=='boolean')throw Error('Invalid toggle');
  return true;
}

function createLocalCompanionEngine({state=createWorld(),random=Math.random}={}){
  if(!state||typeof state!=='object'||typeof random!=='function')throw Error('Invalid engine configuration');
  let revision=0;
  function advance(seconds){
    validateEngineRequest({schema:ENGINE_PROTOCOL,op:'advance',seconds});
    if(!state.paused){tick(state,seconds,random);revision++;}
    return state;
  }
  function command(type,value){
    let message={schema:ENGINE_PROTOCOL,op:'command',command:type};
    if(type==='invite'||type==='refill')message.id=value;
    else if(type==='express')message.action=value;
    else if(type==='choose-form')message.form=value;
    else message.enabled=value;
    validateEngineRequest(message);
    let accepted=false;
    switch(type){
      case 'invite':accepted=requestObject(state,value);break;
      case 'express':accepted=express(state,value);break;
      case 'choose-form':accepted=applyForm(state,value);break;
      case 'set-care':state.care=value;accepted=true;break;
      case 'set-paused':state.paused=value;accepted=true;break;
      case 'refill':accepted=refillObject(state,value);break;
    }
    if(accepted)revision++;
    return accepted;
  }
  function exchange(message){
    validateEngineRequest(message);
    let accepted=true;
    if(message.op==='advance')advance(message.seconds);
    if(message.op==='command'){
      const value=message.command==='express'?message.action:message.command==='choose-form'?message.form:
        message.command==='set-care'||message.command==='set-paused'?message.enabled:message.id;
      accepted=command(message.command,value);
    }
    // Structured-clone/JSON compatible; external/native adapters can return the
    // same shape without sharing JS object references or DOM access.
    return {schema:ENGINE_PROTOCOL,ok:accepted,revision,state:JSON.parse(JSON.stringify(state))};
  }
  return {get state(){return state;},get revision(){return revision;},advance,command,exchange};
}

return {ENGINE_PROTOCOL,validateEngineRequest,createLocalCompanionEngine};
})();
// tavi-sdk.mjs
__modules["tavi-sdk.mjs"]=(()=>{
const __moduleURL=new URL("./tavi-sdk.mjs",document.baseURI).href;
/** Public, tokenless Tavi extension-frame SDK.
 * v1 capabilities are discoverable; future data facades deliberately fail closed
 * until the host and authoritative LoopRD component implement that operation.
 */
function createTaviExtensionSDK(target=window.parent,source=window){
 let nextId=0;
 const pending=new Map();
 const channel='tavi.extension/v1';
 const receiver=e=>{
  if(e.source!==target||e.data?.channel!==channel||e.data?.direction!=='response')return;
  const item=pending.get(e.data.id);if(!item)return;pending.delete(e.data.id);clearTimeout(item.timer);
  if(e.data.ok)item.resolve(e.data.result);else item.reject(Error(e.data.error||'Extension request failed'));
 };
 source.addEventListener('message',receiver);
 const request=(method,args={})=>{
  const id=++nextId;
  return new Promise((resolve,reject)=>{
   if(pending.size>=20)return reject(Error('Too many extension requests'));
   const timer=setTimeout(()=>{pending.delete(id);reject(Error('Tavi host did not respond'));},5000);
   pending.set(id,{resolve,reject,timer});
   target.postMessage({channel,direction:'request',id,method,...args},'*');
  });
 };
 const call=(method,params={})=>request(method,{params});
 return {
  info:()=>request('host.info'),
  capabilities:()=>request('host.capabilities'),
  storage:{get:key=>request('storage.get',{key}),set:(key,value)=>request('storage.set',{key,value})},
  ui:{toast:message=>request('ui.toast',{message}),close:()=>request('ui.close'),requestGameLaunch:handoff=>request('ui.requestGameLaunch',{handoff})},
  companion:{publishPreview:preview=>request('companion.preview',{preview})},
  // Future shared-service APIs. Every call is checked by the host broker and
  // again by the corresponding server; this SDK never stores a Social bearer.
  wallet:{balance:params=>call('wallet.balance',params),transactions:params=>call('wallet.transactions',params),transfer:params=>call('wallet.transfer',params)},
  pets:{list:params=>call('pets.list',params),get:params=>call('pets.get',params),command:params=>call('pets.command',params)},
  contacts:{list:params=>call('contacts.list',params)},
  messages:{list:params=>call('messages.list',params),send:params=>call('messages.send',params)},
  events:{list:params=>call('events.list',params)},
  services:{list:()=>call('services.list')},
  dispose:()=>{source.removeEventListener('message',receiver);for(const item of pending.values()){clearTimeout(item.timer);item.reject(Error('Extension disconnected'));}pending.clear();}
 };
}

return {createTaviExtensionSDK};
})();
// world/tavi-host.mjs
__modules["world/tavi-host.mjs"]=(()=>{
const __moduleURL=new URL("./world/tavi-host.mjs",document.baseURI).href;
/**
 * Optional Tavi host connection. Only the existing Tavi extension/v1 bridge is
 * used; this module does not handle Social credentials or game API endpoints.
 */
const {createTaviExtensionSDK}=__modules["tavi-sdk.mjs"];
async function connectTaviHost({windowRef,createSDK=createTaviExtensionSDK}={}){
  const win=windowRef??(typeof window!=='undefined'?window:null);
  if(!win||!win.parent||win.parent===win)return null;
  const sdk=createSDK(win.parent,win);
  try{
    const info=await sdk.info();
    if(info?.api!=='1.0.0'||info?.mode!=='embedded'||info.extensionId!=='org.tavi.community.companion')throw Error('Not the companion host');
    const capabilities=await sdk.capabilities();
    if(!Array.isArray(capabilities)||!capabilities.includes('ui.panel'))throw Error('Tavi panel unavailable');
    return {
      mode:'tavi',
      canStore:capabilities.includes('storage.private'),
      read:key=>sdk.storage.get(key),
      write:(key,value)=>sdk.storage.set(key,value),
      close:()=>sdk.ui.close(),
      publishPortrait:preview=>sdk.companion.publishPreview(preview),
      dispose:()=>sdk.dispose(),
    };
  }catch{
    sdk.dispose();return null;
  }
}

return {connectTaviHost};
})();
// world/session-codec.mjs
__modules["world/session-codec.mjs"]=(()=>{
const __moduleURL=new URL("./world/session-codec.mjs",document.baseURI).href;
/** Portable, bounded session data; no DOM, Tavi account token, or JS class instances. */
const {createWorld,WORLD_WIDTH}=__modules["world/simulation.mjs"];
const {objects,initialObjectState}=__modules["world/object-catalog.mjs"];
const {startingForms}=__modules["world/forms.mjs"];
const {neutralGenome,validateGenome,migrateLegacyGenome}=__modules["world/genetics.mjs"];
const SESSION_SCHEMA='tavi.companion.session/v3';
const LEGACY_SESSION_SCHEMA='tavi.companion.session/v1';
const PREVIOUS_SESSION_SCHEMA='tavi.companion.session/v2';
const SESSION_STORAGE_KEY='companion_session_v1';
const MAX_BYTES=8192; // Matches the currently deployed Tavi extension storage limit.
const needNames=['fullness','cleanliness','happiness','energy','affection'];
const id=/^[a-z][a-z0-9-]{1,39}$/;
const bounded=(v,min,max)=>Number.isFinite(v)&&v>=min&&v<=max;
const obj=o=>Boolean(o&&typeof o==='object'&&!Array.isArray(o));

function encodeSession({chosen,name,state}){
  if(!state||!obj(state.profile))throw Error('Invalid session state');
  const data={schema:SESSION_SCHEMA,chosen:chosen===true,name:String(name??'').slice(0,32),world:{
    form:state.form,x:state.x,care:state.care===true,genome:state.genome,
    needs:Object.fromEntries(needNames.map(k=>[k,state.needs[k]])),
    preferences:{...state.profile.preferences},experience:{...state.profile.experience},
    objectState:Object.fromEntries(objects.filter(o=>o.capacity).map(o=>[o.id,{usesRemaining:state.objectState?.[o.id]?.usesRemaining??o.capacity}])),
    visits:{...state.visits},lastVisited:state.lastVisited,
    memories:state.memories.slice(0,6),
  }};
  const json=JSON.stringify(data);
  if(json.length>MAX_BYTES)throw Error('Companion session is too large');
  // Round-trip through the same validation used for untrusted host storage.
  if(!decodeSession(json))throw Error('Invalid companion session snapshot');
  return json;
}

/** Strictly validates v3 and explicitly upgrades v1/v2 saves; unknown versions stay untouched. */
function decodeSession(raw){
  if(typeof raw!=='string'||raw.length>MAX_BYTES||!raw.length)return null;
  let data;try{data=JSON.parse(raw);}catch{return null;}
  if(!obj(data)||![SESSION_SCHEMA,LEGACY_SESSION_SCHEMA,PREVIOUS_SESSION_SCHEMA].includes(data.schema)||typeof data.chosen!=='boolean'||typeof data.name!=='string'||data.name.length>32||!obj(data.world))return null;
  const w=data.world;
  if(!Object.hasOwn(startingForms,w.form)||!bounded(w.x,0,WORLD_WIDTH)||typeof w.care!=='boolean'||!obj(w.needs)||!obj(w.preferences)||!obj(w.experience)||!obj(w.objectState)||!obj(w.visits)||!Array.isArray(w.memories)||w.memories.length>6)return null;
  for(const k of needNames)if(!bounded(w.needs[k],0,100))return null;
  if(Object.keys(w.needs).some(k=>!needNames.includes(k)))return null;
  const validPreference=(key,value)=>id.test(key)&&bounded(value,-1,1);
  if(Object.keys(w.preferences).length>32||Object.entries(w.preferences).some(([k,v])=>!validPreference(k,v)))return null;
  if(Object.keys(w.experience).length>32||Object.entries(w.experience).some(([k,v])=>!id.test(k)||!Number.isSafeInteger(v)||v<0||v>50))return null;
  const capacity=objects.filter(o=>o.capacity);
  if(Object.keys(w.objectState).some(k=>!capacity.some(o=>o.id===k)))return null;
  for(const o of capacity)if(!obj(w.objectState[o.id])||!Number.isSafeInteger(w.objectState[o.id].usesRemaining)||w.objectState[o.id].usesRemaining<0||w.objectState[o.id].usesRemaining>o.capacity)return null;
  if(Object.keys(w.visits).length>32||Object.entries(w.visits).some(([k,v])=>!id.test(k)||!Number.isSafeInteger(v)||v<0||v>1000000))return null;
  if(w.lastVisited!==null&&(typeof w.lastVisited!=='string'||!id.test(w.lastVisited)))return null;
  if(w.memories.some(m=>typeof m!=='string'||m.length>160))return null;
  let genome;
  if(data.schema===LEGACY_SESSION_SCHEMA){
    if(Object.hasOwn(w,'genome'))return null;
    // Migrating an existing creature must not randomize its established habits.
    genome=neutralGenome();
  }else if(data.schema===PREVIOUS_SESSION_SCHEMA){
    try{genome=migrateLegacyGenome(w.genome);}catch{return null;}
  }else {
    try{validateGenome(w.genome);}catch{return null;}
    genome=w.genome;
  }
  // Never replay offline time or interrupted activities. Invalid data cannot
  // mutate an existing live world; a fresh validated world is constructed.
  let state;try{state=createWorld({preferences:w.preferences,genome});}catch{return null;}
  state.form=w.form;state.x=w.x;state.care=w.care;
  state.needs={...w.needs};state.profile.experience={...w.experience};
  state.objectState=initialObjectState();
  for(const o of capacity)state.objectState[o.id]={usesRemaining:w.objectState[o.id].usesRemaining};
  state.visits={...w.visits};state.lastVisited=w.lastVisited;
  state.memories=[...w.memories];state.action='idle';state.target=null;state.remaining=4;
  return {chosen:data.chosen,name:data.name,state,migrated:data.schema!==SESSION_SCHEMA};
}

return {SESSION_SCHEMA,LEGACY_SESSION_SCHEMA,PREVIOUS_SESSION_SCHEMA,SESSION_STORAGE_KEY,encodeSession,decodeSession};
})();
// world/companion-colors.mjs
__modules["world/companion-colors.mjs"]=(()=>{
const __moduleURL=new URL("./world/companion-colors.mjs",document.baseURI).href;
const neutralCoat={channel:'coat',chroma:[0,.18],lightness:[.13,1],sourceLightness:.86};
const furRules=[
 {channel:'cream',hue:[30,65],lightness:[.78,.98],saturation:[.18,1],sourceLightness:.85},
 {channel:'markings',hue:[0,28],lightness:[.26,.62],saturation:[.22,1],sourceLightness:.45},
 {channel:'coat',hue:[10,58],lightness:[.26,.96],saturation:[.2,1],sourceLightness:.64}
];
const colorProfiles={
 unicorn:{
  label:'Unicorn colors',defaultPreset:'pearl',
  defaults:{coat:'#e9e5df',mane:'#aa89d9',horn:'#e4bd6b',hooves:'#645275'},
  channels:[{id:'coat',label:'Coat'},{id:'mane',label:'Mane & tail'},{id:'horn',label:'Horn'},{id:'hooves',label:'Hooves'}],
  presets:{
   pearl:{label:'Pearl',colors:{coat:'#e9e5df',mane:'#aa89d9',horn:'#e4bd6b',hooves:'#645275'}},
   twilight:{label:'Twilight',colors:{coat:'#53617c',mane:'#d592bb',horn:'#efc575',hooves:'#40364f'}},
   meadow:{label:'Meadow',colors:{coat:'#bfd1ae',mane:'#548e94',horn:'#e2c17a',hooves:'#526b57'}}
  },
  materials:{
   coat:[neutralCoat],
   limb:[{channel:'hooves',hue:[145,205],saturation:[.2,1],lightness:[.1,1],sourceLightness:.42},neutralCoat],
   mane:[{channel:'mane',lightness:[.1,1],sourceLightness:.58}],
   horn:[{channel:'horn',lightness:[.1,1],sourceLightness:.62}]
  }
 },
 cat:{
  label:'Cat colors',defaultPreset:'ginger',preserveDefaults:true,
  defaults:{coat:'#dba36a',markings:'#ac6038',cream:'#fae4b6',innerEar:'#dca6ab'},
  channels:[{id:'coat',label:'Fur'},{id:'markings',label:'Stripes'},{id:'cream',label:'Muzzle & paws'},{id:'innerEar',label:'Inner ears'}],
  presets:{
   ginger:{label:'Ginger',colors:{coat:'#dba36a',markings:'#ac6038',cream:'#fae4b6',innerEar:'#dca6ab'}},
   silver:{label:'Silver',colors:{coat:'#a8adb8',markings:'#53606d',cream:'#f2ecdf',innerEar:'#cf9da8'}},
   lavender:{label:'Lavender',colors:{coat:'#b497ca',markings:'#6d527d',cream:'#f2e8e7',innerEar:'#d6a3bd'}}
  },
  materials:{
   fur:furRules,
   earFur:[
    {channel:'innerEar',hue:[330,360],saturation:[.12,1],lightness:[.35,.94],sourceLightness:.76},
    {channel:'innerEar',hue:[0,15],saturation:[.12,1],lightness:[.35,.94],sourceLightness:.76},
    ...furRules
   ]
  }
 }
};
const unicornPalette=colorProfiles.unicorn.defaults;
const unicornPresets=Object.fromEntries(Object.entries(colorProfiles.unicorn.presets).map(([id,p])=>[id,p.colors]));
function validateColorProfile(profile){
 if(!profile||!Array.isArray(profile.channels)||!profile.channels.length||profile.channels.length>12||!profile.defaults||!profile.materials)throw Error('Invalid companion color profile');
 const ids=new Set();
 for(const {id,label}of profile.channels){
  if(!/^[a-zA-Z][a-zA-Z0-9]*$/.test(id)||ids.has(id)||typeof label!=='string'||!label)throw Error('Invalid color channel');
  ids.add(id);
 }
 validatePalette(profile.defaults,profile);
 if(!profile.presets?.[profile.defaultPreset])throw Error('Missing default palette');
 for(const preset of Object.values(profile.presets))validatePalette(preset.colors,profile);
 for(const rules of Object.values(profile.materials)){
  if(!Array.isArray(rules)||!rules.length||rules.length>16)throw Error('Invalid material rules');
  for(const rule of rules){
   if(!ids.has(rule.channel)||!Number.isFinite(rule.sourceLightness)||rule.sourceLightness<=0||rule.sourceLightness>=1)throw Error('Invalid material channel');
   for(const key of ['hue','saturation','lightness','chroma'])if(rule[key]){
    const range=rule[key],max=key==='hue'?360:1;
    if(!Array.isArray(range)||range.length!==2||range.some(n=>!Number.isFinite(n))||range[0]<0||range[1]>max||range[0]>range[1])throw Error('Invalid color selector');
   }
  }
 }
 return profile;
}
function validatePalette(palette,profile=colorProfiles.unicorn){
 if(!palette||profile.channels.some(({id})=>!/^#[0-9a-f]{6}$/i.test(palette[id]??'')))throw Error('Invalid companion palette');
 return palette;
}
function hsl(r,g,b){
 r/=255;g/=255;b/=255;const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min,l=(max+min)/2;
 let h=0;if(d)h=max===r?((g-b)/d+(g<b?6:0)):max===g?(b-r)/d+2:(r-g)/d+4;
 return [h*60,d?d/(1-Math.abs(2*l-1)):0,l];
}
function rgb(h,s,l){
 const c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2;
 const v=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];
 return v.map(n=>Math.round((n+m)*255));
}
// Materials, selectors and user-facing channels come from the asset pack.
// This runs only when preparing cached tiles, never on an animation frame.
function recolorPixels(data,material,palette,profile=colorProfiles.unicorn,{width=0,height=0,protectedRegions=[]}={}){
 validatePalette(palette,profile);
 const rules=profile.materials[material];if(!rules)throw Error('Unknown companion material: '+material);
 if(profile.preserveDefaults&&profile.channels.every(({id})=>palette[id].toLowerCase()===profile.defaults[id].toLowerCase()))return data;
 const targets=Object.fromEntries(profile.channels.map(({id})=>[id,hsl(...[1,3,5].map(i=>parseInt(palette[id].slice(i,i+2),16)))]));
 for(let i=0;i<data.length;i+=4){
  if(!data[i+3])continue;
  const [h,s,l]=hsl(data[i],data[i+1],data[i+2]);
  if(protectedRegions.length&&width&&height){
   const x=((i/4)%width+.5)/width,y=(Math.floor(i/4/width)+.5)/height;
   if(protectedRegions.some(region=>h>=region.hue[0]&&h<=region.hue[1]&&((x-region.center[0])/region.radius[0])**2+((y-region.center[1])/region.radius[1])**2<=1))continue;
  }
  const chroma=(Math.max(data[i],data[i+1],data[i+2])-Math.min(data[i],data[i+1],data[i+2]))/255;
  let rule;
  for(const candidate of rules){
   if((!candidate.hue||(h>=candidate.hue[0]&&h<=candidate.hue[1]))&&(!candidate.saturation||(s>=candidate.saturation[0]&&s<=candidate.saturation[1]))&&(!candidate.lightness||(l>=candidate.lightness[0]&&l<=candidate.lightness[1]))&&(!candidate.chroma||(chroma>=candidate.chroma[0]&&chroma<=candidate.chroma[1]))){rule=candidate;break;}
  }
  if(!rule)continue;
  const channel=rule.channel;
  if(profile.preserveDefaults&&palette[channel].toLowerCase()===profile.defaults[channel].toLowerCase())continue;
  const [th,ts,tl]=targets[channel],base=rule.sourceLightness;
  const light=l<base?l*(tl/base):tl+(1-tl)*((l-base)/(1-base));
  const result=rgb(th,ts*(l>.9?.65:1),Math.max(0,Math.min(1,light)));
  data[i]=result[0];data[i+1]=result[1];data[i+2]=result[2];
 }
 return data;
}


return {colorProfiles,unicornPalette,unicornPresets,validateColorProfile,validatePalette,recolorPixels};
})();
// world/rig-diagnostics.mjs
__modules["world/rig-diagnostics.mjs"]=(()=>{
const __moduleURL=new URL("./world/rig-diagnostics.mjs",document.baseURI).href;
// Source-only diagnostic geometry: no mutation of atlases or persistent creature state.
// Bounds are expressed in the same local coordinates used by stamp() in the painter.
const RIG_INSPECTOR_MODES=Object.freeze(['off','head','legs','all']);
const PART_GROUPS={
  head:/^(front|side|front-blink|side-blink|ear|horn|mane)/,
  legs:/^leg/,
};
function inRigGroup(id,mode){
  if(!RIG_INSPECTOR_MODES.includes(mode))throw Error('Unsupported rig inspector mode');
  return mode==='all'||(mode!=='off'&&PART_GROUPS[mode].test(id));
}
function inspectRigLayout(layout,mode='all'){
  if(!layout||!layout.parts||typeof layout.parts!=='object')throw Error('Missing rig layout');
  return Object.entries(layout.parts).filter(([id])=>inRigGroup(id,mode)).map(([id,part])=>{
    const {source,pivot,size,atlas}=part;
    if(!Array.isArray(source)||source.length!==4||!Array.isArray(pivot)||pivot.length!==2||!Array.isArray(size)||size.length!==2||![...source,...pivot,...size].every(Number.isFinite))throw Error('Invalid rig part '+id);
    return {id,atlas:atlas||'base',source:[...source],size:[...size],pivot:[...pivot],relativeBounds:[-pivot[0],-pivot[1],size[0],size[1]]};
  });
}
// Applied AFTER drawImage while in the exact transformed source-part frame.
// With diagnostics=off no extra drawing happens in the production renderer.
function drawRigPartOutline(ctx,id,part,mode){
  if(!inRigGroup(id,mode))return;
  const [w,h]=part.size,[px,py]=part.pivot;
  ctx.save();
  ctx.strokeStyle=/^leg/.test(id)?'#14647b':/^mane/.test(id)?'#b52f7b':'#d66a16';
  ctx.lineWidth=.75;
  ctx.strokeRect(-px,-py,w,h);
  ctx.beginPath();ctx.moveTo(-3,0);ctx.lineTo(3,0);ctx.moveTo(0,-3);ctx.lineTo(0,3);ctx.stroke();
  ctx.font='7px sans-serif';ctx.fillStyle=ctx.strokeStyle;
  ctx.fillText(id,-px,-py-2);
  ctx.restore();
}

return {RIG_INSPECTOR_MODES,inRigGroup,inspectRigLayout,drawRigPartOutline};
})();
// world/cat-painted.mjs
__modules["world/cat-painted.mjs"]=(()=>{
const __moduleURL=new URL("./world/cat-painted.mjs",document.baseURI).href;
// Painted raster parts share the existing cat-v1 motion tracks.
// Artwork provenance and CC0 scope: ../assets/CREDITS.md.
const {recolorPixels,validateColorProfile,validatePalette}=__modules["world/companion-colors.mjs"];
const {drawRigPartOutline,RIG_INSPECTOR_MODES}=__modules["world/rig-diagnostics.mjs"];
const paintedParts=['front','side','front-blink','side-blink','torso-front','torso-side','armLeft','armRight','legLeft','legRight','tail','earLeft','earRight','legSideLeft','legSideRight','earSideNear','earSideFar'];
const optionalParts=['horn','maneFront','maneSide','maneSideForelock','maneFrontBack'];
const companionParts=layout=>[...paintedParts,...optionalParts.filter(id=>layout.parts?.[id])];
function catPresentation(action,lookAtViewer){
  return {view:action==='walk'?'side':lookAtViewer?'front':'side',lookAtViewer:Boolean(lookAtViewer)};
}
function validatePaintedLayout(layout,width,height){
  if(layout.schema!==1||layout.width!==width||layout.height!==height)throw Error('Cat atlas dimensions do not match');
  for(const id of companionParts(layout)){
    const part=layout.parts[id];
    if(!part||!Array.isArray(part.source)||part.source.length!==4||!part.source.every(Number.isFinite))throw Error('Missing cat part: '+id);
    if(layout.colors&&!layout.colors.materials?.[part.recolor])throw Error('Missing part material: '+id);
    if(part.protectedRegions){
      if(!Array.isArray(part.protectedRegions)||part.protectedRegions.length>8)throw Error('Invalid protected color regions');
      for(const region of part.protectedRegions)for(const [key,max]of [['center',1],['radius',1],['hue',360]]){
        if(!Array.isArray(region[key])||region[key].length!==2||region[key].some(n=>!Number.isFinite(n)||n<0||n>max)||(key==='radius'&&region[key].some(n=>n===0))||(key==='hue'&&region[key][0]>region[key][1]))throw Error('Invalid protected color region');
      }
    }
    const [x,y,w,h]=part.source;
    const bounds=part.atlas?layout.atlases?.[part.atlas]:{width,height};
    if(!bounds||!Number.isFinite(bounds.width)||!Number.isFinite(bounds.height)||x<0||y<0||w<=0||h<=0||x+w>bounds.width||y+h>bounds.height||!Array.isArray(part.size)||part.size.length!==2||part.size.some(n=>!Number.isFinite(n)||n<=0||n>192)||!Array.isArray(part.pivot)||part.pivot.length!==2||!part.pivot.every(Number.isFinite))throw Error('Invalid cat part: '+id);
  }
  return layout;
}
function createPaintedCat(makeCanvas,atlas,layout,extraAtlases={},{palette=layout.colors?.defaults}={}){
  validatePaintedLayout(layout,atlas.naturalWidth??atlas.width,atlas.naturalHeight??atlas.height);
  if(layout.colors){validateColorProfile(layout.colors);validatePalette(palette,layout.colors);}
  const sourceColors=layout.colors?.preserveDefaults&&layout.colors.channels.every(({id})=>palette[id].toLowerCase()===layout.colors.defaults[id].toLowerCase());
  const tiles=new Map();let rgbaBytes=0;
  for(const id of companionParts(layout)){
    const p=layout.parts[id],c=makeCanvas(Math.ceil(p.size[0]*2),Math.ceil(p.size[1]*2));
    const source=p.atlas?extraAtlases[p.atlas]:atlas;
    const bounds=p.atlas?layout.atlases[p.atlas]:layout;
    if(!source||(source.naturalWidth??source.width)!==bounds.width||(source.naturalHeight??source.height)!==bounds.height)throw Error('Cat part atlas unavailable: '+id);
    c.getContext('2d').drawImage(source,...p.source,0,0,c.width,c.height);tiles.set(id,c);rgbaBytes+=c.width*c.height*4;
    if(p.recolor&&!sourceColors){
      const context=c.getContext('2d'),pixels=context.getImageData(0,0,c.width,c.height);
      if(!layout.colors)throw Error('Missing asset color profile');
      recolorPixels(pixels.data,p.recolor,palette,layout.colors,{width:c.width,height:c.height,protectedRegions:p.protectedRegions});context.putImageData(pixels,0,0);
    }
    if(id==='earSideNear'){
      const context=c.getContext('2d'),blend=context.createLinearGradient(0,0,0,c.height);
      blend.addColorStop(0,'#fff');blend.addColorStop(.65,'#fff');blend.addColorStop(1,'#ffffff00');
      context.globalCompositeOperation='destination-in';context.fillStyle=blend;context.fillRect(0,0,c.width,c.height);context.globalCompositeOperation='source-over';
    }
  }
  const armSegments=new Map();
  for(const id of ['armLeft','armRight'])for(const upper of [true,false]){
    const height=upper?30:24,c=makeCanvas(40,height*2),p=c.getContext('2d');
    p.drawImage(tiles.get(id),0,upper?0:36,40,height*2,0,0,40,height*2);
    // Rounded overlapping masks hide the rectangular crop edge at the elbow.
    p.globalCompositeOperation='destination-in';p.beginPath();
    p.rect(0,upper?0:12,40,upper?48:height*2-12);
    p.ellipse(20,upper?48:12,20,12,0,0,Math.PI*2);p.fill();p.globalCompositeOperation='source-over';
    armSegments.set(id+(upper?'Upper':'Lower'),c);rgbaBytes+=40*height*2*4;
  }
  let activeDiagnostics='off';
  function stamp(ctx,id,x,y,motion={},fit={}){
    const p=layout.parts[id];ctx.save();ctx.translate(x+(motion.x||0),y+(motion.y||0));ctx.rotate((motion.angle||0)*Math.PI/180);
    ctx.rotate((fit.angle||0)*Math.PI/180);ctx.scale(fit.scaleX??1,fit.scaleY??1);
    ctx.drawImage(tiles.get(fit.tile??id),-p.pivot[0],-p.pivot[1],...(fit.drawSize??p.size));
    if(activeDiagnostics!=='off')drawRigPartOutline(ctx,id,p,activeDiagnostics);ctx.restore();
  }
  // Both segments use the original painted arm tile, overlapping at the elbow.
  // Source crops preserve the fur instead of inventing a geometric joint.
  function arm(ctx,id,x,y,upper={},lower={},segment='both'){
    ctx.save();ctx.translate(x+(upper.x||0),y+(upper.y||0));ctx.rotate((upper.angle||0)*Math.PI/180);
    if(segment!=='lower')ctx.drawImage(armSegments.get(id+'Upper'),-10,-9,20,30);
    if(segment!=='upper'){
      ctx.translate(0,15);ctx.translate(lower.x||0,lower.y||0);ctx.rotate((lower.angle||0)*Math.PI/180);
      ctx.drawImage(armSegments.get(id+'Lower'),-10,-6,20,24);
    }
    ctx.restore();
  }
  function head(ctx,pose,view,blink){
    const m=pose.head??{};ctx.save();ctx.translate((m.x||0)+(view==='side'?4:0),-103+(m.y||0));ctx.rotate((m.angle||0)*Math.PI/180);
    const profile=view==='side';
    if(profile){
      // Profile projects the ears onto nearly the same screen position.
      // Painter order provides depth: far ear, skull, then near ear.
      // Head's +4 offset puts the near ear on the shoulder's x=8 axis.
      stamp(ctx,'earSideFar',0,-22,pose.earLeft);
      if(tiles.has('maneSide'))stamp(ctx,'maneSide',0,0);
      stamp(ctx,view+(blink?'-blink':''),0,0);
      if(tiles.has('maneSideForelock'))stamp(ctx,'maneSideForelock',0,0);
      stamp(ctx,'earSideNear',4,-22,pose.earRight);
      if(tiles.has('horn'))stamp(ctx,'horn',20,-22);
    }else{
      if(tiles.has('maneFrontBack'))stamp(ctx,'maneFrontBack',0,0);
      stamp(ctx,'earLeft',-20,-15,pose.earLeft);
      stamp(ctx,'earRight',20,-15,pose.earRight);
      stamp(ctx,view+(blink?'-blink':''),0,0);
      if(tiles.has('maneFront'))stamp(ctx,'maneFront',0,0);
      if(tiles.has('horn'))stamp(ctx,'horn',0,-24);
    }
    ctx.restore();
  }
  return {
    tileCount:tiles.size+armSegments.size,rgbaBytes,
    draw(ctx,x,ground,pose,{scale=1,view='side',lookAtViewer=false,blink=false,diagnostics='off'}={}){
      if(!RIG_INSPECTOR_MODES.includes(diagnostics))throw Error('Invalid diagnostics mode');
      const previous=activeDiagnostics;activeDiagnostics=diagnostics;
      ctx.save();ctx.imageSmoothingEnabled=true;ctx.translate(x,ground);ctx.scale(scale,scale);
      ctx.translate(pose.root?.x||0,pose.root?.y||0);
      stamp(ctx,'tail',-21,-26,pose.tail);
      // In profile both hips project onto the same walking plane. Widely
      // separated hip anchors made the side walk read as a frontal shuffle.
      stamp(ctx,view==='side'?'legSideLeft':'legLeft',view==='side'?-4:-14,-22,pose.legLeft);
      const torso=pose.torso??{};
      ctx.save();ctx.translate(torso.x||0,-57+(torso.y||0));ctx.rotate((torso.angle||0)*Math.PI/180);ctx.translate(0,57);
      const profile=view==='side',nearX=profile?8:21,shoulderY=-70;
      // The frontal right-arm drawing curls left, toward the belly. Both
      // profile paws must curl right, in the direction the cat is facing.
      const nearArmArt=profile?'armLeft':'armRight';
      arm(ctx,'armLeft',profile?-3:-21,shoulderY,pose.armLeft,pose.forearmLeft);
      stamp(ctx,'torso-'+view,0,-54);
      arm(ctx,nearArmArt,nearX,shoulderY,pose.armRight,pose.forearmRight,'upper');
      head(ctx,pose,lookAtViewer?'front':view,blink);
      arm(ctx,nearArmArt,nearX,shoulderY,pose.armRight,pose.forearmRight,'lower');
      ctx.restore();stamp(ctx,view==='side'?'legSideRight':'legRight',view==='side'?-1:14,-22,pose.legRight);ctx.restore();
      activeDiagnostics=previous;
    },
    portrait(ctx,x,y,{scale=1,blink=false,diagnostics='off'}={}){
      if(!RIG_INSPECTOR_MODES.includes(diagnostics))throw Error('Invalid diagnostics mode');
      const previous=activeDiagnostics;activeDiagnostics=diagnostics;
      ctx.save();ctx.imageSmoothingEnabled=true;ctx.translate(x,y+103*scale);ctx.scale(scale,scale);head(ctx,{},'front',blink);ctx.restore();
      activeDiagnostics=previous;
    }
  };
}
// Both companions use this renderer; the original name remains for older callers.
const createPaintedCompanion=createPaintedCat;

return {paintedParts,companionParts,catPresentation,validatePaintedLayout,createPaintedCat,createPaintedCompanion};
})();
// world/cat-motion.mjs
__modules["world/cat-motion.mjs"]=(()=>{
const __moduleURL=new URL("./world/cat-motion.mjs",document.baseURI).href;
// Motion is data, independent of the character's artwork and world simulation.
const catParts=['root','torso','head','earLeft','earRight','armLeft','armRight','forearmLeft','forearmRight','legLeft','legRight','tail'];
const channels=['x','y','angle'];
function validateClip(clip){
  if(!clip||clip.schema!==1||clip.rig!=='cat-v1'||!Number.isFinite(clip.duration)||clip.duration<=0||clip.duration>30||typeof clip.loop!=='boolean'||!Array.isArray(clip.tracks)||clip.tracks.length>60)throw Error('Invalid cat motion clip');
  const seen=new Set();
  for(const track of clip.tracks){
    const id=track.part+':'+track.channel;
    if(!catParts.includes(track.part)||!channels.includes(track.channel)||seen.has(id)||!Array.isArray(track.keys)||!track.keys.length||track.keys.length>120)throw Error('Invalid motion track');
    seen.add(id);let previous=-1;
    for(const key of track.keys){
      if(!Array.isArray(key)||key.length!==2||!key.every(Number.isFinite)||key[0]<0||key[0]>clip.duration||key[0]<=previous||Math.abs(key[1])>(track.channel==='angle'?180:48))throw Error('Invalid motion key');
      previous=key[0];
    }
  }
  return clip;
}
function sampleClip(clip,time){
  const t=clip.loop?((time%clip.duration)+clip.duration)%clip.duration:Math.max(0,Math.min(clip.duration,time));
  const pose=Object.fromEntries(catParts.map(id=>[id,{x:0,y:0,angle:0}]));
  for(const track of clip.tracks){
    let a=track.keys[0],b=a;
    for(const key of track.keys){if(key[0]<=t)a=key;else{b=key;break;}b=a;}
    const blend=b[0]===a[0]?0:(t-a[0])/(b[0]-a[0]);
    pose[track.part][track.channel]=a[1]+(b[1]-a[1])*blend;
  }
  return pose;
}

return {catParts,validateClip,sampleClip};
})();
// world/studio-renderer.mjs
__modules["world/studio-renderer.mjs"]=(()=>{
const __moduleURL=new URL("./world/studio-renderer.mjs",document.baseURI).href;
// The main world uses only the same detailed painted character rigs as the art studio.
// No procedural/pixel character renderer or fallback is permitted here.
const {createPaintedCompanion,catPresentation}=__modules["world/cat-painted.mjs"];
const {sampleClip,validateClip}=__modules["world/cat-motion.mjs"];
const paintedSpecies=Object.freeze(['cat','unicorn']);
const packs=new Map();
let loading=null,clips=null,loadError=null;
const makeCanvas=(width,height)=>{
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;return canvas;
};
async function loadImage(file){return __loadBundledImage(file);}
async function loadJSON(file){return __bundledJSON(file);}
function loadPaintedCharacters(){
  if(loading)return loading;
  if(typeof document==='undefined'||typeof Image==='undefined'||typeof fetch!=='function')return Promise.resolve(false);
  loading=(async()=>{
    const [motion,catAtlas,catLayout,catLegs,catEars,unicornAtlas,unicornLayout,unicornMane]=await Promise.all([
      loadJSON('./cat-clips.json'),
      loadImage('cat-painted-atlas.png'),loadJSON('./cat-painted-layout.json'),loadImage('cat-profile-legs.png'),loadImage('cat-profile-ears.png'),
      loadImage('unicorn-atlas.png'),loadJSON('./unicorn-layout.json'),loadImage('unicorn-mane-v2.png')
    ]);
    for(const clip of Object.values(motion))validateClip(clip);
    clips=motion;
    packs.set('cat',createPaintedCompanion(makeCanvas,catAtlas,catLayout,{profileLegs:catLegs,profileEars:catEars},{palette:catLayout.colors.defaults}));
    packs.set('unicorn',createPaintedCompanion(makeCanvas,unicornAtlas,unicornLayout,{unicornMane},{palette:unicornLayout.colors.defaults}));
    return true;
  })().catch(error=>{loadError=error;return false;});
  return loading;
}
const paintedError=()=>loadError;
const paintedReady=()=>packs.size===paintedSpecies.length&&Boolean(clips);
const clipForAction=action=>action==='walk'?'walk':action==='wave'?'wave':'idle';
function drawPaintedWorld(ctx,x,ground,state,{reducedMotion=false,scale=1,lookAtViewer=false}={}){
  const art=packs.get(state.form);if(!art||!clips)return false;
  const clipName=clipForAction(state.action);
  const pose=sampleClip(clips[clipName],reducedMotion?0:state.time);
  const blink=!reducedMotion&&state.action!=='sleep'&&state.time%4.2>4;
  ctx.save();
  if(state.facing<0){ctx.translate(Math.round(x)*2,0);ctx.scale(-1,1);}
  art.draw(ctx,Math.round(x),Math.round(ground),pose,{scale:1.06*scale,...catPresentation(clipName,lookAtViewer),blink});
  ctx.restore();
  return true;
}
function drawPaintedPortrait(ctx,state,{x=180,y=210,scale=3,reducedMotion=false}={}){
  const art=packs.get(state.form);if(!art||!clips)return false;
  const blink=!reducedMotion&&state.action!=='sleep'&&state.time%4.2>4;
  art.portrait(ctx,Math.round(x),Math.round(y-12),{scale:.92*scale,blink});
  return true;
}

return {paintedSpecies,loadPaintedCharacters,paintedError,paintedReady,clipForAction,drawPaintedWorld,drawPaintedPortrait};
})();
// world/scenery.mjs
__modules["world/scenery.mjs"]=(()=>{
const __moduleURL=new URL("./world/scenery.mjs",document.baseURI).href;
const {rooms,objects,WORLD_WIDTH}=__modules["world/simulation.mjs"];
const FLOOR=346;
function drawScenery(ctx,width,height,camera,time=0,reduced=false) {
  const r=(x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),w,h);};
  const windowAt=(x,y,outdoor=false)=>{
    r(x-5,y-5,104,124,'#6e775d');r(x-2,y-2,98,118,'#f0e2b9');r(x+3,y+3,88,108,'#a8c9c3');
    r(x+3,y+66,88,45,'#789e7e');r(x+25,y+51,35,60,'#91ac80');r(x+48,y+39,4,72,'#637e65');r(x+35,y+52,31,26,'#739778');
    r(x+64,y+12,15,15,'#f4e9ba');r(x+41,y,5,116,'#e7d6ae');r(x,y+56,95,5,'#e7d6ae');r(x-8,y+114,112,7,'#8c8163');
    if(!outdoor){r(x-12,y-11,120,5,'#6f6851');r(x-10,y-6,12,115,'#c6b68e');r(x+94,y-6,11,115,'#c6b68e');}
  };
  const pot=(x,y,c='#b77961')=>{r(x,y,20,19,c);r(x-2,y-3,24,5,'#d29e76');r(x+8,y-21,3,19,'#567c58');r(x-1,y-19,11,7,'#76935b');r(x+11,y-28,12,8,'#6a8a56');r(x+8,y-12,12,5,'#8aa363');};
  ctx.save();ctx.translate(-Math.round(camera),0);
  r(0,0,WORLD_WIDTH,height,'#c7d7c4');
  for(const room of rooms){
    if(room.x+480<camera||room.x>camera+width)continue;
    const x=room.x;
    if(room.id==='garden'){
      r(x,0,480,FLOOR,'#bdd6ca');r(x,70,480,90,'#cfdcc8');
      for(let i=0;i<6;i++){r(x+i*90,170,95,100,'#91b38c');r(x+i*90+30,149,44,130,'#91b38c');}
      r(x,278,480,68,'#88a978');r(x,338,480,13,'#65865b');
      for(let i=0;i<14;i++){r(x+18+i*35,259,7,76,'#dfd0ab');r(x+20+i*35,255,3,5,'#eadab9');}r(x,282,480,8,'#d1bf98');r(x,311,480,7,'#d1bf98');
      r(x+324,123,20,200,'#6a7760');r(x+292,96,88,80,'#73966b');r(x+260,130,137,68,'#73966b');r(x+286,107,80,57,'#90ad7b');
      for(let i=0;i<7;i++){r(x+285+(i*23)%93,139+(i*17)%41,6,7,'#dca785');}
      pot(x+44,326);pot(x+410,326);
      r(x+230,327,21,18,'#b688a4');r(x+234,324,13,4,'#d9bdd0');r(x+234,334,15,3,'#e1c78c');
      for(let i=0;i<18;i++){r(x+10+i*26,365+(i%3)*9,3,8,'#638b60');r(x+8+i*26,363+(i%3)*9,7,3,i%2?'#edcf98':'#d5b6c5');}
    }else{
      r(x,0,480,FLOOR,room.color);r(x,0,480,22,'#6e715a');r(x,22,480,8,'#a99a75');r(x+2,30,7,316,'#aca383');
      for(let i=0;i<6;i++)r(x+50+i*76,32,1,285,'#ffffff15');
      r(x,320,480,9,'#a29471');r(x,329,480,17,'#887b5e');
      r(x,FLOOR,480,height-FLOOR,'#c2a77e');
      for(let y=FLOOR;y<height;y+=24){r(x,y,480,2,'#ac906a');for(let k=0;k<6;k++)r(x+k*90+(y%48?40:0),y,2,24,'#b39771');}
      r(x+18,32,3,287,'#ffffff19');
      if(room.id==='kitchen'){
        windowAt(x+52,61);r(x+300,77,141,7,'#8d7657');pot(x+307,57);r(x+354,55,17,22,'#dcc28d');r(x+378,51,23,26,'#8caaa1');r(x+408,61,25,16,'#eee0b7');
        r(x+305,215,131,112,'#9b9f78');r(x+298,205,146,10,'#eee0b9');r(x+311,225,55,88,'#b6b58c');r(x+375,225,55,88,'#b6b58c');r(x+356,262,4,6,'#6e7054');r(x+382,262,4,6,'#6e7054');
        r(x+352,186,37,19,'#849e94');r(x+349,183,43,5,'#b9d0bd');r(x+365,174,6,10,'#6c857d');
        r(x+180,280,98,8,'#8e7253');r(x+191,288,8,58,'#a18661');r(x+257,288,8,58,'#a18661');r(x+210,273,40,7,'#b57d64');r(x+213,263,9,11,'#d69d6d');r(x+226,261,9,13,'#a0b375');r(x+237,266,9,8,'#d5b681');
      }else if(room.id==='dining'){
        windowAt(x+300,70);r(x+65,58,112,8,'#8e795b');r(x+73,45,13,13,'#c8a16b');r(x+96,40,10,18,'#a57d7c');pot(x+138,39);
        r(x+138,294,176,35,'#bc977a');r(x+145,326,160,9,'#ad896e');
        r(x+165,276,139,10,'#8c7057');r(x+176,286,9,60,'#9c7c5a');r(x+281,286,9,60,'#9c7c5a');r(x+194,266,34,8,'#efe2bd');r(x+242,250,15,26,'#b3be9a');r(x+245,239,9,14,'#b77d8c');
        r(x+109,273,17,61,'#a78c65');r(x+108,250,20,35,'#b99d72');r(x+111,285,45,7,'#a78c65');
      }else if(room.id==='bathroom'){
        for(let ty=200;ty<320;ty+=24)for(let tx=0;tx<480;tx+=32){r(x+tx,ty,31,23,'#b2cfc3');r(x+tx,ty,31,1,'#dfebd1');}
        windowAt(x+55,57);r(x+346,102,64,85,'#788f80');r(x+352,108,52,73,'#b7d5cf');r(x+357,115,3,55,'#d6e6da');
        r(x+338,233,77,12,'#eee6ca');r(x+346,245,62,77,'#a5b49a');r(x+365,216,22,17,'#e7dcc0');r(x+377,203,5,17,'#7f9685');
        r(x+170,294,132,35,'#e8ddbe');r(x+179,286,114,16,'#f9edcf');r(x+188,289,96,8,'#90b8b1');r(x+177,327,11,17,'#9e9e7c');r(x+284,327,11,17,'#9e9e7c');r(x+282,270,6,18,'#7c9989');r(x+270,267,16,5,'#7c9989');
      }else if(room.id==='bedroom'){
        windowAt(x+55,62);r(x+281,54,103,6,'#92806c');r(x+287,59,90,102,'#b9abc0');r(x+291,63,82,94,'#837e9f');
        for(const [sx,sy]of [[308,84],[351,95],[328,120],[302,142]]){r(x+sx,sy,2,8,'#e4d4aa');r(x+sx-3,sy+3,8,2,'#e4d4aa');}
        r(x+138,296,177,43,'#9b7c65');r(x+137,266,12,74,'#8c705c');r(x+307,289,10,51,'#8c705c');r(x+150,291,151,29,'#b5a4b9');r(x+156,287,46,15,'#eee2c5');r(x+211,292,90,26,'#9695ac');r(x+213,296,85,2,'#c0b3c8');r(x+217,307,81,2,'#c0b3c8');
        r(x+355,280,52,9,'#9d8566');r(x+361,289,40,52,'#b3a17b');r(x+373,254,14,26,'#d2bb85');r(x+363,243,34,14,'#e5d4a3');
      }
    }
    // Small room labels live in the world, rather than selecting isolated scenes.
    ctx.fillStyle='#465a49';ctx.font='12px Georgia';ctx.fillText(room.name,x+28,394);
  }
  // A few calm motes add life without changing any care or progression state.
  if(!reduced)for(let i=0;i<9;i++)r(180+i*265+Math.sin(time*.3+i)*12,90+(i*29)%140+Math.sin(time+i)*5,2,2,'#fff4ce85');
  ctx.restore();
}
function drawForeground(ctx,camera,state) {
  if(state.action==='bathe'&&state.target==='bath'){
    ctx.fillStyle='#e6ddbd';ctx.fillRect(1130-camera,318,132,16);ctx.fillStyle='#b9d9ce';ctx.fillRect(1141-camera,314,111,4);
  }
}

return {FLOOR,drawScenery,drawForeground};
})();
// world/companion-preview.mjs
__modules["world/companion-preview.mjs"]=(()=>{
const __moduleURL=new URL("./world/companion-preview.mjs",document.baseURI).href;
/** Only a painted visual and a display name are exported to Tavi's main shell.
 * No genome, care/need data, messages, credentials, or other private state.
 */
const PREVIEW_SCHEMA='tavi.companion.preview/v1';
const PREVIEW_PIXEL_SIZE=80;
const PREVIEW_DATA_LIMIT=90000;
function normalizePreviewName(input){
  return typeof input==='string'?input.trim().slice(0,32):'';
}
function makeCompanionPreview({name,form,source,makeCanvas=()=>document.createElement('canvas')}){
  if(!['cat','unicorn'].includes(form))throw Error('Unsupported painted form');
  if(!source||typeof source.width!=='number'||typeof source.height!=='number'||source.width<1||source.height<1)throw Error('Missing portrait canvas');
  const out=makeCanvas();out.width=PREVIEW_PIXEL_SIZE;out.height=PREVIEW_PIXEL_SIZE;
  const ctx=out.getContext('2d');if(!ctx)throw Error('Portrait context unavailable');
  ctx.imageSmoothingEnabled=true;
  ctx.drawImage(source,0,0,source.width,source.height,0,0,PREVIEW_PIXEL_SIZE,PREVIEW_PIXEL_SIZE);
  const image=out.toDataURL('image/png');
  if(!/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(image)||image.length>PREVIEW_DATA_LIMIT)throw Error('Invalid painted preview image');
  return {schema:PREVIEW_SCHEMA,name:normalizePreviewName(name),form,image};
}

return {PREVIEW_SCHEMA,PREVIEW_PIXEL_SIZE,PREVIEW_DATA_LIMIT,normalizePreviewName,makeCompanionPreview};
})();
// world/app.mjs
__modules["world/app.mjs"]=(()=>{
const __moduleURL=new URL("./world/app.mjs",document.baseURI).href;
const {createWorld,objects,isObjectAvailable,rooms,WORLD_WIDTH}=__modules["world/simulation.mjs"];
const {createLocalCompanionEngine}=__modules["world/engine-port.mjs"];
const {connectTaviHost}=__modules["world/tavi-host.mjs"];
const {SESSION_STORAGE_KEY,encodeSession,decodeSession}=__modules["world/session-codec.mjs"];
const {drawPaintedWorld,drawPaintedPortrait,loadPaintedCharacters,paintedReady,paintedError}=__modules["world/studio-renderer.mjs"];
const {drawScenery,drawForeground,FLOOR}=__modules["world/scenery.mjs"];
const {startingForms,applyForm}=__modules["world/forms.mjs"];
const {TRAIT_KEYS}=__modules["world/genetics.mjs"];
const {makeCompanionPreview}=__modules["world/companion-preview.mjs"];
const $=id=>document.getElementById(id);
// A new individual gets a locally generated genotype; the test engine keeps a
// deterministic seed for reproducible native-adapter contract tests.
const freshSeed=globalThis.crypto?.getRandomValues?globalThis.crypto.getRandomValues(new Uint32Array(1))[0]:(Date.now()>>>0);
let engine=createLocalCompanionEngine({state:createWorld({genomeSeed:freshSeed})});
let state=engine.state;
let taviHost=null,saveTimer=null,saveInFlight=null,lastSaved=null,nextAutoSave=20,portraitTimer=null;
let chosen=false,name='',camera=230,following=true,lastTime=0,viewportWidth=960,viewportHeight=422,drag=null,lastMessage='',lastMemory='',lastTraitRevision=-1;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const canvas=$('world'),ctx=canvas.getContext('2d');
const previews=[];
// Tavi's extension host is OPTIONAL. Standalone preview remains usable and never
// talks to LoopRD or demands an account token. Host I/O happens out of the frame loop.
function sendCommand(type,value){
  const result=engine.command(type,value);
  if(result&&chosen)scheduleSave();
  return result;
}
// Synchronize only selected painted appearance. Never send genes/needs or chat data.
function queuePortrait(){
  if(!chosen||!taviHost?.publishPortrait||portraitTimer)return;
  portraitTimer=setTimeout(()=>{portraitTimer=null;void publishPortrait();},650);
}
async function publishPortrait(){
  if(!chosen||!taviHost?.publishPortrait||!paintedReady())return;
  try{
    portrait();
    const preview=makeCompanionPreview({name,form:state.form,source:$('portrait')});
    await taviHost.publishPortrait(preview);
  }catch{ /* Companions stays fully usable even if Tavi refuses this optional UI contribution. */ }
}
function scheduleSave(){
  if(!taviHost?.canStore||!chosen||saveTimer)return;
  saveTimer=setTimeout(()=>{saveTimer=null;void saveSession();},2500);
}
async function saveSession(){
  if(!taviHost?.canStore||!chosen)return;
  if(saveInFlight){try{await saveInFlight;}catch{ /* Retry with current state. */ }}
  let snapshot;
  try{snapshot=encodeSession({chosen,name,state});}catch{return;}
  if(snapshot===lastSaved)return;
  const current=taviHost.write(SESSION_STORAGE_KEY,snapshot);
  saveInFlight=current;
  try{await current;lastSaved=snapshot;}
  catch{ /* Private storage may be disabled; navigation remains available. */ }
  finally{if(saveInFlight===current)saveInFlight=null;}
}
async function initializeTaviHost(){
  const connection=await connectTaviHost();
  if(!connection)return;
  taviHost=connection;
  $('return-to-tavi').hidden=false;
  $('return-to-tavi').disabled=false;
  queuePortrait();
  if(!connection.canStore)return;
  try{
    const saved=decodeSession(await connection.read(SESSION_STORAGE_KEY));
    // Never overwrite a selection made while waiting for the host response.
    if(saved&&!chosen){
      engine=createLocalCompanionEngine({state:saved.state});state=engine.state;
      chosen=saved.chosen;name=saved.name;
      $('name').value=name;$('care').checked=state.care;
      nextAutoSave=state.time+20;
      // After a legacy v1 load, persist the versioned migration at next safe save.
      lastSaved=saved.migrated?null:encodeSession({chosen,name,state});
      if(saved.migrated)scheduleSave();
      syncControls();updateText();
    }
  }catch{ /* Invalid/old storage stays untouched and is never silently migrated. */ }
}
$('return-to-tavi').addEventListener('click',async()=>{
  if(!taviHost)return;
  $('return-to-tavi').disabled=true;
  if(saveTimer){clearTimeout(saveTimer);saveTimer=null;}
  await saveSession();
  if(portraitTimer){clearTimeout(portraitTimer);portraitTimer=null;}
  await publishPortrait();
  try{await taviHost.close();}
  catch{
    $('return-to-tavi').disabled=false;
    $('art-status').textContent='Could not close the panel. Use Tavi’s main navigation.';
  }
});
function renderTraits(){
  if(!chosen||lastTraitRevision===state.genome.revision)return;
  lastTraitRevision=state.genome.revision;
  $('trait-list').replaceChildren();
  for(const key of TRAIT_KEYS){
    const li=document.createElement('li');
    li.textContent=`${key[0].toUpperCase()+key.slice(1)}: ${Math.round(state.phenotype[key]*100)}%`;
    $('trait-list').append(li);
  }
  $('trait-evolution').textContent=`${state.genome.revision} completed evolving experiences · changes persist with this companion`;
}
function syncControls(){
  $('welcome').hidden=chosen;
  $('companion-name').textContent=name||'Your companion';
  $('portrait-hint').textContent=chosen?(name||'Your companion'):'? Choose a companion';
  $('portrait-button').setAttribute('aria-label',chosen?`Face portrait of ${name||'your companion'}. Change starting look.`:'Choose your companion');
  $('needs').hidden=!state.care;
  $('traits').hidden=!chosen;
  renderTraits();
  $('form').value=state.form;
  $('follow').setAttribute('aria-pressed',String(following));
  $('pause').setAttribute('aria-pressed',String(state.paused));$('pause').textContent=state.paused?'Resume world':'Pause world';
  for(const control of document.querySelectorAll('.below-world button, .below-world input, .below-world select'))control.disabled=!chosen;
  for(const button of document.querySelectorAll('[data-object]'))button.disabled=!chosen||!isObjectAvailable(state,button.dataset.object);
  $('refill-honey').disabled=!chosen||state.objectState.honey.usesRemaining===10;
}
function updateText(){
  if(chosen && lastMessage!==state.message){$('thought').textContent=state.message;lastMessage=state.message;}
  $('emotion').textContent=chosen?`${state.emotion.toUpperCase()} · ${state.action==='walk'?'FOLLOWING A LITTLE CURIOSITY':state.action==='idle'?'AT HOME':state.action.toUpperCase()}`:'A LITTLE LIFE, AT ITS OWN PACE';
  const memoryKey=state.memories.join('|');
  if(lastMemory!==memoryKey){lastMemory=memoryKey;$('memories').replaceChildren();for(const text of state.memories){const li=document.createElement('li');li.textContent=text;$('memories').append(li);}}
  for(const [key,value]of Object.entries(state.needs)){$('need-'+key).value=value;}
  $('honey-remaining').textContent=`${state.objectState.honey.usesRemaining} servings left`;
  for(const button of document.querySelectorAll('[data-object]'))button.disabled=!chosen||!isObjectAvailable(state,button.dataset.object);
  $('refill-honey').disabled=!chosen||state.objectState.honey.usesRemaining===10;
}
function resize(){
  viewportWidth=Math.max(280,Math.round($('viewport').clientWidth));viewportHeight=$('viewport').clientHeight;
  const density=Math.min(2,Math.ceil(devicePixelRatio||1));canvas.width=viewportWidth*density;canvas.height=viewportHeight*density;
  ctx.setTransform(density,0,0,density,0,0);ctx.imageSmoothingEnabled=false;$('pan').max=Math.max(0,WORLD_WIDTH-viewportWidth);
}
function portrait(){
  const p=$('portrait').getContext('2d');p.clearRect(0,0,360,360);p.imageSmoothingEnabled=false;
  if(chosen)drawPaintedPortrait(p,state,{reducedMotion:reduced.matches});
  else {p.font='76px Georgia';p.fillStyle='#8c9d77';p.textAlign='center';p.fillText('?',180,185);}
}
function frame(timestamp){
  const delta=lastTime?Math.min(.1,(timestamp-lastTime)/1000):0;lastTime=timestamp;
  if(!document.hidden){
    if(chosen)engine.advance(delta);
    if(chosen&&state.time>=nextAutoSave){nextAutoSave=state.time+20;scheduleSave();}
    if(chosen && following)camera+=(state.x-viewportWidth/2-camera)*(reduced.matches?1:Math.min(1,delta*3));
    camera=Math.max(0,Math.min(Math.max(0,WORLD_WIDTH-viewportWidth),camera));
    ctx.clearRect(0,0,viewportWidth,viewportHeight);drawScenery(ctx,viewportWidth,viewportHeight,camera,state.time,reduced.matches);
    if(chosen){
      ctx.save();
      if(state.action==='bathe'&&state.target==='bath'){
        ctx.beginPath();ctx.rect(0,0,viewportWidth,318);ctx.clip();
      }
      drawPaintedWorld(ctx,state.x-camera,FLOOR,state,{reducedMotion:reduced.matches,lookAtViewer:state.action!=='sleep'&&(state.time<(state.lookUntil??0)||(['idle','sit'].includes(state.action)&&state.time%14>=9))});ctx.restore();
    }
    drawForeground(ctx,camera,state);portrait();
    if($('selection').open)for(const preview of previews){
      preview.state.time=timestamp/1000;
      const context=preview.canvas.getContext('2d');context.clearRect(0,0,360,320);
      drawPaintedWorld(context,180,292,preview.state,{reducedMotion:reduced.matches,scale:2});
    }
    $('pan').value=Math.round(camera);
    $('where').textContent=rooms.filter(r=>r.x+480>camera&&r.x<camera+viewportWidth).map(r=>r.name).join(' · ');
    renderTraits();updateText();
  }
  requestAnimationFrame(frame);
}
function pan(value){following=false;camera=Math.max(0,Math.min(WORLD_WIDTH-viewportWidth,value));syncControls();}
$('pan-left').addEventListener('click',()=>pan(camera-250));$('pan-right').addEventListener('click',()=>pan(camera+250));
$('pan').addEventListener('input',()=>pan(Number($('pan').value)));
$('follow').addEventListener('click',()=>{following=!following;syncControls();});
canvas.addEventListener('pointerdown',event=>{drag={x:event.clientX,y:event.clientY,camera,moved:false};});
canvas.addEventListener('pointermove',event=>{
  if(!drag)return;const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
  if(Math.abs(dx)>8 && Math.abs(dx)>Math.abs(dy)){drag.moved=true;canvas.setPointerCapture(event.pointerId);pan(drag.camera-dx);}
});
canvas.addEventListener('pointerup',event=>{
  if(!drag)return;
  if(!drag.moved&&chosen){const bounds=canvas.getBoundingClientRect();const x=event.clientX-bounds.left+camera;const closest=objects.reduce((a,b)=>Math.abs(a.x-x)<Math.abs(b.x-x)?a:b);if(Math.abs(closest.x-x)<90)sendCommand('invite',closest.id);}
  drag=null;
});
canvas.addEventListener('pointercancel',()=>{drag=null;});
canvas.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();pan(camera+(event.key==='ArrowLeft'?-180:180));}});
$('pause').addEventListener('click',()=>{sendCommand('set-paused',!state.paused);syncControls();});
for(const button of document.querySelectorAll('[data-object]'))button.addEventListener('click',()=>{if(chosen)sendCommand('invite',button.dataset.object);});
$('refill-honey').addEventListener('click',()=>{if(chosen)sendCommand('refill','honey');});
$('pet').addEventListener('click',()=>{if(chosen)sendCommand('express','pet');});$('wave').addEventListener('click',()=>{if(chosen)sendCommand('express','wave');});
$('look').addEventListener('click',()=>{if(chosen)sendCommand('express','look');});
$('name').addEventListener('input',()=>{name=$('name').value.trim().slice(0,32);syncControls();scheduleSave();queuePortrait();});
$('form').addEventListener('change',()=>{sendCommand('choose-form',$('form').value);syncControls();queuePortrait();});
$('care').addEventListener('change',()=>{sendCommand('set-care',$('care').checked);syncControls();});
function openSelection(){if(!$('selection').open)$('selection').showModal();}
$('portrait-button').addEventListener('click',openSelection);$('choose').addEventListener('click',openSelection);$('close-selection').addEventListener('click',()=>$('selection').close());
for(const button of document.querySelectorAll('[data-form]')){
  const preview=createWorld();applyForm(preview,button.dataset.form);preview.facing=1;
  const previewCanvas=button.querySelector('canvas');
  drawPaintedWorld(previewCanvas.getContext('2d'),180,292,preview,{reducedMotion:true,scale:2});
  previews.push({canvas:previewCanvas,state:preview});
  button.setAttribute('aria-label',`${startingForms[button.dataset.form].label}: ${startingForms[button.dataset.form].description}`);
  button.addEventListener('click',()=>{sendCommand('choose-form',button.dataset.form);chosen=true;$('selection').close();syncControls();scheduleSave();queuePortrait();$('wave').focus();});
}
for(const [key,value]of Object.entries(state.needs)){
  const label=document.createElement('label');label.className='need';label.textContent=key[0].toUpperCase()+key.slice(1);
  const meter=document.createElement('meter');meter.id='need-'+key;meter.min=0;meter.max=100;meter.value=value;meter.setAttribute('aria-label',key);label.append(meter);$('needs').append(label);
}
new ResizeObserver(resize).observe($('viewport'));
document.addEventListener('visibilitychange',()=>{lastTime=0;if(document.hidden)void saveSession();});
resize();syncControls();requestAnimationFrame(frame);
void initializeTaviHost();
// Asset loading is explicit. Never substitute an unrelated or generated creature if it fails.
loadPaintedCharacters().then(ok=>{
  $('art-status').textContent=ok?'Painted character artwork ready':'Painted artwork unavailable. Check the preview files and reload.';
  if(ok)queuePortrait();
}).catch(()=>{$('art-status').textContent='Painted artwork unavailable. Check the preview files and reload.';});

return {};
})();
})();
