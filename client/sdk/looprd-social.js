/** LoopRD v1 client protocol: strict server-local components, no federation. */
export const SOCIAL_COMPONENT = 'looprd-social';
// Public, unprivileged guest scope: registration/discovery only; never a user token.
export const TAVI_GUEST_CREDENTIAL = 'tavi_guest_v1';
const guestHeaders = {'Authorization':`Bearer ${TAVI_GUEST_CREDENTIAL}`};
const COMPONENT = /^[a-z][a-z0-9-]{0,47}$/;
// Call fetch as a method on its host: WebView2 can reject a detached native fetch.
const browserFetch = (url, options) => globalThis.fetch(url, options);
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

/** Each discovery request gets its own deadline; a slow /info must not consume /social's allowance. */
async function discoveryRequest(fetcher, url, options, stage) {
  const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),15000);
  try {return await fetcher(url,{...options,signal:controller.signal});}
  catch(error){
    if(error?.name==='AbortError'){
      const failure=new ProtocolError(`Server discovery timed out during ${stage}. Check your connection and retry.`);
      failure.code='DISCOVERY_TIMEOUT';throw failure;
    }
    if(error?.name==='TypeError' || error?.name==='NetworkError'){
      const failure=new ProtocolError('Could not reach the LoopRD server. Check your internet connection, HTTPS certificate and server availability.');
      failure.code='DISCOVERY_NETWORK';throw failure;
    }
    throw error;
  }finally{clearTimeout(timer);}
}

/** Probe a LoopRD origin without requiring user credentials or a stored session. */
export async function discoverSocial(origin, fetcher = browserFetch) {
  const base=normalizeServer(origin);
  const response=await discoveryRequest(fetcher,componentPath(base,SOCIAL_COMPONENT,'info'),
    {method:'GET',headers:guestHeaders,cache:'no-store'},'server information');
  if(response.status===404)return {available:false,reason:'This LoopRD server does not have the Social component installed.'};
  if(response.status===503)return {available:false,reason:'The Social service is temporarily unavailable (HTTP 503). Retry shortly.'};
  const data=await responseJson(response);
  if(data?.protocol!=='looprd.social/1')return {available:false,reason:'This server does not provide a compatible Social component.'};
  if(data.auth!=='social-accounts')return {available:true,registration:false,accounts:false,release:data.release||''};
  const caps=await discoveryRequest(fetcher,componentPath(base,SOCIAL_COMPONENT,'social'),
    {method:'POST',headers:{'Content-Type':'application/json',...guestHeaders},cache:'no-store',body:JSON.stringify({op:'capabilities'})},
    'account capabilities');
  const check=await responseJson(caps);
  if(check?.ok!==true||check.schema!=='looprd.social.capabilities/v1'||check.accounts!==true)
    return {available:true,registration:false,accounts:false,release:data.release||''};
  return {available:true,registration:check.registration===true,accounts:true,recoveryCodes:check.recoveryCodes===true,release:data.release||''};
}

async function accountCommand(origin, op, username, password, fetcher = browserFetch, extra={}) {
  const controller = new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try {
    const response=await fetcher(componentPath(origin,SOCIAL_COMPONENT,'social'),{
      method:'POST',headers:{'Content-Type':'application/json',...guestHeaders},cache:'no-store',signal:controller.signal,
      body:JSON.stringify({op,username,password,...extra})});
    const body=await responseJson(response);
    if(!body?.ok || typeof body.token!=='string' || body.token.length<32)
      throw new ProtocolError(body?.error||'Social sign-in failed');
    return new LooprdSocial(origin,body.token,fetcher);
  } catch(error){if(error?.name==='AbortError')throw new ProtocolError('Social sign-in timed out.');throw error;}
  finally{clearTimeout(timer);}
}

export const registerSocial=(origin,username,password,fetcher=browserFetch)=>accountCommand(origin,'register',username,password,fetcher);
export const loginSocial=(origin,username,password,fetcher=browserFetch)=>accountCommand(origin,'login',username,password,fetcher);
/** Recovery-code exchange creates a fresh session and revokes every older session. */
export function recoverSocial(origin,username,recoveryCode,newPassword,fetcher=browserFetch){
  if(!/^TAVI-(?:[A-Z2-7]{4}-){7}[A-Z2-7]{4}$/.test(recoveryCode||''))throw new ProtocolError('Enter a complete Tavi recovery code.');
  if(typeof newPassword!=='string'||newPassword.length<12||newPassword.length>128)throw new ProtocolError('New password must have 12–128 characters.');
  return accountCommand(origin,'recover_account',username,undefined,fetcher,{recoveryCode,newPassword});
}

