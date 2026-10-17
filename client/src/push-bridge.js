import {validPushWakeup} from './push-readiness.js';
/** Trusted native UnifiedPush receiver adapter. The content-free LoopRD hint
 * has no event ID; throttle bursts, then perform authenticated synchronization.
 * Registration and closed-app delivery require the native Android distributor.
 */
export function createPushWakeupBridge(sync,{maxRecent=128,minIntervalMs=1500,now=()=>Date.now()}={}){
  let last=Number.NEGATIVE_INFINITY;
  return function onWakeup(value,{signedIn=false}={}){
    if(!signedIn||!validPushWakeup(value))return false;
    const time=now();
    if(time-last<minIntervalMs)return false;
    last=time;
    Promise.resolve().then(sync).catch(()=>{});
    return true;
  };
}
