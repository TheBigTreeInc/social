import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {composerState,messageLimit,messageReceipt} from '../src/message-ui.js';

test('direct messages show a visible 1000-character limit instead of silently truncating',()=>{
  assert.equal(messageLimit('acct_2'),1000);
  assert.deepEqual(composerState('x'.repeat(1000),1000),{length:1000,limit:1000,remaining:0,over:false,near:true,label:'1000 / 1000',error:''});
  const over=composerState('x'.repeat(1001),1000);
  assert.equal(over.over,true);
  assert.match(over.error,/1,001 characters; maximum is 1,000/);
});

test('receipt state is truthful and monotonic',()=>{
  const message={id:42,authorId:'acct_1'};
  assert.equal(messageReceipt(message,'acct_1',{}),'Sent');
  assert.equal(messageReceipt(message,'acct_1',{peerDeliveredId:42,peerReadId:0}),'Delivered');
  assert.equal(messageReceipt(message,'acct_1',{peerDeliveredId:42,peerReadId:42}),'Seen');
  assert.equal(messageReceipt({...message,authorId:'acct_2'},'acct_1',{peerReadId:99}),null);
});

test('main and native chat no longer depend on maxlength for private-message rejection',()=>{
  const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
  const chat=readFileSync(new URL('../src/chat.js',import.meta.url),'utf8');
  assert.match(main,/composerState\(value,messageLimit\(state\.peer\)\)/);
  const ui=readFileSync(new URL('../src/message-ui.js',import.meta.url),'utf8');
  assert.match(ui,/Message is/);
  assert.doesNotMatch(chat,/maxlength="\$\{peer==='lobby'\?320:1000\}"/);
  assert.match(chat,/composerState\(text,messageLimit\(peer\)\)/);
  assert.match(chat,/message-receipt/);
});

test('0.3.109 keeps the Android PackageInstaller repair and overlay compatibility guards',()=>{
  const plugin=readFileSync(new URL('../../tools/android-update/TaviUpdaterPlugin.kt',import.meta.url),'utf8');
  const legacy=readFileSync(new URL('./android-updater-100.test.mjs',import.meta.url),'utf8');
  const overlay=readFileSync(new URL('../../tests/ziprunner-overlay-compat.test.mjs',import.meta.url),'utf8');
  assert.match(plugin,/import app\.tauri\.plugin\.JSObject/);
  assert.doesNotMatch(plugin,/import app\.tauri\.JSObject/);
  assert.doesNotMatch(legacy,/0\.3\.100/);
  assert.match(overlay,/android-updater-100\.test\.mjs/);
});
