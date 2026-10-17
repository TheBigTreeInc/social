/** Tavi push transport readiness and user consent.
 * No endpoint registration is performed until a deployed backend and Android
 * distributor adapter implement the agreed contract. A valid capability alone
 * does NOT mean that a device can receive background notifications.
 */
const KEY_SCHEMA = 'tavi.push-preferences/v1';
const CAP_SCHEMA = 'looprd-push/v1';
const ENDPOINT_PATTERN = /^https:\/\//;

export function pushPreferencesKey(origin, profileId) {
  const parsed = new URL(origin);
  if (parsed.origin !== origin || !/^acct_[0-9]{1,19}$/.test(profileId)) throw Error('Invalid push preference identity');
  return `tavi.push-prefs.v1:${encodeURIComponent(origin)}:${encodeURIComponent(profileId)}`;
}

export function readPushPreferences(storage, key) {
  try {
    const value = JSON.parse(storage.getItem(key) || 'null');
    if (value?.schema === KEY_SCHEMA) return {backgroundEnabled:value.backgroundEnabled === true};
  } catch { /* broken local settings must not activate notifications */ }
  return {backgroundEnabled:false}; // no automatic opt-in
}

export function savePushPreferences(storage, key, value) {
  // Do not store distributor endpoint URLs, provider credentials, device IDs,
  // account tokens, or private message contents in WebView/browser storage.
  const clean = {schema:KEY_SCHEMA, backgroundEnabled:value?.backgroundEnabled === true};
  try {storage.setItem(key, JSON.stringify(clean));return true;} catch {return false;}
}

/** Actual Social/LoopRD capability: compatible with LoopRD push.unifiedpush.
 * The Social handler announces protocol support; actual ntfy provider
 * availability is established by device registration (503 if not configured).
 */
export function parsePushCapabilities(response) {
  const push=response?.push;
  if(!push || push.schema!==CAP_SCHEMA || push.transport!=='unifiedpush' ||
      push.deviceRegistration!==true || push.requiresVerifiedSession!==true) return null;
  return {schema:CAP_SCHEMA,providers:['unifiedpush']};
}

export function pushReadiness({platform='web', preference=false, capability=null, nativeAdapter=false, permission='unknown'}={}) {
  if (!['android','windows','web'].includes(platform)) return {code:'unsupported',label:'This platform is not supported'};
  if (!preference) return {code:'off',label:'Background notifications are off on this device'};
  if (platform === 'windows') return {code:'windows',label:'Windows notifications work while Tavi is running; background push is not required'};
  if (permission === 'denied') return {code:'permission',label:'OS notification permission is denied'};
  if (!capability || capability.schema !== CAP_SCHEMA) return {code:'server',label:'Waiting for this server to advertise background push support'};
  const needed = platform === 'android' ? 'unifiedpush' : 'webpush';
  if (!capability.providers?.includes(needed)) return {code:'provider',label:`This server does not advertise ${needed === 'unifiedpush' ? 'UnifiedPush' : 'Web Push'}`};
  if (!nativeAdapter) return {code:'device',label:platform === 'android' ?
    'Android UnifiedPush distributor adapter is not yet installed' : 'Browser service-worker push receiver is not yet available'};
  if (permission !== 'granted') return {code:'permission',label:'Enable notifications before enrolling this device'};
  // Explicitly distinguish bridge/provider availability from actual enrollment.
  return {code:'pending-enrollment',label:'LoopRD supports device registration; enroll this device through an installed UnifiedPush distributor'};
}

/** Exact, content-free LoopRD v1 wake-up. Never accept message contents. */
export function validPushWakeup(value) {
  return !!value && typeof value==='object' && !Array.isArray(value) &&
    value.apiVersion==='looprd-push/v1' && value.type==='sync' &&
    Object.keys(value).length===2;
}

/** Stable per-installation random ID; not a credential, but still account-scoped. */
export function installationKey(origin,profileId) {
  return pushPreferencesKey(origin,profileId)+':installation';
}
export function getInstallationId(storage,key,random=()=>globalThis.crypto.randomUUID()) {
  let previous;
  try{previous=storage.getItem(key);}catch{}
  if(typeof previous==='string' && /^[A-Za-z0-9_-]{8,128}$/.test(previous))return previous;
  const id=random();
  if(typeof id!=='string'||!/^[A-Za-z0-9_-]{8,128}$/.test(id))throw Error('Invalid installation identifier');
  storage.setItem(key,id);
  return id;
}

export function checkUnifiedPushEndpoint(value) {
  if (typeof value !== 'string' || value.length > 2048 || !ENDPOINT_PATTERN.test(value)) return false;
  try {const u=new URL(value);return u.protocol==='https:' && !!u.hostname && !u.username && !u.password && !u.hash && !u.search && /^[\/][A-Za-z0-9_-]{1,200}$/.test(u.pathname) && u.origin+u.pathname===value;}catch{return false;}
}
