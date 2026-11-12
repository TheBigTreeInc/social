/** Optional, non-privileged TaviX presentation declaration and device-local choice. */
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const obj=o=>o!==null&&typeof o==='object'&&!Array.isArray(o);
const modes=['embedded','detached','native-window','split-pane','floating-panel'];
const canonical=mode=>mode==='detached'?'native-window':mode;
const legacy=mode=>mode==='native-window'?'detached':mode;
export function validatePresentation(p){
 if(p===undefined)return null; // all existing manifests remain valid
 if(!obj(p)||p.schema!=='tavix.presentation/v1'||Object.keys(p).some(k=>!['schema','preferred','supported','minimumSize','preferredSize','responsive'].includes(k)))throw Error('Invalid TaviX presentation');
 if(!modes.includes(p.preferred)||!Array.isArray(p.supported)||p.supported.length<1||p.supported.length>4||new Set(p.supported).size!==p.supported.length||p.supported.some(x=>!modes.includes(x))||p.supported.filter(x=>canonical(x)==='native-window').length>1||!p.supported.includes('embedded')||!p.supported.includes(p.preferred))throw Error('Invalid presentation modes');
 for(const key of ['minimumSize','preferredSize'])if(own(p,key)){
  const size=p[key];if(!obj(size)||Object.keys(size).some(k=>!['width','height'].includes(k))||!Number.isInteger(size.width)||!Number.isInteger(size.height)||size.width<280||size.width>2400||size.height<320||size.height>1800)throw Error('Invalid presentation dimensions');
 }
 if(p.responsive!==undefined&&typeof p.responsive!=='boolean')throw Error('Invalid presentation responsiveness');
 return p;
}
export const workspaceLabel=id=>{
 if(typeof id!=='string'||!/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+){2,}$/.test(id)||id.length>120)throw Error('Invalid workspace app ID');
 // Asynchronous SHA-256 in main.js supplies the collision-resistant native label.
 return id;
};
export function presentationKey(scope,id){
 if(typeof scope!=='string'||!scope||scope.length>300)throw Error('Invalid account scope');
 workspaceLabel(id);return `tavi.workspace.presentation/v1:${scope}:${id}`;
}
export function savedPresentation(storage,scope,id){
 try{const value=storage.getItem(presentationKey(scope,id));return modes.includes(value)?value:null;}catch{return null;}
}
export function forgetPresentation(storage,scope,id){
 try{storage.removeItem(presentationKey(scope,id));return true;}catch{return false;}
}
export function rememberPresentation(storage,scope,id,mode){
 if(!modes.includes(mode))throw Error('Invalid presentation mode');
 storage.setItem(presentationKey(scope,id),mode);
}
export function allowDetached({desktop,verified,entry,store,scope,source}){
 if(!desktop||!verified||!scope||!entry||!store)return false;
 if(entry.local&&source!=='tavi:local')return false;
 const id=entry.manifest?.id;
 if(!id||id==='org.tavi.core.wallet'||id==='org.tavi.companion'||!store.enabled(id)||store.source(id)!==source)return false;
 if(store.version(id)!==entry.manifest.version)return false;
 if(entry.manifest.presentation?.supported&&!entry.manifest.presentation.supported.some(mode=>canonical(mode)==='native-window'))return false;
 return true;
}
export function desiredPresentation(storage,scope,id,manifest){
 return legacy(savedPresentation(storage,scope,id)||manifest?.presentation?.preferred||'embedded');
}

// Per-device, per-account defaults. These never grant a capability; native
// window eligibility is checked separately for every installed app.
const defaults=Object.freeze({game:'detached',app:'embedded'});
export function deviceWindowKey(scope,kind){
 if(typeof scope!=='string'||!scope||scope.length>300||!Object.hasOwn(defaults,kind))throw Error('Invalid workspace preference scope');
 return `tavi.workspace.device-window/v1:${scope}:${kind}`;
}
export function deviceWindowDefault(storage,scope,kind){
 const fallback=defaults[kind];deviceWindowKey(scope,kind);
 try{const mode=storage.getItem(deviceWindowKey(scope,kind));return ['embedded','detached'].includes(mode)?mode:fallback;}catch{return fallback;}
}
export function setDeviceWindowDefault(storage,scope,kind,mode){
 if(!['embedded','detached'].includes(mode))throw Error('Invalid window default');
 storage.setItem(deviceWindowKey(scope,kind),mode);
}
export function desktopLaunchPresentation(storage,scope,id,manifest,{kind='app',detachable=false}={}){
 if(!detachable)return 'embedded';
 const saved=savedPresentation(storage,scope,id);
 // An explicit per-app choice has precedence over a device category default.
 if(saved)return legacy(saved);
 const chosen=deviceWindowDefault(storage,scope,kind);
 // A reviewed manifest declaring embedded-only cannot be overridden by prefs.
 if(chosen==='detached'&&manifest?.presentation?.supported&&
    !manifest.presentation.supported.some(m=>canonical(m)==='native-window'))return 'embedded';
 return chosen;
}
