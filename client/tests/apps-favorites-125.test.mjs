import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DEFAULT_APP_FAVORITES,appFavoriteId,readAppFavorites,toggleAppFavorite,favoriteApplications,favoritesStorageKey} from '../src/ui/app-favorites.js';
import {menuApplications} from '../src/launcher.js';
import {hostToolbar,mobileTabs} from '../src/ui/shell.js';
import {wireAppPages} from '../src/ui/touch-navigation.js';
const read=path=>readFile(new URL(path,import.meta.url),'utf8');
const storage=()=>{
 const map=new Map();return {getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value),dump:()=>map};
};

test('Favorites defaults to useful local apps and All remains complete',()=>{
 const db=storage(),apps=menuApplications({});
 const favorites=readAppFavorites(db,'account-1');
 assert.deepEqual(favorites,DEFAULT_APP_FAVORITES);
 assert.deepEqual(favoriteApplications(apps,favorites).map(x=>x.label),['Notifications','Wallet','Tavi Store']);
 assert.equal(apps.length,9);
 assert.equal(favoritesStorageKey('account-1').includes('account-1'),true);
});

test('favorite/unfavorite persists per account without installing or modifying an app',()=>{
 const db=storage(),scope='serverA:userA',other='serverA:userB';
 const first=readAppFavorites(db,scope);
 assert.deepEqual(toggleAppFavorite(db,scope,'builtin:portrait'),[...first,'builtin:portrait']);
 assert(readAppFavorites(db,scope).includes('builtin:portrait'));
 assert(!readAppFavorites(db,other).includes('builtin:portrait'));
 assert(!toggleAppFavorite(db,scope,'builtin:portrait').includes('builtin:portrait'));
 assert.equal(menuApplications({}).length,9);
 assert.equal(appFavoriteId({kind:'extension',id:'inc.thebigtree.tavi.atrium'}),'extension:inc.thebigtree.tavi.atrium');
 const app={kind:'extension',id:'inc.thebigtree.tavi.atrium',label:'Atrium'};
 toggleAppFavorite(db,scope,appFavoriteId(app));
 assert.deepEqual(favoriteApplications([app],readAppFavorites(db,scope)),[app]);
 assert.deepEqual(favoriteApplications([],readAppFavorites(db,scope)),[],'removed/disabled extensions stay hidden but their preference can survive');
});

test('empty favorites and corrupt/crafted local data remain safe',()=>{
 const db=storage();
 for(const id of ['__proto__','extension:<script>','builtin:contacts onmouseover=evil','extension:../../evil'])assert.throws(()=>toggleAppFavorite(db,'acct',id));
 assert.throws(()=>favoritesStorageKey(''));
 for(const id of [...DEFAULT_APP_FAVORITES])toggleAppFavorite(db,'acct',id);
 assert.deepEqual(readAppFavorites(db,'acct'),[]);
 db.setItem(favoritesStorageKey('acct'),JSON.stringify({schema:'tavi.apps.favorites/v1',ids:['builtin:contacts','builtin:contacts','extension:<x>','extension:inc.thebigtree.tavi.atrium']}));
 assert.deepEqual(readAppFavorites(db,'acct'),['builtin:contacts','extension:inc.thebigtree.tavi.atrium']);
 db.setItem(favoritesStorageKey('acct'),'{oops');assert.deepEqual(readAppFavorites(db,'acct'),DEFAULT_APP_FAVORITES);
});

test('Apps uses two accessible tabs with uncluttered context-ready app tiles',async()=>{
 const main=await read('../src/main.js'),css=await read('../src/style.css');
 const markup=main.split('function mainMenu(){')[1].split('\nfunction homeScreen(){')[0];
 for(const part of ["label:'Favorites'","label:'All'",'role="tablist"','role="tabpanel"','aria-selected=','readAppFavorites(localStorage,extensionStoreScope)','role="tablist"'])assert(markup.includes(part),part);
 assert.match(main,/data-app-context=/);
 assert.doesNotMatch(main,/data-app-favorite=/);
 assert(!markup.includes("label:'Talk'"));
 assert(!markup.includes('Your apps</h2>'));
 assert.match(main,/appStoreReturnPanel==='menu'/);
 assert.match(main,/toggleAppFavorite\(localStorage,extensionStoreScope,item.identity\)/);
 assert.doesNotMatch(css,/\.tavi-app-favorite/);
 assert.match(css,/\.tavi-app-context-menu/);
 assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 const toolbar=hostToolbar('Apps',{action:'back',backLabel:'Home'});
 assert.match(toolbar,/data-action="back"/);
 assert.doesNotMatch(toolbar,/data-action="home"/);
 assert.match(mobileTabs('menu'),/data-action="home"/);
});

test('two tabs support swipe index, click, keyboard and re-render selection',()=>{
 class Control{
  constructor(){this.events={};this.attributes={};this.tabIndex=0;this.focused=false;}
  addEventListener(name,callback){this.events[name]=callback;}
  setAttribute(key,value){this.attributes[key]=value;}
  fire(name,event={}){this.events[name]?.(event);}
  focus(){this.focused=true;}
 }
 const a=new Control(),b=new Control(),pages=new Control();
 pages.clientWidth=320;pages.scrollLeft=0;
 pages.scrollTo=({left})=>{pages.scrollLeft=left;pages.fire('scroll');};
 const root={querySelector:()=>pages,querySelectorAll:()=>[a,b]};
 const original=globalThis.matchMedia;
 globalThis.matchMedia=()=>({matches:true});
 try{
  let current=-1;
  wireAppPages(root,{initialIndex:1,onChange:i=>{current=i;}});
  assert.equal(current,1);assert.equal(pages.scrollLeft,320);
  assert.equal(b.attributes['aria-selected'],'true');
  a.fire('click');assert.equal(current,0);assert.equal(pages.scrollLeft,0);
  a.fire('keydown',{key:'ArrowRight',preventDefault(){}});
  assert.equal(current,1);assert(b.focused);
  pages.scrollLeft=10;pages.fire('scroll');assert.equal(current,0);
 }finally{globalThis.matchMedia=original;}
});

test('App Store icon-only controls have hidden assistive copy without overflow',async()=>{
 const main=await read('../src/main.js'),storefront=await read('../src/ui/storefront.js'),css=await read('../src/style.css');
 assert.match(storefront,/data-action="settings-sources"/);
 assert.doesNotMatch(main,/data-marketplace-manage/);
 assert.match(storefront,/data-store-pull-status/);
 assert.match(storefront,/data-action="store-refresh"/);
 assert.match(storefront,/aria-label="Open my library and private apps"/);
 assert.match(css,/\.sr-only\{position:absolute!important/);
});
