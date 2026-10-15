export function readConfig(storage = localStorage) {
  try {
    const json = JSON.parse(storage.getItem('looprd.social.client.config.v1') || '{}');
    const games = Array.isArray(json.games) ? json.games.filter(x => /^[a-z][a-z0-9-]{0,47}$/.test(x)).slice(0, 20) : [];
    return {server: typeof json.server === 'string' ? json.server : '', games: [...new Set(games)]};
  } catch { return {server:'',games:[]}; }
}
export function writeConfig(config, storage = localStorage) {
  storage.setItem('looprd.social.client.config.v1', JSON.stringify({server:config.server, games:config.games}));
}
export function portraitStorageKey(origin, profileId) { return `portrait-code-v1:${origin}:${profileId}`; }
export function seenStorageKey(origin, game, profileId) { return `turn-seen-v1:${origin}:${game}:${profileId}`; }
export function previousTurnKeys(storage, key) {
  try { const v = JSON.parse(storage.getItem(key) || '[]'); return Array.isArray(v) ? v.filter(x => typeof x === 'string').slice(0, 150) : []; }
  catch { return []; }
}
