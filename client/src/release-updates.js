/** Public GitHub release discovery. Never downloads or executes binaries. */
export const RELEASE_API='https://api.github.com/repos/TheBigTreeInc/social/releases/latest';
export const RELEASES_URL='https://github.com/TheBigTreeInc/social/releases/latest';
export function parseVersion(value){
 const match=/^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(value||''));
 return match?[Number(match[1]),Number(match[2]),Number(match[3])]:null;
}
export function newerRelease(current,tag){
 const a=parseVersion(current),b=parseVersion(tag);
 if(!a||!b)return false;
 for(let i=0;i<3;i++){if(b[i]!==a[i])return b[i]>a[i];}
 return false;
}
export function androidApkAsset(release){
 const version=String(release?.tag_name||'').replace(/^v/,'');
 if(!parseVersion(version))return null;
 const expected=`tavi-android-arm64-v${version}.apk`;
 const asset=(Array.isArray(release?.assets)?release.assets:[]).find(a=>a.name===expected);
 const expectedUrl=`https://github.com/TheBigTreeInc/social/releases/download/v${version}/${expected}`;
 return asset?.browser_download_url===expectedUrl&&Number(asset.size)>1_000_000?expectedUrl:null;
}
export function updateDismissKey(version){return `tavi.update.dismissed.${version}`;}
export async function checkTaviRelease(current,{fetcher=fetch,signal}={}){
 const response=await fetcher(RELEASE_API,{headers:{Accept:'application/vnd.github+json'},signal});
 if(!response.ok)throw Error(`Release lookup failed (HTTP ${response.status})`);
 const release=await response.json();
 if(release?.draft||release?.prerelease||!parseVersion(release?.tag_name))throw Error('No stable release available');
 return {version:release.tag_name.replace(/^v/,''),available:newerRelease(current,release.tag_name),url:RELEASES_URL,androidUrl:androidApkAsset(release)};
}
