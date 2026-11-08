/** Optional, build-configured read-only Assets catalog. Metadata never grants
 * installs, payments, URL fetches from a TaviX iframe or asset entitlements.
 */
const MAX_CATALOG_BYTES=120_000;
const idPattern=/^[a-z0-9][a-z0-9._-]{0,126}$/;
const isObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
export function validateAssetCatalog(raw){
 if(!isObject(raw)||raw.schema!=='tavi.assets.catalog/v1'||!Array.isArray(raw.items)||raw.items.length>150)throw Error('Invalid Tavi Assets catalog');
 const seen=new Set();
 return raw.items.map(item=>{
  if(!isObject(item)||typeof item.id!=='string'||!idPattern.test(item.id)||seen.has(item.id)||
     typeof item.title!=='string'||!item.title.trim()||item.title.length>160||
     typeof item.summary!=='string'||item.summary.length>400||
     typeof item.category!=='string'||!item.category.trim()||item.category.length>80||
     !Array.isArray(item.versions)||item.versions.length<1||item.versions.length>40||
     item.versions.some(v=>!isObject(v)||!/^\d{1,8}\.\d{1,8}\.\d{1,8}$/.test(v.version)))throw Error('Invalid Tavi Assets catalog item');
  seen.add(item.id);
  const latest=[...item.versions].sort((a,b)=>{
   const x=a.version.split('.').map(Number),y=b.version.split('.').map(Number);
   for(let i=0;i<3;i++)if(x[i]!==y[i])return y[i]-x[i];return 0;
  })[0];
  return Object.freeze({id:item.id,title:item.title,summary:item.summary,category:item.category,version:latest.version});
 });
}
export function validateAssetCatalogSource(source){
 if(!source)return null;
 if(typeof source!=='string'||source.length>2048)throw Error('Invalid Assets catalog URL');
 const url=new URL(source);
 if(url.protocol!=='https:'||url.username||url.password||url.hash||url.port)throw Error('Assets catalog must use clean HTTPS URL');
 return url.href;
}
export async function fetchAssetCatalog(source,{fetcher=fetch,signal}={}){
 const approved=validateAssetCatalogSource(source);
 if(!approved)return {state:'not-configured',items:[]};
 const response=await fetcher(approved,{credentials:'omit',redirect:'error',cache:'no-store',signal});
 if(!response.ok)throw Error('Assets catalog unavailable');
 if(response.headers?.get('content-length')&&Number(response.headers.get('content-length'))>MAX_CATALOG_BYTES)throw Error('Assets catalog too large');
 const body=await response.text();
 if(body.length>MAX_CATALOG_BYTES)throw Error('Assets catalog too large');
 return {state:'available',items:validateAssetCatalog(JSON.parse(body))};
}
