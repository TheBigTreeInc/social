#!/usr/bin/env node
/**
 * TAVI-ATRIUM-056: operator-run read-only Tavi/Social discovery acceptance.
 * No secret is accepted as a CLI argument. No private URL, bearer, raw response,
 * or service credential appears in logs/reports. Live execution is opt-in.
 */
import {pathToFileURL} from 'node:url';
import {LooprdSocial,discoverAtriumGames} from '../client/sdk/looprd-social.js';

export async function checkTaviAtrium({origin,token,expected='life.loop',absent=false,fetcher=globalThis.fetch}={}) {
  if(!/^[a-z][a-z0-9.-]{2,119}$/.test(expected))throw Error('Invalid expected game identifier');
  // LooprdSocial uses the same authentication and URL validation as the Tavi app.
  const api=new LooprdSocial(origin,token,fetcher);
  const catalog=await discoverAtriumGames(api);
  if(catalog.status!=='connected')throw Error('Atrium discovery is not connected');
  const found=catalog.games.find(g=>g.gameId===expected);
  if(absent===Boolean(found))throw Error(absent?'Withdrawn title remains in discovery':'Expected title is missing from discovery');
  return Object.freeze({status:'connected',expected,found:!!found,gameCount:catalog.games.length,
    title:found?.title||null,playable:false});
}

async function main() {
  const args=process.argv.slice(2);
  if(args.length<2||args.length>3||args[0]!=='--origin'||(args[2]&&args[2]!=='--expect-absent')){
    throw Error('Usage: node tools/verify-atrium-live.mjs --origin https://your-approved-looprd-host [--expect-absent]');
  }
  if(!process.env.TAVI_SOCIAL_QA_TOKEN)throw Error('TAVI_SOCIAL_QA_TOKEN is missing (use a disposable signed-in Social test session)');
  const result=await checkTaviAtrium({origin:args[1],token:process.env.TAVI_SOCIAL_QA_TOKEN,absent:args[2]==='--expect-absent'});
  console.log(`PASS TAVI-ATRIUM-056: connected; ${result.expected} ${result.found?'discovered':'withdrawn'}; reviewed game count ${result.gameCount}; discovered entries remain non-playable.`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  main().catch(()=>{console.error('FAIL TAVI-ATRIUM-056: Social discovery not verified. Check server configuration, Atrium trusted observations, or the disposable test account. No credentials logged.');process.exitCode=1;});
}
