/**
 * Host-only, font-independent icon registry shared by Tavi on Windows,
 * Android and web. All shapes are locally vendored Lucide SVGs; the alias
 * list preserves the existing launcher/settings API and extension isolation.
 */
import {LUCIDE_ICONS} from './lucide-icons.js';

export const TAVI_ICON_ALIASES=Object.freeze({
 chevron:'chevron-right', search:'search', account:'user-round',
 device:'monitor', palette:'palette', shield:'shield', storage:'database',
 info:'info', eye:'eye', volume:'volume-2', sync:'refresh-cw',
 key:'key-round', logout:'log-out', download:'download',
 diagnostics:'chart-no-axes-column', back:'arrow-left', home:'house',
 send:'send', help:'circle-question-mark', minimize:'minus',
 refresh:'refresh-cw', messages:'message-square-text', games:'gamepad-2',
 wallet:'wallet', bell:'bell', paw:'paw-print', portrait:'user-round',
 store:'store', apps:'layout-grid', 'person-plus':'user-round-plus', people:'users-round',
 settings:'settings', star:'star', extension:'puzzle', atrium:'landmark',
 notepad:'notebook-pen'
});

export function resolvedGlyph(name){
 // An unknown publisher or UI name cannot supply SVG markup or attributes.
 const known=Object.hasOwn(TAVI_ICON_ALIASES,name)?TAVI_ICON_ALIASES[name]:'puzzle';
 return Object.hasOwn(LUCIDE_ICONS,known)?known:'puzzle';
}
function glyph(name,kind){
 const shape=LUCIDE_ICONS[resolvedGlyph(name)];
 return `<svg class="${kind==='app'?'tavi-app-glyph':'tavi-ui-glyph'}" aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${kind==='app'?'1.9':'2'}" stroke-linecap="round" stroke-linejoin="round">${shape}</svg>`;
}
export const uiGlyph=name=>glyph(name,'ui');
export const appGlyph=name=>glyph(name,'app');
