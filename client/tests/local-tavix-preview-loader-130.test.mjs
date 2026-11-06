import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// No companion code is run by these tests. A tiny fake document captures the
// preview renderer's generated HTML and stylesheet/script URL decisions.
const loader=readFileSync(new URL('../public/local-extension-host.js',import.meta.url),'utf8');
const config=JSON.parse(readFileSync(new URL('../src-tauri/tauri.conf.json',import.meta.url),'utf8'));
function exercise(stylesheets,html='<link rel="stylesheet" href="./style.css"><script src="./app.js"></script>'){
 const assets={'ui/index.html':Buffer.from(html),'ui/app.js':Buffer.from('document.body.dataset.started="yes";')};
 for(const [name,contents] of Object.entries(stylesheets))assets[name]=Buffer.from(contents);
 const events=new Map(),reports=[],urls=[],cssNodes=[],inlineStyles=[],scripts=[],links=[];
 let output='',error='';
 const parent={postMessage:message=>reports.push(message)};
 const element=(tag,attributes={})=>({
  tagName:tag.toUpperCase(),attributes:[],textContent:'',getAttribute:name=>attributes[name]??null,
  setAttribute:(name,value)=>{attributes[name]=value;},hasAttribute:name=>Object.hasOwn(attributes,name),
  replaceWith(other){if(tag==='link'){const i=links.indexOf(this);if(i>=0)links.splice(i,1);cssNodes.push(other);}},
  remove(){if(tag==='link'){const i=links.indexOf(this);if(i>=0)links.splice(i,1);}}
 });
 const document={
  body:{replaceChildren:node=>{error=node.textContent;}},createTextNode:text=>({textContent:text}),
  open(){},write:value=>{output=value;},close(){},
 };
 const fakeDocument={
  head:{prepend(){}},
  createElement:tag=>element(tag),
  querySelectorAll(selector){
   if(selector==='link')return [...links];
   if(selector==='style')return [...inlineStyles];
   if(selector==='script')return scripts;
   if(selector==='*')return [...cssNodes,...inlineStyles,...scripts];
   return [];
  },
  documentElement:{get outerHTML(){return `<html><head>${[...cssNodes,...inlineStyles].map(s=>`<style>${s.textContent}</style>`).join('')}</head><body>${scripts.map(x=>`<script src="${x.getAttribute('src')}"></script>`).join('')}</body></html>`;}}
 };
 const l=html.match(/<link rel="stylesheet" href="([^"]+)"/);
 if(l)links.push(element('link',{href:l[1],rel:'stylesheet'}));
 const script=html.match(/<script src="([^"]+)"/);
 if(script)scripts.push(element('script',{src:script[1]}));
 const inline=html.match(/<style>([\s\S]*?)<\/style>/);if(inline){const node=element('style');node.textContent=inline[1];inlineStyles.push(node);}
 const window={addEventListener:(name,fn)=>events.set(name,fn)};
 const context={window,parent,document,DOMParser:class{parseFromString(){return fakeDocument;}},
  TextDecoder,Uint8Array,Blob,URL:{createObjectURL:blob=>{const url=`blob:local-${urls.length+1}`;urls.push({url,type:blob.type});return url;},revokeObjectURL(){}},};
 vm.runInNewContext(loader,context,{filename:'local-extension-host.js',timeout:1500});
 events.get('message')({source:parent,data:{type:'tavi.local.load/v1',package:{schema:'tavi.local-package/v1',manifest:{entrypoints:{panel:'ui/index.html'}},assets}}});
 return {output,error,reports,urls,cssNodes,scripts};
}
const status=r=>r.reports.map(x=>x.code);

