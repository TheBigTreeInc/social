import test from 'node:test';
import assert from 'node:assert/strict';
import {PETS} from '../src/companions/catalog.js';
import {newCompanion,sanitizeCompanion,tickCompanion,performCare,suggestMode,dismissSuggestion,changeMode,selectCompanion,updatePreferences,storageKey,saveCompanion,loadCompanion,unlockedPets} from '../src/companions/engine.js';
import {petSprite,companionPanel,companionBadge} from '../src/companions/view.js';
const DAY=86400000,T0=Date.parse('2026-10-01T12:00:00Z');
const enabled=()=>updatePreferences(newCompanion({now:T0}),{enabled:true},{now:T0});
test('eight distinct data-defined 16px species, four starters, stable IDs',()=>{
 assert.equal(PETS.length,8);assert.equal(PETS.filter(x=>x.starter).length,4);
 assert.equal(new Set(PETS.map(x=>x.id)).size,8);
 for(const pet of PETS){assert.equal(pet.art.length,16);assert.ok(pet.art.every(row=>row.length===16));assert.ok(petSprite(pet).includes('shape-rendering="crispEdges"'));}
});
test('off by default; no decay at any later time or while in ambient mode',()=>{
 const p=newCompanion({now:T0});assert.equal(p.enabled,false);
 const late=tickCompanion(p,{now:T0+400*DAY});assert.deepEqual(late.needs,p.needs);
 const ambient=tickCompanion(enabled(),{now:T0+400*DAY});assert.deepEqual(ambient.needs,p.needs);
});
test('gentle and classic care explicitly selected; offline impact capped',()=>{
 const p=enabled(),gentle=changeMode(p,'gentle',{now:T0});const classic=changeMode(p,'classic',{now:T0});
 assert.ok(tickCompanion(gentle,{now:T0+5*3600000}).needs.fullness>tickCompanion(classic,{now:T0+5*3600000}).needs.fullness);
 assert.equal(tickCompanion(classic,{now:T0+300*DAY}).needs.fullness,tickCompanion(classic,{now:T0+8*3600000}).needs.fullness);
 assert.ok(tickCompanion({...classic,needs:{...classic.needs,fullness:20}},{now:T0+500*DAY}).needs.fullness>=20);
});
test('care requires opt-in; bounded actions increase bond and only pet engagement recorded',()=>{
 assert.throws(()=>performCare(newCompanion({now:T0}),'feed',{now:T0+10000}));
 let pet=enabled();pet=performCare(pet,'feed',{now:T0+5000});
 assert.ok(pet.needs.bond>0);assert.equal(pet.engagement.actions,1);
 pet=performCare(pet,'feed',{now:T0+5001});assert.equal(pet.engagement.actions,1);
 assert.deepEqual(Object.keys(pet.engagement).sort(),['actions','days','dismissed','kinds','suggestions'].sort());
});
test('engagement offers, never automatically changes, progressively deeper modes',()=>{
 let p=enabled();let t=T0;const actions=['feed','clean','pet','play','rest'];
 for(let i=0;i<10;i++){t=T0+Math.floor(i/4)*DAY+i*4000;p=performCare(p,actions[i%actions.length],{now:t});}
 assert.equal(p.mode,'companion');assert.equal(suggestMode(p),'gentle');
 p=dismissSuggestion(p,'gentle');assert.equal(suggestMode(p),null);
 p=changeMode(p,'gentle',{now:t+5000});
 for(let i=10;i<26;i++){t=T0+Math.floor(i/4)*DAY+i*4000;p=performCare(p,actions[i%actions.length],{now:t});}
 assert.equal(p.mode,'gentle');assert.equal(suggestMode(p),'classic');
 assert.equal(changeMode(p,'classic',{now:t+6000}).mode,'classic');
});
test('new unlock species available on activity milestones without changing care complexity',()=>{
 let p=enabled();assert.throws(()=>selectCompanion(p,'bloop',{now:T0}));
 for(let i=0;i<12;i++)p=performCare(p,'pet',{now:T0+Math.floor(i/4)*DAY+10000+i*4000});
 assert.ok(unlockedPets(p).includes('bloop'));p=selectCompanion(p,'bloop',{now:T0+4*DAY});assert.equal(p.petId,'bloop');assert.equal(p.mode,'companion');
});
test('account isolation, corrupt state, safe name and HTML escaping',()=>{
 assert.notEqual(storageKey('https://one.test','a'),storageKey('https://one.test','b'));
 const store=new Map(),storage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};
 let p=enabled();p=updatePreferences(p,{name:'<script>x</script>',overlay:'in-app'},{now:T0});const k=storageKey('https://one.test','a');saveCompanion(storage,k,p);
 assert.equal(loadCompanion(storage,k,{now:T0}).name,'<script>x</script>');
 assert.ok(!companionPanel(p).includes('<script>'));assert.ok(!companionBadge(p).includes('<script>'));
 assert.equal(loadCompanion(storage,storageKey('https://one.test','b'),{now:T0}).enabled,false);
 assert.equal(sanitizeCompanion({schema:'bad'},{now:T0}).enabled,false);
});
test('overlay cannot remain when pet disabled; no OS overlay is automatically selected',()=>{
 let p=updatePreferences(enabled(),{overlay:'in-app'},{now:T0});assert.ok(companionBadge(p));
 p=updatePreferences(p,{enabled:false},{now:T0});assert.equal(p.overlay,'off');assert.equal(companionBadge(p),'');
});
