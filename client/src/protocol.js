/** LoopRD v1 client protocol: strict server-local components, no federation. */
export const SOCIAL_COMPONENT = 'looprd-social';
const COMPONENT = /^[a-z][a-z0-9-]{0,47}$/;
const DEV_HOSTS = new Set(['localhost', '127.0.0.1', '10.0.2.2', '[::1]']);

export function normalizeServer(input) {
  if (typeof input !== 'string' || !input.trim()) throw Error('Enter a LoopRD server URL.');
  let parsed;
  try { parsed = new URL(input.trim()); } catch { throw Error('Invalid server URL.'); }
  if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') {
    throw Error('Use only the LoopRD server origin (no path, username or query).');
  }
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && DEV_HOSTS.has(parsed.hostname))) {
    throw Error('Remote LoopRD servers require HTTPS.');
  }
  return parsed.origin;
}

export function componentPath(origin, component, route = '') {
  const base = normalizeServer(origin);
  if (!COMPONENT.test(component)) throw Error('Invalid LoopRD component ID.');
  if (route && (!/^[a-zA-Z0-9_/-]+$/.test(route) || route.includes('//') || route.split('/').includes('..')))
    throw Error('Invalid component route.');
  return `${base}/looprd/${component}/v1/${route}`;
}

export class ProtocolError extends Error {
  constructor(message, status = 0) { super(message); this.status = status; }
}

async function responseJson(response) {
  let body;
  try { body = await response.json(); } catch { throw new ProtocolError('Invalid server JSON response.', response.status); }
  if (!response.ok) throw new ProtocolError(body?.error || `Server returned HTTP ${response.status}.`, response.status);
  return body;
}

/** Probe one LoopRD origin. Missing Social means no local account or chat store. */
export async function discoverSocial(origin, fetcher = fetch) {
  const url = componentPath(origin, SOCIAL_COMPONENT, 'info');
  const controller = new AbortController(), timer = setTimeout(()=>controller.abort(),12000);
  try {
    const response = await fetcher(url,{method:'GET',cache:'no-store',signal:controller.signal});
    if (response.status===404 || response.status===503) return {available:false,reason:'The selected LoopRD server has no active Social component.'};
    const data = await responseJson(response);
    if (data?.protocol!=='looprd.social/1') return {available:false,reason:'This server does not provide a compatible Social component.'};
    if(data.auth!=='social-accounts') return {available:true,registration:false,accounts:false,release:data.release||''};
    const caps=await fetcher(componentPath(origin,SOCIAL_COMPONENT,'social'),{
      method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',signal:controller.signal,
      body:JSON.stringify({op:'capabilities'})});
    const check=await responseJson(caps);
    if(check?.ok!==true||check.schema!=='looprd.social.capabilities/v1'||check.accounts!==true)
      return {available:true,registration:false,accounts:false,release:data.release||''};
    return {available:true,registration:check.registration===true,accounts:true,release:data.release||''};
  } catch(error){if(error?.name==='AbortError') throw new ProtocolError('Server discovery timed out.');throw error;}
  finally {clearTimeout(timer);}
}

async function accountCommand(origin, op, username, password, fetcher = fetch) {
  const controller = new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try {
    const response=await fetcher(componentPath(origin,SOCIAL_COMPONENT,'social'),{
      method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',signal:controller.signal,
      body:JSON.stringify({op,username,password})});
    const body=await responseJson(response);
    if(!body?.ok || typeof body.token!=='string' || body.token.length<32)
      throw new ProtocolError(body?.error||'Social sign-in failed');
    return new LooprdSocial(origin,body.token,fetcher);
  } catch(error){if(error?.name==='AbortError')throw new ProtocolError('Social sign-in timed out.');throw error;}
  finally{clearTimeout(timer);}
}

export const registerSocial=(origin,username,password,fetcher=fetch)=>accountCommand(origin,'register',username,password,fetcher);
export const loginSocial=(origin,username,password,fetcher=fetch)=>accountCommand(origin,'login',username,password,fetcher);

