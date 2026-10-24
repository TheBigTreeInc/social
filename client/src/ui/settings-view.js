import {uiGlyph} from './glyphs.js';
import {uiEscape} from './components.js';

const PAGE_TITLES=Object.freeze({
 root:'Settings',account:'Account',notifications:'Notifications',chats:'Chats',devices:'Connected devices',
 appearance:'Appearance',privacy:'Privacy & safety',storage:'Storage',companion:'Companion apps',extensions:'Extensions',about:'About Tavi'
});
export function settingsPageTitle(page='root'){return PAGE_TITLES[page]||PAGE_TITLES.root;}

const icon=name=>`<span class="md-settings-icon" aria-hidden="true">${uiGlyph(name)}</span>`;
const chevron=()=>`<span class="md-settings-chevron" aria-hidden="true">${uiGlyph('chevron')}</span>`;
const safe=v=>uiEscape(v??'');

function navRow({page,action,iconName,title,subtitle='',trailing='',search=''}){
 const target=page?`data-settings-page="${safe(page)}"`:`data-action="${safe(action)}"`;
 return `<button type="button" class="md-settings-row" ${target} data-settings-search="${safe((search||`${title} ${subtitle}`).toLowerCase())}">${icon(iconName)}<span class="md-settings-copy"><strong>${safe(title)}</strong>${subtitle?`<small>${safe(subtitle)}</small>`:''}</span>${trailing?`<span class="md-settings-trailing">${safe(trailing)}</span>`:''}${chevron()}</button>`;
}
function infoRow({iconName,title,subtitle='',trailing=''}){
 return `<div class="md-settings-row md-settings-row--static">${icon(iconName)}<span class="md-settings-copy"><strong>${safe(title)}</strong>${subtitle?`<small>${safe(subtitle)}</small>`:''}</span>${trailing?`<span class="md-settings-trailing">${safe(trailing)}</span>`:''}</div>`;
}
function switchRow({name,id,checked,iconName,title,subtitle=''}){
 return `<label class="md-settings-row md-settings-row--switch" for="${safe(id)}">${icon(iconName)}<span class="md-settings-copy"><strong>${safe(title)}</strong>${subtitle?`<small>${safe(subtitle)}</small>`:''}</span><span class="md-switch"><input id="${safe(id)}" type="checkbox" ${name?`${name}="1"`:''} ${checked?'checked':''}><span aria-hidden="true"></span></span></label>`;
}
function group(title,content){return `<section class="md-settings-group">${title?`<h3>${safe(title)}</h3>`:''}<div class="md-settings-card">${content}</div></section>`;}
function pageIntro(text){return text?`<p class="md-settings-intro">${safe(text)}</p>`:'';}

function root(model){
 const display=model.profile?.displayName||model.profile?.username||'You';
 const handle=model.profile?.username?`@${model.profile.username}`:'Your Tavi account';
 return `<section class="utility tavi-material-settings tavi-settings-index" aria-label="Settings">
  <label class="md-settings-search">${uiGlyph('search')}<input id="settings-search" type="search" inputmode="search" autocomplete="off" placeholder="Search settings" aria-label="Search settings"></label>
  <button type="button" class="md-settings-profile" data-settings-page="account"><span class="md-settings-avatar">${safe(display.slice(0,1).toUpperCase())}</span><span><strong>${safe(display)}</strong><small>${safe(handle)}</small><em>View and manage your Tavi account</em></span>${chevron()}</button>
  <div id="settings-search-results">
   ${group('',[
    navRow({page:'account',iconName:'account',title:'Account',subtitle:'Profile, sign-in and recovery'}),
    navRow({page:'notifications',iconName:'bell',title:'Notifications',subtitle:'Messages, alerts and background delivery'}),
    navRow({page:'chats',iconName:'messages',title:'Chats',subtitle:'Receipts, previews and message behavior'}),
    navRow({page:'devices',iconName:'device',title:'Connected devices',subtitle:'This device, server and cross-device sync'})
   ].join(''))}
   ${group('',[
    navRow({page:'appearance',iconName:'palette',title:'Appearance',subtitle:'Theme and visual preferences'}),
    navRow({page:'privacy',iconName:'shield',title:'Privacy & safety',subtitle:'Recovery, sessions and account protection'}),
    navRow({page:'storage',iconName:'storage',title:'Storage',subtitle:'Local preferences and diagnostic data'})
   ].join(''))}
   ${group('',[
    navRow({page:'companion',iconName:'games',title:'Companion apps',subtitle:`Reviewed Companion ${model.companionVersion||''}`.trim()}),
    navRow({page:'extensions',iconName:'extension',title:'Extensions',subtitle:'Installed apps and update checks'}),
    navRow({page:'about',iconName:'info',title:'About Tavi',subtitle:'Version, updates and diagnostics',trailing:model.updateInfo?`Update ${model.updateInfo.version}`:''})
   ].join(''))}
  </div>
 </section>`;
}

