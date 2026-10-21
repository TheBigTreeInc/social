/** Cross-realm identifier; NEVER infer another realm from matching subject strings. */
export type RealmId = string;
export type CurrencyId = string;
export type MinorUnitAmount = string;
export interface ResourceCursor { cursor?:string; limit?:number }
export interface Balance { currencyId: CurrencyId; postedMinor: MinorUnitAmount; availableMinor: MinorUnitAmount; revision:number; cursor:string }
export interface LedgerReceipt { schema:'tavi.ledger-receipt/v1'; transactionId:string; idempotencyKey:string; currencyId:CurrencyId; amountMinor:MinorUnitAmount; status:'posted'|'rejected'|'pending'; journalRevision:number; eventCursor:string }
export interface TaviExtensionSDK {
  info(): Promise<{api:string;extensionId:string;features?:string[]}>;
  /** Only implemented, currently granted host capabilities are returned. */
  capabilities():Promise<string[]>;
  storage: {get(key:string):Promise<string|null>;set(key:string,value:string):Promise<void>};
  ui: {toast(message:string):Promise<void>;close():Promise<void>;/** First-party Atrium only: asks Tavi to display a Life Open/Cancel gate. */requestGameLaunch(handoff:{schema:'atrium.tavi-launch/v1';gameId:'life.loop';target:string;matchContext:{matchId:string}}):Promise<{awaitingApproval:boolean}>};
  /** First-party bundled Wallet only. Other extension IDs are denied by the host. */
  wallet: {
    balance():Promise<{schema:'tavi.wallet/v1';balances:{currencyId:string;amount:string}[];currencies:unknown[];rates:unknown[];offers:unknown[];faucet:unknown}>;
    transactions(params?:{limit?:number}):Promise<unknown>;
    claim(params:{requestId:string}):Promise<unknown>;
    convert(params:{from:string;to:string;amount:MinorUnitAmount;requestId:string;expectedNumerator:string;expectedDenominator:string}):Promise<unknown>;
    purchase(params:{sku:string;requestId:string;expectedPrice:string;expectedCurrency:string;expectedMerchant:string}):Promise<unknown>;
    orderStatus(params:{orderId:number}):Promise<unknown>;
    /** Not implemented: arbitrary user-to-user transfers remain denied. */
    transfer(params:{recipientSubject:string;currencyId:CurrencyId;amountMinor:MinorUnitAmount;idempotencyKey:string;reason?:string}):Promise<LedgerReceipt>;
  };
  /** Planned: separate Companions LoopRD component and per-pet revision validation. */
  pets: {list(params?:ResourceCursor):Promise<unknown>;get(params:{petId:string}):Promise<unknown>;command(params:{petId:string;action:string;expectedRevision:number;idempotencyKey:string}):Promise<unknown>};
  /** Planned: explicit per-user contacts.read grant. */
  contacts: {list(params?:ResourceCursor):Promise<unknown>};
  /** Planned: restricted conversation grants, NOT automatic full-inbox read access. */
  messages: {list(params:{peerId:string}&ResourceCursor):Promise<unknown>;send(params:{peerId:string;content:string;idempotencyKey:string}):Promise<unknown>};
  /** Planned: event replay, per-realm and per-resource grant filtering. */
  events: {list(params?:ResourceCursor & {resourceId?:string}):Promise<unknown>};
  /** Planned: public capability descriptors only, never a service credential. */
  services: {list():Promise<unknown>};
  dispose(): void;
}
export declare function createTaviExtensionSDK(target?:Window,source?:Window):TaviExtensionSDK;
