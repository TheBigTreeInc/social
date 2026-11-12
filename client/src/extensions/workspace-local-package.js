/** Load an already approved local TaviX archive in a trusted native host shell.
 * The iframe receives only verified manifest and assets, not account scope,
 * IndexedDB access, local archive metadata, or session credentials.
 */
import {loadLocalTavix} from './local-package.js';
const ID=/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+){2,}$/;
const DIGEST=/^[a-f0-9]{64}$/;
export async function loadWorkspaceLocalPackage({id,scope,revision},{read=loadLocalTavix}={}){
 if(typeof id!=='string'||id.length>120||!ID.test(id)||
    typeof scope!=='string'||!scope||scope.length>300||
    typeof revision!=='string'||!DIGEST.test(revision))throw Error('Invalid local workspace grant');
 const record=await read(scope,id);
 if(record?.schema!=='tavi.local-package/v1'||record?.manifest?.id!==id||record.revision!==revision||
    !record.assets||typeof record.assets!=='object')throw Error('Local workspace package is missing or changed');
 return {schema:'tavi.local-package/v1',manifest:record.manifest,assets:record.assets};
}
