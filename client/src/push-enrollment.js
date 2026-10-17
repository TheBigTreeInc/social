/** Device enrollment orchestration for the real LoopRD UnifiedPush protocol.
 * Native Android distributor integration must supply the endpoint and challenge.
 * No credentials, endpoints, or challenges are persisted by this module.
 */
export async function enrollPushDevice(api,{installationId,endpoint,consented}={}){
  if(!consented)throw new Error('Background notifications require explicit consent.');
  const result=await api.registerPushDevice(installationId,endpoint);
  if(!result || !['pending','active'].includes(result.status) || typeof result.id!=='string')
    throw new Error('LoopRD returned invalid device status.');
  return {id:result.id,status:result.status,expiresAt:result.expiresAt,
    verificationExpiresAt:result.verificationExpiresAt??null};
}
export async function confirmPushDevice(api,{deviceId,challenge}={}){
  const result=await api.verifyPushDevice(deviceId,challenge);
  if(result?.status!=='active')throw new Error('LoopRD did not activate the device.');
  return {id:result.id,status:'active',expiresAt:result.expiresAt};
}
export async function revokePushDevice(api,deviceId){
  const result=await api.removePushDevice(deviceId);
  return result?.removed===true;
}
