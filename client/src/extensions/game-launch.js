/** One narrowly scoped, credential-free hosted Life handoff from reviewed Atrium.
 * Validation is deliberately independent from the extension iframe.
 * This does not confer Life match membership or attest the deployed release.
 */
const MATCH_ID=/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const OWN=(obj,keys)=>obj!==null&&typeof obj==='object'&&!Array.isArray(obj)&&Object.keys(obj).sort().join('|')===keys.slice().sort().join('|');
export const ATRIUM_EXTENSION_ID='inc.thebigtree.tavi.atrium';
// Both first-party publishing channels are explicitly trusted for the
// temporary Life compatibility broker. Arbitrary community mirrors are not.
export const ATRIUM_REPOSITORY_URL='https://thebigtreeinc.github.io/atrium/tavi/tavi.repository.json';
export const TAVIX_ATRIUM_REPOSITORY_URL='https://thebigtreeinc.github.io/tavix/tavi.repository.json';
const APPROVED_ATRIUM_SOURCES=new Set([ATRIUM_REPOSITORY_URL,TAVIX_ATRIUM_REPOSITORY_URL]);
export const isOfficialAtriumSource=source=>APPROVED_ATRIUM_SOURCES.has(source);
export function parseReviewedLifeHandoff(input){
 if(!OWN(input,['schema','gameId','target','matchContext'])||input.schema!=='atrium.tavi-launch/v1'||input.gameId!=='life.loop'||!OWN(input.matchContext,['matchId']))throw Error('Unsupported Life launch handoff');
 const matchId=input.matchContext.matchId;
 if(typeof matchId!=='string'||!MATCH_ID.test(matchId))throw Error('Invalid opaque Life match ID');
 const raw=input.target;
 if(typeof raw!=='string'||raw.length>1500||/[\\\x00-\x20\x7f]/.test(raw))throw Error('Invalid Life target');
 let target;try{target=new URL(raw);}catch{throw Error('Invalid Life target');}
 if(target.protocol!=='https:'||target.username||target.password||target.search||target.hash||target.port||target.href!==raw)throw Error('Life target must be a canonical HTTPS URL without credentials, query or fragment');
 const host=target.hostname.toLowerCase();
 if(!host.includes('.')||host.startsWith('[')||/^\d+\.\d+\.\d+\.\d+$/.test(host)||host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||host.endsWith('.internal'))throw Error('Invalid public Life host');
 if(target.pathname.includes('//')||/%2f|%5c|%00/i.test(target.pathname))throw Error('Invalid Life launch path');
 // The sole query argument is an opaque selector, never an identity credential.
 const href=new URL(target.href);href.searchParams.set('match',matchId);
 return Object.freeze({gameId:'life.loop',target:target.href,matchId,url:href.href,origin:target.origin});
}
