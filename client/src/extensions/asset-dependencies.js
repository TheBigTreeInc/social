/** TaviX 0.1.11 assetDependencies/v1 request validation.
 * A dependency is a request, NEVER a grant or entitlement.
 * Keep in step with contracts/tavix-asset-dependencies-v1.schema.json.
 */
const PACK=/^[a-z0-9][a-z0-9._-]{0,126}$/;
const CAP=/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const VER=/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;
const ASSET_PERMS=new Set(['assets.read','assets.preferences.write']);
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const keys=(o,allowed)=>Object.keys(o).every(key=>allowed.includes(key));
export const assetVersionCompare=(a,b)=>{
 if(!VER.test(a)||!VER.test(b))throw Error('Invalid asset version');
 const x=a.split('.').map(BigInt),y=b.split('.').map(BigInt);
 for(let i=0;i<3;i++){if(x[i]!==y[i])return x[i]>y[i]?1:-1;}return 0;
};
export function validateAssetDependencies(manifest){
 if(!plain(manifest)||!Array.isArray(manifest.permissions))throw Error('Invalid asset permissions');
 const permissions=new Set(manifest.permissions);
 if(manifest.assetDependencies===undefined){
  if([...ASSET_PERMS].some(p=>permissions.has(p)))throw Error('Asset permissions require assetDependencies');
  return [];
 }
 const list=manifest.assetDependencies;
 if(!Array.isArray(list)||list.length<1||list.length>16||!permissions.has('assets.read'))throw Error('Invalid asset dependencies or missing assets.read permission');
 const seen=new Set(),allCaps=new Set();let customize=false;
 for(const dep of list){
  if(!plain(dep)||!keys(dep,['packId','compatibility','capabilities','optional','requestCustomization'])||
   !Object.hasOwn(dep,'packId')||!Object.hasOwn(dep,'compatibility')||!Object.hasOwn(dep,'capabilities')||!Object.hasOwn(dep,'optional'))throw Error('Invalid asset dependency fields');
  if(typeof dep.packId!=='string'||!PACK.test(dep.packId)||seen.has(dep.packId))throw Error('Invalid or duplicate asset pack');
  seen.add(dep.packId);
  if(!plain(dep.compatibility)||!keys(dep.compatibility,['min','maxExclusive'])||
   !Object.hasOwn(dep.compatibility,'min')||!Object.hasOwn(dep.compatibility,'maxExclusive')||
   typeof dep.compatibility.min!=='string'||typeof dep.compatibility.maxExclusive!=='string'||
   !VER.test(dep.compatibility.min)||!VER.test(dep.compatibility.maxExclusive)||
   assetVersionCompare(dep.compatibility.min,dep.compatibility.maxExclusive)>=0)throw Error('Invalid asset compatibility range');
  if(!Array.isArray(dep.capabilities)||dep.capabilities.length<1||dep.capabilities.length>32||
   dep.capabilities.some(c=>typeof c!=='string'||!CAP.test(c))||
   new Set(dep.capabilities).size!==dep.capabilities.length)throw Error('Invalid asset capabilities');
  dep.capabilities.forEach(c=>allCaps.add(c));if(allCaps.size>256)throw Error('Too many asset capabilities');
  if(typeof dep.optional!=='boolean'||(dep.requestCustomization!==undefined&&typeof dep.requestCustomization!=='boolean'))throw Error('Invalid asset optional/customization flag');
  customize||=dep.requestCustomization===true;
 }
 if(customize!==permissions.has('assets.preferences.write'))throw Error('Asset customization and assets.preferences.write must agree');
 return list.map(dep=>({packId:dep.packId,compatibility:{...dep.compatibility},capabilities:[...dep.capabilities],optional:dep.optional,requestCustomization:dep.requestCustomization===true}));
}
/** Pure structural/subset check of a host-created ephemeral projection.
 * Not an approval mechanism: the host MUST also verify its own session,
 * installation, local consent, ownership and installed pack versions.
 */
export function validateAssetGrantProjection(manifest,verifiedSha256,projection){
 const deps=validateAssetDependencies(manifest);
 if(!plain(projection)||!keys(projection,['schema','extensionId','extensionVersion','manifestSha256','scope','grants'])||Object.keys(projection).length!==6||
  projection.schema!=='tavix.asset-grants/v1'||projection.scope!=='host-session'||
  projection.extensionId!==manifest.id||projection.extensionVersion!==manifest.version||
  !/^[a-f0-9]{64}$/.test(verifiedSha256)||projection.manifestSha256!==verifiedSha256||
  !Array.isArray(projection.grants)||projection.grants.length>16)throw Error('Invalid host asset grant projection');
 const requested=new Map(deps.map(dep=>[dep.packId,dep]));const seen=new Set();
 for(const g of projection.grants){
  if(!plain(g)||Object.keys(g).length!==3||!keys(g,['packId','capabilities','canCustomize'])||
   !requested.has(g.packId)||seen.has(g.packId)||!Array.isArray(g.capabilities)||g.capabilities.length<1||g.capabilities.length>32||
   new Set(g.capabilities).size!==g.capabilities.length||g.capabilities.some(c=>!requested.get(g.packId).capabilities.includes(c))||
   typeof g.canCustomize!=='boolean'||(g.canCustomize&&(!requested.get(g.packId).requestCustomization||!manifest.permissions.includes('assets.preferences.write'))))throw Error('Invalid per-pack host grant');
  seen.add(g.packId);
 }
 return projection;
}
