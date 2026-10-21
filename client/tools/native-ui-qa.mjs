#!/usr/bin/env node
// ATTACH ONLY to the operator-approved Windows Tavi WebView2 QA instance.
// This is NOT a Chromium substitute and does not start an installed user app.
// For native QA use a disposable account/server, NEVER your private session.
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';

export function nativeQaPreflight(env=process.env,platform=process.platform){
 if(platform!=='win32')return {ok:false,reason:'windows_required'};
 if(env.TAVI_NATIVE_QA_DISPOSABLE!=='1')return {ok:false,reason:'disposable_qa_required'};
 const port=Number(env.TAVI_NATIVE_QA_CDP_PORT);
 if(!Number.isInteger(port)||port<1024||port>65535)return {ok:false,reason:'cdp_port_required'};
 return {ok:true,port,capture:env.TAVI_NATIVE_QA_CAPTURE==='1'};
}
const project=resolve(fileURLToPath(new URL('..',import.meta.url)));
const artifacts=resolve(process.env.TAVI_NATIVE_QA_ARTIFACTS||join(project,'native-qa-artifacts'));
const summary={schema:'tavi.native-ui-qa-report/v1',status:'blocked',platform:'windows',checks:[],blocker:null};
const record=(step,result)=>summary.checks.push({step,result});
async function writeReport(){await mkdir(artifacts,{recursive:true});await writeFile(join(artifacts,'report.json'),JSON.stringify(summary,null,2)+'\n');}
async function main(){
 const preflight=nativeQaPreflight();
 if(!preflight.ok){summary.blocker=preflight.reason;return;}
 let chromium;
 try{({chromium}=await import('playwright-core'));}catch{summary.blocker='playwright_core_not_installed';return;}
 let browser;
 try{browser=await chromium.connectOverCDP(`http://127.0.0.1:${preflight.port}`,{timeout:7500});}
 catch{summary.blocker='webview2_cdp_unavailable';return;}
 try{
  // Tauri WebView2 debug targets must belong to the local native application.
  // Never attach a random Chrome tab or an extension iframe.
  const pages=browser.contexts().flatMap(context=>context.pages());
  const page=pages.find(p=>/^https?:\/\/tauri\.localhost(?:[:/]|$)|^tauri:\/\//i.test(p.url()));
  if(!page){summary.blocker='native_tavi_page_not_found';return;}
  const native=await page.evaluate(()=>Boolean(window.__TAURI_INTERNALS__)).catch(()=>false);
  if(!native){summary.blocker='not_a_tauri_webview';return;}
  summary.status='failed';
  const jsErrors=[];
  page.on('pageerror',()=>jsErrors.push('uncaught_page_error'));
  const home=page.locator('[data-action="main-menu"]');
  if(!await home.isVisible().catch(()=>false)){summary.blocker='signed_in_home_required';summary.status='blocked';return;}
  // Exercise the true native app's messenger menus before launching an extension.
  const menuEntries=page.locator('.menubar .menu-drop');
  if(await menuEntries.count()>=5){
   await menuEntries.nth(0).locator('summary').click();
   await menuEntries.nth(4).locator('summary').click();
   const openCount=await page.locator('.menubar .menu-drop[open]').count();
   if(openCount!==1)throw Error('menu_exclusivity_failed');
   await page.keyboard.press('Escape');
   if(await page.locator('.menubar .menu-drop[open]').count())throw Error('menu_escape_failed');
   record('native_exclusive_menus','passed');
  }else throw Error('native_menu_missing');
  const legacyCount=await page.locator('.games-strip, .roster-search, .roster-toolbar').count();
  if(legacyCount)throw Error('legacy_roster_controls_returned');
  record('compact_messenger_home','passed');
  await home.click();await page.locator('.tavi-menu-grid').waitFor({state:'visible',timeout:5000});record('home_to_apps','passed');
  await page.locator('.tavi-menu-grid [data-action="app-store"]').click();
  await page.locator('.tavi-app-store').waitFor({state:'visible',timeout:5000});record('app_store','passed');
  await page.locator('.tavi-shell-bar__back[data-action="minimize-view"]').click();
  await home.waitFor({state:'visible',timeout:5000});record('return_home','passed');
  const dimensions=await page.evaluate(()=>({view:document.documentElement.clientWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth}));
  if(dimensions.document>dimensions.view+2||dimensions.body>dimensions.view+2)throw Error('horizontal_overflow');
  record('no_horizontal_overflow','passed');
  const theme=await page.locator('html').getAttribute('data-theme');
  if(!['light','dark'].includes(theme))throw Error('invalid_theme');record('theme_'+theme,'passed');
  // Screenshot disabled by default: an authenticated messenger may display PII.
  if(preflight.capture){await page.screenshot({path:join(artifacts,'qa-home.png'),fullPage:false});record('explicit_qa_screenshot','passed');}
  if(jsErrors.length)throw Error('javascript_page_error');
  summary.status='passed';
 }catch(error){record(error.message==='horizontal_overflow'?'horizontal_overflow':error.message==='javascript_page_error'?'javascript_page_error':'navigation_or_native_check','failed');}
 finally{await browser.close().catch(()=>{});}
}
try{await main();}catch{summary.status='failed';record('unexpected_native_qa_error','failed');}
await writeReport();
if(summary.status!=='passed'){console.error(`TAVI_NATIVE_QA_${summary.status.toUpperCase()}: ${summary.blocker||'See local report.json'}`);process.exitCode=1;}
else console.log('PASS: real Tavi Windows WebView2 native QA; report stored locally.');
