// A local .tavix file is developer-only. LoopRD grants permissions.developer;
// the account switch opts into showing developer tools. Neither condition alone
// permits importing unreviewed extension code. No localStorage override exists.
export function canInstallLocalTavix(state){
 return state?.connected===true && !!state.api &&
  state.developerAllowed===true && state.developerVisible===true;
}

// Re-query the authenticated LoopRD account before accepting a local file or
// committing it. A revoked grant, stale session, or offline server fails closed.
// This is a client-local development guard; published extensions still require
// the normal independent publisher/repository authorization process.
export async function verifyLocalTavixDeveloperGrant(state,updatePermission){
 if(!canInstallLocalTavix(state))return false;
 const api=state.api;
 try{
  const account=await api.me();
  if(state.api!==api||state.connected!==true)return false;
  updatePermission(account);
  return state.api===api && account?.permissions?.developer===true && canInstallLocalTavix(state);
 }catch{return false;}
}
