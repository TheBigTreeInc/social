/** TaviX 1.0 application-host SDK. */
export declare const TAVIX_STANDARD:'tavix/1.0';
export declare const TAVIX_CHANNEL:'tavi.extension/v1';
export declare const TAVIX_HOST_API:'1.0.0';
export type RealmId = string;
export type CurrencyId = string;
export type MinorUnitAmount = string;
export interface ResourceCursor { cursor?:string; limit?:number }
export interface Balance { currencyId: CurrencyId; postedMinor: MinorUnitAmount; availableMinor: MinorUnitAmount; revision:number; cursor:string }
export interface LedgerReceipt { schema:'tavi.ledger-receipt/v1'; transactionId:string; idempotencyKey:string; currencyId:CurrencyId; amountMinor:MinorUnitAmount; status:'posted'|'rejected'|'pending'; journalRevision:number; eventCursor:string }
export interface TaviXHostInfo { standard:'tavix/1.0';channel:'tavi.extension/v1';api:string;extensionId:string;mode:'embedded';navigation:'host';features:string[] }
export interface TaviXSurfaceRequest { schema:'tavix.surface/v1';id:string;kind:'application'|'game';target:string;context?:Record<string,unknown>;presentation?:'embedded'|'external'|'auto' }
export interface TaviXSDK {
  info(): Promise<TaviXHostInfo>;
  conformance():Promise<TaviXHostInfo>;
  capabilities():Promise<string[]>;
  navigation:{back():Promise<void>;close():Promise<void>};
  storage:{get(key:string):Promise<string|null>;set(key:string,value:string):Promise<void>};
  ui:{toast(message:string):Promise<void>;/** compatibility alias; prefer navigation.close */close():Promise<void>;/** Legacy first-party Atrium bridge; not part of TaviX core. */requestGameLaunch(handoff:{schema:'atrium.tavi-launch/v1';gameId:'life.loop';target:string;matchContext:{matchId:string}}):Promise<{awaitingApproval:boolean}>};
  /** Optional tavix.surface/v1 module. Call only when host.info().features advertises it. */
  surfaces:{requestOpen(surface:TaviXSurfaceRequest):Promise<unknown>};
  on(event:string,handler:(payload:unknown)=>void):()=>void;
  wallet:{
    balance():Promise<{schema:'tavi.wallet/v1';balances:{currencyId:string;amount:string}[];currencies:unknown[];rates:unknown[];offers:unknown[];faucet:unknown}>;
    transactions(params?:{limit?:number}):Promise<unknown>;claim(params:{requestId:string}):Promise<unknown>;
    convert(params:{from:string;to:string;amount:MinorUnitAmount;requestId:string;expectedNumerator:string;expectedDenominator:string}):Promise<unknown>;
    purchase(params:{sku:string;requestId:string;expectedPrice:string;expectedCurrency:string;expectedMerchant:string}):Promise<unknown>;
    orderStatus(params:{orderId:number}):Promise<unknown>;transfer(params:{recipientSubject:string;currencyId:CurrencyId;amountMinor:MinorUnitAmount;idempotencyKey:string;reason?:string}):Promise<LedgerReceipt>;
  };
  pets:{list(params?:ResourceCursor):Promise<unknown>;get(params:{petId:string}):Promise<unknown>;command(params:{petId:string;action:string;expectedRevision:number;idempotencyKey:string}):Promise<unknown>};
  contacts:{list(params?:ResourceCursor):Promise<unknown>};
  messages:{list(params:{peerId:string}&ResourceCursor):Promise<unknown>;send(params:{peerId:string;content:string;idempotencyKey:string}):Promise<unknown>};
  events:{list(params?:ResourceCursor & {resourceId?:string}):Promise<unknown>};services:{list():Promise<unknown>};dispose():void;
}
export declare function assertTaviXHostInfo(info:unknown):TaviXHostInfo;
export declare function createTaviXSDK(target?:Window,source?:Window):TaviXSDK;
/** Backward-compatible source name for pre-standard applications. */
export declare const createTaviExtensionSDK:typeof createTaviXSDK;
export type TaviExtensionSDK=TaviXSDK;
