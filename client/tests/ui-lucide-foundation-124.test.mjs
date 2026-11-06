import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {uiGlyph,appGlyph,resolvedGlyph,TAVI_ICON_ALIASES} from '../src/ui/glyphs.js';
import {LUCIDE_ICONS,LUCIDE_SOURCE_REVISION} from '../src/ui/lucide-icons.js';
import {homeToolbar,mobileTabs} from '../src/ui/shell.js';
const read=path=>readFile(new URL(path,import.meta.url),'utf8');
const names=Object.keys(TAVI_ICON_ALIASES);

test('all host and launcher glyphs are locally pinned Lucide SVGs with matching 24px geometry',async()=>{
 assert.match(LUCIDE_SOURCE_REVISION,/^[a-f0-9]{40}$/);
 assert.ok(names.length>=30);
 for(const name of names){
  const markup=uiGlyph(name);
  assert.equal(resolvedGlyph(name),TAVI_ICON_ALIASES[name]);
  assert.match(markup,/^<svg class="tavi-ui-glyph" aria-hidden="true" focusable="false" viewBox="0 0 24 24"/);
  assert.ok(markup.includes(LUCIDE_ICONS[resolvedGlyph(name)]),name);
  assert.match(markup,/<\/svg>$/);
  assert.match(appGlyph(name),/class="tavi-app-glyph"/);
  assert.doesNotMatch(markup,/<script|<foreignObject|onload=|href=|url\(/i);
 }
 const source=await read('../src/ui/lucide-icons.js');
 const attribution=await read('../src/ui/LUCIDE_LICENSE.txt');
 assert.match(source,/github.com\/lucide-icons\/lucide/);
 assert.match(attribution,/Copyright \(c\) 2026 Lucide Icons and Contributors/);
 assert.match(attribution,/Permission to use, copy, modify/);
 assert.doesNotMatch(source,/fetch\(|https?:\/\/[^\s'"`]+\.js/);
});

test('unknown icon names never become SVG attributes or untrusted markup',()=>{
 const attacked='evil" onload="alert(1)';
 assert.equal(resolvedGlyph(attacked),'puzzle');
 assert.equal(uiGlyph(attacked),uiGlyph('extension'));
 assert.equal(uiGlyph('__proto__'),uiGlyph('extension'));
 assert.doesNotMatch(uiGlyph(attacked),/evil|alert|onload/);
});

test('four navigation tabs use house, chat, controller and app-grid; storefront remains distinct',()=>{
 const tabs=mobileTabs('home',{unread:7});
 for(const action of ['home','contacts','games','main-menu'])assert.match(tabs,new RegExp(`data-action="${action}"`));
 assert.ok(tabs.includes(LUCIDE_ICONS['house']));
 assert.ok(tabs.includes(LUCIDE_ICONS['message-square-text']));
 assert.ok(tabs.includes(LUCIDE_ICONS['gamepad-2']));
 assert.ok(tabs.includes(LUCIDE_ICONS['layout-grid']));
 assert.ok(!tabs.includes(LUCIDE_ICONS['store']));
 assert.match(tabs,/aria-label="7 unread"/);
 assert.match(tabs,/aria-current="page"/);
 assert.notEqual(appGlyph('store'),appGlyph('apps'));
 const toolbar=homeToolbar();
 assert.match(toolbar,/aria-label="Notifications"/);
 assert.match(toolbar,/aria-label="Settings"/);
});

test('Home keeps roster and optional private previews, with accessible contact and companion actions',async()=>{
 const main=await read('../src/main.js');
 const snippet=main.split('function homeBuddyRow(')[1].split('function homeBuddyGroup(')[0];
 assert.match(snippet,/state\.conversationSummaries\.find/);
 assert.match(snippet,/state\.notifyPrefs\.preview/);
 assert.match(snippet,/esc\(summary\)/);
 assert.match(snippet,/aria-label="Open chat with/);
 assert.match(snippet,/tavi-inline-presence/);
 assert.match(main,/tavi-companion-portrait-empty.*uiGlyph\('paw'\)/);
 assert.match(main,/tavi-home-group-chevron.*uiGlyph\('chevron'\)/);
 assert.match(main,/homeBuddyGroup\('online'/);
 assert.match(main,/homeBuddyGroup\('offline'/);
 assert.doesNotMatch(main,/iframe\.contentDocument|iframe\.contentWindow\.document/);
});

test('compact touch and dark host styling do not weaken focus or alter extension iframe',async()=>{
 const css=await read('../src/ui/components.css');
 const tokens=await read('../src/ui/design-tokens.css');
 assert.match(css,/\.tavi-home-messenger \.tavi-home-buddy-subtitle/);
 assert.match(css,/\.tavi-home-messenger \.tavi-home-group-title/);
 assert.match(css,/min-height:44px/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/\.tavi-home-messenger button:focus-visible/);
 assert.match(tokens,/:root\[data-theme='dark'\]/);
 assert.doesNotMatch(css,/\.tavi-extension-frame iframe\s*\{/);
});
