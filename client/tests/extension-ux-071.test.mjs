import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const js=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../src/style.css',import.meta.url),'utf8');
test('extension install approval is Tavi-owned and not a browser confirm',()=>{
 assert.match(js,/function extensionInstallDialog\(\)/);
 assert.match(js,/role=\"dialog\" aria-modal=\"true\"/);
 assert.match(js,/data-extension-install-approve/);
 assert.match(js,/data-extension-install-cancel/);
 assert.doesNotMatch(js,/confirm\(`Install\/update/);
});
test('extension fills available stage without loosening iframe permissions',()=>{
 assert.match(css,/\.tavi-extension-panel\{flex:1 1 auto;min-height:0;height:auto/);
 assert.match(css,/\.tavi-extension-frame\{flex:1 1 auto;min-height:0;overflow:hidden/);
 assert.match(js,/frame\.setAttribute\('sandbox','allow-scripts'\)/);
 assert.match(js,/function attachExtensionFrame\(previous\)/);
});

test('official iframe host declares host-managed navigation',()=>{const host=fs.readFileSync(new URL('../src/extensions/host.js',import.meta.url),'utf8');assert.match(host,/mode:'embedded',navigation:'host'/);});
