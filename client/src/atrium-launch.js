/** Tavi app-directory handoff: Atrium is the game catalog, Tavi is messenger.
 * Accept only a reviewed server-advertised HTTPS base URL; no credentials,
 * query, game IDs, chat tokens, or invitation references are forwarded here.
 * A launch opens a separate system browser through Tauri's standard opener.
 */
export function reviewedAtriumBase(input){
 if(typeof input!=='string'||input.length<12||input.length>512||!input.endsWith('/')||/[\\\x00-\x20\x7f]/.test(input))return null;
 try{
  const url=new URL(input);
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.port||url.href!==input)return null;
  const host=url.hostname.toLowerCase();
  if(!host.includes('.')||host.startsWith('[')||/^\d+\.\d+\.\d+\.\d+$/.test(host)||
     host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||host.endsWith('.internal'))return null;
  if(!url.pathname.startsWith('/')||url.pathname.includes('//'))return null;
  return url.href;
 }catch{return null;}
}
export function atriumLauncher(advertised){
 const url=reviewedAtriumBase(advertised);
 return Object.freeze({
  available:!!url,
  url,
  title:'Atrium — Games & apps',
  detail:url?'Open the reviewed Atrium game directory. Chat stays open in Tavi.':
    'Atrium has not been connected to this Tavi server yet. Your conversations and game invitations still work.',
 });
}
