/** LoopRD reports.bugs/v1: explicit user-consented, credential-free reports. */
export const REPORT_API='looprd-bugreport/v1';
export const REPORT_COMPONENT='looprd-social';
const PUBLIC_GUEST='tavi_guest_v1'; // Public, verifier-scoped guest marker, not a password.
export function reportEndpoint(origin){
  const u=new URL(origin);
  if(u.protocol!=='https:' && !(u.protocol==='http:' && ['localhost','127.0.0.1'].includes(u.hostname)))throw Error('Use an HTTPS LoopRD server.');
  if(u.username||u.password||u.search||u.hash||u.pathname!=='/')throw Error('Enter the LoopRD server origin only.');
  return `${u.origin}/looprd/${REPORT_COMPONENT}/v1/_bugreports`;
}
export function reportPayload({version,platform,stage='login',code='LOGIN_FAILED',note=''}){
  const cleanStage=['discovery','login','session'].includes(stage)?stage:'login';
  const cleanCode=/^[A-Z_]{2,40}$/.test(code)?code:'LOGIN_FAILED';
  // Only controlled fields; never serialize exception messages, request bodies, usernames, URLs or credentials.
  const cleanNote=String(note).trim().slice(0,400);
  return {apiVersion:REPORT_API,appVersion:version,category:'authentication',errorCode:cleanCode,
    message:`Tavi ${cleanStage} failed${cleanNote?': '+cleanNote:''}`,platform,
    diagnostics:{stage:cleanStage,client:'Tavi',authenticated:false}};
}
export async function sendBugReport({origin,version,platform,stage,code,note='',fetcher=fetch}){
  const endpoint=reportEndpoint(origin);
  const payload=reportPayload({version,platform,stage,code,note});
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),12000);
  try{
    const response=await fetcher(endpoint,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${PUBLIC_GUEST}`},body:JSON.stringify(payload),cache:'no-store',signal:controller.signal});
    if(response.status!==202)throw Error(response.status===401?'Reporting is not permitted by this LoopRD deployment.':response.status===404?'This LoopRD server does not support bug reports yet.':`Report not accepted (HTTP ${response.status}).`);
    const result=await response.json();
    if(typeof result?.id!=='string' || !result.id)throw Error('LoopRD did not return a report ID.');
    return {id:result.id,deduplicated:result.deduplicated===true};
  }catch(e){if(e.name==='AbortError')throw Error('Report submission timed out.');throw e;}
  finally{clearTimeout(timeout);}
}
