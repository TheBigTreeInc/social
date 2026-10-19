import {validateExtensionManifest} from './contract.js';

// Tavi subscriptions are URLs to independent, static, open-source indexes.
// No central publisher account, upload API or registry is involved.
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
    if (!isObject(item) || Object.keys(item).some(k => !['manifest','entrypoint','source','license'].includes(k))) throw Error('Invalid repository extension entry');
    const m = item.manifest;
    validateExtensionManifest(m);
    if (seen.has(m.id)) throw Error('Duplicate extension in repository');
    seen.add(m.id);
    if (typeof item.license !== 'string' || !/^[A-Za-z0-9.\-+]{1,50}$/.test(item.license)) throw Error('An open-source SPDX license identifier is required');
    // Source URL must point to a browsable HTTPS source repository, not opaque binaries.
    const source = safeUrl(item.source);
    const entrypoint = safeUrl(item.entrypoint);
    if (new URL(entrypoint).pathname.split('/').pop() !== m.entrypoints.panel.split('/').pop()) throw Error('Entrypoint filename differs from manifest');
    return {manifest:m,remote:{entrypoint,source,license:item.license}};
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
export function mergeRepositoryEntries(bundled,collections) {
  const entries=[...bundled];const ids=new Set(bundled.map(e=>e.manifest.id));
  for(const collection of collections)for(const entry of collection){if(ids.has(entry.manifest.id))continue;ids.add(entry.manifest.id);entries.push(entry);}
  return entries;
}
export function extensionSource(entry) {return entry?.repositoryUrl || 'tavi:bundled';}
export function remoteOrigin(entry) {return new URL(entry.remote.entrypoint).origin;}
