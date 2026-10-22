/** Companion is a reviewed bundled partner, NOT a first-party/core module.
 * No account/credentials/game state leaves the isolated extension.
 */
import {REVIEWED_COMPANION} from './reviewed-companion.js';
export const COMPANION_PREVIEW_SCHEMA='tavi.companion.preview/v1';
const PNG=/^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/;
const PREFIX='tavi.companion.preview/v1:';
const PNG_MAGIC=[137,80,78,71,13,10,26,10];
export function validateCompanionPreview(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join('|')!=='form|image|name|schema'||value.schema!==COMPANION_PREVIEW_SCHEMA)throw Error('Invalid Companion preview schema');
 if(!['cat','unicorn'].includes(value.form)||typeof value.name!=='string'||value.name.length>32||/[\x00-\x1f\x7f]/.test(value.name))throw Error('Invalid Companion name or form');
 if(typeof value.image!=='string'||value.image.length>90000)throw Error('Companion PNG too large');
 const match=PNG.exec(value.image);if(!match)throw Error('Companion preview must be an inline PNG');
 let decoded;try{decoded=atob(match[1]);}catch{throw Error('Invalid Companion PNG encoding');}
 const bytes=Uint8Array.from(decoded,c=>c.charCodeAt(0));
 if(bytes.length<60||PNG_MAGIC.some((n,i)=>bytes[i]!==n)||String.fromCharCode(...bytes.slice(12,16))!=='IHDR')throw Error('Invalid Companion PNG header');
 const width=((bytes[16]*16777216)+(bytes[17]<<16)+(bytes[18]<<8)+bytes[19])>>>0;
 const height=((bytes[20]*16777216)+(bytes[21]<<16)+(bytes[22]<<8)+bytes[23])>>>0;
 if(width!==80||height!==80)throw Error('Companion preview must be 80x80');
 if(String.fromCharCode(...bytes.slice(-8,-4))!=='IEND')throw Error('Incomplete PNG');
 return {schema:COMPANION_PREVIEW_SCHEMA,form:value.form,name:value.name,image:value.image};
}
export function previewStorageKey(scope){
 if(typeof scope!=='string'||!scope.startsWith('tavi.extensions.install/v1:')||scope.length>2000)throw Error('Invalid Companion account scope');
 return PREFIX+REVIEWED_COMPANION.sha256+':'+scope;
}
export function readCompanionPreview(storage,scope){
 try{return validateCompanionPreview(JSON.parse(storage.getItem(previewStorageKey(scope))||'null'));}catch{return null;}
}
export function clearCompanionPreview(storage,scope){
 try{storage.removeItem(previewStorageKey(scope));}catch{}
}
