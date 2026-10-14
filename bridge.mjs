/** Development-only compatibility bridge: existing Life Loop REST API -> native Looprd POST /social.
 * This is NOT an identity provider or a public-facing reverse proxy. Loopback bind only.
 */
import {createServer} from 'node:http';
import {pathToFileURL} from 'node:url';
const MAX_BODY=20*1024;
const permittedUpstream=(url)=>{
 const u=new URL(url);if(u.username||u.password||u.hash||u.search||u.pathname!=='/social')throw Error('Upstream must be a plain Looprd /social URL');
 const local=['localhost','127.0.0.1','[::1]'].includes(u.hostname);
 if(u.protocol!=='https:'&&!(u.protocol==='http:'&&local))throw Error('HTTPS required except for local Looprd');
 return u.toString();
};
const safeTokens=(a,b)=>a===b; // upstream verifies credential; no token is trusted at the bridge.
function bridge({upstream,allowedOrigins='http://localhost:8080,http://127.0.0.1:8080',fetcher=fetch}){
 const endpoint=permittedUpstream(upstream);
 const allowed=new Set(allowedOrigins.split(',').map(x=>x.trim()).filter(Boolean));
 const reply=(res,status,data)=>{res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('X-Content-Type-Options','nosniff');res.writeHead(status);res.end(JSON.stringify(data));};
 return async (req,res)=>{
  const requestOrigin=req.headers.origin;
  if(requestOrigin){if(!allowed.has(requestOrigin))return reply(res,403,{error:'Origin denied'});
   res.setHeader('Access-Control-Allow-Origin',requestOrigin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');res.setHeader('Access-Control-Allow-Methods','GET, PUT, POST, OPTIONS');}
  if(req.method==='OPTIONS')return reply(res,204,{});
  if(req.url==='/v1/health'&&req.method==='GET')return reply(res,200,{ok:true,role:'social-bridge',mode:'development-only',upstreamConfigured:true});
  const match=/^Bearer ([^\s]+)$/i.exec(req.headers.authorization||'');
  const token=match?.[1]||'';
  if(token.length<24||token.length>256)return reply(res,401,{error:'Missing or invalid credential'});
  let operation, input={};
  if(req.url==='/v1/me'&&req.method==='GET')operation='me';
  else if(req.url==='/v1/me'&&req.method==='PUT')operation='save_profile';
  else if(req.url==='/v1/chat/lobby'&&req.method==='GET')operation='chat_feed';
  else if(req.url==='/v1/chat/lobby'&&req.method==='POST')operation='chat_send';
  else if(req.url==='/v1/game-tickets'&&req.method==='POST')return reply(res,501,{error:'Trusted game tickets not implemented'});
  else return reply(res,404,{error:'Unknown route'});
  if(req.method!=='GET'){
   try{const parts=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>MAX_BODY)return reply(res,413,{error:'Payload too large'});parts.push(chunk);}
    input=JSON.parse(Buffer.concat(parts).toString('utf8'));
    if(!input||typeof input!=='object'||Array.isArray(input))throw Error();
   }catch{return reply(res,400,{error:'Invalid JSON object'});}
  }
  const payload={op:operation,token};
  if(operation==='save_profile')payload.profile=input;
  if(operation==='chat_send')payload.text=input.text;
  try{
   const response=await fetcher(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(8000)});
   if(!response.ok)return reply(res,502,{error:'Looprd upstream unavailable'});
   const result=await response.json();
   if(!result?.ok){const status=/credential/i.test(result?.error||'')?401:/another profile/i.test(result?.error||'')?403:/cooldown/i.test(result?.error||'')?429:400;return reply(res,status,{error:result?.error||'Social operation failed'});}
   return reply(res,200,operation==='me'||operation==='save_profile'?result.profile:operation==='chat_send'?result.message:result);
  }catch{return reply(res,502,{error:'Looprd social service not reachable'});}
 };
}
export {bridge,permittedUpstream};
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const upstream=process.env.LOOPRD_SOCIAL_LOOPRD_URL;
 if(!upstream)throw Error('Set LOOPRD_SOCIAL_LOOPRD_URL to the Looprd /social endpoint (HTTPS or localhost).');
 createServer(bridge({upstream,allowedOrigins:process.env.LOOPRD_SOCIAL_ALLOWED_ORIGINS||'http://localhost:8080,http://127.0.0.1:8080'}))
  .listen(Number(process.env.LOOPRD_SOCIAL_BRIDGE_PORT||8947),'127.0.0.1',()=>console.log('Looprd Social development REST bridge on 127.0.0.1:'+String(process.env.LOOPRD_SOCIAL_BRIDGE_PORT||8947)));
}
