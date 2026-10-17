import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const source=(await readFile(new URL('../src/main.js',import.meta.url),'utf8'))
  .split('\n').filter(line=>!line.startsWith('import ')).join('\n')
  .split("window.addEventListener('message'")[0];

function shell({connected=true,mobileRoster=false}={}) {
  const app={innerHTML:''};
  const context={
    document:{getElementById:key=>key==='app'?app:null,querySelectorAll:()=>[]},
    localStorage:{getItem:()=>null},readConfig:()=>({server:'https://social.example.org',games:['jones'],gamesByServer:{}}),
    isTauri:()=>false,navigator:{userAgent:'Mozilla/5.0'},clearTimeout(){},setTimeout(){},URL,Date,Map,JSON,String,console,
  };
  const fixture=`
    state.connected=${connected};state.mobileRoster=${mobileRoster};
    state.api={origin:'https://social.example.org'};
    state.profile={profileId:'alice',displayName:'Alice'};
    state.contacts=[{id:'bob',username:'Bob',status:'accepted',online:true},{id:'eve',username:'Eve',status:'accepted',online:false}];
    state.peer='bob';state.direct=[{id:1,authorId:'bob',displayName:'Bob',at:1760550000,text:'Want to play?'}];
    render();`;
  runInNewContext(source+'\n'+fixture,context);
  return app.innerHTML;
}

test('desktop: classic window chrome, real roster grouping, simple transcript and small integrated game panel',()=>{
  const html=shell();
  for (const cls of ['roster-window','window-titlebar','menubar','conversation classic-window','transcript-message','roster-scroll','games-strip','compose-toolbar'])
    assert(html.includes(cls),cls);
  assert(html.includes('Online (1)')&&html.includes('Offline (1)'));
  assert(html.includes('data-contact-name="bob"'));
  assert(html.includes('Want to play?'));
  assert(!html.includes('gamepane')&&!html.includes('bubble-row'));
  assert(!html.includes('Admin / Debug'), 'server-denied developer pane must remain hidden');
});

test('mobile navigation state and login are server-scoped and token-free',()=>{
  const html=shell({mobileRoster:true});
  assert(html.includes('messenger show-roster'));
  assert(html.includes('data-action="contacts"'));
  const login=shell({connected:false});
  assert(login.includes('Tavi · Sign in'));
  assert(login.includes('LoopRD server address'));
  assert(!login.includes('social-token'));
  assert(!login.includes('dev-token'));
});

test('untrusted friend names/messages are escaped before inclusion',()=>{
  const app={innerHTML:''};
  const context={
    document:{getElementById:key=>key==='app'?app:null,querySelectorAll:()=>[]},
    readConfig:()=>({server:'https://social.example.org',games:[],gamesByServer:{}}),
    isTauri:()=>false,navigator:{userAgent:'Mozilla/5.0'},clearTimeout(){},setTimeout(){},URL,Date,Map,JSON,String,
  };
  runInNewContext(source+`
  state.connected=true;state.api={origin:'https://social.example.org'};
  state.profile={profileId:'alice',displayName:'Alice'};
  state.contacts=[{id:'bob',username:'<script>alert(1)</script>',status:'accepted',online:true}];
  state.peer='bob';state.direct=[{id:1,authorId:'bob',displayName:'Bob',at:1760550000,text:'<img src=x onerror=bad()>'}];render();`,context);
  assert(!app.innerHTML.includes('<script>alert(1)</script>'));
  assert(!app.innerHTML.includes('<img src=x'));
  assert(app.innerHTML.includes('&lt;img src=x'));
});
