#!/usr/bin/env node
// Real-browser Tavi UI smoke tests. Uses only local, disposable LoopRD fixtures;
// never connects to the operator's server or logs account credentials.
import assert from 'node:assert/strict';
import {snapshotTouchTargets} from './ui-qa-touch.mjs';
import {snapshotSafeLayout} from './ui-qa-insets.mjs';
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
const fixture={lifeVisible:true};
const life={gameId:'life.loop',publisher:'thebigtreeinc',title:'The Life Loop',status:'discovered',instances:1,hostingConfigured:false,playable:false};
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
  case 'atrium_discovery':return {ok:true,schema:'tavi.atrium-discovery/v1',status:'connected',games:fixture.lifeVisible?[life]:[]};
  default:return {ok:true};
 }
};
function fixtureServer(){
 return createServer(async(req,res)=>{
  try{
   const pathname=new URL(req.url,'http://127.0.0.1').pathname;
   if(pathname==='/__qa/withdraw-life'&&req.method==='POST'){fixture.lifeVisible=false;return reply(res,{ok:true});}
   if(pathname==='/looprd/looprd-social/v1/info')return reply(res,{protocol:'looprd.social/1',auth:'social-accounts',release:'0.3.58'});
   if(pathname==='/looprd/looprd-social/v1/wallet'&&req.method==='POST'){
    let body='';for await(const chunk of req){body+=chunk;if(body.length>10000)return reply(res,{error:'Too large'},413);}
    let op;try{op=JSON.parse(body).op;}catch{return reply(res,{error:'Malformed wallet request'},400);}
    if(op==='balance')return reply(res,{ok:true,schema:'tavi.wallet/v1',balances:[{currencyId:'gold',amount:'100',playOnly:'100',availableForShopping:'0'}],currencies:[{id:'gold',name:'Gold',symbol:'Gold',decimals:0}],rates:[],offers:[],faucet:{claimable:false}});
    if(op==='transactions')return reply(res,{ok:true,transactions:[]});
    return reply(res,{ok:false,error:'Unavailable in fixture'});
   }
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
  stage='messenger Home: profile left, Companion right and buddy groups';
  await visible(page,'.tavi-home-messenger .tavi-home-identity');
  await visible(page,'.tavi-home-self-portrait[data-action="portrait"]');
  await visible(page,'.tavi-home-companion .tavi-companion-portrait');
  await visible(page,'.tavi-home-group-title[data-group="online"]');
  await visible(page,'.tavi-home-group-title[data-group="offline"]');
  await visible(page,'.tavi-home-buddy[data-peer="acct_2"]');
  // Validate left/right placement in the painted layout, not just DOM existence.
  const portraits=await page.evaluate(()=>{
    const bounds=selector=>{const rect=document.querySelector(selector)?.getBoundingClientRect();return rect?{left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom}:null;};
    return {own:bounds('.tavi-home-self-portrait'),companion:bounds('.tavi-home-companion .tavi-companion-portrait'),width:document.documentElement.clientWidth};
  });
  assert(portraits.own&&portraits.companion&&portraits.companion.left>=portraits.own.right&&portraits.companion.right<=portraits.width+2,
    `${device.name} Home profile/Companion layout clipped or reversed: ${JSON.stringify(portraits)}`);
  assert.equal(await page.locator('.tavi-home-messenger .tavi-message-inbox').count(),0,'Home must remain the buddy list, not the Messages inbox');
  stage='Messages: independent inbox, no Companion or Wallet';
  await page.locator('.tavi-unified-home .tavi-mobile-tabs [data-action="contacts"]').click();
  await visible(page,'.tavi-message-inbox .tavi-message-search input');
  await visible(page,'.tavi-message-threads [data-message-kind="lobby"]');
  for(const filter of ['all','unread','friends'])await visible(page,`.tavi-message-filters [data-message-filter="${filter}"]`);
  assert.equal(await page.locator('.tavi-contact-focus .tavi-home-companion, .tavi-contact-focus .tavi-gold-balance').count(),0,'Messages must contain no Companion or Wallet controls');
  await page.locator('.tavi-contact-focus .tavi-mobile-tabs [data-action="home"]').click();
  await visible(page,'.tavi-home-messenger .tavi-home-identity');
  assert.equal(await page.locator('.games-strip, .tavi-discovered-mini, .roster-toolbar, .roster-search').count(),0,'No legacy Games strip, duplicate action toolbar or search in the messenger Home');
  if(device.mobile){
   stage='mobile touch targets';
   const touch=await page.evaluate(()=>({touch:document.documentElement.dataset.touch,maxTouchPoints:navigator.maxTouchPoints}));
   assert.equal(touch.touch,'true',`${device.name} touch input not recognized: ${JSON.stringify(touch)}`);
   // A login/refresh can replace the roster between locators. Read section
   // and buddy dimensions together in one animation frame, and retry until
   // both controls have a real layout box. Never accept a visible sub-44px row.
   const metricsHandle=await page.waitForFunction(snapshotTouchTargets,null,{timeout:7000,polling:'raf'});
   const metrics=await metricsHandle.jsonValue();
   const heights=metrics.buddies.map(item=>item.height);
   assert(heights.length&&heights.every(height=>height>=44),`${device.name} buddy rows too small for touch: ${JSON.stringify(metrics)}`);
   const sectionHeight=metrics.section.height;
   assert(sectionHeight>=44,`${device.name} section button is only ${sectionHeight}px: ${JSON.stringify(metrics)}`);
  }
  if(device.mobile){
   stage='Android simulated safe areas';
   // Synthetic 46px top / 34px bottom ensures an edge-to-edge Android
   // WebView leaves room for status and gesture bars even when env() is zero.
   await page.evaluate(()=>{
    document.documentElement.classList.add('android-shell');
    document.documentElement.style.setProperty('--tavi-safe-top','46px');
    document.documentElement.style.setProperty('--tavi-safe-bottom','34px');
   });
   const layout=await page.evaluate(snapshotSafeLayout,null);
   assert(layout.roster&&layout.dock&&layout.menu&&layout.homeHeader,`${device.name} missing Home regions: ${JSON.stringify(layout)}`);
   assert(layout.homeHeader.top>=45&&layout.roster.top>=layout.homeHeader.bottom-1&&layout.dock.bottom<=layout.viewport.height-33,
     `${device.name} Home enters system bars: ${JSON.stringify(layout)}`);
   assert(layout.menu.top>=layout.dock.top-1&&layout.menu.bottom<=layout.dock.bottom+1,
     `${device.name} Main Menu overlaps roster text: ${JSON.stringify(layout)}`);
   assert(layout.roster.bottom<=layout.dock.top+1,
     `${device.name} roster and dock overlap: ${JSON.stringify(layout)}`);
  }
  stage='core Wallet profile balance';
  await page.locator('.tavi-gold-balance').waitFor({state:'visible',timeout:6000});
  await page.waitForFunction(()=>document.querySelector('.tavi-gold-balance')?.textContent?.includes('100 Gold'),null,{timeout:6000});
  assert.equal(await page.locator('.tavi-home-self-details .personal-message').count(),0,'Home must not show internal account/server IDs');
  stage='open core Wallet directly';await page.locator('.tavi-gold-balance').click();
  await visible(page,'#tavi-extension-surface[data-extension-id="org.tavi.core.wallet"] iframe[sandbox="allow-scripts"]');
  assert.equal(await page.locator('.tavi-install-dialog').count(),0,'Core Wallet requires no install dialog');
  assert.equal(await page.locator('.tavi-app-store').count(),0,'Core Wallet must bypass App Store');
  await page.frameLocator('#tavi-extension-surface iframe').locator('#gold').waitFor({state:'visible',timeout:6000});
  await page.waitForFunction(()=>document.querySelector('#tavi-extension-surface iframe')!==null);
  stage='Wallet return Home through shared Back';await page.locator('.tavi-utility-focus .tavi-shell-bar__back[data-action="back"]').click();
  await visible(page,'.tavi-home-messenger .tavi-home-identity');
  await visible(page,'.tavi-gold-balance');
  stage='Life discovered Games';await visible(page,'.tavi-unified-home .tavi-mobile-tabs [data-action="games"]');await page.locator('.tavi-unified-home .tavi-mobile-tabs [data-action="games"]').click();
  await visible(page,'[data-discovered-game="life.loop"]');
  assert.match(await page.locator('[data-discovered-game="life.loop"]').innerText(),/Not playable yet/);
  assert.equal(await page.locator('[data-discovered-game="life.loop"] [data-launch-game], [data-discovered-game="life.loop"] [data-challenge-game]').count(),0);
  if(device.mobile){
   stage='Android safe Back and focused header';
   const layout=await page.evaluate(snapshotSafeLayout,null);
   assert(layout.toolbar&&layout.back,`${device.name} Back missing: ${JSON.stringify(layout)}`);
   assert(layout.toolbar.top>=45&&layout.back.top>=layout.toolbar.top-1&&layout.back.height>=44,
      `${device.name} Back overlaps header or status bar: ${JSON.stringify(layout)}`);
   assert(layout.back.bottom<=layout.toolbar.bottom+1,
      `${device.name} Back overlays focused screen text: ${JSON.stringify(layout)}`);
  }
  stage='Life withdrawn';await fetch(new URL('__qa/withdraw-life',base),{method:'POST'});
  await page.locator('.tavi-game-title-row [data-action="refresh"]').click();
  await page.locator('[data-discovered-game="life.loop"]').waitFor({state:'detached',timeout:7000});
  assert.match(await page.locator('.tavi-games-browser').innerText(),/No reviewed games are currently available/);
  stage='return from Games through shared Back';await page.locator('.tavi-utility-focus .tavi-shell-bar__back[data-action="back"]').click();
  await visible(page,'.tavi-home-messenger .tavi-home-identity');
  stage='main-menu';await page.locator('[data-action="main-menu"]').click();
  await visible(page,'.tavi-menu-grid [data-action="app-store"]');
  stage='app-store';await page.locator('.tavi-menu-grid [data-action="app-store"]').click();
  await visible(page,'.tavi-app-store');
  assert.equal(await page.locator('[data-extension-install="org.tavi.core.wallet"], [data-extension-remove="org.tavi.core.wallet"], [data-extension-disable="org.tavi.core.wallet"]').count(),0,'Core Wallet must have no install/remove/disable controls');
  assert.equal(await page.locator('.tavi-store-item').filter({hasText:'Core Gold Wallet'}).count(),0,'Core Wallet is not an optional store app');
  await visible(page,'#extension-repository-form input[name="repository"]');
  // App Store can contain Notepad, Companion, and additional extensions.
  // Never wait on an unscoped multi-match locator (Playwright strict mode).
  const notepadInstall=page.locator('[data-extension-install="org.tavi.examples.notepad"]');
  await notepadInstall.waitFor({state:'visible',timeout:6000});
  const notepadCard=page.locator('.tavi-store-item').filter({has:notepadInstall});
  assert.equal(await notepadCard.count(),1,'Exactly one Private Notepad App Store card expected');
  assert.match(await notepadCard.innerText(),/Private Notepad/);
  await noOverflow(page,`${device.name} app store`);
  stage='review extension install';await page.locator('[data-extension-install="org.tavi.examples.notepad"]').click();
  await visible(page,'.tavi-install-dialog[role="dialog"]');
  assert.match(await page.locator('.tavi-install-dialog').innerText(),/Install Private Notepad\?/);
  // Installation is never implicit: cancellation retains the uninstalled state.
  stage='cancel extension install';await page.locator('[data-extension-install-cancel]').click();
  await page.locator('.tavi-install-dialog').waitFor({state:'detached'});
  assert.equal(await page.locator('[data-extension-open="org.tavi.examples.notepad"]').count(),0);
  stage='approve extension install';await page.locator('[data-extension-install="org.tavi.examples.notepad"]').click();
  await visible(page,'[data-extension-install-approve="org.tavi.examples.notepad"]');
  await page.locator('[data-extension-install-approve="org.tavi.examples.notepad"]').click();
  await visible(page,'[data-extension-open="org.tavi.examples.notepad"]');
  stage='open extension';await page.locator('[data-extension-open="org.tavi.examples.notepad"]').click();
  await visible(page,'#tavi-extension-surface iframe[sandbox="allow-scripts"]');
  stage='return from Notepad through shared Home';await page.locator('.tavi-utility-focus .tavi-shell-bar__home[data-action="home"]').click();
  await visible(page,'.tavi-home-messenger .tavi-home-identity');
  await visible(page,'.tavi-unified-home .tavi-mobile-tabs [data-action="main-menu"]');
  await noOverflow(page,`${device.name} returned home`);
  assert.equal(errors.length,0,`${device.name} JavaScript errors: ${errors.join('; ')}`);
  if(process.env.TAVI_QA_CAPTURE==='1')await screenshot(page,`${device.name}-success`);
  checks.push({device:device.name,result:'passed',stages:['login','messenger-home','messages-inbox-isolated','gold-balance-in-profile','core-wallet-direct-open','life-discovered-in-games','life-nonplayable','life-withdrawn','main-menu','app-store','extension-install-approval-and-cancel','extension-launch','return-home','viewport-overflow','mobile-touch-targets','android-safe-insets-and-navigation','javascript-errors']});
  console.log(`PASS ${device.name}: sign-in, Life discover/withdraw, home, App Store, approve/open extension, return home, viewport, script errors`);
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
  for(const device of [{name:'desktop',width:1366,height:768,mobile:false},{name:'tablet',width:768,height:1024,mobile:true},{name:'compact-355',width:355,height:630,mobile:false},{name:'mobile-390',width:390,height:844,mobile:true},{name:'mobile-320',width:320,height:720,mobile:true}]){fixture.lifeVisible=true;await testViewport(browser,base,device);}
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
let failure;
try{await main();if(checks.some(x=>x.result!=='passed'))failure='One or more browser UI checks failed';}
catch(error){failure=String(error.message||error);console.error(failure);}
await mkdir(reportDir,{recursive:true});
await writeFile(join(reportDir,'report.json'),JSON.stringify({schema:'tavi.ui-qa-report/v1',status:failure?failure.startsWith('UI QA BLOCKED')?'blocked':'failed':'passed',checks,error:failure||null},null,2)+'\n');
if(failure)process.exitCode=1;else console.log(`PASS: UI QA report ${join(reportDir,'report.json')}`);
