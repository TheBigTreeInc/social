(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;root.Portraits=api;})(globalThis,function(root){
 'use strict';
 const clone=x=>JSON.parse(JSON.stringify(x));
 const uint=(v,max)=>Number.isInteger(v)&&v>=0&&v<=max;
 const rgb=value=>{if(!/^#[\da-f]{6}$/i.test(value))throw Error('Expected #RRGGBB.');return parseInt(value.slice(1),16);};
 const hex=value=>{if(!uint(value,0xffffff))throw Error('Invalid RGB colour.');return '#'+value.toString(16).padStart(6,'0');};
 function compile(index,items){
  if(index.schema!=='portraits.registry/v1'||index.id!=='portraits')throw Error('Unsupported registry.');
  for(const fields of [index.categories,index.colors]){
   if(!Array.isArray(fields)||fields.length>255)throw Error('Invalid registry fields.');
   const ids=new Set(),keys=new Set();for(const field of fields){if(!uint(field.id,65535)||!field.id||ids.has(field.id)||!/^[a-zA-Z][a-zA-Z0-9]*$/.test(field.key)||keys.has(field.key))throw Error('Duplicate or invalid field.');ids.add(field.id);keys.add(field.key);}
  }
  const registry={index:clone(index),items:{},pack:{schema:'modular-portraits.pack/v1',id:'portraits',revision:1,canvas:index.canvas,rig:index.rig,logicalSize:index.logicalSize,shadeSteps:index.shadeSteps,pixelated:index.pixelated,background:index.background,layers:clone(index.layers),slots:{},colors:{}}};
  for(const category of index.categories){
   const map=registry.items[category.key]={},options=[];
   if(category.nullable)options.push({id:'0',label:category.noneLabel||'None',tags:[]});
   for(const path of category.items){
    if(!new RegExp('^items/'+category.key+'/[0-9]{8,10}\\.json$').test(path))throw Error('Invalid item path.');
    const item=items[path];if(!item||item.category!==category.key||!uint(item.id,0xffffffff)||!item.id||map[item.id])throw Error('Invalid or duplicate item.');
    if(path!=='items/'+category.key+'/'+String(item.id).padStart(8,'0')+'.json')throw Error('Item filename differs from ID.');
    const render=clone(item.render);if(!/^art\/[a-f0-9]{64}\.png$/.test(render.image))throw Error('Invalid artwork path.');
    const profile=index.renderProfiles[render.profile];if(!profile)throw Error('Unknown render profile.');
    const {image,profile:profileName,...registration}=render;
    map[item.id]=clone(item);options.push({id:String(item.id),label:item.name,type:item.type,tags:item.tags||[],...registration,asset:image,render:clone(profile)});
   }
   if(!options.some(o=>o.id===String(category.default)))throw Error('Unknown category default.');
   registry.pack.slots[category.key]={label:category.label,default:String(category.default),options};
  }
  for(const color of index.colors){rgb(color.default);registry.pack.colors[color.key]=clone(color);}
  return registry;
 }
 function validate(registry,input){
  if(!input||typeof input!=='object'||Array.isArray(input)||!input.parts||!input.colors)throw Error('Expected parts and colours.');
  const output={parts:{},colors:{}},index=registry.index;
  for(const key of Object.keys(input.parts))if(!index.categories.some(c=>c.key===key))throw Error('Unknown category: '+key);
  for(const key of Object.keys(input.colors))if(!index.colors.some(c=>c.key===key))throw Error('Unknown colour: '+key);
  for(const c of index.categories){const id=input.parts[c.key]??(c.nullable?0:undefined);if(!uint(id,0xffffffff)||(!id&&!c.nullable)||(id&&!registry.items[c.key][id]))throw Error('Unknown '+c.key+' ID: '+id);output.parts[c.key]=id;}
  for(const c of index.colors){const color=input.colors[c.key]??(!c.required?rgb(c.default):undefined);if(!uint(color,0xffffff))throw Error('Missing or invalid '+c.key+' colour.');output.colors[c.key]=color;}
  return output;
 }
 function encode(registry,input){
  const value=validate(registry,input),bytes=[1],write=(v,n)=>{for(let i=n-1;i>=0;i--)bytes.push(Math.floor(v/256**i)%256);};
  const parts=registry.index.categories.filter(c=>value.parts[c.key]).sort((a,b)=>a.id-b.id);bytes.push(parts.length);
  for(const c of parts){write(c.id,2);write(value.parts[c.key],4);}
  const colors=[...registry.index.colors].filter(c=>c.required||value.colors[c.key]!==rgb(c.default)).sort((a,b)=>a.id-b.id);bytes.push(colors.length);
  for(const c of colors){write(c.id,2);write(value.colors[c.key],3);}
  return BigInt('0x'+bytes.map(b=>b.toString(16).padStart(2,'0')).join('')).toString(10);
 }
 function decode(registry,code){
  if(typeof code==='bigint')code=code.toString();
  if(typeof code!=='string'||!/^[1-9][0-9]{0,6999}$/.test(code))throw Error('Portrait code must be decimal text or BigInt, never Number.');
  let text=BigInt(code).toString(16);if(text.length%2)text='0'+text;
  const bytes=text.match(/../g).map(b=>parseInt(b,16));let position=0;
  const read=n=>{if(position+n>bytes.length)throw Error('Truncated portrait code.');let v=0;while(n--)v=v*256+bytes[position++];return v;};
  if(read(1)!==1)throw Error('Unsupported portrait encoding.');
  const value={parts:{},colors:{}};
  for(const [fields,key,size] of [[registry.index.categories,'parts',4],[registry.index.colors,'colors',3]]){
   const count=read(1);let last=0;
   for(let i=0;i<count;i++){const id=read(2),v=read(size),field=fields.find(c=>c.id===id);if(!field||id<=last||(key==='parts'&&!v))throw Error('Unknown, duplicate or unordered portrait field.');last=id;value[key][field.key]=v;}
  }
  if(position!==bytes.length)throw Error('Trailing portrait data.');
  const result=validate(registry,value);if(encode(registry,result)!==code)throw Error('Non-canonical portrait code.');return result;
 }
 async function cached(url,{fetch:fetcher=root.fetch,cacheStorage=root.caches}={},hash=null){
  const cache=cacheStorage?await cacheStorage.open('portraits-content-v1'):null;
  const verify=async response=>{if(!response?.ok)throw Error('Could not load '+url);if(hash){const digest=await root.crypto.subtle.digest('SHA-256',await response.clone().arrayBuffer());if([...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('')!==hash)throw Error('Artwork checksum mismatch.');}return response;};
  const old=await cache?.match(url);if(hash&&old){try{return await verify(old);}catch{await cache.delete(url);}}
  try{const response=await verify(await fetcher(url,{cache:'no-cache'}));await cache?.put(url,response.clone());return response;}catch(error){if(!hash&&old)return verify(old);throw error;}
 }
 async function loadRegistry(indexURL,options={}){
  const url=new URL(indexURL,root.location?.href),index=await (await cached(url.href,options)).json(),items={};
  if(index.schema!=='portraits.registry/v1')throw Error('Unsupported registry.');
  await Promise.all(index.categories.flatMap(c=>c.items.map(async path=>{if(!/^items\/[A-Za-z][A-Za-z0-9]*\/[0-9]{8,10}\.json$/.test(path))throw Error('Invalid item path.');items[path]=await (await cached(new URL(path,url).href,options)).json();})));
  const registry=compile(index,items);registry.baseURL=new URL('../',url).href;return registry;
 }
 class System{
  constructor(renderer,registry,{backgroundProvider=null}={}){this.renderer=renderer;this.registry=registry;this.pack=registry.pack;this.backgroundProvider=backgroundProvider;}
  static async load(indexURL,options={}){
   let registry;try{registry=await loadRegistry(indexURL,options);}catch(error){if(!options.fallbackURL)throw error;registry=await loadRegistry(options.fallbackURL,options);}
   root.ModularPortraits.validatePack(registry.pack);
   const renderer=new root.ModularPortraits.Renderer(registry.pack,registry.baseURL,options),system=new System(renderer,registry,options);system.loadOptions=options;
   await system.preload(options.preload==='selected'?(options.code||system.defaultAppearance()):null);return system;
  }
  defaultAppearance(){return {parts:Object.fromEntries(this.registry.index.categories.map(c=>[c.key,c.default])),colors:Object.fromEntries(this.registry.index.colors.map(c=>[c.key,rgb(c.default)]))};}
  normalize(input){return typeof input==='string'||typeof input==='bigint'?decode(this.registry,input):validate(this.registry,input);}
  choices(key,{tags=[],type=null}={}){const c=this.registry.index.categories.find(c=>c.key===key);if(!c)throw Error('Unknown category.');const items=Object.values(this.registry.items[key]).filter(i=>!i.retired&&(!type||i.type===type)&&tags.every(t=>i.tags?.includes(t))).sort((a,b)=>(a.order??a.id)-(b.order??b.id)||a.id-b.id).map(i=>({id:i.id,label:i.name,type:i.type,tags:i.tags||[],hasAsset:true}));return c.nullable&&!type&&!tags.length?[{id:0,label:c.noneLabel||'None',tags:[],hasAsset:false},...items]:items;}
  item(key,id){return clone(this.registry.items[key]?.[id]??null);}
  randomAppearance(){const value=this.defaultAppearance();for(const c of this.registry.index.categories){const options=this.choices(c.key);value.parts[c.key]=options[Math.floor(Math.random()*options.length)].id;}return value;}
  async preload(input=null){
   const value=input===null?null:this.normalize(input),files=new Set();
   for(const c of this.registry.index.categories)for(const item of Object.values(this.registry.items[c.key]))if(value===null||value.parts[c.key]===item.id){files.add(item.render.image);if(item.render.neckAsset)files.add(item.render.neckAsset);}
   await Promise.all([...files].map(async file=>{if(this.renderer.images.has(file))return;const hash=/^art\/([a-f0-9]{64})\.png$/.exec(file)?.[1];if(!hash)throw Error('Invalid image path.');const response=await cached(new URL(file,this.registry.baseURL).href,this.loadOptions,hash),url=URL.createObjectURL(await response.blob());try{const image=this.renderer.document.createElement('img');image.src=url;await image.decode();if(image.naturalWidth!==this.pack.canvas[0]||image.naturalHeight!==this.pack.canvas[1])throw Error('Incorrect artwork dimensions.');this.renderer.images.set(file,image);}finally{URL.revokeObjectURL(url);}}));this.renderer.ready=true;return this;
  }
  render(input,{context={},background, ...options}={}){const value=this.normalize(input);const selected={choices:Object.fromEntries(Object.entries(value.parts).map(([k,v])=>[k,String(v)])),colors:Object.fromEntries(Object.entries(value.colors).map(([k,v])=>[k,hex(v)]))};for(const [key,id]of Object.entries(value.parts)){const r=this.registry.items[key][id]?.render;if(r&&!this.renderer.images.has(r.image))throw Error('Preload the selected artwork before rendering.');}if(background===undefined)background=this.backgroundProvider?this.backgroundProvider(context,value):this.pack.background;return this.renderer.render(selected,{...options,background});}
  toDataURL(input,options={}){return this.render(input,options).toDataURL('image/png');}
 }
 return {rgb,hex,compile,validate,encode,decode,serialize:encode,deserialize:decode,loadRegistry,System};
});
