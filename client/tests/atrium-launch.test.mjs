import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {atriumLauncher,reviewedAtriumBase} from '../src/atrium-launch.js';
const read=path=>readFile(new URL(path,import.meta.url),'utf8');
test('Atrium accepts reviewed HTTPS Pages and operator custom subpath, not local or credential URLs',()=>{
 for(const url of ['https://thebigtreeinc.github.io/atrium/','https://games.example.org/','https://games.example.org/atrium/'])
  assert.equal(reviewedAtriumBase(url),url);
 for(const url of [null,undefined,'','http://games.example.org/','https://localhost/','https://server.internal/','https://host.local/',
   'https://192.168.1.1/','https://127.0.0.1/','https://[::1]/','https://admin:pass@games.example.org/',
   'https://games.example.org/?token=123','https://games.example.org/#jump','https://games.example.org/\\evil/',
   'https://games.example.org/atrium','https://games.example.org:8443/','javascript:alert(1)'])
  assert.equal(reviewedAtriumBase(url),null,String(url));
});
test('unconfigured Atrium is an explicit disabled launcher, not a second catalog',()=>{
 const no=atriumLauncher(null),yes=atriumLauncher('https://thebigtreeinc.github.io/atrium/');
 assert.equal(no.available,false);assert.equal(no.url,null);assert.match(no.detail,/not been connected/);
 assert.equal(yes.available,true);assert.match(yes.detail,/Chat stays open/);
 assert(Object.isFrozen(yes));
});
test('Windows Games shows explicit Atrium destination and keeps the old challenge flow separate',async()=>{
 const code=await read('../src/main.js');
 assert.match(code,/atriumLauncher\(state\.atriumUrl\)/);
 assert.match(code,/Open Atrium/);
 assert.match(code,/Find Atrium in Apps/);
 assert.match(code,/Browse website/);
 assert.match(code,/data-action="atrium"/);
 assert.match(code,/Play with friends/);
 assert.match(code,/data-challenge-game/);
 assert.match(code,/challengeContact\(peer,gameId\)/);
 assert.match(code,/reviewedAtriumBase\(state\.atriumUrl\)/);
 assert.match(code,/await openExternalGame\(url\)/);
 assert.doesNotMatch(code,/atrium.*[?&]token=/i);
});
