import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const file=f=>readFileSync(new URL(f,import.meta.url),'utf8');
const main=file('../src/main.js'),chat=file('../src/chat.js'),notifications=file('../src/notifications.js'),css=file('../src/style.css');
test('roster shows unread badges and native chat windows acknowledge viewed messages',()=>{
 for(const token of ['unreadTotal','unread-badge','scanDirectMessages','reconcileDirectFeed','saveChatReadState','social-chat-viewed'])assert.ok(main.includes(token),token);
 assert.match(main,/chatPollPeers\(state\.contacts,state\.chatOffset,12\)/);
 assert.match(chat,/emitTo\('main','social-chat-viewed'/);
 assert.match(chat,/document\.hasFocus\(\)/);
 assert.match(chat,/setInterval\(update,3500\)/);
 assert.doesNotMatch(chat,/if\(document\.activeElement===\$\('message'\)\)return/);
 assert.doesNotMatch(chat,/token\s*:|localStorage|password\s*:/);
});
test('notifications use native Windows/Android plugin with permission, private previews by default',()=>{
 assert.match(notifications,/isPermissionGranted/);
 assert.match(notifications,/sendNotification/);
 assert.match(notifications,/notifyChat/);
 assert.match(notifications,/notifyFriendRequest/);
 assert.match(main,/data-notify-pref/);
 assert.match(main,/preview:state\.notifyPrefs\.preview/);
});
test('phone UI has comfortable tap targets and safe area for bottom navigation',()=>{
 assert.match(css,/env\(safe-area-inset-bottom/);
 assert.match(css,/\.buddy \{min-height:48px/);
 assert.match(css,/\.bottom-nav button \{min-height:48px/);
 assert.match(main,/mobileRoster/);
 const conf=JSON.parse(file('../src-tauri/tauri.android.conf.json'));
 assert.equal(conf.app.windows[0].title,'Tavi');
});
