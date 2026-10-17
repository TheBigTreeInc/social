/** Recover only sessions already saved on this device.
 * 401 means the Social credential is invalid; other failures never erase it.
 * 403 is a permission/configuration denial and requires manual retry rather
 * than repeated background attempts. Retry scheduling is bounded and cancellable.
 */
export function classifySessionFailure(error) {
  if (error?.status === 401) return 'rejected';
  if (error?.status === 403) return 'blocked';
  return 'temporary';
}

export function createSessionRetry({retry, schedule=setTimeout, cancel=clearTimeout,
    initialDelayMs=8000, maxDelayMs=60000} = {}) {
  if (typeof retry !== 'function') throw Error('Retry callback required');
  let armed = false;
  let timer = null;
  let running = false;
  let delay = initialDelayMs;
  function plan() {
    if (!armed || running || timer !== null) return;
    const wait = delay;
    delay = Math.min(maxDelayMs, delay * 2);
    timer = schedule(() => {
      timer = null;
      void trigger().catch(()=>{});
    }, wait);
  }
  function disable() {
    armed = false;
    delay = initialDelayMs;
    if (timer !== null) { cancel(timer); timer = null; }
  }
  function enable() {
    armed = true;
    plan();
  }
  async function trigger() {
    if (!armed || running) return false;
    if (timer !== null) { cancel(timer); timer = null; }
    running = true;
    try { await retry(); }
    finally { running = false; plan(); }
    return true;
  }
  return {enable,disable,trigger,get enabled(){return armed;}};
}