export class LooprdSocial {
  constructor(origin, token, fetcher = fetch) {
    this.origin = normalizeServer(origin);
    if (typeof token !== 'string' || token.length < 24 || token.length > 256) throw Error('Enter the Social credential (24–256 characters).');
    this.token = token; // memory only; never serialized, logged or sent to game endpoints
    this.fetcher = fetcher;
  }
  async command(op, fields = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await this.fetcher(componentPath(this.origin, SOCIAL_COMPONENT, 'social'), {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ op, ...fields, token: this.token }), signal: controller.signal,
        cache: 'no-store',
      });
      const data = await responseJson(response);
      if (!data || data.ok !== true) throw new ProtocolError(data?.error || 'Social request failed.');
      return data;
    } catch (error) {
      if (error?.name === 'AbortError') throw new ProtocolError('Connection timed out.');
      throw error;
    } finally { clearTimeout(timer); }
  }
  me() { return this.command('me'); }
  saveProfile(profile, revision) { return this.command('save_profile', {profile, ifRevision: revision}); }
  feed() { return this.command('chat_feed'); }
  send(text) { return this.command('chat_send', {text}); }
  contacts() {return this.command('contact_list');}
  requestContact(username) {return this.command('contact_request',{username});}
  acceptContact(peer) {return this.command('contact_accept',{peer});}
  removeContact(peer) {return this.command('contact_remove',{peer});}
  directFeed(peer) {return this.command('dm_feed',{peer});}
  directSend(peer,text) {return this.command('dm_send',{peer,text});}
  logout() {return this.command('logout');}
  /** Current Social public WS only broadcasts opaque pulse signals; never identities or chat payloads. */
  pulseUrl() { return componentPath(this.origin, SOCIAL_COMPONENT, 'events').replace(/^http/, 'ws'); }
}

export function parseGameActivity(body, component) {
  if (!body || body.schema !== 'looprd.game.activity/v1' || !Array.isArray(body.turns))
    throw new ProtocolError('Game has no compatible turn-activity contract.');
  if (body.turns.length > 150) throw new ProtocolError('Game returned too many turns.');
  const turns = body.turns.map(entry => {
    if (!entry || typeof entry.id !== 'string' || entry.id.length > 120 || !entry.id ||
        typeof entry.title !== 'string' || entry.title.length > 180 ||
        !['your-turn', 'waiting', 'complete'].includes(entry.status)) {
      throw new ProtocolError('Game returned invalid turn activity.');
    }
    const link = entry.path || '';
    // A game may only advertise its own LoopRD paths, never external URLs or other components.
    if (link && (typeof link !== 'string' || !link.startsWith(`/looprd/${component}/v1/`) ||
                 !/^\/[A-Za-z0-9/_-]+$/.test(link) || link.includes('//'))) {
      throw new ProtocolError('Game returned an unsafe destination.');
    }
    return {id: entry.id, title: entry.title, status: entry.status,
      match: String(entry.match || '').slice(0, 100), path: link};
  });
  return {turns};
}

export async function gameActivity(origin, game, credential = '', fetcher = fetch) {
  if (!COMPONENT.test(game)) throw Error('Invalid game component ID.');
  const url = componentPath(origin, game, 'activity');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetcher(url, {method:'GET', headers: credential ? {'Authorization':`Bearer ${credential}`} : {},
      cache: 'no-store', signal: controller.signal});
    return parseGameActivity(await responseJson(response), game);
  } catch (error) {
    if (error?.name === 'AbortError') throw new ProtocolError('Game activity timed out.');
    throw error;
  } finally { clearTimeout(timer); }
}

export function newTurnKeys(turns, previous = []) {
  const seen = new Set(previous);
  const active = turns.filter(t => t.status === 'your-turn').map(t => t.id);
  return {newIds: active.filter(id => !seen.has(id)), activeIds: active};
}
