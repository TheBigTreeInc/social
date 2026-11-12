/** TAVI-STORE-TOUCH-174 — viewport-local gesture; no page reload or host navigation.
 * The host owns the catalog refresh. A gesture never authorizes installation,
 * checkout, entitlement changes, or a developer application update.
 */
export const STORE_PULL_THRESHOLD=72;

export function storePullDistance(startX,startY,currentX,currentY){
 const dx=currentX-startX,dy=currentY-startY;
 return dy>0&&dy>Math.abs(dx)*1.25?dy:0;
}

const INTERACTIVE='button,a,input,textarea,select,summary,[role="button"],[contenteditable="true"],.tavi-storefront-tabs,.tavi-storefront-grid';
/** Wire to the actual scrolling viewport, not window/document scroll position.
 * Pointer events cover Windows mouse/stylus; touch events cover Android WebView.
 */
export function wireStorePullToRefresh({surface,scroller,onRefresh,threshold=STORE_PULL_THRESHOLD}={}){
 if(!surface||!scroller||typeof onRefresh!=='function')return ()=>{};
 const indicator=surface.querySelector('[data-store-pull-status]');
 let gesture=null,working=false;
 const display=(text,visible)=>{if(!indicator)return;indicator.hidden=!visible;indicator.textContent=text;};
 const blocked=target=>!surface.contains(target)||Boolean(target?.closest?.(INTERACTIVE));
 const begin=(x,y,target)=>{
  if(working||scroller.scrollTop>2||blocked(target))return;
  gesture={x,y,distance:0};
 };
 const move=(x,y)=>{
  if(!gesture)return;
  if(scroller.scrollTop>2){cancel();return;}
  gesture.distance=storePullDistance(gesture.x,gesture.y,x,y);
  display(gesture.distance>=threshold?'Release to refresh':'Pull down to refresh',gesture.distance>=14);
 };
 const cancel=()=>{gesture=null;if(!working)display('',false);};
 const finish=()=>{
  const ready=gesture?.distance>=threshold;
  cancel();
  if(!ready||working)return;
  working=true;display('Refreshing Store…',true);
  Promise.resolve().then(onRefresh).catch(()=>{display('Could not refresh. Try again.',true);}).finally(()=>{working=false;display('',false);});
 };
 const onTouchStart=event=>{if(event.touches.length!==1)return;const t=event.touches[0];begin(t.clientX,t.clientY,event.target);};
 const onTouchMove=event=>{if(event.touches.length!==1){cancel();return;}const t=event.touches[0];move(t.clientX,t.clientY);};
 const onTouchEnd=()=>finish();
 const onPointerDown=event=>{if(event.pointerType==='touch'||event.button!==0)return;begin(event.clientX,event.clientY,event.target);};
 const onPointerMove=event=>{if(event.pointerType==='touch')return;move(event.clientX,event.clientY);};
 const onPointerUp=event=>{if(event.pointerType==='touch')return;finish();};
 const onPointerCancel=()=>cancel();
 const handlers=[['touchstart',onTouchStart],['touchmove',onTouchMove],['touchend',onTouchEnd],['touchcancel',onPointerCancel],['pointerdown',onPointerDown],['pointermove',onPointerMove],['pointerup',onPointerUp],['pointercancel',onPointerCancel]];
 for(const [name,handler] of handlers)scroller.addEventListener(name,handler,{passive:true});
 return ()=>{for(const [name,handler] of handlers)scroller.removeEventListener(name,handler);cancel();};
}
