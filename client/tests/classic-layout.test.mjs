import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {createSurfaceRegistry} from '../src/surfaces.js';

const source=(await readFile(new URL('../src/main.js',import.meta.url),'utf8'))
  .split('\n').filter(line=>!line.startsWith('import ')).join('\n')
  .split("window.addEventListener('message'")[0];

function shell({connected=true,mobileRoster=false,panel='messenger'}={}) {
  const app={innerHTML:''};
  const context={
    createDiagnosticEvents:()=>({record(){},clear(){},snapshot(){return [];}}),createSurfaceRegistry,createExtensionHost:()=>({unmount(){},mount(){}}),extensionStorageScope:()=>null,petById:()=>null,petSprite:()=>'',atriumLauncher:()=>({available:false}),companionPanel:()=>'',
    document:{addEventListener:()=>{},getElementById:key=>key==='app'?app:null,querySelectorAll:()=>[],querySelector:()=>null},
    localStorage:{getItem:()=>null},newCompanion:()=>({enabled:false,overlay:'off'}),companionBadge:()=>'',readConfig:()=>({server:'https://social.example.org',games:['jones'],gamesByServer:{}}),
    createResumeSync:()=>()=>false,createPushWakeupBridge:()=>()=>false,createDeviceSessionStore:()=>({load:async()=>({record:null,remembered:false})}),invoke:async()=>null,sessionStorage:{getItem:()=>null},isTauri:()=>false,navigator:{userAgent:'Mozilla/5.0'},clearTimeout(){},setTimeout(){},URL,Date,Map,JSON,String,console,
  };
  const fixture=`
    state.connected=${connected};state.mobileRoster=${mobileRoster};
    state.api={origin:'https://social.example.org'};
    state.profile={profileId:'alice',displayName:'Alice'};
    state.contacts=[{id:'bob',username:'Bob',status:'accepted',online:true},{id:'eve',username:'Eve',status:'accepted',online:false}];
    state.panel='${panel}';state.peer='bob';state.direct=[{id:1,authorId:'bob',displayName:'Bob',at:1760550000,text:'Want to play?'}];
    render();`;
  runInNewContext(source+'\n'+fixture,context);
  return app.innerHTML;
}

test('focused chat uses message area without navigation dock and keeps escaped transcript',()=>{
  const html=shell();
  for (const cls of ['tavi-modern-chat','tavi-chat-history','tavi-chat-bubble','tavi-chat-compose','tavi-chat-minimize'])
    assert(html.includes(cls),cls);
  assert(!html.includes('tavi-home-dock'), 'no navigation while chatting');
  assert(html.includes('Want to play?'));
  assert(!html.includes('gamepane'));
  assert(!html.includes('Admin / Debug'), 'server-denied developer pane must remain hidden');
});

test('mobile navigation state and login are server-scoped and token-free',()=>{
  const html=shell({mobileRoster:true});
  assert(html.includes('tavi-contact-focus'));
  assert(html.includes('data-action="minimize-view"'));
  const login=shell({connected:false});
  assert(login.includes('Tavi · Sign in'));
  assert(login.includes('LoopRD server address'));
  assert(!login.includes('social-token'));
  assert(!login.includes('dev-token'));
});

test('untrusted friend names/messages are escaped before inclusion',()=>{
  const app={innerHTML:''};
  const context={
    createDiagnosticEvents:()=>({record(){},clear(){},snapshot(){return [];}}),createSurfaceRegistry,createExtensionHost:()=>({unmount(){},mount(){}}),extensionStorageScope:()=>null,petById:()=>null,petSprite:()=>'',atriumLauncher:()=>({available:false}),companionPanel:()=>'',
    document:{addEventListener:()=>{},getElementById:key=>key==='app'?app:null,querySelectorAll:()=>[],querySelector:()=>null},
    localStorage:{getItem:()=>null},newCompanion:()=>({enabled:false,overlay:'off'}),companionBadge:()=>'',readConfig:()=>({server:'https://social.example.org',games:[],gamesByServer:{}}),
    createResumeSync:()=>()=>false,createPushWakeupBridge:()=>()=>false,createDeviceSessionStore:()=>({load:async()=>({record:null,remembered:false})}),invoke:async()=>null,sessionStorage:{getItem:()=>null},isTauri:()=>false,navigator:{userAgent:'Mozilla/5.0'},clearTimeout(){},setTimeout(){},URL,Date,Map,JSON,String,
  };
  runInNewContext(source+`
  state.connected=true;state.api={origin:'https://social.example.org'};
  state.profile={profileId:'alice',displayName:'Alice'};
  state.contacts=[{id:'bob',username:'<script>alert(1)</script>',status:'accepted',online:true}];
  state.panel='messenger';state.mobileRoster=false;state.peer='bob';state.direct=[{id:1,authorId:'bob',displayName:'Bob',at:1760550000,text:'<img src=x onerror=bad()>'}];render();`,context);
  assert(!app.innerHTML.includes('<script>alert(1)</script>'));
  assert(!app.innerHTML.includes('<img src=x'));
  assert(app.innerHTML.includes('&lt;img src=x'));
});

test('Home matches sketch and only Home shows game/menu/message dock',()=>{
 const home=shell({panel:'home'});
 for(const label of ['tavi-home-roster','menubar','roster-profile','roster-toolbar','roster-search','Conversations','Community Lobby','Online (','Offline (','My Games','window-status','tavi-home-dock','Games','Main menu','Messages'])assert(home.includes(label),label);
 assert(!shell({panel:'messenger'}).includes('tavi-home-dock'));
});