function account(model){
 const display=model.profile?.displayName||model.profile?.username||'You';
 return `<section class="utility tavi-material-settings">${pageIntro(`Signed in as ${display}.`)}
  ${group('Profile',`<form id="profile-form" class="md-settings-form"><label>Display name<input name="displayName" maxlength="24" required value="${safe(model.profile?.displayName||'')}"></label><button class="md-primary-button" type="submit">Save profile</button></form>`)}
  ${group('This device',[
   infoRow({iconName:'device',title:'Device session',subtitle:model.sessionRemembered?'Tavi will remember this sign-in':'Tavi will forget this sign-in when local session data is cleared',trailing:model.sessionRemembered?'Remembered':'Not remembered'}),
   navRow({action:'remember-device',iconName:'key',title:model.sessionRemembered?'Stop remembering this device':'Remember this device',subtitle:'Change persistent sign-in for this device'}),
   navRow({action:'signout',iconName:'logout',title:'Sign out of this device',subtitle:'Other device sessions remain signed in'})
  ].join(''))}
 </section>`;
}

function recoveryBlock(model){
 return `<form id="recovery-codes-form" class="md-settings-form"><p>Generate eight single-use recovery codes. Save them offline. Creating new codes invalidates the old ones.</p><label>Current password<input type="password" autocomplete="current-password" minlength="12" maxlength="128" name="password" required></label><button class="md-primary-button" type="submit">Generate recovery codes</button></form>${model.recoveryCodes?`<div class="md-settings-callout"><strong>Save these now. They will not be shown again.</strong><pre>${model.recoveryCodes.map(safe).join('\n')}</pre><button type="button" data-action="hide-recovery-codes">I have saved my codes</button></div>`:''}${model.recoveryMessage?`<p class="md-settings-status" role="status">${safe(model.recoveryMessage)}</p>`:''}`;
}
function privacy(model){
 return `<section class="utility tavi-material-settings">${pageIntro('Security and privacy controls for this Tavi account and device.')}
  ${group('Account recovery',recoveryBlock(model))}
  ${group('Sessions',[
   infoRow({iconName:'shield',title:'Current device',subtitle:'Signing out revokes this device session only',trailing:model.sessionRemembered?'Remembered':'Session only'}),
   navRow({action:'remember-device',iconName:'key',title:model.sessionRemembered?'Stop remembering this device':'Remember this device',subtitle:'Control whether this device keeps its protected session'}),
   navRow({action:'signout',iconName:'logout',title:'Sign out',subtitle:'Revoke the current Tavi session'})
  ].join(''))}
  ${model.developerAllowed?group('Advanced',`<label class="md-settings-row md-settings-row--switch" for="developer-switch">${icon('settings')}<span class="md-settings-copy"><strong>Developer tools</strong><small>Visibility only; server permission is still required</small></span><span class="md-switch"><input id="developer-switch" type="checkbox" ${model.developerVisible?'checked':''}><span aria-hidden="true"></span></span></label>`):''}
 </section>`;
}

