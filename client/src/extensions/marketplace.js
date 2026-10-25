// Marketplace view model and explicit publisher-source migration policy.
// Never silently replace a pinned publisher source with another catalog.
import {compareVersions} from './contract.js';
import {extensionUpdateStatus} from './updates.js';
import {extensionSource,TAVIX_REPOSITORY_URL} from './repositories.js';

export function alternativeRelease(entry,available,store,{staleSources=new Set()}={}) {
  const id=entry?.manifest?.id;
  if(!id||!store?.installed?.(id))return null;
  const currentSource=store.source(id);
  const original=readInstalledManifest(store,id);
  if(!original || original.publisher!==entry.manifest.publisher)return null;
  const candidates=available.filter(other=>
    other?.manifest?.id===id && other.manifest.publisher===original.publisher &&
    extensionSource(other)!==currentSource && other.repositoryUrl===TAVIX_REPOSITORY_URL &&
    !staleSources.has(other.repositoryUrl) &&
    other.manifest.platforms?.length!==0 &&
    compareVersions(other.manifest.version,store.version(id)||'0.0.0')>0
  );
  candidates.sort((a,b)=>compareVersions(b.manifest.version,a.manifest.version));
  return candidates[0]||null;
}
export function readInstalledManifest(store,id){
  try{const value=store?.metadata?.(id);const m=typeof value==='string'?JSON.parse(value):value;return m&&typeof m==='object'&&m.id===id?m:null;}catch{return null;}
}
export function migrationEligibility(entry,store,{staleSources=new Set(),platform='web'}={}){
  const id=entry?.manifest?.id;
  if(!id||!store?.installed?.(id))return {allowed:false,reason:'Application is not installed'};
  if(!entry.remote||entry.repositoryUrl!==TAVIX_REPOSITORY_URL||staleSources.has(entry.repositoryUrl))return {allowed:false,reason:'A fresh approved TaviX repository entry is required'};
  if(store.source(id)===extensionSource(entry))return {allowed:false,reason:'Already using this source'};
  const previous=readInstalledManifest(store,id);
  if(!previous||previous.publisher!==entry.manifest.publisher)return {allowed:false,reason:'Publisher identity does not match the installed app'};
  if(entry.manifest.platforms&&!entry.manifest.platforms.includes(platform))return {allowed:false,reason:'Application is not supported on this platform'};
  try {if(compareVersions(entry.manifest.version,store.version(id)||'0.0.0')<=0)return {allowed:false,reason:'Only newer versions may replace the pinned source'};}catch{return {allowed:false,reason:'Invalid extension version'};}
  return {allowed:true,reason:''};
}
export function marketplaceRows(entries,store,alternatives,{query='',filter='all',staleSources=new Set()}={}){
  const lower=String(query).trim().toLocaleLowerCase();
  return entries.map(entry=>{
    const id=entry.manifest.id;
    const installed=Boolean(store?.installed?.(id));
    const alternative=alternativeRelease(entry,alternatives,store,{staleSources});
    return {entry,installed,alternative};
  }).filter(row=>{
    if(filter==='installed'&&!row.installed)return false;
    if(filter==='updates'&&!row.alternative&&extensionUpdateStatus(row.entry,store)!=='update-available')return false;
    if(!lower)return true;
    return [row.entry.manifest.name,row.entry.manifest.publisher,row.entry.manifest.summary,row.entry.manifest.id].some(s=>String(s||'').toLocaleLowerCase().includes(lower));
  });
}
