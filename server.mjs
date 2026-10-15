/** Looprd Social LOCAL DEVELOPMENT ADAPTER ONLY. Bind to loopback; not internet-ready.
 * Production must replace dev bearer tokens with Social-owned verified sessions and revocation. OIDC is optional, not required.
 */
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,renameSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {timingSafeEqual} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const MAX_BODY=20*1024;
const cleanName=x=>String(x??'').replace(/[\x00-\x1f\x7f<>]/g,'').trim().slice(0,24);
function profile(profileId,input){
 if(!input||typeof input!=='object'||Array.isArray(input)|| (input.schema&&input.schema!=='looprd.social.profile/v1'))throw Error('Invalid profile schema');
 const displayName=cleanName(input.displayName);
 if(!displayName)throw Error('Name required');
 const appearance=input.appearance??null;
 if(appearance!==null){
  if(!appearance||typeof appearance!=='object'||Array.isArray(appearance)||appearance.schema!=='modular-portraits.identity/v1'||!['everyday-illustrated','dominion-pixel'].includes(appearance.pack)||appearance.revision!==1||JSON.stringify(appearance).length>16384)throw Error('Invalid appearance identity');
  if(!appearance.choices||typeof appearance.choices!=='object'||Object.values(appearance.choices).some(v=>typeof v!=='string'||!(/^[a-z0-9-]{1,64}$/.test(v)))||!appearance.colors||typeof appearance.colors!=='object'||Object.values(appearance.colors).some(v=>typeof v!=='string'||!/^#[a-fA-F0-9]{6}$/.test(v)))throw Error('Invalid appearance attributes');
 }
 return {schema:'looprd.social.profile/v1',profileId,displayName,appearance};
}
function safeTokenCompare(a,b){const aa=Buffer.from(a),bb=Buffer.from(b);return aa.length===bb.length&&timingSafeEqual(aa,bb);}
function handler({tokens,dataDir,origin}){
 if(!tokens||!Object.keys(tokens).length)throw Error('Configure explicit dev tokens');
 const profiles=new Map(),messages=[];
 mkdirSync(dataDir,{recursive:true});
 const dataFile=join(dataDir,'profiles.json');
 try{for(const [id,p] of Object.entries(JSON.parse(readFileSync(dataFile,'utf8')))){if(tokens[id])profiles.set(id,profile(id,p));}}catch(e){if(e.code!=='ENOENT')throw e;}
 const persist=()=>{const output=JSON.stringify(Object.fromEntries(profiles),null,2);writeFileSync(dataFile+'.tmp',output,{mode:0o600});renameSync(dataFile+'.tmp',dataFile);};
 const allowed=String(origin).split(',').map(v=>v.trim()).filter(Boolean);
 const respond=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
 return async(req,res)=>{
  const incomingOrigin=req.headers.origin;
  if(incomingOrigin){if(!allowed.includes(incomingOrigin))return respond(res,403,{error:'Origin not allowed'});res.setHeader('Access-Control-Allow-Origin',incomingOrigin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');res.setHeader('Access-Control-Allow-Methods','GET, PUT, POST, OPTIONS');}
  if(req.method==='OPTIONS')return respond(res,200,{ok:true});
  if(req.url==='/v1/health'&&req.method==='GET')return respond(res,200,{ok:true,role:'social',mode:'development-only'});
  const bearer=/^Bearer (.+)$/i.exec(req.headers.authorization||'')?.[1]||'';
  let identity=null;for(const [id,t] of Object.entries(tokens)){if(safeTokenCompare(bearer,t))identity=id;}
  if(!identity)return respond(res,401,{error:'Missing or invalid development token'});
  const me=()=>profiles.get(identity)||profile(identity,{displayName:identity,appearance:null});
  if(req.url==='/v1/me'&&req.method==='GET')return respond(res,200,me());
  const body=async()=>{let raw='',bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>MAX_BODY)throw Error('Payload too large');raw+=chunk;}return JSON.parse(raw);};
  try{
   if(req.url==='/v1/me'&&req.method==='PUT'){
    const input=await body();
    if(input.profileId!==null&&input.profileId!==undefined&&input.profileId!==identity)return respond(res,403,{error:'Cannot edit another user'});
    const p=profile(identity,input);profiles.set(identity,p);persist();return respond(res,200,p);
   }
   if(req.url==='/v1/chat/lobby'&&req.method==='GET')return respond(res,200,{schema:'looprd.social.chat/v1',messages:messages.slice(-50)});
   if(req.url==='/v1/chat/lobby'&&req.method==='POST'){
    const input=await body(),content=String(input.text??'').trim().slice(0,320);
    if(!content||/[\x00-\x08\x0e-\x1f]/.test(content))return respond(res,400,{error:'Invalid message'});
    const message={id:messages.length+1,authorId:identity,displayName:me().displayName,text:content,at:new Date().toISOString()};messages.push(message);if(messages.length>100)messages.shift();return respond(res,200,message);
   }
   if(req.url==='/v1/game-tickets'&&req.method==='POST')return respond(res,501,{error:'Game ticket issuance requires production identity/trust integration'});
   return respond(res,404,{error:'Unknown endpoint'});
  }catch(e){return respond(res,400,{error:e.message});}
 };
}
export {handler,profile,safeTokenCompare};
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const token=process.env.LOOPRD_SOCIAL_DEV_TOKEN;
 if(!token||token.length<24)throw Error('Set LOOPRD_SOCIAL_DEV_TOKEN to a random 24+ character value. Local testing only.');
 const tokens={dev_demo_user:token};
 createServer(handler({tokens,dataDir:join(process.cwd(),'.data'),origin:process.env.LOOPRD_SOCIAL_ALLOWED_ORIGINS||'http://127.0.0.1:8080,http://localhost:8080'})).listen(Number(process.env.LOOPRD_SOCIAL_PORT||8947),'127.0.0.1',()=>console.log('Looprd Social DEV ONLY listening at http://127.0.0.1:'+(process.env.LOOPRD_SOCIAL_PORT||8947)));
}