function notifications(model){
 return `<section class="utility tavi-material-settings">${pageIntro('Choose which Tavi events can alert you on this device.')}
  ${group('Messages',[
   switchRow({id:'notify-messages',checked:model.notifyPrefs.messages,iconName:'bell',title:'Message notifications',subtitle:'Notify when new private messages arrive'}).replace('type="checkbox"','type="checkbox" data-notify-pref="messages"'),
   switchRow({id:'notify-requests',checked:model.notifyPrefs.requests,iconName:'account',title:'Friend requests',subtitle:'Notify when someone wants to connect'}).replace('type="checkbox"','type="checkbox" data-notify-pref="requests"'),
   switchRow({id:'notify-preview',checked:model.notifyPrefs.preview,iconName:'eye',title:'Notification previews',subtitle:'Show message text in notifications'}).replace('type="checkbox"','type="checkbox" data-notify-pref="preview"')
  ].join(''))}
  ${group('Sound & delivery',[
   navRow({action:'notifications',iconName:'bell',title:'OS notification permission',subtitle:'Ask the operating system to allow Tavi alerts',trailing:model.pushPermission||'unknown'}),
   navRow({action:'toggle-mute',iconName:'volume',title:model.mute?'Unmute Tavi alerts':'Mute Tavi alerts',subtitle:model.mute?'Notifications are currently muted':'Silence in-app alert sounds'}),
   navRow({action:'test-notification',iconName:'bell',title:'Send test notification',subtitle:'Verify the operating-system notification path'})
  ].join(''))}
  ${group('Background delivery',`<label class="md-settings-row md-settings-row--switch" for="push-opt-in">${icon('sync')}<span class="md-settings-copy"><strong>Background alerts</strong><small>${safe(model.pushLabel||'Background delivery status unavailable')}</small></span><span class="md-switch"><input id="push-opt-in" type="checkbox" ${model.pushPrefs.backgroundEnabled?'checked':''}><span aria-hidden="true"></span></span></label>${navRow({action:'push-check',iconName:'refresh',title:'Check background support',subtitle:model.platform==='android'?'Requires a supported UnifiedPush distributor on Android':'Check server and browser support'})}<p class="md-settings-footnote">No endpoint is registered until a distributor provides one and background alerts are explicitly enabled. Message content and credentials never travel in push payloads.</p>`)}
 </section>`;
}

function chats(model){
 return `<section class="utility tavi-material-settings">${pageIntro('Conversation behavior and delivery information.')}
  ${group('Messages',[
   infoRow({iconName:'messages',title:'Message length',subtitle:'Tavi keeps the draft and shows an error instead of silently dropping oversized messages',trailing:'1,000 max'}),
   infoRow({iconName:'eye',title:'Delivery and seen receipts',subtitle:'Sent = stored, Delivered = fetched by the recipient, Seen = opened/read',trailing:'On'}),
   switchRow({id:'chat-preview',checked:model.notifyPrefs.preview,iconName:'eye',title:'Notification previews',subtitle:'Show message text outside the conversation'}).replace('type="checkbox"','type="checkbox" data-notify-pref="preview"')
  ].join(''))}
  ${group('Open',navRow({action:'contacts',iconName:'messages',title:'Messages',subtitle:'Return to your conversations'}))}
 </section>`;
}

function devices(model){
 const platform=model.platform==='android'?'Android':model.platform==='windows'?'Windows desktop':'Web browser';
 let host='Connected Social server'; try{host=new URL(model.origin).host;}catch{}
 return `<section class="utility tavi-material-settings">${pageIntro('Tavi sessions are account-bound. Each device keeps its own session and uses Social for synchronized conversation state.')}
  ${group('This device',[
   infoRow({iconName:'device',title:platform,subtitle:'Current Tavi client',trailing:`v${model.clientVersion}`}),
   infoRow({iconName:'sync',title:'Social server',subtitle:host,trailing:'Connected'}),
   navRow({action:'remember-device',iconName:'key',title:model.sessionRemembered?'Remembered sign-in':'Remember this device',subtitle:'Control persistent sign-in on this device',trailing:model.sessionRemembered?'On':'Off'}),
   navRow({action:'signout',iconName:'logout',title:'Sign out of this device',subtitle:'Other Tavi sessions stay signed in'})
  ].join(''))}
  ${group('Cross-device sync',[
   infoRow({iconName:'messages',title:'Messages and read state',subtitle:'Synchronized through your Social account',trailing:'On'}),
   infoRow({iconName:'games',title:'Game notifications',subtitle:'Tavi receives game turns and invitations through LoopRD',trailing:'On'})
  ].join(''))}
 </section>`;
}

function appearance(model){
 return `<section class="utility tavi-material-settings">${pageIntro('Tavi uses one shared theme across first-party surfaces.')}
  ${group('Theme',`<div class="md-theme-choice" role="group" aria-label="Color theme"><button type="button" data-set-theme="light" aria-pressed="${model.theme==='light'}" class="${model.theme==='light'?'selected':''}"><span>Light</span><small>Android-style light surface</small></button><button type="button" data-set-theme="dark" aria-pressed="${model.theme==='dark'}" class="${model.theme==='dark'?'selected':''}"><span>Dark</span><small>Dark green Tavi surface</small></button></div>`)}
 </section>`;
}

