import type {Balance, LedgerReceipt, ResourceCursor, CurrencyId, MinorUnitAmount} from './index.js';
export interface ServiceCall {
 capability:string;
 operation:string;
 args:Record<string,unknown>;
}
export interface TaviServiceSDK {
 wallet: {
  balance(args:{subject:string;currencyId:CurrencyId}):Promise<Balance>;
  transactions(args:{subject:string}&ResourceCursor):Promise<unknown>;
  transfer(args:{subject:string;recipientSubject:string;currencyId:CurrencyId;amountMinor:MinorUnitAmount;idempotencyKey:string}):Promise<LedgerReceipt>;
  /** Requires a server-side reward issuance policy and service grant. */
  reward(args:{subject:string;currencyId:CurrencyId;amountMinor:MinorUnitAmount;idempotencyKey:string;reason:string}):Promise<LedgerReceipt>;
 };
 pets:{list(args:Record<string,unknown>):Promise<unknown>;get(args:Record<string,unknown>):Promise<unknown>;command(args:Record<string,unknown>):Promise<unknown>};
 contacts:{list(args:Record<string,unknown>):Promise<unknown>};
 messages:{list(args:Record<string,unknown>):Promise<unknown>;send(args:Record<string,unknown>):Promise<unknown>};
 events:{list(args:Record<string,unknown>):Promise<unknown>};
 games:{sessions(args:Record<string,unknown>):Promise<unknown>};
}
/** No authorization is performed inside this SDK; the LoopRD service enforces all grants. */
export declare function createTaviServiceSDK(options:{call:(request:ServiceCall)=>Promise<unknown>}):TaviServiceSDK;
