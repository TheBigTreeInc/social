/** Unprivileged window. No SDK, credentials, messaging or browser storage. */
import {getCurrentWindow} from '@tauri-apps/api/window';
import {listen,emitTo} from '@tauri-apps/api/event';
import {petById} from './companions/catalog.js';
import {petSprite} from './companions/view.js';
import {parsePetWindowCommand} from './companions/native.js';
const petWindow=getCurrentWindow();
const surface=document.getElementById('pet-window');
const htmlEscape=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
let latest=null;
async function send(action){if(!parsePetWindowCommand({action}))return;
  try{await emitTo('main','tavi-companion-request',{action});}catch{status('The main Tavi window is unavailable.');}}
function status(message){const target=document.getElementById('pet-window-status');if(target)target.textContent=message;}
function display(data){if(data?.schema!=='tavi.companion-window/v1')return;
 const pet=petById(data.petId);if(!pet)return;latest=data;
 const need=data.needs||{},needs=Number(need.fullness)<35?'Hungry':Number(need.cleanliness)<35?'Dirty':Number(need.energy)<35?'Sleepy':'Content';
 surface.innerHTML=`<section class="pet-shell"><div class="pet-top"><button class="pet-drag" type="button" title="Drag pet" aria-label="Drag companion">⠿</button><strong>${htmlEscape(data.name)}</strong><button type="button" data-pet-command="hide" aria-label="Hide floating companion" title="Hide">×</button></div><div class="pet-stage">${petSprite(pet)}<span>${htmlEscape(needs)}</span></div><div class="pet-actions">${[['feed','Feed'],['clean','Clean'],['play','Play'],['rest','Rest'],['pet','Pet']].map(([a,n])=>`<button type="button" data-pet-command="${a}">${n}</button>`).join('')}</div><div class="pet-bottom"><button data-pet-command="open" type="button">Open in Tavi</button><button data-pet-command="reset-position" type="button" title="Reset window position">↺</button></div><p id="pet-window-status" role="status" class="pet-status"></p></section>`;
 surface.querySelectorAll('[data-pet-command]').forEach(button=>button.addEventListener('click',()=>void send(button.dataset.petCommand)));
 surface.querySelector('.pet-drag')?.addEventListener('pointerdown',event=>{if(event.button===0)void petWindow.startDragging().catch(()=>status('Dragging unavailable.'));});
}
await listen('tavi-companion-state',event=>display(event.payload));
// Main window owns all persistent account-scoped state. We accept no other requests.
await petWindow.onMoved(({payload})=>{if(latest && Number.isSafeInteger(payload?.x)&&Number.isSafeInteger(payload?.y))void emitTo('main','tavi-companion-moved',{x:payload.x,y:payload.y}).catch(()=>{});});
void send('ready');
