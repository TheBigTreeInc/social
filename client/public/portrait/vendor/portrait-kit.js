/* Internal drawing engine. Public persistence API: Portraits.encode / Portraits.decode. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ModularPortraits = api;
})(typeof globalThis === 'undefined' ? this : globalThis, function() {
  'use strict';
  const PACK_SCHEMA = 'modular-portraits.pack/v1';
  const HEX = /^#[0-9a-f]{6}$/i;
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const object = x => x && typeof x === 'object' && !Array.isArray(x);
  const clone = x => JSON.parse(JSON.stringify(x));
  const safeAsset = value => typeof value==='string'&&/^[a-zA-Z0-9_./-]+\.(png|webp)$/.test(value)&&!value.startsWith('/')&&!value.split('/').some(p=>['','..','.'].includes(p));
  function validatePack(pack) {
    if (!object(pack) || pack.schema !== PACK_SCHEMA || !/^[a-z0-9-]+$/.test(pack.id)) throw Error('Unsupported art pack.');
    if (!Number.isInteger(pack.revision) || pack.revision < 1) throw Error('Invalid pack revision.');
    if (!Number.isInteger(pack.logicalSize) || pack.logicalSize < 32 || pack.logicalSize > 1024) throw Error('Invalid logical canvas size.');
    if (!Array.isArray(pack.canvas) || pack.canvas.length !== 2 || pack.canvas.some(v=>!Number.isInteger(v)||v<32||v>4096)) throw Error('Invalid source canvas.');
    if (!object(pack.slots) || !object(pack.colors) || !Array.isArray(pack.layers)) throw Error('Incomplete art pack.');
    const files = new Set();
    for (const [key, slot] of Object.entries(pack.slots)) {
      if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(key) || !object(slot) || !Array.isArray(slot.options) || !slot.options.length) throw Error('Invalid component slot.');
      const ids = new Set();
      for (const option of slot.options) {
        if (!object(option) || !/^[a-z0-9-]+$/.test(option.id) || ids.has(option.id)) throw Error('Invalid or duplicate component ID.');
        ids.add(option.id);
        if (option.asset) {
          if (!/^[a-zA-Z0-9_./-]+\.(png|webp)$/.test(option.asset) || option.asset.startsWith('/') || option.asset.split('/').includes('..')) throw Error('Asset must be a relative image path within the pack.');
          files.add(option.asset);
        }
        for (const prop of ['scale','offset']) {
          if (option[prop] && (!Array.isArray(option[prop]) || option[prop].length !== 2 || option[prop].some(v => !Number.isFinite(v)))) throw Error('Invalid component registration.');
        }
        if (option.modularAsset) {
          if (!safeAsset(option.modularAsset)) throw Error('Invalid modular head path.');
          files.add(option.modularAsset);
        }
        if(option.neckAsset){if(!safeAsset(option.neckAsset))throw Error('Invalid neck asset path.');files.add(option.neckAsset);}
        if(option.jawBoundary){if(!Array.isArray(option.jawBoundary)||option.jawBoundary.length<2||option.jawBoundary.some((p,i)=>!Array.isArray(p)||p.length!==2||p.some(n=>!Number.isFinite(n)||n<0||n>1)||(i&&p[0]<=option.jawBoundary[i-1][0])))throw Error('Invalid jaw boundary.');}
        if(option.render){
          if(!object(option.render))throw Error('Invalid component render settings.');
          if(option.render.logicalSize!==undefined&&(!Number.isInteger(option.render.logicalSize)||option.render.logicalSize<32||option.render.logicalSize>1024))throw Error('Invalid component resolution.');
          if(option.render.shadeSteps!==undefined&&(!Number.isInteger(option.render.shadeSteps)||option.render.shadeSteps<0||option.render.shadeSteps>32))throw Error('Invalid component shading.');
        }
        if (option.scale?.some(v => v <= 0 || v > 2)) throw Error('Invalid component scale.');
        if (option.frontFromY !== undefined && (!Number.isFinite(option.frontFromY) || option.frontFromY < 0 || option.frontFromY > 1)) throw Error('Invalid collar overlap.');
      }
      if (!ids.has(slot.default)) throw Error('Missing slot default.');
    }
    for (const [key,color] of Object.entries(pack.colors)) {
      if(!/^[a-zA-Z][a-zA-Z0-9]*$/.test(key))throw Error('Invalid color key.');
      if (!object(color) || !HEX.test(color.default)) throw Error('Invalid color default.');
      if(color.swatches && (!Array.isArray(color.swatches)||!color.swatches.length||color.swatches.some(v=>typeof v!=='string'||!HEX.test(v))))throw Error('Invalid color swatches.');
    }
    for (const layer of pack.layers) {
      if (!object(layer) || !own(pack.slots, layer.slot)) throw Error('Layer refers to an unknown slot.');
      if(layer.anatomy!==undefined&&(!['head','neck'].includes(layer.anatomy)||layer.slot!=='head'))throw Error('Invalid anatomy plane.');
      if(layer.opacity!==undefined&&(!Number.isFinite(layer.opacity)||layer.opacity<0||layer.opacity>1))throw Error('Invalid layer opacity.');
      if (layer.color && !own(pack.colors, layer.color)) throw Error('Layer refers to an unknown color.');
      if (layer.accent && !own(pack.colors, layer.accent)) throw Error('Layer refers to an unknown accent.');
      if (layer.chromaColor && !own(pack.colors, layer.chromaColor)) throw Error('Layer refers to an unknown iris color.');
    }
    return [...files];
  }
  function normalizeIdentity(pack, input = {}, {strict = false} = {}) {
    validatePack(pack);
    if (!object(input)) throw Error('Appearance must be an object.');
    if (own(input,'choices') && !object(input.choices)) throw Error('Component choices must be an object.');
    if (own(input,'colors') && !object(input.colors)) throw Error('Colors must be an object.');
    const result = {choices: {}, colors: {}};
    for (const [key, slot] of Object.entries(pack.slots)) {
      const candidate = input.choices?.[key];
      const valid = slot.options.some(o => o.id === candidate);
      if (strict && candidate !== undefined && !valid) throw Error('Unknown '+key+' option.');
      result.choices[key] = valid ? candidate : slot.default;
    }
    for (const [key, color] of Object.entries(pack.colors)) {
      const candidate = input.colors?.[key];
      if (strict && candidate !== undefined && (typeof candidate !== 'string' || !HEX.test(candidate))) throw Error('Invalid '+key+' color.');
      result.colors[key] = typeof candidate === 'string' && HEX.test(candidate) ? candidate.toLowerCase() : color.default;
    }
    return result;
  }
  const rgb = hex => [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)/255);
  const mix = (a,b,t) => a*(1-t)+b*t;
  const smooth = (lo,hi,v) => { const t=Math.max(0,Math.min(1,(v-lo)/(hi-lo))); return t*t*(3-2*t); };
  function recolor(data, primary, accent, {steps=8,preserveChroma=false,whiteThreshold=.94} = {}) {
    const p=rgb(primary), a=rgb(accent);
    for (let i=0;i<data.length;i+=4) {
      if (!data[i+3]) continue;
      const source=[data[i]/255,data[i+1]/255,data[i+2]/255];
      const lum=source[0]*.2126+source[1]*.7152+source[2]*.0722;
      const chroma=Math.max(...source)-Math.min(...source);
      if (preserveChroma && (chroma>.14 || lum>whiteThreshold)) continue;
      const shade=steps > 1 ? Math.floor(Math.min(lum,.999)*steps)/(steps-1) : lum;
      for (let c=0;c<3;c++) {
        const tone=mix(p[c],a[c],smooth(.55,.9,lum));
        const shadow=tone*[.16,.19,.24][c], highlight=mix(tone,1,.22);
        data[i+c]=Math.round(255*mix([.012,.016,.025][c],mix(shadow,highlight,shade),smooth(.04,.16,lum)));
      }
    }
    return data;
  }
  class Renderer {
    constructor(pack, baseURL, {document: doc=globalThis.document, cacheLimit=64} = {}) {
      validatePack(pack);
      if (!doc?.createElement) throw Error('A browser document is required for canvas rendering.');
      this.pack=clone(pack);this.baseURL=baseURL;this.document=doc;this.cacheLimit=Math.max(1,Math.min(128,cacheLimit));
      this.images=new Map();this.tints=new Map();this.ready=false;
    }
    canvas(size) {const canvas=this.document.createElement('canvas');canvas.width=size;canvas.height=size;return canvas;}
    tint(file,primary,accent,layer,chromaColor=null) {
      const key=JSON.stringify([file,primary,accent,layer.preserveChroma,layer.whiteThreshold,layer.logicalSize,layer.shadeSteps,layer.pixelated,chromaColor]);
      if(this.tints.has(key)) {const value=this.tints.get(key);this.tints.delete(key);this.tints.set(key,value);return value;}
      const canvas=this.canvas(layer.logicalSize??this.pack.logicalSize), ctx=canvas.getContext('2d',{willReadFrequently:true});
      ctx.imageSmoothingEnabled=!(layer.pixelated??this.pack.pixelated);
      ctx.drawImage(this.images.get(file),0,0,canvas.width,canvas.height);
      if(primary) {
        const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
        const chromaMask=chromaColor?new Uint8Array(pixels.data.length/4):null;
        if(chromaMask)for(let i=0;i<pixels.data.length;i+=4)chromaMask[i/4]=pixels.data[i+2]>pixels.data[i]*1.05&&(Math.max(...pixels.data.slice(i,i+3))-Math.min(...pixels.data.slice(i,i+3)))>6?1:0;
        recolor(pixels.data,primary,accent||primary,{steps:layer.shadeSteps??this.pack.shadeSteps??8,preserveChroma:!!layer.preserveChroma,whiteThreshold:layer.whiteThreshold??.94});
        if(chromaMask){const tone=rgb(chromaColor);for(let i=0;i<pixels.data.length;i+=4)if(chromaMask[i/4]){const light=Math.max(...pixels.data.slice(i,i+3))/255;for(let c=0;c<3;c++)pixels.data[i+c]=Math.round(255*tone[c]*light);}}
        ctx.putImageData(pixels,0,0);
      }
      this.tints.set(key,canvas);
      if(this.tints.size>this.cacheLimit)this.tints.delete(this.tints.keys().next().value);
      return canvas;
    }
    render(input, {size=256,canvas=null,background=this.pack.background??null,base=false} = {}) {
      if(!this.ready)throw Error('Preload the art pack before rendering.');
      if(!Number.isInteger(size)||size<16||size>2048)throw Error('Portrait size must be 16–2048 pixels.');
      const identity=normalizeIdentity(this.pack,input,{strict:true}), work=this.canvas(this.pack.logicalSize),ctx=work.getContext('2d');
      const n=work.width;ctx.imageSmoothingEnabled=!this.pack.pixelated;
      if(background) {if(!HEX.test(background))throw Error('Background must be a six-digit hex color or null.');ctx.fillStyle=background;ctx.fillRect(0,0,n,n);}
      const face=this.pack.slots.head.options.find(o=>o.id===identity.choices.head);
      const featuresActive=['eyes','nose','mouth'].some(slot=>this.pack.slots[slot]?.options.find(o=>o.id===identity.choices[slot])?.asset);
      for(const layer of this.pack.layers) {
        if(base&&layer.accessory)continue;
        if(layer.feature&&!featuresActive)continue;
        let option=this.pack.slots[layer.slot].options.find(o=>o.id===identity.choices[layer.slot]);
        if(layer.feature&&!option.asset)option=this.pack.slots[layer.slot].options.find(o=>o.id===(face.featureDefaults?.[layer.slot]??this.pack.featureDefaults?.[layer.slot]));
        if(layer.slot==='head'&&featuresActive&&face.modularAsset)option={...option,asset:face.modularAsset};
        if(layer.anatomy==='neck'&&face.neckAsset)option={...option,asset:face.neckAsset};
        if(!option)throw Error('Missing facial foundation default.');
        if(!option.asset)continue;
        const drawLayer={...layer,...option.render};
        const texture=this.tint(option.asset,layer.color?identity.colors[layer.color]:null,layer.accent?identity.colors[layer.accent]:null,drawLayer,layer.chromaColor?identity.colors[layer.chromaColor]:null);
        const scale=option.scale||[1,1],offset=option.offset||[0,0];
        ctx.save();ctx.globalAlpha=drawLayer.opacity??1;
        if(layer.anatomy){const jaw=face.jawBoundary||[[.26,.68],[.29,.74],[.37,.80],[.45,.835],[.55,.835],[.63,.80],[.71,.74],[.74,.68]],points=jaw.map(([x,y])=>[(offset[0]+x*scale[0])*n,(offset[1]+y*scale[1])*n]);ctx.beginPath();if(layer.anatomy==='head'){ctx.moveTo(0,0);ctx.lineTo(n,0);ctx.lineTo(n,points[points.length-1][1]);for(const [x,y] of [...points].reverse())ctx.lineTo(x,y);ctx.lineTo(0,points[0][1]);}else{ctx.moveTo(0,points[0][1]);for(const [x,y] of points)ctx.lineTo(x,y);ctx.lineTo(n,points[points.length-1][1]);ctx.lineTo(n,n);ctx.lineTo(0,n);}ctx.closePath();ctx.clip();}
        ctx.imageSmoothingEnabled=!(drawLayer.pixelated??this.pack.pixelated);
        ctx.drawImage(texture,offset[0]*n,offset[1]*n,scale[0]*n,scale[1]*n);
        ctx.restore();
      }
      const target=canvas||this.canvas(size);target.width=size;target.height=size;
      const targetCtx=target.getContext('2d');targetCtx.clearRect(0,0,size,size);targetCtx.imageSmoothingEnabled=!this.pack.pixelated;
      targetCtx.drawImage(work,0,0,size,size);return target;
    }
    toDataURL(identity,options={}) {return this.render(identity,options).toDataURL('image/png');}
    async toBlob(identity,options={}) {return new Promise((resolve,reject)=>this.render(identity,options).toBlob(blob=>blob?resolve(blob):reject(Error('PNG export failed.')),'image/png'));}
    dispose() {this.images.clear();this.tints.clear();this.ready=false;}
  }
  return {validatePack,normalizeIdentity,recolor,Renderer};
});
