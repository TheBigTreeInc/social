import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderSettings,settingsPageTitle} from '../src/ui/settings-view.js';

const model={page:'root',profile:{displayName:'Dorbian',username:'dorbian'},origin:'https://social.example',sessionRemembered:true,theme:'light',notifyPrefs:{messages:true,requests:true,preview:false},pushPrefs:{backgroundEnabled:false},pushPermission:'granted',pushLabel:'Background alerts off',mute:false,platform:'android',nativeApp:true,clientVersion:'0.3.113',companionVersion:'0.6.27',updateChecked:true,updateInfo:{version:'0.3.113'},androidStatus:{stage:'idle'},developerAllowed:false};

test('settings index follows Android-style category hierarchy with search and account card',()=>{
 const html=renderSettings(model);
 assert.match(html,/id="settings-search"/);
 assert.match(html,/md-settings-profile/);
 for(const page of ['account','notifications','chats','devices','appearance','privacy','storage','companion','extensions','about'])
  assert.match(html,new RegExp(`data-settings-page="${page}"`));
});

test('settings subpages keep real Tavi controls rather than mock-only rows',()=>{
 const notifications=renderSettings({...model,page:'notifications'});
 assert.match(notifications,/data-notify-pref="messages"/);
 assert.match(notifications,/id="push-opt-in"/);
 assert.match(notifications,/data-action="test-notification"/);
 const privacy=renderSettings({...model,page:'privacy'});
 assert.match(privacy,/id="recovery-codes-form"/);
 assert.match(privacy,/data-action="remember-device"/);
 const about=renderSettings({...model,page:'about'});
 assert.match(about,/data-action="check-updates"/);
 assert.match(about,/data-action="download-update"/);
 assert.match(about,/data-action="android-update-self-test"/);
 assert.match(about,/Current|App version/);
});

test('settings title and host back integration preserve Settings before Home',()=>{
 assert.equal(settingsPageTitle('notifications'),'Notifications');
 assert.equal(settingsPageTitle('nope'),'Settings');
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(main,/state\.panel==='settings'&&state\.settingsPage!=='root'/);
 assert.match(main,/state\.settingsPage='root'/);
 assert.match(main,/settingsBack=.*\?'Settings':'Home'/);
});

test('settings stylesheet uses Material-like surfaces and touch-friendly rows',()=>{
 const css=readFileSync(new URL('../src/ui/settings.css',import.meta.url),'utf8');
 assert.match(css,/md-settings-card/);
 assert.match(css,/border-radius:20px/);
 assert.match(css,/min-height:64px/);
 assert.match(css,/md-switch/);
 assert.match(css,/:root\[data-theme='dark'\]/);
});
