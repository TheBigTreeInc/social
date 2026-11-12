import type {TaviXUIContext} from './index.js';
export declare function applyTaviUI(root:HTMLElement,context:TaviXUIContext):HTMLElement;
export type TaviUILayout='compact'|'medium'|'wide';
export interface TaviUIBridgeSDK {
 info():Promise<{features?:string[]}>;
 uiContext():Promise<TaviXUIContext>;
 on(event:'ui.contextChanged',callback:(context:TaviXUIContext)=>void):()=>void;
}
export interface TaviUIController {
 readonly ready:Promise<{source:'host'|'local'}>;
 refresh():void;
 dispose():void;
}
/** Host features are optional; layout always follows the app's own viewport. */
export declare function createTaviUIController(root:HTMLElement,options?:{
 sdk?:TaviUIBridgeSDK|null;
 windowRef?:Window;
 ResizeObserverClass?:typeof ResizeObserver;
}):TaviUIController;
