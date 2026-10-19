import {PETS,petById} from './catalog.js';
import {suggestMode,unlockedPets} from './engine.js';
const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mood=pet=>!pet.enabled?'Off':pet.needs.energy<35?'Sleepy':pet.needs.fullness<35?'Hungry':pet.needs.cleanliness<35?'Needs washing':pet.needs.happiness<35?'Bored':'Content';
export function petSprite(spec,{small=false}={}) {
 if(!spec)return '';
 const squares=spec.art.flatMap((row,y)=>[...row].map((v,x)=>v==='.'?'':`<rect x="${x}" y="${y}" width="1" height="1" fill="${spec.colors[+v-1]}" />`).filter(Boolean)).join('');
 return `<svg class="companion-pixels ${small?'small':''}" role="img" aria-label="16-pixel ${escapeHtml(spec.species)}" viewBox="0 0 16 16" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">${squares}</svg>`;
}
const stats=[['fullness','Fullness'],['cleanliness','Cleanliness'],['happiness','Happiness'],['energy','Energy'],['bond','Bond']];
export function companionPanel(p,{desktopFloatingAvailable=false}={}){
 const pet=petById(p.petId),unlocked=new Set(unlockedPets(p));const suggested=suggestMode(p);
 const options=PETS.map(spec=>{
  const available=spec.starter||unlocked.has(spec.id);const selected=spec.id===p.petId;
  return `<button type="button" class="pet-choice ${selected?'selected':''} ${available?'':'locked'}" data-pet-select="${spec.id}" ${available?'':'disabled'} aria-pressed="${selected}" title="${escapeHtml(available?spec.temperament:'Unlockable pet')}">${available?petSprite(spec,{small:true}):'<span class="pet-locked-art">?</span>'}<strong>${available?escapeHtml(spec.name):'???'}</strong><small>${available?escapeHtml(spec.species):'Locked'}</small></button>`;
 }).join('');
 return `<section class="utility companions" aria-label="Tavi companions">
 <div class="companion-title"><div><h2>Companions</h2><p>A tiny pixel friend. Always optional, on PC and phone.</p></div><label class="companion-toggle"><input type="checkbox" id="companion-enabled" ${p.enabled?'checked':''}> Enabled</label></div>
 ${!p.enabled?'<p class="fineprint companion-soft-note">Companions are off. Nothing decays while disabled; you will not receive pet prompts.</p>':''}
 <div class="companion-scene ${p.enabled?'awake':'paused'}"><div class="companion-art">${petSprite(pet)}</div><div class="companion-descriptor"><strong>${escapeHtml(p.name)}</strong><span>${escapeHtml(pet.temperament)}</span><span class="companion-mood">${mood(p)}</span><span class="fineprint">${escapeHtml(pet.trait)}</span></div></div>
 ${p.enabled?`<div class="companion-needs">${stats.map(([id,label])=>`<div class="companion-stat"><span>${label}</span><progress value="${p.needs[id]}" max="100" aria-label="${label}"></progress><b>${p.needs[id]}</b></div>`).join('')}</div><div class="companion-actions">${[['feed','Feed'],['clean','Clean'],['play','Play'],['rest','Rest'],['pet','Pet']].map(([id,label])=>`<button type="button" data-pet-care="${id}">${label}</button>`).join('')}</div>`:''}
 ${suggested?`<div class="companion-suggestion"><strong>You seem to enjoy caring for ${escapeHtml(p.name)}.</strong><p>${suggested==='gentle'?'Want to try gentle hunger, energy and cleanliness needs?':'Interested in a more classic Tamagotchi-style care routine?'}</p><div class="row-actions"><button type="button" data-pet-mode="${suggested}">Try ${suggested==='gentle'?'Gentle Care':'Classic Care'}</button><button type="button" data-pet-dismiss="${suggested}">Not interested</button></div></div>`:''}
 <details class="companion-settings"><summary>Pet and play style</summary>
 <label>Pet name <input id="companion-name" maxlength="24" value="${escapeHtml(p.name)}"></label>
 <label>Play style <select id="companion-mode"><option value="companion" ${p.mode==='companion'?'selected':''}>Companion — no needs decay</option><option value="gentle" ${p.mode==='gentle'?'selected':''}>Gentle Care — forgiving routine</option><option value="classic" ${p.mode==='classic'?'selected':''}>Classic Care — more involved</option></select></label>
 <p class="fineprint">Modes change only when you choose them. Pet actions are the only behavior used to suggest more care. No messages or contacts are analyzed. No death or irreversible penalties.</p>
 <label><input id="companion-inapp" type="checkbox" ${p.overlay==='in-app'?'checked':''} ${p.enabled?'':'disabled'}> Keep a small companion visible inside Tavi</label>
 ${desktopFloatingAvailable?`<label><input id="companion-floating" type="checkbox" ${p.overlay==='floating'?'checked':''} ${p.enabled?'':'disabled'}> Show an independent floating Windows desktop companion</label><p class="fineprint">Small always-on-top, draggable pet. Hide it using ×; no Social credentials enter the pet window. To reset its location, use the ↺ button on the pet. You may disable it at any time.</p>`:'<p class="fineprint">System-wide floating pets on this platform are not yet available; the in-app badge is optional.</p>'}
 </details>
 <h3>Choose a pet</h3><div class="companion-choices">${options}</div>
 <p class="fineprint">Eight species are defined now. Four are starters; the others unlock through optional pet-care activity. New pets can be added as data and artwork without changing the care engine. Your companion is stored on this device only for now.</p>
 </section>`;
}
export function companionBadge(p){if(!p?.enabled||p.overlay!=='in-app')return '';const spec=petById(p.petId);return `<button type="button" class="companion-float" data-action="companion" title="Open ${escapeHtml(p.name)} companion" aria-label="Open ${escapeHtml(p.name)} companion">${petSprite(spec,{small:true})}<span>${escapeHtml(p.name)}</span></button>`;}
