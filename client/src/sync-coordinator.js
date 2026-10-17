/** Coalesce content-free LoopRD push/WebSocket wake hints. The application's
 * authenticated mailbox remains authoritative: no event payload is trusted.
 * A wake during an in-flight read must trigger one more read, never be dropped.
 */
export function createWakeCoordinator(sync, {isBusy=()=>false, delayMs=200,
    retryMs=500, schedule=(fn,ms)=>setTimeout(fn,ms), cancel=clearTimeout}={}) {
  let pending=false, running=false, timer=null, closed=false;
  const tick=async()=>{
    timer=null;
    if(closed||!pending)return;
    if(running||isBusy()) {timer=schedule(tick,retryMs);return;}
    pending=false;running=true;
    try{await sync();}catch{ /* subsequent periodic recovery remains authoritative */ }
    finally{running=false;if(pending&&!closed&&timer===null)timer=schedule(tick,delayMs);}
  };
  return {
    wake(){if(closed)return false;pending=true;if(timer===null&&!running)timer=schedule(tick,delayMs);return true;},
    close(){closed=true;pending=false;if(timer!==null)cancel(timer);timer=null;},
    get pending(){return pending;}
  };
}