/** Read the selected server's operator-approved game catalog. No Social token sent. */
export async function discoverGames(origin, fetcher=browserFetch) {
  const response=await fetcher(componentPath(origin,SOCIAL_COMPONENT,'social'),{
    method:'POST',headers:{'Content-Type':'application/json',...guestHeaders},body:JSON.stringify({op:'game_catalog'}),cache:'no-store'
  });
  const data=await responseJson(response);
  if(data?.ok!==true||data.schema!=='tavi.game-catalog/v1'||!Array.isArray(data.games)||data.games.length>40)
    throw new ProtocolError('Server did not return a compatible game catalog.');
  return data.games.filter(g=>g?.type==='web'&&typeof g.id==='string'&&/^[a-z][a-z0-9-]{1,47}$/.test(g.id)&&
      typeof g.name==='string'&&g.name.length<=64&&typeof g.url==='string'&&isSafePublishedGameUrl(g.url))
    .map(g=>({id:g.id,name:g.name,type:'web',url:g.url,embedded:g.embedded===true,external:true}));
}
/** Read sanitized discovery metadata from this signed-in Social server.
 * This command never sees the Atrium apps:read service credential and never
 * substitutes discovery for an approved playable release.
 */
export async function discoverAtriumGames(api) {
  if (!api || typeof api.command !== 'function') throw new ProtocolError('Sign in to see discovered games.');
  const data=await api.command('atrium_discovery');
  if(data?.schema!=='tavi.atrium-discovery/v1'||
     !['connected','not_connected','unavailable'].includes(data.status)||
     !Array.isArray(data.games)||data.games.length>100)
    throw new ProtocolError('Invalid Atrium discovery response.');
  const ids=new Set();
  const games=data.games.map(game=>{
    if(!game || !/^[a-z][a-z0-9.-]{2,119}$/.test(game.gameId||'') ||
       !/^[a-z][a-z0-9-]{0,63}$/.test(game.publisher||'') ||
       typeof game.title!=='string' || game.title.length<1||game.title.length>120 ||
       /[\x00-\x1f\x7f]/.test(game.title) ||
       game.status!=='discovered'||game.playable!==false||
       !Number.isInteger(game.instances)||game.instances<1||game.instances>30 ||
       typeof game.hostingConfigured!=='boolean'||
       ids.has(game.publisher+':'+game.gameId)) throw new ProtocolError('Invalid Atrium game metadata.');
    ids.add(game.publisher+':'+game.gameId);
    return Object.freeze({gameId:game.gameId,publisher:game.publisher,title:game.title,
      status:'discovered',instances:game.instances,hostingConfigured:game.hostingConfigured,playable:false});
  });
  return Object.freeze({status:data.status,games:Object.freeze(games)});
}

export function isSafePublishedGameUrl(value){
  try{const u=new URL(value);return u.protocol==='https:'&&!!u.hostname&&!u.username&&!u.password&&!u.hash&&
    (!u.port||u.port==='443')&&!['localhost','localhost.localdomain'].includes(u.hostname)&&
    !/\.(local|internal|localhost)$/.test(u.hostname)&&!/^(127\.|10\.|192\.168\.|169\.254\.)/.test(u.hostname)&&
    !/^172\.(1[6-9]|2[0-9]|3[01])\./.test(u.hostname)&&u.hostname!=='[::1]';}catch{return false;}
}

export function safePushEndpoint(value) {
  try {const url=new URL(value);return typeof value==='string'&&value.length<=2048&&
    url.protocol==='https:'&&!!url.hostname&&!url.username&&!url.password&&!url.search&&!url.hash&&
    /^\/[A-Za-z0-9_-]{1,200}$/.test(url.pathname)&&url.origin+url.pathname===value;}
  catch{return false;}
}

