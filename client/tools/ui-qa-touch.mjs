// Shared browser-safe touch-target snapshot. A zero-area element means the
// asynchronous roster is not laid out yet, NOT that its hit target is 0px.
// Playwright runs this function in the page; Node tests pass a fake document.
export function snapshotTouchTargets(doc) {
  const documentRef = doc || document;
  const section = documentRef.querySelector('.tavi-roster-merged > .group-title');
  const peers = [...documentRef.querySelectorAll('.tavi-roster-merged .buddy')];
  if (!section || !peers.length) return null;
  const measure = element => {
    if (!element.isConnected) return null;
    const rect = element.getBoundingClientRect();
    const style = documentRef.defaultView.getComputedStyle(element);
    if (!rect.width || !rect.height || style.display === 'none' || style.visibility !== 'visible') return null;
    return {height: Math.round(rect.height), width: Math.round(rect.width), cssMinHeight: style.minHeight};
  };
  const sizes = [measure(section), ...peers.map(measure)];
  // Missing/hidden during a refresh: Playwright retries rather than claiming
  // the touch target is too small. A visible 30px control is still a failure.
  if (sizes.some(item => item === null)) return null;
  return {section: sizes[0], buddies: sizes.slice(1)};
}
