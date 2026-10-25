import {validateExtensionManifest} from './contract.js';

// Tavi subscriptions are URLs to independent, static, open-source indexes.
// No central publisher account, upload API or registry is involved.
// TaviX is the official aggregate catalog. The legacy Atrium feed is retained
// for existing per-account source pins and as a fallback if TaviX is unavailable.
// Neither feed installs apps automatically; the user must approve installs.
export const TAVIX_REPOSITORY_URL = 'https://thebigtreeinc.github.io/tavix/tavi.repository.json';
export const LEGACY_ATRIUM_REPOSITORY_URL = 'https://thebigtreeinc.github.io/atrium/tavi/tavi.repository.json';
export const FIRST_PARTY_REPOSITORIES = Object.freeze([
  TAVIX_REPOSITORY_URL
]);
const MAX_BYTES = 160_000;
const STORAGE_PREFIX = 'tavi.extensions.repositories/v1:';
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const safeUrl = (value) => {
  if (typeof value !== 'string' || value.length > 2048) throw Error('Invalid HTTPS URL');
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw Error('Extension URLs must use HTTPS without credentials or fragments');
  return url.href;
};
export function validateRepositoryList(value) {
  if (!isObject(value) || value.schema !== 'tavi.repository-list/v1' || !Array.isArray(value.repositories) || value.repositories.length > 24) throw Error('Invalid server repository recommendations');
  return [...new Set(value.repositories.map(safeUrl))];
}
export function validateRepository(value) {
  if (!isObject(value) || value.schema !== 'tavi.repository/v1' || typeof value.name !== 'string' || !value.name.trim() || value.name.length > 80 || !Array.isArray(value.extensions) || value.extensions.length > 150) throw Error('Invalid Tavi extension repository');
  const seen = new Set();
  return value.extensions.map(item => {
    if (!isObject(item) || Object.keys(item).some(k => !['manifest','entrypoint','source','license','release'].includes(k))) throw Error('Invalid repository extension entry');
    if(item.release!==undefined && (!isObject(item.release)||Object.keys(item.release).some(k=>k!=='revision')||!/^([a-f0-9]{64})$/.test(item.release.revision)))throw Error('Invalid release revision metadata');
    const m = item.manifest;
    validateExtensionManifest(m);
    if (seen.has(m.id)) throw Error('Duplicate extension in repository');
    seen.add(m.id);
    if (typeof item.license !== 'string' || !/^[A-Za-z0-9.\-+]{1,50}$/.test(item.license)) throw Error('An open-source SPDX license identifier is required');
    // Source URL must point to a browsable HTTPS source repository, not opaque binaries.
    const source = safeUrl(item.source);
    const entrypoint = safeUrl(item.entrypoint);
    if (!new URL(entrypoint).pathname.endsWith('/'+m.entrypoints.panel)) throw Error('Entrypoint path differs from manifest');
    return {manifest:m,remote:{entrypoint,source,license:item.license},...(item.release?{release:{revision:item.release.revision}}:{})};
  });
}
export async function fetchJsonLimited(url,{fetcher=fetch}={}) {
  const safe = safeUrl(url);
  const res = await fetcher(safe,{credentials:'omit',redirect:'error',cache:'no-store'});
  if (!res.ok) throw Error(`Repository unavailable (${res.status})`);
  const body = await res.text();
  if (body.length > MAX_BYTES) throw Error('Repository index is too large');
  return JSON.parse(body);
}
export async function fetchRepository(url,options={}) {
  const safe=safeUrl(url);
  return validateRepository(await fetchJsonLimited(safe,options)).map(entry=>({...entry,repositoryUrl:safe}));
}
export async function fetchServerRepositories(origin,{fetcher=fetch}={}) {
  const base=new URL(origin);
  if (!['https:','http:'].includes(base.protocol) || base.username || base.password) throw Error('Invalid LoopRD server');
  const url=new URL('/.well-known/tavi-repositories.json',base);
  const response=await fetcher(url.href,{credentials:'omit',redirect:'error',cache:'no-store'});
  if (response.status===404) return [];
  if (!response.ok) throw Error(`Server repository recommendations unavailable (${response.status})`);
  const body=await response.text();
  if(body.length>MAX_BYTES)throw Error('Repository recommendations too large');
  return validateRepositoryList(JSON.parse(body));
}
export function repositoryStorageKey(origin) {
  const parsed=new URL(origin);
  if(!['https:','http:'].includes(parsed.protocol))throw Error('Invalid server');
  return STORAGE_PREFIX+encodeURIComponent(parsed.origin);
}
export function createRepositorySubscriptions({storage,serverOrigin}) {
  const key=repositoryStorageKey(serverOrigin);
  let urls=[];
  try {const raw=JSON.parse(storage.getItem(key)||'[]'); if(Array.isArray(raw)) urls=[...new Set(raw.filter(v=>{try{return safeUrl(v)===v;}catch{return false;}}))].slice(0,24);} catch {}
  const persist=()=>storage.setItem(key,JSON.stringify(urls));
  return {
    list:()=>[...urls],
    add(value){const url=safeUrl(value);if(urls.includes(url))return url;if(urls.length>=24)throw Error('Maximum 24 repositories');urls.push(url);persist();return url;},
    remove(value){urls=urls.filter(url=>url!==value);persist();}
  };
}
/** Resolve same-ID applications without silently switching an existing install's
 * publisher source. Core/bundled applications remain authoritative unless an
 * explicitly recognized optional app opts into the first-party hosted catalog.
 * If a pinned source goes offline, keep the catalog entry unavailable rather
 * than silently using another publisher as the active installed application.
 */
export function mergeRepositoryEntries(bundled,collections,{store=null,hostedOptionalIds=[]}={}) {
  const groups=new Map();
  for(const entry of [...bundled,...collections.flat()]){
    const id=entry.manifest.id;
    if(!groups.has(id))groups.set(id,[]);
    groups.get(id).push(entry);
  }
  const allowed=new Set(hostedOptionalIds);
  return [...groups.values()].map(group=>{
    const id=group[0].manifest.id;
    const installed=store?.installed?.(id)===true;
    if(installed){
      const pinned=store.source(id);
      const match=group.find(entry=>extensionSource(entry)===pinned);
      if(match)return match;
      // Keep a missing, untrusted source visibly incompatible and unlaunchable.
      return group[0];
    }
    const bundled=group.find(entry=>!entry.remote);
    if(bundled){
      if(allowed.has(id)){
        const hosted=group.find(entry=>entry.repositoryUrl===TAVIX_REPOSITORY_URL&&
          entry.manifest.publisher===bundled.manifest.publisher&&
          entry.manifest.permissions.every(permission=>bundled.manifest.permissions.includes(permission)));
        if(hosted)return hosted;
      }
      return bundled;
    }
    return group[0];
  });
}
export function extensionSource(entry) {return entry?.repositoryUrl || 'tavi:bundled';}
export function remoteOrigin(entry) {return new URL(entry.remote.entrypoint).origin;}
