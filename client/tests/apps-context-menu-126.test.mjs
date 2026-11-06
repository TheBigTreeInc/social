import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {appContextActions,canRemoveAppFromTavi,wireAppContextMenus} from '../src/ui/app-context-menu.js';

const tree=path=>readFile(new URL(path,import.meta.url),'utf8');
function fixture(){
 const doc={activeElement:null,events:{},defaultView:{innerWidth:355,innerHeight:630,setTimeout,clearTimeout},
  addEventListener(type,fn){this.events[type]=fn;},removeEventListener(type){delete this.events[type];}};
 const mk=(tag)=>({tag,children:[],events:{},attributes:{},className:'',dataset:{},style:{props:{},setProperty(k,v){this.props[k]=v;}},isConnected:true,
  classList:{value:new Set(),add(x){this.value.add(x);}},
  addEventListener(type,fn){(this.events[type]??=[]).push(fn);},removeEventListener(type,fn){this.events[type]=this.events[type]?.filter(x=>x!==fn);},
  fire(type,e={}){let ev={preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;},...e};for(const fn of this.events[type]||[])fn(ev);return ev;},
  setAttribute(k,v){this.attributes[k]=v;},append(child){this.children.push(child);child.parent=this;},
  remove(){this.isConnected=false;const children=this.parent?.children;if(children)children.splice(children.indexOf(this),1);},
  focus(){doc.activeElement=this;},getBoundingClientRect(){return{left:45,bottom:300};},
  querySelectorAll(selector){return selector==='button'?this.children.filter(x=>x.tag==='button'):[];},
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
 });
 doc.createElement=mk;doc.body=mk('body');
 const tile=mk('button');tile.dataset.appContext='extension:org.test.widget';
 const root={ownerDocument:doc,querySelectorAll:()=>[tile]};
 return {doc,tile,root,overlay:()=>doc.body.children[0],menu:()=>doc.body.children[0]?.children[0]};
}
const store={installed:id=>id==='org.test.widget'};

test('only installed optional extensions can be removed; built-ins and core app protected',()=>{
 const opts={coreWalletId:'org.tavi.core.wallet',bundledCompanionId:'org.tavi.community.companion'};
 assert.equal(canRemoveAppFromTavi({kind:'builtin',action:'settings'},store,opts),false);
 assert.equal(canRemoveAppFromTavi({kind:'extension',id:'org.tavi.core.wallet'}, {installed:()=>true},opts),false);
 assert.equal(canRemoveAppFromTavi({kind:'extension',id:opts.bundledCompanionId}, {installed:()=>true},opts),false);
 assert.equal(canRemoveAppFromTavi({kind:'extension',id:'org.test.widget'},store,opts),true);
 assert.equal(canRemoveAppFromTavi({kind:'extension',id:'org.unknown'},store,opts),false);
 assert.equal(canRemoveAppFromTavi(null,store,opts),false);
});

test('context actions reveal favorites and removal conditionally',()=>{
 assert.deepEqual(appContextActions({isFavorite:false,canRemove:false}).map(x=>x.label),['Open','Add to Favorites']);
 assert.deepEqual(appContextActions({isFavorite:true,canRemove:true}).map(x=>x.label),['Open','Remove from Favorites','Remove from Tavi']);
});

test('mouse context menu opens accessible options; select favorites; teardown removes overlay',()=>{
 const f=fixture(),seen=[];
 const dispose=wireAppContextMenus(f.root,{resolveApp:()=>({label:'Widget',isFavorite:false,canRemove:true}),onFavorite:x=>seen.push(x.label)});
 const e=f.tile.fire('contextmenu',{clientX:70,clientY:190});assert.equal(e.prevented,true);
 assert.equal(dispose.dismiss(),true);assert.equal(dispose.dismiss(),false);
 f.tile.fire('contextmenu',{clientX:70,clientY:190});
 assert.equal(f.menu().attributes.role,'menu');assert.equal(f.menu().attributes['aria-label'],'Widget options');
 assert.equal(f.menu().querySelectorAll('button').length,3);
 f.menu().querySelectorAll('button')[1].fire('click');assert.deepEqual(seen,['Widget']);assert.equal(f.overlay(),undefined);
 f.tile.fire('contextmenu',{clientX:80,clientY:180});dispose();assert.equal(f.overlay(),undefined);
});

test('long press opens bottom sheet, suppresses synthetic open click',async()=>{
 const f=fixture(),dispose=wireAppContextMenus(f.root,{resolveApp:()=>({label:'Widget'}),holdMs:2});
 f.tile.fire('pointerdown',{pointerType:'touch',clientX:20,clientY:20,isPrimary:true});
 await new Promise(resolve=>setTimeout(resolve,15));
 assert.equal(f.overlay().classList.value.has('is-touch'),true);
 // Android may emit a native contextmenu event after the long-press timer: keep the sheet.
 f.tile.fire('contextmenu',{pointerType:undefined,clientX:20,clientY:20});
 assert.equal(f.overlay().classList.value.has('is-touch'),true);
 const click=f.tile.fire('click');assert.equal(click.prevented,true);assert.equal(click.stopped,true);
 dispose();
});

test('finger movement cancels hold so swiping the app grid stays functional',async()=>{
 const f=fixture(),dispose=wireAppContextMenus(f.root,{resolveApp:()=>({label:'Widget'}),holdMs:5});
 f.tile.fire('pointerdown',{pointerType:'touch',clientX:10,clientY:10,isPrimary:true});
 f.tile.fire('pointermove',{pointerType:'touch',clientX:40,clientY:12});
 await new Promise(resolve=>setTimeout(resolve,18));
 assert.equal(f.overlay(),undefined);dispose();
});

test('keyboard menu key, Escape, and removal revalidation work',()=>{
 const f=fixture();let count=0,canRemove=true;
 const dispose=wireAppContextMenus(f.root,{resolveApp:()=>({label:'Widget',isFavorite:true,canRemove}),onRemove:()=>count++});
 let e=f.tile.fire('keydown',{shiftKey:true,key:'F10'});assert.equal(e.prevented,true);
 assert.equal(f.menu().querySelectorAll('button').length,3);
 docEscape();assert.equal(f.overlay(),undefined);
 function docEscape(){f.doc.events.keydown({key:'Escape',preventDefault(){}});}
 f.tile.fire('keydown',{key:'ContextMenu'});canRemove=false;
 f.menu().querySelectorAll('button')[2].fire('click');assert.equal(count,0);
 dispose();
});

test('source keeps no always-visible stars, uses registered local uninstall and no Git/remote app actions',async()=>{
 const main=await tree('../src/main.js'),css=await tree('../src/style.css');
 assert.doesNotMatch(main,/data-app-favorite=/);
 assert.doesNotMatch(css,/\.tavi-app-favorite/);
 assert.match(main,/wireAppContextMenus\(document/);
 assert.match(main,/if\(disposeAppContexts\.dismiss\?\.\(\)\)return/);
 assert.match(main,/store\.uninstall\(item.id\)/);
 assert.match(main,/canRemoveAppFromTavi\(item,store/);
 assert.match(main,/confirm\(`Remove \$\{item.label\}/);
 assert.match(css,/\.tavi-app-context-overlay\.is-touch/);
});
