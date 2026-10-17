import test from 'node:test';
import assert from 'node:assert/strict';
import {parseVersion,newerRelease,checkTaviRelease,RELEASES_URL,androidApkAsset,updateDismissKey} from '../src/release-updates.js';
test('semantic version comparison is numeric and strictly newer',()=>{
 assert.deepEqual(parseVersion('v0.3.35'),[0,3,35]);
 assert.equal(newerRelease('0.3.9','v0.3.10'),true);
 assert.equal(newerRelease('0.3.35','v0.3.35'),false);
 assert.equal(newerRelease('0.4.0','v0.3.99'),false);
 assert.equal(newerRelease('0.3.35','not-a-version'),false);
});
test('release discovery returns fixed trusted download destination',async()=>{
 const result=await checkTaviRelease('0.3.32',{fetcher:async()=>({ok:true,json:async()=>({tag_name:'v0.3.35',html_url:'https://evil.example/download'})})});
 assert.deepEqual(result,{version:'0.3.35',available:true,url:RELEASES_URL,androidUrl:null});
});
test('draft, prerelease and failed requests cannot advertise an update',async()=>{
 await assert.rejects(checkTaviRelease('0.3.32',{fetcher:async()=>({ok:true,json:async()=>({tag_name:'v0.3.35',prerelease:true})})}));
 await assert.rejects(checkTaviRelease('0.3.35',{fetcher:async()=>({ok:false,status:403})}));
});

test('Android release asset must be a direct signed APK from the official versioned release',()=>{
 const valid={tag_name:'v0.3.35',assets:[{name:'tavi-android-arm64-v0.3.35.apk',size:12345678,browser_download_url:'https://github.com/TheBigTreeInc/social/releases/download/v0.3.35/tavi-android-arm64-v0.3.35.apk'}]};
 assert.equal(androidApkAsset(valid),valid.assets[0].browser_download_url);
 assert.equal(androidApkAsset({...valid,assets:[{...valid.assets[0],browser_download_url:'https://evil.example/app.apk'}]}),null);
 assert.equal(androidApkAsset({...valid,assets:[{...valid.assets[0],size:0}]}),null);
 assert.equal(updateDismissKey('0.3.35'),'tavi.update.dismissed.0.3.35');
});
