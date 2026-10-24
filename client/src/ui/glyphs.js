/** First-party, font-independent icon registry, used in all host windows. */
// All paths are fixed markup literals: no source-derived SVG attributes.
const SHAPES=Object.freeze({
  'chevron':'<path d="m12 7 9 9-9 9"/>',
 'search':'<circle cx="14" cy="14" r="8"/><path d="m20 20 7 7"/>',
 'account':'<circle cx="16" cy="11" r="5"/><path d="M6 28c1-7 5-10 10-10s9 3 10 10"/>',
 'device':'<rect x="5" y="7" width="22" height="16" rx="2"/><path d="M10 27h12M16 23v4"/>',
 'palette':'<path d="M16 4a12 12 0 1 0 0 24h2a3 3 0 0 0 0-6h-1a2 2 0 0 1-2-2c0-1 1-2 2-2h5a6 6 0 0 0 6-6C28 7 22 4 16 4z"/><circle cx="10" cy="12" r="1"/><circle cx="15" cy="9" r="1"/><circle cx="21" cy="11" r="1"/>',
 'shield':'<path d="M16 3 27 7v8c0 7-4.5 12-11 15C9.5 27 5 22 5 15V7z"/>',
 'storage':'<ellipse cx="16" cy="7" rx="10" ry="4"/><path d="M6 7v9c0 2 4.5 4 10 4s10-2 10-4V7M6 16v9c0 2 4.5 4 10 4s10-2 10-4v-9"/>',
 'info':'<circle cx="16" cy="16" r="12"/><path d="M16 14v8M16 9h.01"/>',
 'eye':'<path d="M3 16s5-8 13-8 13 8 13 8-5 8-13 8S3 16 3 16z"/><circle cx="16" cy="16" r="3"/>',
 'volume':'<path d="M5 13h5l7-6v18l-7-6H5zM22 12a6 6 0 0 1 0 8M25 9a10 10 0 0 1 0 14"/>',
 'sync':'<path d="M26 11a11 11 0 0 0-19-3L4 11m0 0V4m0 7h7M6 21a11 11 0 0 0 19 3l3-3m0 0v7m0-7h-7"/>',
 'key':'<circle cx="11" cy="16" r="6"/><path d="M17 16h12M24 16v4M28 16v3"/>',
 'logout':'<path d="M13 6H6v20h7M19 10l6 6-6 6M11 16h14"/>',
 'download':'<path d="M16 4v17m-6-6 6 6 6-6M6 27h20"/>',
 'diagnostics':'<path d="M5 25V15M11 25V9M17 25V18M23 25V5M29 25V12"/>',
 'back':'<path d="M19 6 9 16l10 10"/>',
 'home':'<path d="M3 15 16 4l13 11M7 13v15h18V13M12 28v-9h8v9"/>',
 'send':'<path d="m3 16 26-12-7 24-6-9-13-3 13-3"/>',
 'help':'<circle cx="16" cy="16" r="12"/><path d="M12 12a4 4 0 1 1 5 4c-1.5 1-1 2-1 3M16 24h.01"/>',
 'minimize':'<path d="M6 18h20"/>',
 'refresh':'<path d="M27 15a11 11 0 1 0-3 8M27 5v10H17"/>',
 'messages':'<path d="M5 7h22v15H14l-7 5v-5H5z"/><path d="M10 12h12M10 17h8"/>',
 'games':'<path d="M10 11h12c3 0 5 3 6 9l1 4c.5 3-2.5 4.1-4.5 2l-4.5-4h-8l-4.5 4C5.5 28.1 2.5 27 3 24l1-4c1-6 3-9 6-9z"/><path d="M9 15v7m-3.5-3.5h7M23 16h.01M26 19h.01"/>',
 'wallet':'<rect x="4" y="7" width="24" height="21" rx="4"/><path d="M4 13h24M19 18h9v7h-9z"/><circle cx="23" cy="21.5" r="1"/>',
 'bell':'<path d="M7 23h18l-2.5-4v-6a6.5 6.5 0 0 0-13 0v6z"/><path d="M13 27c.6 3 5.4 3 6 0"/>',
 'paw':'<ellipse cx="16" cy="23" rx="7" ry="5"/><ellipse cx="7" cy="13" rx="2" ry="3"/><ellipse cx="13" cy="9" rx="2" ry="3"/><ellipse cx="20" cy="9" rx="2" ry="3"/><ellipse cx="26" cy="13" rx="2" ry="3"/>',
 'portrait':'<circle cx="16" cy="12" r="5"/><path d="M6 27c.7-7 5-10 10-10s9.3 3 10 10z"/>',
 'store':'<path d="M7 12h18v16H7zM5 12l3-8h16l3 8-3 4-4-4-4 4-4-4-4 4z"/><path d="M14 28V19h6v9"/>',
 'person-plus':'<circle cx="13" cy="11" r="5"/><path d="M4 27c0-6 4-10 9-10 3 0 5 1 7 3M25 20v9m-4.5-4.5h9"/>',
 'settings':'<circle cx="16" cy="16" r="5"/><path d="m13 3 1 4h4l1-4 4 2-2 4 3 3 4-1 1 5-4 1-1 4 3 3-4 4-3-3-4 1-1 4-5-1 1-4-4-2-3 2-3-4 3-3-1-4-4-1 1-5 4 1 3-3-2-4z"/>',
 'extension':'<path d="M12 4h8v5a4 4 0 1 1 0 8v10H5V17h5a4 4 0 1 0 0-8V4h2z"/>',
 'atrium':'<path d="M5 26V12l11-7 11 7v14M11 26V14h10v12M7 9h18"/><circle cx="16" cy="18" r="2"/>',
 'notepad':'<rect x="7" y="4" width="18" height="24" rx="3"/><path d="M12 10h9M12 16h9M12 22h6"/>'
});
export function uiGlyph(name){
 const shape=SHAPES[name]||SHAPES.extension;
 return `<svg class="tavi-ui-glyph" aria-hidden="true" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">${shape}</svg>`;
}
export function appGlyph(name){
 const shape=SHAPES[name]||SHAPES.extension;
 return `<svg class="tavi-app-glyph" aria-hidden="true" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round">${shape}</svg>`;
}