export class LooprdSocial {
  constructor(origin, token, fetcher = browserFetch) {
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
        method: 'POST', headers: {'Content-Type':'application/json','Authorization':`Bearer ${this.token}`},
        body: JSON.stringify({ op, ...fields, token: this.token }), signal: controller.signal,
        cache: 'no-store',
      });
      const data = await responseJson(response);
      if (!data || data.ok !== true) throw new ProtocolError(data?.error || 'Social request failed.', data?.code === 'DEVELOPER_ACCESS_DENIED' ? 403 : 0);
      return data;
    } catch (error) {
      if (error?.name === 'AbortError') throw new ProtocolError('Connection timed out.');
      throw error;
    } finally { clearTimeout(timer); }
  }
  interactions() { return this.command('interaction_feed'); }
  /** Game event inbox remains Social-owned; the game state stays in Life/Atrium. */
  gameEvents(after = 0) {
    if (!Number.isSafeInteger(after) || after < 0) throw new ProtocolError('Invalid game-event cursor');
    return this.command('game_event_feed', {after});
  }
  /** Consent is bound to this authenticated Social account, not a caller-supplied subject. */
  setGameNotification(publisher, gameId, matchId, enabled = true) {
    if (!/^[a-z][a-z0-9-]{1,47}$/.test(publisher || '') ||
        !/^[a-z][a-z0-9.]{1,95}$/.test(gameId || '') ||
        !/^[A-Za-z0-9_-]{12,128}$/.test(matchId || '') || typeof enabled !== 'boolean')
      throw new ProtocolError('Invalid game notification selection');
    return this.command('game_subscription_set', {publisher, gameId, matchId, enabled});
  }

  /** Game-owned match roster grants chat access only after account opt-in. */
  gameRooms() {return this.command('game_room_list');}
  gameRoomFeed(roomId,after=0) {
    if(!/^[a-f0-9]{64}$/.test(roomId||'') || !Number.isSafeInteger(after) || after<0)
      throw new ProtocolError('Invalid game room cursor');
    return this.command('game_room_feed',{roomId,after});
  }
  gameRoomSend(roomId,text) {
    if(!/^[a-f0-9]{64}$/.test(roomId||'') || typeof text!=='string' ||
       !text.trim() || text.length>1000) throw new ProtocolError('Invalid game room message');
    return this.command('game_room_send',{roomId,text});
  }

  /** Account-bound one-use proof for an approved game backend, never a seat authorization. */
  issueGameGrant(publisher, gameId, matchId) {
    if (!/^[a-z][a-z0-9-]{1,47}$/.test(publisher || '') ||
        !/^[a-z][a-z0-9.]{1,95}$/.test(gameId || '') ||
        !/^[A-Za-z0-9_-]{12,128}$/.test(matchId || ''))
      throw new ProtocolError('Invalid game grant audience');
    return this.command('game_grant_issue', {publisher, gameId, matchId});
  }
  /** Propose a game to an accepted contact. This never creates a game-owned match. */
  challengeContact(peer,gameId) {
    if(!/^acct_[1-9][0-9]{0,18}$/.test(peer||'')||!(/^[a-z][a-z0-9-]{1,47}$/.test(gameId||'')))
      throw new ProtocolError('Invalid challenge recipient or game');
    return this.command('game_challenge_send',{peer,gameId});
  }
  acceptChallenge(id) {return this.replyInteraction(id,'accept-challenge',{});}
  declineChallenge(id) {return this.replyInteraction(id,'decline-challenge',{});}
  acceptGameInvitation(id) { return this.replyInteraction(id, 'accept-game', {}); }
  declineGameInvitation(id) { return this.replyInteraction(id, 'decline-game', {}); }

  replyInteraction(id, action, values) { return this.command('interaction_reply', {id,action,values}); }
  dismissInteraction(id) { return this.command('interaction_dismiss', {id}); }
  publishInteraction(recipient, interaction, ttlSeconds = 86400) { return this.command('interaction_publish', {recipient,interaction,ttlSeconds}); }
  me() { return this.command('me'); }
  recoveryCodesStatus(){return this.command('recovery_codes_status');}
  recoveryCodesCreate(password){return this.command('recovery_codes_create',{password});}
  recoveryCodesRevoke(password){return this.command('recovery_codes_revoke',{password});}
  developerDiagnostics() { return this.command('developer_diagnostics').then(validateDeveloperDiagnostics); }
  saveProfile(profile, revision) { return this.command('save_profile', {profile, ifRevision: revision}); }
  feed() { return this.command('chat_feed'); }
  send(text) { return this.command('chat_send', {text}); }
  contacts() {return this.command('contact_list');}
  requestContact(username) {return this.command('contact_request',{username});}
  acceptContact(peer) {return this.command('contact_accept',{peer});}
  removeContact(peer) {return this.command('contact_remove',{peer});}
  conversations() {return this.command('dm_conversations');}
  markDirectRead(peer,upToId) {return this.command('dm_mark_read',{peer,upToId});}
  directFeed(peer) {return this.command('dm_feed',{peer});}
  directSend(peer,text) {return this.command('dm_send',{peer,text});}
  logout() {return this.command('logout');}
  async pushRequest(path, method='GET', value) {
    const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),12000);
    try {
      const response=await this.fetcher(componentPath(this.origin,SOCIAL_COMPONENT,path),{
        method,headers:{'Authorization':`Bearer ${this.token}`, ...(value===undefined?{}:{'Content-Type':'application/json'})},
        ...(value===undefined?{}:{body:JSON.stringify(value)}),cache:'no-store',signal:controller.signal,
      });
      return await responseJson(response);
    } catch(error){if(error?.name==='AbortError')throw new ProtocolError('Push request timed out.');throw error;}
    finally {clearTimeout(timer);}
  }
  pushDevices() {return this.pushRequest('_push/devices');}
  registerPushDevice(installationId,endpoint) {
    if(typeof installationId!=='string'||!/^[A-Za-z0-9_-]{8,128}$/.test(installationId))throw new ProtocolError('Invalid installation ID');
    if(typeof endpoint!=='string'||!safePushEndpoint(endpoint))throw new ProtocolError('Invalid push endpoint');
    return this.pushRequest('_push/devices','POST',{installationId,endpoint});
  }
  verifyPushDevice(deviceId,challenge) {
    if(typeof deviceId!=='string'||!/^[0-9a-f]{32}$/.test(deviceId)||
       typeof challenge!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(challenge))throw new ProtocolError('Invalid push verification');
    return this.pushRequest(`_push/devices/${deviceId}/verify`,'POST',{challenge});
  }
  removePushDevice(deviceId) {
    if(typeof deviceId!=='string'||!/^[0-9a-f]{32}$/.test(deviceId))throw new ProtocolError('Invalid device ID');
    return this.pushRequest(`_push/devices/${deviceId}`,'DELETE');
  }
  async pulseTicket() {
    const response=await this.pushRequest('_ws-ticket','POST');
    if(typeof response?.ticket!=='string'||response.ticket.length<16)throw new ProtocolError('Invalid WS ticket');
    return response.ticket;
  }
  /** Verified LoopRD WS uses a single-use, 30-second ticket; never a Social token in URL. */
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

