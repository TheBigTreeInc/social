/** Narrowly scoped TaviX nested game-surface request validation.
 * A request is NEVER a game-seat grant or proof that the URL is a deployed game.
 * The host must bind it to an active reviewed publisher and obtain user consent.
 */
const GAME_ID=/^[a-z][a-z0-9.-]{2,119}$/;
const MATCH_ID=/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const hasOwn=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const object=o=>o!==null&&typeof o==='object'&&!Array.isArray(o);
const keysWithin=(o,allowed,required=[])=>object(o)&&Object.keys(o).every(k=>allowed.includes(k))&&required.every(k=>hasOwn(o,k));
export function validateTaviXSurface(input){
 if(!keysWithin(input,['schema','id','kind','target','context','presentation'],['schema','id','kind','target'])||
   input.schema!=='tavix.surface/v1'||input.kind!=='game'||typeof input.id!=='string'||!GAME_ID.test(input.id))throw Error('Unsupported TaviX game surface');
 if(input.presentation!==undefined&&!['auto','embedded','external'].includes(input.presentation))throw Error('Unsupported game presentation');
 if(input.context!==undefined&&!keysWithin(input.context,['matchId']))throw Error('Unsupported game context');
 const matchId=input.context?.matchId;
 if(matchId!==undefined&&(typeof matchId!=='string'||!MATCH_ID.test(matchId)))throw Error('Invalid opaque match ID');
 const value=input.target;
 if(typeof value!=='string'||value.length>1500||/[\\\x00-\x20\x7f]/.test(value))throw Error('Invalid game target');
 let url;try{url=new URL(value);}catch{throw Error('Invalid game target');}
 if(url.protocol!=='https:'||url.username||url.password||url.hash||url.search||url.port||url.href!==value)throw Error('Game target must be canonical public HTTPS without credentials, query or fragment');
 const host=url.hostname.toLowerCase();
 if(!host.includes('.')||host.startsWith('[')||/^\d+(?:\.\d+){3}$/.test(host)||host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||host.endsWith('.internal')||host.endsWith('.test')||url.pathname.includes('//')||/%2f|%5c|%00/i.test(url.pathname))throw Error('Game target host/path is not public');
 // A match ID is an opaque public selector ONLY, not proof of authorization.
 // Life already understands this optional, no-credential ?match= convention.
 const launch=new URL(url.href);if(matchId)launch.searchParams.set('match',matchId);
 return Object.freeze({schema:'tavix.surface/v1',id:input.id,kind:'game',target:url.href,url:launch.href,origin:url.origin,matchId:matchId||null,presentation:input.presentation||'auto'});
}
