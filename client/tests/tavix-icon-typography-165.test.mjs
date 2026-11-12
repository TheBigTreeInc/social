import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TAVIX_ICON_SET,TAVIX_ICON_NAMES,TAVIX_ICON_SIZES,hasTaviIcon,createTaviIcon} from '../extension-sdk/icons.js';
import {LUCIDE_ICONS} from '../src/ui/lucide-icons.js';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const json=p=>JSON.parse(read(p));

function fakeDocument(){
 return {createElementNS:(namespace,tag)=>{
  assert.equal(namespace,'http://www.w3.org/2000/svg');assert.equal(tag,'svg');
  const attrs={};return {attrs,setAttribute(k,v){attrs[k]=v;},innerHTML:''};
 }};
}

test('public TaviX kit matches the exact reviewed host geometry and contract',()=>{
 const contract=json('../../docs/contracts/tavix-ui-kit-v1.json');
 assert.equal(contract.schema,'tavix.ui-kit/v1');assert.equal(TAVIX_ICON_SET,contract.icons.schema);
 assert.equal(TAVIX_ICON_NAMES.length,50);assert.deepEqual(TAVIX_ICON_NAMES,contract.icons.names);
 assert.deepEqual(TAVIX_ICON_SIZES,contract.icons.sizePx);
 for(const name of TAVIX_ICON_NAMES){assert.equal(hasTaviIcon(name),true);assert.ok(LUCIDE_ICONS[name]);}
 assert.equal(read('../extension-sdk/icon-shapes.js'),read('../src/ui/lucide-icons.js'));
 assert.match(read('../extension-sdk/LUCIDE_LICENSE.txt'),/Lucide Icons and Contributors/);
});

test('DOM renderer rejects untrusted icon data, never uses remote assets, and applies accessibility',()=>{
 const doc=fakeDocument();const icon=createTaviIcon('folder',{size:'lg',documentRef:doc});
 assert.equal(icon.attrs['aria-hidden'],'true');assert.equal(icon.attrs.class,'tavix-icon tavix-icon--lg');
 assert.match(icon.innerHTML,/path/);
 const meaningful=createTaviIcon('search',{decorative:false,label:'Search files',documentRef:doc});
 assert.equal(meaningful.attrs['aria-label'],'Search files');assert.equal(meaningful.attrs.role,'img');
 for(const bad of ['evil" onload="x','__proto__','<svg/>',null])assert.throws(()=>createTaviIcon(bad,{documentRef:doc}),RangeError);
 assert.throws(()=>createTaviIcon('search',{size:'gigantic',documentRef:doc}),RangeError);
 assert.throws(()=>createTaviIcon('search',{decorative:false,documentRef:doc}),TypeError);
 for(const name of TAVIX_ICON_NAMES)assert.doesNotMatch(LUCIDE_ICONS[name],/<script|<foreignObject|onload\s*=|href\s*=|url\(/i);
 assert.doesNotMatch(read('../extension-sdk/icons.js'),/fetch\(|https?:\/\/.+\.svg/);
});

test('CSS has native font stack, bounded icon sizes and accessible touch controls',()=>{
 const css=read('../extension-sdk/ui.css');
 for(const token of ['--tavix-font-family','--tavix-font-body','--tavix-font-mono','--tavix-font-title','--tavix-icon-size'])assert.ok(css.includes(token),token);
 assert.match(css,/Segoe UI/);assert.match(css,/Roboto/);assert.match(css,/44px/);
 assert.match(css,/\.tavix-icon--sm/);assert.match(css,/\.tavix-app-icon/);
 assert.doesNotMatch(css,/@font-face|url\(https?:|font-family\s*:\s*icon/i);
 assert.doesNotMatch(css,/\.tavi-single-workspace|\.tavi-shell-bar/);
 assert.equal(json('../extension-sdk/package.json').exports['./icons'].default,'./icons.js');
});
