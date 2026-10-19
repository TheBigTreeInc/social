#!/usr/bin/env node
// Real-browser Tavi UI smoke tests. Uses only local, disposable LoopRD fixtures;
// never connects to the operator's server or logs account credentials.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,stat,mkdir,writeFile} from 'node:fs/promises';
import {join,resolve,dirname,extname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const dist=join(root,'dist');
const reportDir=resolve(process.env.TAVI_QA_ARTIFACTS||join(root,'qa-artifacts'));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.ico':'image/x-icon','.woff2':'font/woff2'};
const reply=(res,value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'});res.end(JSON.stringify(value));};
const disposableToken='tavi_qa_disposable_token_only_000000000000';
const responseFor=op=>{
 switch(op){
  case 'capabilities':return {ok:true,schema:'looprd.social.capabilities/v1',accounts:true,registration:true,recoveryCodes:false};
  case 'register':case 'login':return {ok:true,token:disposableToken};
  case 'me':return {ok:true,profile:{profileId:'acct_1',displayName:'QA Example',portraitCode:''},revision:1};
  case 'contact_list':return {ok:true,contacts:[{id:'acct_2',username:'qa_friend',status:'accepted',online:true}]};
  case 'chat_feed':case 'dm_feed':return {ok:true,messages:[]};
  case 'dm_conversations':return {ok:true,schema:'tavi.dm-summaries/v1',conversations:[]};
  case 'interaction_feed':return {ok:true,events:[]};
  case 'game_room_list':return {ok:true,rooms:[]};
  case 'pulse_ticket':return {ok:false,error:'No websocket in disposable QA fixture'};
  case 'atrium_discovery':return {ok:false,error:'Not configured in disposable QA fixture'};
  default:return {ok:true};
 }
};
function fixtureServer(){
 return createServer(async(req,res)=>{
  try{
   const pathname=new URL(req.url,'http://127.0.0.1').pathname;
   if(pathname==='/looprd/looprd-social/v1/info')return reply(res,{protocol:'looprd.social/1',auth:'social-accounts',release:'0.3.58'});
   if(pathname==='/looprd/looprd-social/v1/social'&&req.method==='POST'){
    let body='';for await(const chunk of req){body+=chunk;if(body.length>10000){reply(res,{ok:false,error:'Input too large'},413);return;}}
    let op;try{op=JSON.parse(body).op;}catch{reply(res,{ok:false,error:'Invalid JSON'},400);return;}
    return reply(res,responseFor(op));
   }
   if(pathname==='/.well-known/tavi-repositories.json')return reply(res,{schema:'tavi.repository-list/v1',repositories:[]},404);
   const requested=pathname==='/'?'index.html':decodeURIComponent(pathname.slice(1));
   const filename=resolve(dist,requested);
   if(relative(dist,filename).startsWith('..')||filename===dist){reply(res,{error:'Not found'},404);return;}
   const info=await stat(filename).catch(()=>null);
   if(!info?.isFile()){reply(res,{error:'Not found'},404);return;}
   res.writeHead(200,{'Content-Type':types[extname(filename)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
   res.end(await readFile(filename));
  }catch(error){reply(res,{error:'Fixture error'},500);}
 });
}
const checks=[];
async function screenshot(page,name){try{const file=join(reportDir,`${name}.png`);await page.screenshot({path:file,fullPage:true,timeout:4000});return file;}catch{return null;}}
async function noOverflow(page,label){
 const data=await page.evaluate(()=>({viewport:document.documentElement.clientWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth}));
 assert(data.document<=data.viewport+2&&data.body<=data.viewport+2,`${label} horizontal overflow: ${JSON.stringify(data)}`);
}
async function visible(page,selector){await page.locator(selector).waitFor({state:'visible',timeout:6000});}
async function signIn(page,base){
 await visible(page,'#server-form input[name="server"]');
 await page.locator('#server-form input[name="server"]').fill(base);
 await page.locator('#server-form button').click();
 await visible(page,'#auth-form input[name="username"]');
 await page.locator('#auth-form input[name="username"]').fill('qauser');
 await page.locator('#auth-form input[name="password"]').fill('qa_password_valid_123');
 await page.locator('#auth-form button[type="submit"], #auth-form button.solid').click();
 await visible(page,'[data-action="main-menu"]');
}
async function testViewport(browser,base,device){
 const context=await browser.newContext({viewport:{width:device.width,height:device.height},isMobile:device.mobile,hasTouch:device.mobile,deviceScaleFactor:1});
 const page=await context.newPage();const errors=[];let stage='load';
 // Any non-loopback network access indicates the test is not self-contained.
 await context.route('**/*',route=>{const url=new URL(route.request().url());return ['localhost','127.0.0.1'].includes(url.hostname)?route.continue():route.abort('blockedbyclient');});
 page.on('pageerror',error=>errors.push(error.message));
 page.on('dialog',dialog=>dialog.accept());
 try{
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:12000});
  await visible(page,'#server-form');
  await noOverflow(page,`${device.name} login`);
  stage='sign-in';await signIn(page,base);
  await noOverflow(page,`${device.name} home`);
  stage='main-menu';await page.locator('[data-action="main-menu"]').click();
  await visible(page,'.tavi-menu-grid [data-action="app-store"]');
  stage='app-store';await page.locator('.tavi-menu-grid [data-action="app-store"]').click();
  await visible(page,'.tavi-app-store');
  await visible(page,'#extension-repository-form input[name="repository"]');
  await visible(page,'.tavi-store-item');
  assert.match(await page.locator('.tavi-store-item').first().innerText(),/Private Notepad/);
  await noOverflow(page,`${device.name} app store`);
  stage='install extension';await page.locator('[data-extension-install="org.tavi.examples.notepad"]').click();
  await visible(page,'[data-extension-open="org.tavi.examples.notepad"]');
  stage='open extension';await page.locator('[data-extension-open="org.tavi.examples.notepad"]').click();
  await visible(page,'#tavi-extension-surface iframe[sandbox="allow-scripts"]');
  stage='return home';await page.locator('.tavi-extension-toolbar [data-action="home"]').click();
  await visible(page,'[data-action="main-menu"]');
  await noOverflow(page,`${device.name} returned home`);
  assert.equal(errors.length,0,`${device.name} JavaScript errors: ${errors.join('; ')}`);
  if(process.env.TAVI_QA_CAPTURE==='1')await screenshot(page,`${device.name}-success`);
  checks.push({device:device.name,result:'passed',stages:['login','home','main-menu','app-store','extension-install','extension-launch','return-home','viewport-overflow','javascript-errors']});
  console.log(`PASS ${device.name}: sign-in, home, App Store, install/open extension, return home, viewport, script errors`);
 }catch(error){
  const picture=await screenshot(page,`${device.name}-failure`);
  checks.push({device:device.name,result:'failed',stage,error:String(error?.message||error),screenshot:picture,scriptErrors:errors});
  console.error(`FAIL ${device.name}/${stage}: ${error?.message||error}${picture?` (screenshot ${picture})`:''}`);
 }finally{await context.close();}
}
async function main(){
 await mkdir(reportDir,{recursive:true});
 const entry=await stat(join(dist,'index.html')).catch(()=>null);
 if(!entry?.isFile())throw Error('UI QA BLOCKED: built client/dist/index.html missing. Run npm install --prefix client then npm --prefix client run web:build.');
 let chromium;
 try{({chromium}=await import('playwright-core'));}catch{throw Error('UI QA BLOCKED: playwright-core missing. Run npm install --prefix client.');}
 const attempts=[process.env.TAVI_QA_BROWSER_PATH?{executablePath:process.env.TAVI_QA_BROWSER_PATH}:null,{channel:'chrome'},{}].filter(Boolean);
 if(process.platform==='linux')attempts.splice(1,0,{executablePath:'/usr/bin/chromium'});
 let browser,lastError;
 for(const launch of attempts){try{browser=await chromium.launch({...launch,headless:true,args:process.platform==='linux'?['--no-sandbox']:[]});break;}catch(error){lastError=error;}}
 if(!browser)throw Error(`UI QA BLOCKED: Chromium/Chrome unavailable. Set TAVI_QA_BROWSER_PATH or install a Playwright browser. ${lastError?.message||''}`);
 const server=fixtureServer();
 try{
  await new Promise((accept,reject)=>server.once('error',reject).listen(0,'127.0.0.1',accept));
  const base=`http://127.0.0.1:${server.address().port}/`;
  for(const device of [{name:'desktop',width:1366,height:768,mobile:false},{name:'mobile-390',width:390,height:844,mobile:true},{name:'mobile-320',width:320,height:720,mobile:true}])await testViewport(browser,base,device);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
let failure;
try{await main();if(checks.some(x=>x.result!=='passed'))failure='One or more browser UI checks failed';}
catch(error){failure=String(error.message||error);console.error(failure);}
await mkdir(reportDir,{recursive:true});
await writeFile(join(reportDir,'report.json'),JSON.stringify({schema:'tavi.ui-qa-report/v1',status:failure?failure.startsWith('UI QA BLOCKED')?'blocked':'failed':'passed',checks,error:failure||null},null,2)+'\n');
if(failure)process.exitCode=1;else console.log(`PASS: UI QA report ${join(reportDir,'report.json')}`);