export async function gameActivity(origin, game, credential = '', fetcher = browserFetch) {
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

/** Bounded, typed diagnostic contract. Deliberately omits secrets and user content. */
export function validateDeveloperDiagnostics(body) {
  if (!body || body.ok !== true || body.schema !== 'looprd.social.developer-diagnostics/v1' ||
      body.component !== SOCIAL_COMPONENT || body.apiVersion !== 'looprd/v1' ||
      typeof body.release !== 'string' || body.release.length > 40 ||
      !Number.isSafeInteger(body.databaseSchemaVersion) ||
      !Number.isSafeInteger(body.serverTime) ||
      !body.counts || typeof body.counts !== 'object')
    throw new ProtocolError('Invalid developer diagnostics contract.');
  const labels = ['accounts','profiles','contacts','directMessages','lobbyMessages','activeSessions'];
  const counts = {};
  for (const key of labels) {
    if (!Number.isSafeInteger(body.counts[key]) || body.counts[key] < 0)
      throw new ProtocolError('Invalid developer diagnostic counters.');
    counts[key] = body.counts[key];
  }
  const features = Array.isArray(body.features) ? body.features.filter(x => typeof x === 'string' && /^[a-z0-9-]{1,48}$/.test(x)).slice(0,20) : [];
  return {schema:body.schema,component:body.component,apiVersion:body.apiVersion,
    release:body.release,serverTime:body.serverTime,databaseSchemaVersion:body.databaseSchemaVersion,
    counts,features};
}
