/** Throttle foreground recovery after a phone resumes or a window regains focus.
 * Normal WebSocket/polling remains authoritative while the client is running.
 */
export function createResumeSync(sync, {minIntervalMs=4000, now=()=>Date.now()}={}) {
  let last=Number.NEGATIVE_INFINITY;
  return function resume({signedIn=false, visible=true}={}) {
    if (!signedIn || !visible) return false;
    const instant=now();
    if (instant-last<minIntervalMs) return false;
    last=instant;
    Promise.resolve().then(sync).catch(()=>{}); // network outage must not crash focus events
    return true;
  };
}
