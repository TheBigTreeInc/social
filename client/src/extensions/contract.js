// Tavi Extension Manifest v1. Deny unknown permissions/contributions rather than
// silently accepting a grant the installed host does not understand.
export const HOST_API_VERSION = '1.0.0';
export const PERMISSIONS = Object.freeze(['ui.panel', 'ui.toast', 'storage.private']);
export const SUPPORTED_SLOTS = Object.freeze(['app.store', 'app.launcher']);
const ID = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+){2,}$/;
const FILE = /^(?!\/)(?!.*(?:^|\/)\.\.?\/)[a-zA-Z0-9_/-]+\.(?:html|css|js|png|svg|webp)$/;
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const OWN = (obj,k)=>Object.prototype.hasOwnProperty.call(obj,k);
const plain = obj => !!obj && typeof obj === 'object' && !Array.isArray(obj);
const only = (obj,keys)=>Object.keys(obj).every(k=>keys.includes(k));
export function compareVersions(a,b){
 if(!VERSION.test(a)||!VERSION.test(b))throw Error('Invalid semantic version');
 const x=a.split('.').map(Number),y=b.split('.').map(Number);
 for(let i=0;i<3;i++){if(x[i]!==y[i])return Math.sign(x[i]-y[i]);}return 0;
}
export function validateExtensionManifest(m,hostVersion=HOST_API_VERSION){
 if(!plain(m)||!only(m,['schema','id','version','name','summary','publisher','kind','hostApi','entrypoints','contributions','permissions','platforms']))throw Error('Invalid manifest fields');
 if(m.schema!=='tavi.extension/v1'||typeof m.id!=='string'||m.id.length>120||!ID.test(m.id)||!VERSION.test(m.version)||typeof m.name!=='string'||!m.name.trim()||m.name.length>60||typeof m.summary!=='string'||!m.summary.trim()||m.summary.length>240||typeof m.publisher!=='string'||!/^[-a-z0-9]{2,64}$/.test(m.publisher)||m.kind!=='app')throw Error('Invalid extension identity');
 if(!plain(m.hostApi)||!only(m.hostApi,['min','maxExclusive'])||!VERSION.test(m.hostApi.min)||!VERSION.test(m.hostApi.maxExclusive)||compareVersions(m.hostApi.min,m.hostApi.maxExclusive)>=0)throw Error('Invalid host API range');
 if(!plain(m.entrypoints)||!only(m.entrypoints,['panel'])||typeof m.entrypoints.panel!=='string'||!FILE.test(m.entrypoints.panel))throw Error('Invalid entrypoint');
 if(!Array.isArray(m.permissions)||m.permissions.length>10||new Set(m.permissions).size!==m.permissions.length||m.permissions.some(p=>!PERMISSIONS.includes(p))||!m.permissions.includes('ui.panel'))throw Error('Unsupported extension permission');
 if(!Array.isArray(m.contributions)||m.contributions.length>12||m.contributions.some(c=>!plain(c)||!only(c,['slot','id','label','action'])||!SUPPORTED_SLOTS.includes(c.slot)||typeof c.id!=='string'||!/^[-a-z0-9]{1,40}$/.test(c.id)||typeof c.label!=='string'||c.label.length>50||!c.label.trim()||c.action!=='openPanel'))throw Error('Unsupported contribution');
 if(m.platforms!==undefined&&(!Array.isArray(m.platforms)||m.platforms.length<1||m.platforms.some(p=>!['web','windows','android'].includes(p))||new Set(m.platforms).size!==m.platforms.length))throw Error('Invalid platforms');
 if(compareVersions(hostVersion,m.hostApi.min)<0||compareVersions(hostVersion,m.hostApi.maxExclusive)>=0)return {compatible:false,reason:`Requires Tavi extension API ${m.hostApi.min}–${m.hostApi.maxExclusive}`};
 return {compatible:true,reason:''};
}
export function validateCatalog(catalog,hostVersion=HOST_API_VERSION){
 if(!plain(catalog)||catalog.schema!=='tavi.store.catalog/v1'||!Array.isArray(catalog.extensions)||catalog.extensions.length>150)throw Error('Invalid catalog');
 const ids=new Set();
 for(const entry of catalog.extensions){
  if(!plain(entry)||!only(entry,['manifest','files'])||!Array.isArray(entry.files)||entry.files.length<1||entry.files.length>60)throw Error('Invalid catalog entry');
  validateExtensionManifest(entry.manifest,hostVersion);
  if(ids.has(entry.manifest.id))throw Error('Duplicate extension');ids.add(entry.manifest.id);
  const paths=new Set();
  for(const f of entry.files){
   if(!plain(f)||!only(f,['path','sha256','size'])||typeof f.path!=='string'||!FILE.test(f.path)||paths.has(f.path)||!/^([a-f0-9]{64})$/.test(f.sha256)||!Number.isSafeInteger(f.size)||f.size<0||f.size>1_000_000)throw Error('Invalid extension asset');
   paths.add(f.path);
  }
  if(!paths.has(entry.manifest.entrypoints.panel))throw Error('Entrypoint absent');
 }
 return catalog.extensions;
}
export function extensionAssetUrl(id,path,base){
 if(!ID.test(id)||!FILE.test(path))throw Error('Unsafe extension path');
 const relative=`tavi-extensions/${id}/${path}`;
 const url=new URL(relative,base);
 if(url.origin!==new URL(base).origin)throw Error('Cross-origin extension forbidden');
 return url.href;
}
