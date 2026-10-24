import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createExtensionHost,TAVIX_STANDARD,TAVIX_CHANNEL} from '../src/extensions/host.js';
import {createTaviXSDK,createTaviExtensionSDK,assertTaviXHostInfo,TAVIX_HOST_API} from '../extension-sdk/index.js';
import {validateTaviXDirectory} from '../../tools/tavix-validate.mjs';

function bridge(){
 const hostListeners=new Map(),childListeners=new Map(),closed=[];
 const source={addEventListener:(name,fn)=>childListeners.set(name,fn),removeEventListener:name=>childListeners.delete(name)};
 const frame={contentWindow:{postMessage:data=>childListeners.get('message')?.({source:parent,origin:'https://tavi.example',data})}};
 const parent={postMessage:data=>hostListeners.get('message')?.({source:frame.contentWindow,origin:'null',data})};
 const host=createExtensionHost({windowRef:{addEventListener:(name,fn)=>hostListeners.set(name,fn),removeEventListener:name=>hostListeners.delete(name)},storage:{getItem:()=>null,setItem:()=>{}},notify:()=>{},close:()=>closed.push(true)});
 host.mount(frame,{id:'org.tavi.examples.test',permissions:['ui.panel','storage.private'],scope:'test:account'});
 return {host,parent,source,closed};
}

test('TaviX 1.0 formalizes existing wire channel and host info without breaking v1 apps',async()=>{
 assert.equal(TAVIX_STANDARD,'tavix/1.0');assert.equal(TAVIX_CHANNEL,'tavi.extension/v1');assert.equal(TAVIX_HOST_API,'1.0.0');
 const {host,parent,source}=bridge();const sdk=createTaviXSDK(parent,source);
 const info=await sdk.conformance();assert.equal(info.standard,'tavix/1.0');assert.equal(info.channel,'tavi.extension/v1');assert.equal(info.navigation,'host');assert(info.features.includes('tavix.navigation/v1'));
 assert.equal(assertTaviXHostInfo(info),info);sdk.dispose();host.dispose();
});

test('TaviX host-owned navigation works while legacy ui.close remains compatible',async()=>{
 for(const mode of ['back','close','legacy']){
  const {host,parent,source,closed}=bridge();const sdk=(mode==='legacy'?createTaviExtensionSDK:createTaviXSDK)(parent,source);
  if(mode==='back')await sdk.navigation.back();else if(mode==='close')await sdk.navigation.close();else await sdk.ui.close();
  assert.equal(closed.length,1);sdk.dispose();host.dispose();
 }
});

test('generic surface module is standardized but fails closed until host advertises it',async()=>{
 const {host,parent,source}=bridge();const sdk=createTaviXSDK(parent,source);const info=await sdk.info();
 assert(!info.features.includes('tavix.surface/v1'));
 await assert.rejects(sdk.surfaces.requestOpen({schema:'tavix.surface/v1',id:'life.loop',kind:'game',target:'https://example.test/life/',presentation:'auto'}),/Unsupported extension method/);
 sdk.dispose();host.dispose();
});

test('TaviX validator accepts existing v1 package layout and rejects missing assets',async()=>{
 const tmp=await mkdtemp(join(tmpdir(),'tavix-'));
 try{
  await mkdir(join(tmp,'ui'));
  const manifest={schema:'tavi.extension/v1',id:'org.example.demo',version:'1.0.0',name:'Demo',summary:'TaviX demo',publisher:'example',kind:'app',hostApi:{min:'1.0.0',maxExclusive:'2.0.0'},entrypoints:{panel:'ui/index.html'},contributions:[{slot:'app.launcher',id:'demo',label:'Demo',action:'openPanel'}],permissions:['ui.panel'],platforms:['web','windows','android']};
  await writeFile(join(tmp,'manifest.json'),JSON.stringify(manifest));await writeFile(join(tmp,'ui/index.html'),'<html></html>');
  const result=await validateTaviXDirectory(tmp);assert.equal(result.standard,'tavix/1.0');assert.equal(result.manifest,'org.example.demo');
  await rm(join(tmp,'ui/index.html'));await assert.rejects(validateTaviXDirectory(tmp));
 }finally{await rm(tmp,{recursive:true,force:true});}
});

test('TaviX standard documents compatibility and non-standard Atrium bridge boundary',async()=>{
 const spec=await readFile(new URL('../../docs/TAVIX_1_0_SPEC.adoc',import.meta.url),'utf8');
 const pkg=JSON.parse(await readFile(new URL('../extension-sdk/package.json',import.meta.url),'utf8'));assert.equal(pkg.name,'@tavi/tavix-sdk');assert.equal(pkg.version,'1.0.0');
 assert.match(spec,/existing first-party `atrium\.tavi-launch\/v1`/i);assert.match(spec,/tavix\.surface\/v1/);assert.match(spec,/does NOT advertise `tavix\.surface\/v1`/);
});
