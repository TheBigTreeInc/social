/* Tavi local-package sandbox renderer. This document is loaded inside an
 * opaque-origin iframe with sandbox="allow-scripts" (no same-origin grant).
 * It does not fetch external resources or obtain parent storage/credentials.
 */
(()=>{
 'use strict';
 const POLICY="default-src 'none'; script-src blob:; style-src 'unsafe-inline' blob:; img-src blob: data:; font-src blob: data:; connect-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'";
 const allowed=/^[A-Za-z0-9_.\-/]+$/;
 let installed=false;
 const created=[];
 const mime=path=>path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':path.endsWith('.svg')?'image/svg+xml':path.endsWith('.png')?'image/png':path.endsWith('.webp')?'image/webp':path.endsWith('.json')?'application/json':'text/html';
 const decode=bytes=>new TextDecoder('utf-8',{fatal:true}).decode(bytes);
 const fail=reason=>{document.body.replaceChildren(document.createTextNode(`Cannot open local TaviX package: ${reason}`));};
 function render(record){
  if(!record||record.schema!=='tavi.local-package/v1'||!record.manifest||!record.assets)throw Error('Invalid package handoff');
  const assets=record.assets,entry=record.manifest.entrypoints.panel;
  if(!Object.prototype.hasOwnProperty.call(assets,entry))throw Error('Entrypoint missing');
  // Resolve package-relative paths without permitting escape from package root.
  function resolve(path,from){
   if(typeof path!=='string'||/^(?:[a-z][a-z\d+.-]*:|\/\/|\/|#)/i.test(path))return null;
   const bare=path.split(/[?#]/,1)[0];if(!bare||bare.includes('\\'))return null;
   const parts=from.split('/').slice(0,-1);
   for(const part of bare.split('/')){if(part==='.'||!part)continue;if(part==='..'){if(!parts.length)return null;parts.pop();}else parts.push(part);}
   const key=parts.join('/');return allowed.test(key)&&Object.prototype.hasOwnProperty.call(assets,key)?key:null;
  }
  const blobs=new Map(),making=new Set();
  function blobUrl(path){
   if(blobs.has(path))return blobs.get(path);
   if(making.has(path))throw Error('Cyclic script imports are not supported in local preview');
   making.add(path);
   let body=assets[path];if(!(body instanceof Uint8Array))throw Error('Invalid asset bytes');
   if(path.endsWith('.js')){
    // Resolve relative ESM imports. Non-relative imports remain blocked by CSP.
    let code=decode(body);
    code=code.replace(/(\b(?:from\s*|import\s*\(|import\s*))(['"])(\.{1,2}\/[^'"\r\n]+)\2/g,(all,prefix,quote,target)=>{
     const resolved=resolve(target,path);if(!resolved||!resolved.endsWith('.js'))throw Error('Missing local JavaScript dependency');
     return `${prefix}${quote}${blobUrl(resolved)}${quote}`;
    });
    body=code;
   }else if(path.endsWith('.css')){
    let code=decode(body);
    code=code.replace(/url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/gi,(all,q,target)=>{
      const resolved=resolve(target,path);return resolved?`url("${blobUrl(resolved)}")`:all;
    });
    code=code.replace(/@import\s+(['"])([^'"\r\n]+)\1/gi,(all,q,target)=>{
      const resolved=resolve(target,path);return resolved?`@import "${blobUrl(resolved)}"`:all;
    });body=code;
   }
   const url=URL.createObjectURL(new Blob([body],{type:mime(path)}));created.push(url);blobs.set(path,url);making.delete(path);return url;
  }
  const doc=new DOMParser().parseFromString(decode(assets[entry]),'text/html');
  for(const el of [...doc.querySelectorAll('base,meta[http-equiv],iframe,object,embed')])el.remove();
  for(const el of [...doc.querySelectorAll('script')]){
    const src=el.getAttribute('src');
    if(src){const path=resolve(src,entry);if(!path||!path.endsWith('.js')){el.remove();continue;}el.setAttribute('src',blobUrl(path));}
    else if(el.textContent?.trim()){
     const url=URL.createObjectURL(new Blob([el.textContent],{type:'text/javascript'}));created.push(url);el.textContent='';el.setAttribute('src',url);
    }
  }
  for(const el of [...doc.querySelectorAll('link[rel="stylesheet"]')]){
   const path=resolve(el.getAttribute('href'),entry);if(!path||!path.endsWith('.css')){el.remove();continue;}el.setAttribute('href',blobUrl(path));
  }
  for(const el of [...doc.querySelectorAll('[src],img[srcset],source[srcset]')]){
   if(el.tagName==='SCRIPT')continue;
   const old=el.getAttribute('src');if(old){const path=resolve(old,entry);if(path)el.setAttribute('src',blobUrl(path));else el.removeAttribute('src');}
   el.removeAttribute('srcset');
  }
  for(const el of [...doc.querySelectorAll('a[href]')]){
   const path=resolve(el.getAttribute('href'),entry);
   if(path)el.setAttribute('href',blobUrl(path));else if(!el.getAttribute('href')?.startsWith('#'))el.removeAttribute('href');
  }
  // For local packages, disable outbound navigation and event-handler HTML.
  for(const el of [...doc.querySelectorAll('*')]){
   for(const attr of [...el.attributes])if(/^on/i.test(attr.name))el.removeAttribute(attr.name);
  }
  const meta=doc.createElement('meta');meta.setAttribute('http-equiv','Content-Security-Policy');meta.setAttribute('content',POLICY);
  doc.head.prepend(meta);
  const html='<!doctype html>'+doc.documentElement.outerHTML;
  document.open();document.write(html);document.close();
 }
 window.addEventListener('message',event=>{
  if(installed||event.source!==parent||event.data?.type!=='tavi.local.load/v1')return;
  installed=true;
  try{render(event.data.package);}catch(e){fail(e?.message||'Unable to render local package');}
 });
 window.addEventListener('pagehide',()=>{for(const url of created)URL.revokeObjectURL(url);});
})();
