/** Pinned by Tavi's reviewed source registry, not by untrusted iframe messages.
 * Change only when publishing a new approved bundled partner in Tavi source.
 */
export const REVIEWED_COMPANION=Object.freeze({
  id:'org.tavi.community.companion',publisher:'tavi-community',
  version:'0.6.11',sha256:'e979fd0c473167c64106fa59c45eae366692b6d2cf2d2ab0c3bcc0fdeb9b11a6'
});
/** Confirm catalog metadata corresponds EXACTLY to the reviewed source digest.
 * verifyBundledExtension separately checks every published asset byte.
 */
export async function verifyReviewedCompanion(entry,{cryptoRef=globalThis.crypto}={}){
 const pinned=REVIEWED_COMPANION,m=entry?.manifest;
 if(entry?.remote||!m||m.id!==pinned.id||m.publisher!==pinned.publisher||m.version!==pinned.version||m.kind!=='app'||!Array.isArray(entry.files)||
  !['ui.panel','ui.toast','storage.private'].every(p=>m.permissions.includes(p)))throw Error('Unreviewed Companion publisher or permissions');
 if(!cryptoRef?.subtle)throw Error('Companion provenance verification unavailable');
 const serial=new TextEncoder().encode(JSON.stringify({manifest:m,files:entry.files})+'\n');
 const sha=Array.from(new Uint8Array(await cryptoRef.subtle.digest('SHA-256',serial)),byte=>byte.toString(16).padStart(2,'0')).join('');
 if(sha!==pinned.sha256)throw Error('Unreviewed Companion release digest');
 return pinned.sha256;
}
