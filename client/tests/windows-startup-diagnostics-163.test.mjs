import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const boot=readFileSync(new URL('../public/boot-guard.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
function node(tagName){
 const el={tagName:tagName.toUpperCase(),children:[],style:{},textContent:'',listeners:{},setAttribute(k,v){this[k]=v;},
  addEventListener(k,fn){this.listeners[k]=fn;},appendChild(child){this.children.push(child);},get childElementCount(){return this.children.length;}};
 return el;
}
function probe(){
 const app=node('div'),events={},window={location:{origin:'https://tauri.localhost',reload(){this.reloaded=true;}},
  addEventListener(name,fn){events[name]=fn;},setTimeout(fn){this.timeout=fn;}};
 const document={baseURI:'https://tauri.localhost/index.html',getElementById(id){return id==='app'?app:null;},
  querySelector(selector){return selector==='meta[name="tavi-client-version"]'?{content:'0.3.165'}:null;},createElement:node};
 const location=window.location;
 vm.runInNewContext(boot,{window,document,location,URL,Number,String});
 const text=()=>app.children.flatMap(x=>x.children).map(x=>x.textContent).join('\n');
 return {app,events,window,document,text};
}
test('entry order and version marker let classic bootstrap run before module graph',()=>{
 assert.ok(html.indexOf('boot-guard.js')<html.indexOf('/src/main.js'));
 assert.ok(html.includes('name="tavi-client-version" content="0.3.165"'));
 assert.match(main,/globalThis\.taviBootStarted\?\.\(\)/);
 assert.match(main,/window\.taviBootComplete\?\.\(\)/);
});
test('resource load errors describe only the same-origin module basename',()=>{
 const p=probe();p.events.error({target:{tagName:'SCRIPT',src:'https://tauri.localhost/assets/index-3f5.js?token=NEVER'}});
 p.window.timeout();assert.match(p.text(),/TAVI_STARTUP_SCRIPT_LOAD asset=index-3f5\.js/);
 assert.doesNotMatch(p.text(),/token|NEVER/i);
});
test('unrelated image and icon errors cannot falsely report a script failure',()=>{
 const p=probe();p.events.error({target:{tagName:'IMG',src:'https://elsewhere/icon.svg'}});
 p.window.timeout();assert.match(p.text(),/TAVI_STARTUP_MODULE_TIMEOUT/);
 assert.doesNotMatch(p.text(),/SCRIPT_LOAD|RUNTIME_ERROR/);
});
test('runtime exception location is bounded, and raw exception messages never leak',()=>{
 const p=probe();p.events.error({target:p.window,error:{name:'ReferenceError'},message:'Bearer sensitive-account-token',
  filename:'https://tauri.localhost/assets/index-abc.js?secret=TOKEN',lineno:105,colno:9});
 p.window.timeout();assert.match(p.text(),/TAVI_STARTUP_RUNTIME_ERROR ReferenceError asset=index-abc\.js :105:9/);
 assert.doesNotMatch(p.text(),/Bearer|sensitive|secret|TOKEN/);
});
test('external cross-origin source is hidden',()=>{
 const p=probe();p.events.error({target:p.window,error:{name:'TypeError'},filename:'https://private.example.net/session-secret.js',lineno:1,colno:2});
 p.window.timeout();assert.match(p.text(),/TAVI_STARTUP_RUNTIME_ERROR TypeError/);
 assert.doesNotMatch(p.text(),/private|session-secret/);
});
test('promise rejection is diagnosed separately, without reason contents',()=>{
 const p=probe();p.events.unhandledrejection({reason:{name:'TypeError',message:'private value'}});
 p.window.timeout();assert.match(p.text(),/TAVI_STARTUP_PROMISE_REJECTION TypeError/);
 assert.doesNotMatch(p.text(),/private value/);
});
test('started module but missing first render is distinct from missing module',()=>{
 const p=probe();p.window.taviBootStarted();p.window.timeout();
 assert.match(p.text(),/TAVI_STARTUP_RENDER_TIMEOUT/);
});
test('successful startup never shows recovery; failed startup allows user reload',()=>{
 const good=probe();good.window.taviBootStarted();good.window.taviBootComplete();good.window.timeout();
 assert.equal(good.app.children.length,0);
 const bad=probe();bad.window.timeout();const panel=bad.app.children[0];
 assert.equal(panel.role,'alert');panel.children.at(-1).listeners.click();
 assert.equal(bad.window.location.reloaded,true);
});
test('recovery does not access storage or include raw JS exceptions in screen',()=>{
 assert.doesNotMatch(boot,/localStorage|sessionStorage|\.message|Bearer|token/);
 assert.match(boot,/No account or session data is shown/);
});