test('CSS loads inline before JavaScript and needs no blob stylesheet in native CSP',()=>{
 const r=exercise({'ui/style.css':'#viewport{height:450px}canvas{width:100%;height:100%}'});
 assert.equal(r.error,'');assert.match(r.output,/<style>#viewport\{height:450px\}/);
 assert.equal(r.urls.filter(x=>x.type==='text/css').length,0);
 assert.equal(r.urls.filter(x=>x.type==='text/javascript').length,2); // monitor + app
 assert.deepEqual(status(r),['assets_prepared']);
 assert.match(config.app.security.csp,/style-src 'self' 'unsafe-inline'/);
 assert.doesNotMatch(config.app.security.csp,/style-src[^;]*blob:/);
});
test('missing styles block ALL scripts and return a bounded diagnostic code',()=>{
 const r=exercise({});assert.match(r.error,/preview blocked/);
 assert.deepEqual(status(r),['css_missing']);assert.equal(r.urls.length,0);
});
test('network stylesheets and remote CSS resource URLs are fail closed',()=>{
 assert.deepEqual(status(exercise({},'<link rel="stylesheet" href="https://external.example/style.css"><script src="./app.js"></script>')),['css_missing']);
 assert.deepEqual(status(exercise({'ui/style.css':'body{background:url(https://external.example/pixel.png)}'})),['css_asset_missing']);
});
test('local imported styles and PNG assets are inlined without external fetches',()=>{
 const r=exercise({'ui/style.css':'@import "./layout.css"; .icon{background:url(./logo.png)}',
  'ui/layout.css':'.viewport{height:450px}','ui/logo.png':new Uint8Array([1,2,3])});
 assert.equal(r.error,'');assert.match(r.output,/viewport\{height:450px\}/);
 assert.match(r.output,/background:url\("blob:local-1"\)/);
 assert.equal(r.urls.filter(x=>x.type==='image/png').length,1);
});
test('cyclic CSS imports, unsupported imports, and closing-style injection are rejected',()=>{
 assert.deepEqual(status(exercise({'ui/style.css':'@import "./style.css";'})),['css_cycle']);
 assert.deepEqual(status(exercise({'ui/style.css':'@import "https://x.test/a.css";'})),['css_import_missing']);
 assert.deepEqual(status(exercise({'ui/style.css':'@import "./a.css" print;', 'ui/a.css':'body{}'})),['css_import_unsupported']);
 assert.deepEqual(status(exercise({'ui/style.css':'body{} </style><script>evil()</script>'})),['css_unsafe']);
});
test('missing JavaScript is refused after CSS preparation, rather than silently dropping functionality',()=>{
 const r=exercise({'ui/style.css':'#viewport{height:400px}'},'<link rel="stylesheet" href="./style.css"><script src="./missing.js"></script>');
 assert.deepEqual(status(r),['script_missing']);
 assert.equal(r.urls.filter(x=>x.type==='text/javascript').length,0);
});
test('global host CSP stays unchanged; local package still runs in opaque allow-scripts sandbox',()=>{
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(main,/frame\.setAttribute\('sandbox','allow-scripts'\)/);
 assert.match(main,/local-extension-host\.html/);
 assert.match(loader,/style-src 'unsafe-inline' blob:/);
 assert.doesNotMatch(loader,/for\(const el of \[\.\.\.doc\.querySelectorAll\('link\[rel=\"stylesheet\"\]'\)\]\)\{[^}]*setAttribute\('href',blobUrl\(path\)\)/s);
});
test('only the active local preview iframe can supply bounded non-sensitive diagnostics',()=>{
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(main,/event\.source!==frame\?\.contentWindow/);
 assert.match(main,/LOCAL_PREVIEW_STATUS_CODES\.has\(code\)/);
 assert.match(main,/if\(count>=4\)return/);
 assert.match(main,/operation:`local_preview\.\$\{code\}`/);
 assert.doesNotMatch(main,/operation:`local_preview\.\$\{event\.data\./);
});

test('CSS @import url(./local.css) works; inline style imports are validated too',()=>{
 const a=exercise({'ui/style.css':'@import url("./part.css");','#unused':'ignore', 'ui/part.css':'.viewport{min-height:440px}'});
 assert.equal(a.error,'');assert.match(a.output,/min-height:440px/);
 const b=exercise({'ui/part.css':'.viewport{min-height:440px}'},'<style>@import "./part.css";</style><script src="./app.js"></script>');
 assert.equal(b.error,'');assert.match(b.output,/min-height:440px/);
});
test('inline untrusted styles cannot load an external network import',()=>{
 const r=exercise({},'<style>@import "https://example.invalid/track.css";</style><script src="./app.js"></script>');
 assert.deepEqual(status(r),['css_import_missing']);assert.equal(r.urls.length,0);
});
test('very large and malformed CSS fails before package code executes',()=>{
 const large=exercise({'ui/style.css':'a{color:red}'.repeat(24000)});
 assert.deepEqual(status(large),['css_budget']);
 const malformed=exercise({'ui/style.css':'div{background:url("https://example.invalid/has space.png")}'});
 assert.deepEqual(status(malformed),['css_asset_unsupported']);
});

test('trusted preview runtime monitor emits only fixed error categories before guest script runs',()=>{
 assert.match(loader,/const monitorCode=`/);
 for(const name of ['script_error','resource_error','policy_violation','document_loaded'])assert.match(loader,new RegExp(name));
 assert.match(loader,/doc\.head\.prepend\(monitor\)/);
 assert.match(loader,/doc\.head\.prepend\(meta\)/);
 assert.doesNotMatch(loader,/event\.message|event\.reason|event\.filename|event\.stack/);
});