function storage(){
 return `<section class="utility tavi-material-settings">${pageIntro('Tavi keeps small device preferences locally; conversations and account data belong to Social.')}
  ${group('Storage & data',[
   infoRow({iconName:'storage',title:'Local preferences',subtitle:'Theme, notification preferences and device-session metadata',trailing:'On device'}),
   infoRow({iconName:'messages',title:'Messages',subtitle:'Stored by the connected Social component, not as a local chat archive',trailing:'Server'}),
   navRow({action:'copy-diagnostics',iconName:'diagnostics',title:'Diagnostics',subtitle:'Review a privacy-safe local status snapshot'})
  ].join(''))}
 </section>`;
}

function companion(model){
 return `<section class="utility tavi-material-settings">${pageIntro('Manage Tavi companion experiences through the reviewed extension system.')}
  ${group('Companion',[
   navRow({action:'companion',iconName:'games',title:'Tavi Companion',subtitle:`Reviewed bundled release ${model.companionVersion||'unknown'}`,trailing:model.companionVersion||''}),
   navRow({action:'app-store',iconName:'store',title:'App Store',subtitle:'Install or manage reviewed companion apps'})
  ].join(''))}
 </section>`;
}

function extensions(){
 return `<section class="utility tavi-material-settings">${pageIntro('Extensions run in reviewed, isolated app surfaces and do not inherit Social credentials.')}
  ${group('Extensions',[
   navRow({action:'app-store',iconName:'store',title:'App Store',subtitle:'Browse installed and available extensions'}),
   navRow({action:'check-extension-updates',iconName:'refresh',title:'Check app updates',subtitle:'Refresh reviewed extension sources'})
  ].join(''))}
 </section>`;
}

function about(model){
 const android=model.platform==='android'&&model.nativeApp;
 const updateCard=model.updateInfo?`<section class="md-update-available"><div>${icon('download')}<span><strong>Update available</strong><small>Tavi ${safe(model.updateInfo.version)} is ready to download.</small></span></div><button type="button" class="md-primary-button" data-action="download-update">${android?'Download and install':'Download update'}</button></section>`:'';
 const status=model.updateError?`Update check failed: ${safe(model.updateError)}`:model.updateChecked?(model.updateInfo?`Version ${safe(model.updateInfo.version)} available`:'Tavi is up to date'):'Not checked yet';
 const androidBlock=android?group('Android updater',[
  infoRow({iconName:'download',title:'Updater status',subtitle:(model.androidStatus?.stage||'idle').replaceAll('_',' '),trailing:model.androidStatus?.version||''}),
  navRow({action:'android-update-status',iconName:'refresh',title:'Refresh updater status',subtitle:'Read PackageInstaller download/install state'}),
  navRow({action:'android-update-self-test',iconName:'shield',title:'Test updater',subtitle:'Verify official APK package, version and signature without installing'}),
  navRow({action:'android-update-copy-diagnostics',iconName:'diagnostics',title:'Updater diagnostics',subtitle:'Copy privacy-safe updater status details'})
 ].join('')):'';
 return `<section class="utility tavi-material-settings">${updateCard}
  ${group('Tavi',[
   infoRow({iconName:'info',title:'App version',subtitle:'Installed Tavi client',trailing:model.clientVersion}),
   navRow({action:'check-updates',iconName:'refresh',title:'Check for updates',subtitle:status}),
   infoRow({iconName:'shield',title:'Update channel',subtitle:'Stable releases only',trailing:'Stable'})
  ].join(''))}
  ${androidBlock}
  ${group('Support & diagnostics',[
   navRow({action:'copy-diagnostics',iconName:'diagnostics',title:'Tavi diagnostics',subtitle:'Review and copy a privacy-safe support snapshot'}),
   navRow({action:'about',iconName:'info',title:'About Tavi',subtitle:'Tavi messenger and social game launcher'})
  ].join(''))}
 </section>`;
}

export function renderSettings(model={}){
 switch(model.page){
  case 'account':return account(model);
  case 'notifications':return notifications(model);
  case 'chats':return chats(model);
  case 'devices':return devices(model);
  case 'appearance':return appearance(model);
  case 'privacy':return privacy(model);
  case 'storage':return storage(model);
  case 'companion':return companion(model);
  case 'extensions':return extensions(model);
  case 'about':return about(model);
  default:return root(model);
 }
}
