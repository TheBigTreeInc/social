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
 const REPORT_CODES=new Set(['css_missing','css_cycle','css_budget','css_unsafe','css_import_missing','css_import_unsupported','css_asset_missing','css_asset_unsupported','script_missing']);
 const report=code=>{try{parent.postMessage({type:'tavi.local.preview-status/v1',code},'*');}catch{}};
 const fail=reason=>{report(REPORT_CODES.has(reason)?reason:'render_error');document.body.replaceChildren(document.createTextNode('Local TaviX preview blocked: required assets could not be prepared.'));};
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
  // Local CSS is inserted as text, NOT as a blob: URL. Tauri's native CSP
  // permits inline styles but does not permit blob stylesheets. If an
  // essential stylesheet cannot be prepared we must not start app scripts.
  const MAX_CSS_CHARS=256_000, MAX_CSS_DEPTH=8;
  let cssChars=0;
  function inlineCss(path,parents=new Set()){
   if(parents.has(path)||parents.size>=MAX_CSS_DEPTH)throw Error('css_cycle');
   const bytes=assets[path];
   if(!(bytes instanceof Uint8Array)||!path.endsWith('.css'))throw Error('css_missing');
   parents.add(path);
   try{return inlineCssText(decode(bytes),path,parents);}
   finally{parents.delete(path);}
  }
  function inlineCssText(raw,path,parents){
   if(/<\/style\b/i.test(raw))throw Error('css_unsafe');
   cssChars+=raw.length;if(cssChars>MAX_CSS_CHARS)throw Error('css_budget');
   const imports=[];
   // Mark imports before rewriting url(). Otherwise @import url("./x.css")
   // would be mistaken for an ordinary image. Imported CSS is never rewritten
   // a second time after expansion.
   let code=raw.replace(/@import\s+(?:url\(\s*)?(['"]?)([^'"\s)]+)\1\s*\)?\s*([^;]*);/gi,(_all,_q,target,condition)=>{
    if(condition.trim())throw Error('css_import_unsupported');
    const key=resolve(target,path);
    if(!key||!key.endsWith('.css'))throw Error('css_import_missing');
    const id=imports.length;imports.push(inlineCss(key,parents));
    return `/*TAVI_LOCAL_IMPORT_${id}*/`;
   });
   if(/@import\b/i.test(code))throw Error('css_import_unsupported');
   code=code.replace(/url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/gi,(_all,_q,target)=>{
    if(target.startsWith('#')||target.startsWith('data:image/'))return `url("${target}")`;
    const asset=resolve(target,path);
    if(!asset||asset.endsWith('.css')||asset.endsWith('.js')||asset.endsWith('.html'))throw Error('css_asset_missing');
    return `url("${blobUrl(asset)}")`;
   });
   if(/url\s*\(/i.test(code.replace(/url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/gi,'')))throw Error('css_asset_unsupported');
   return code.replace(/\/\*TAVI_LOCAL_IMPORT_(\d+)\*\//g,(_all,id)=>imports[Number(id)]||'');
  }

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
   }

   const url=URL.createObjectURL(new Blob([body],{type:mime(path)}));created.push(url);blobs.set(path,url);making.delete(path);return url;
  }
  const doc=new DOMParser().parseFromString(decode(assets[entry]),'text/html');
  for(const el of [...doc.querySelectorAll('base,meta[http-equiv],iframe,object,embed')])el.remove();
  // Preflight ALL styles before creating script URLs or executing code.
  const inlineStyles=[...doc.querySelectorAll('style')];
  for(const el of [...doc.querySelectorAll('link')]){
   const rel=String(el.getAttribute('rel')||'').toLowerCase().split(/\s+/);
   if(!rel.includes('stylesheet')){el.remove();continue;}
   const path=resolve(el.getAttribute('href'),entry);
   if(!path||!path.endsWith('.css'))throw Error('css_missing');
   const css=inlineCss(path);
   const style=doc.createElement('style');
   if(el.hasAttribute('media'))style.setAttribute('media',el.getAttribute('media'));
   style.textContent=css;
   el.replaceWith(style);
  }
  for(const el of inlineStyles)el.textContent=inlineCssText(el.textContent||'',entry,new Set());
  for(const el of [...doc.querySelectorAll('script')]){
   const src=el.getAttribute('src');
   if(src){const path=resolve(src,entry);if(!path||!path.endsWith('.js'))throw Error('script_missing');el.setAttribute('src',blobUrl(path));}
   else if(el.textContent?.trim()){
    const url=URL.createObjectURL(new Blob([el.textContent],{type:'text/javascript'}));created.push(url);el.textContent='';el.setAttribute('src',url);
   }
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
  // A trusted, tiny monitor runs before package scripts. It reports only
  // allowlisted categories, never messages, stack traces, URLs or asset names.
  // This is diagnostic evidence, not a native process/memory watchdog.
  const monitorCode=`(()=>{
   let count=0;
   const send=code=>{if(count++>=3)return;try{parent.postMessage({type:'tavi.local.preview-status/v1',code},'*');}catch{}};
   window.addEventListener('error',event=>{send(event.target&&event.target!==window?'resource_error':'script_error');},true);
   window.addEventListener('unhandledrejection',()=>send('script_error'));
   window.addEventListener('securitypolicyviolation',()=>send('policy_violation'));
   window.addEventListener('load',()=>send('document_loaded'),{once:true});
  })();`;
  const monitorUrl=URL.createObjectURL(new Blob([monitorCode],{type:'text/javascript'}));
  created.push(monitorUrl);
  const monitor=doc.createElement('script');monitor.setAttribute('src',monitorUrl);
  doc.head.prepend(monitor);
  const meta=doc.createElement('meta');meta.setAttribute('http-equiv','Content-Security-Policy');meta.setAttribute('content',POLICY);
  doc.head.prepend(meta);
  const html='<!doctype html>'+doc.documentElement.outerHTML;
  report('assets_prepared');
  document.open();document.write(html);document.close();
 }
 window.addEventListener('message',event=>{
  if(installed||event.source!==parent||event.data?.type!=='tavi.local.load/v1')return;
  installed=true;
  try{render(event.data.package);}catch(e){fail(e?.message||'Unable to render local package');}
 });
 window.addEventListener('pagehide',()=>{for(const url of created)URL.revokeObjectURL(url);});
})();
