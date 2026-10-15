const SAFE_GAME=/^[a-z][a-z0-9-]{0,47}$/;
function safeGames(v){return Array.isArray(v)?[...new Set(v.filter(x=>typeof x==='string'&&SAFE_GAME.test(x)))].slice(0,20):[];}
function maps(input){const out={};if(input&&typeof input==='object'&&!Array.isArray(input))for(const [server,games] of Object.entries(input)){
  try{if(new URL(server).origin===server)out[server]=safeGames(games);}catch{}
}return out;}
export function readConfig(storage = localStorage) {
 try {
  const json=JSON.parse(storage.getItem('looprd.social.client.config.v1')||'{}');
  const server=typeof json.server==='string'?json.server:'';
  const gamesByServer=maps(json.gamesByServer);
  if(server&&!Object.hasOwn(gamesByServer,server))gamesByServer[server]=safeGames(json.games);
  return {server,games:gamesByServer[server]||[],gamesByServer};
 }catch{return {server:'',games:[],gamesByServer:{}};}
}
export function selectServerGames(config,server){
 if(!config.gamesByServer)config.gamesByServer={};
 if(config.server)config.gamesByServer[config.server]=safeGames(config.games);
 config.server=server;
 config.games=safeGames(config.gamesByServer[server]);
 return config;
}
export function writeConfig(config,storage = localStorage){
 if(!config.gamesByServer)config.gamesByServer={};
 if(config.server)config.gamesByServer[config.server]=safeGames(config.games);
 storage.setItem('looprd.social.client.config.v1',JSON.stringify({server:config.server,games:config.games,gamesByServer:config.gamesByServer}));
}
export function portraitStorageKey(origin, profileId) { return `portrait-code-v1:${origin}:${profileId}`; }
export function seenStorageKey(origin, game, profileId) { return `turn-seen-v1:${origin}:${game}:${profileId}`; }
export function previousTurnKeys(storage, key) {
 try { const v=JSON.parse(storage.getItem(key)||'[]');return Array.isArray(v)?v.filter(x=>typeof x==='string').slice(0,150):[];}
 catch{return [];}
}
