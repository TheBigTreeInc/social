// Trusted first-party Wallet selection and balance presentation.
// The Wallet is part of Tavi itself, not an installable account extension.
import {CORE_WALLET_ID} from '../extensions/host.js';

export function filterOptionalApps(entries=[]){return entries.filter(e=>e?.manifest?.id!==CORE_WALLET_ID);}
export function coreWalletFromBundle(entries=[]){
 const entry=entries.find(e=>e?.manifest?.id===CORE_WALLET_ID);
 if(!entry||entry.repositoryUrl||entry.remote||entry.manifest.publisher!=='tavi'||
    entry.manifest.entrypoints?.panel!=='ui/index.html'||
    !entry.manifest.permissions?.includes('ui.panel')||!Array.isArray(entry.files)||!entry.files.length)
  throw Error('The Tavi core Wallet bundle is unavailable or invalid');
 return entry;
}
export function goldStatusLabel(payload){
 if(payload?.schema!=='tavi.wallet/v1'||!Array.isArray(payload.balances))return null;
 const gold=payload.balances.find(e=>e?.currencyId==='gold');
 if(!gold||typeof gold.amount!=='string'||!/^(0|[1-9]\d{0,29})$/.test(gold.amount))return null;
 // Preserve integer precision; do not infer a balance from the refill policy.
 const amount=BigInt(gold.amount).toLocaleString('en-US');
 return {amount,raw:gold.amount};
}
