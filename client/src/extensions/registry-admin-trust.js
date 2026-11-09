/** Operator-reviewed digest allowlist. Empty by default on purpose: no Asset
 * Studio artifact has yet been approved. Never infer trust from an ID, publisher,
 * manifest permission, user preference or sideloaded developer preview.
 * Add exact repository SOURCE + SHA-256 + version only after operator acceptance.
 */
export const ASSET_STUDIO_APP_ID='org.tavi.tools.asset-studio';
export const APPROVED_ASSET_STUDIO_RELEASES=Object.freeze([]);
const SHA=/^[a-f0-9]{64}$/;
export function trustedAssetStudioInstall({id,version,source,revision,publisher,permissions,
  accountAdmin,enabled,verified,scope,accountScope}={}){
 if(id!==ASSET_STUDIO_APP_ID||publisher!=='tavi'||enabled!==true||verified!==true||
    accountAdmin!==true||scope!==accountScope||!Array.isArray(permissions)||
    !permissions.includes('ui.panel')||!permissions.includes('assets.registry.admin/v1')||
    !SHA.test(revision||'')||typeof source!=='string'||!source.startsWith('https://'))return false;
 return APPROVED_ASSET_STUDIO_RELEASES.some(a=>
   a.id===id&&a.version===version&&a.source===source&&a.sha256===revision&&a.publisher===publisher);
}
