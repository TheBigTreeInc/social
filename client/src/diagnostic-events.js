/** Privacy-first bounded client diagnostics: never store requests, origins or payloads. */
export function createDiagnosticEvents({limit=32,clock=()=>new Date().toISOString()}={}) {
 const items=[];
 const allowed=new Set(['repository','catalog','extension','navigation','network','application']);
 const categories=new Set(['ok','http','cors_or_network','timeout','validation','unavailable','blocked','error']);
 return {
  record({area,operation,result,status}={}) {
   if(!allowed.has(area)||typeof operation!=='string'||!/^[a-z][a-z0-9_.-]{0,45}$/.test(operation)||!categories.has(result))return false;
   const code=Number.isInteger(status)&&status>=100&&status<=599?status:null;
   items.push({at:clock(),area,operation,result,...(code!==null?{httpStatus:code}:{})});
   while(items.length>Math.min(100,Math.max(1,limit)))items.shift();
   return true;
  },
  snapshot:()=>items.map(x=>({...x})),clear:()=>{items.length=0;}
 };
}
/** Deliberately process only allowlisted data and never interpolate exception text/URLs. */
export function classifyFetchFailure(error) {
 const message=String(error?.message||'');
 const match=message.match(/\((\d{3})\)/);
 if(match){const status=Number(match[1]);return {result:'http',status};}
 if(/abort|timeout/i.test(error?.name||'')||/timed?\s*out/i.test(message))return {result:'timeout'};
 if(/invalid|schema|duplicate|manifest|json|license|icon|entrypoint|publisher/i.test(message))return {result:'validation'};
 return {result:'cors_or_network'};
}
export function diagnosticsQuickSummary(report){
 return ['Tavi '+report.client.version+' ('+report.client.platform+')',
 'Connection: '+(report.connection.connected?'connected':'disconnected')+'; pulse '+report.connection.pulseState,
 'Panel: '+report.navigation.panel+'; extensions: '+report.integrations.extensions.filter(x=>x.installed&&x.enabled).length+' enabled',
 'Atrium: '+report.integrations.atriumDiscoveryStatus+'; configured '+report.integrations.atriumConfigured,
 'Repository checks: '+(report.integrations.repositoryChecks?.length||0),
 ...(report.integrations.repositoryChecks||[]).map(x=>'  '+x.source+': '+x.result+(x.httpStatus?' HTTP '+x.httpStatus:'')),
 'Events: '+(report.recentEvents?.length||0)+' (no identifiers or credentials)'].join('\n');
}
