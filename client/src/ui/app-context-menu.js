/** Apps drawer context actions, local to the Tavi host (never extension-supplied HTML).
 * Mouse right-click, touch/pen long press, or keyboard Shift+F10 / Menu.
 * Any destructive action is delegated to an independently revalidated host handler.
 */
const LONG_PRESS_MS=550;
const MOVE_CANCEL_PX=12;

export function canRemoveAppFromTavi(app,store,{coreWalletId,bundledCompanionId}={}){
 return app?.kind==='extension' && typeof app.id==='string' && app.id.length>0 &&
   app.id!==coreWalletId && app.id!==bundledCompanionId && store?.installed(app.id)===true;
}
export function appContextActions({isFavorite=false,canRemove=false,canRestore=false}={}){
 return [
  {action:'open',label:'Open'},
  {action:'favorite',label:isFavorite?'Remove from Favorites':'Add to Favorites'},
  ...(canRestore?[{action:'restore',label:'Restore original app'}]:[]),
  ...(canRemove?[{action:'remove',label:'Remove from Tavi'}]:[])
 ];
}

/** A close function is returned so host render/navigation can dispose global listeners. */
export function wireAppContextMenus(root,{resolveApp,onOpen,onFavorite,onRemove,onRestore,holdMs=LONG_PRESS_MS}={}){
 const tiles=[...(root?.querySelectorAll?.('[data-app-context]')||[])];
 if(!tiles.length)return ()=>{};
 const doc=root.ownerDocument||root;
 const view=doc.defaultView||globalThis.window;
 let overlay=null,restoreFocus=null,holdTimer=null,pressedTile=null,pressStart=null;
 let suppressTile=null,suppressUntil=0;
 const cancelHold=()=>{if(holdTimer!==null){view.clearTimeout(holdTimer);holdTimer=null;}pressedTile=null;pressStart=null;};
 const close=({focus=true}={})=>{
  if(!overlay)return;
  overlay.remove();overlay=null;
  if(focus && restoreFocus?.isConnected)restoreFocus.focus();
  restoreFocus=null;
 };
 const onDocumentKey=e=>{if(e.key==='Escape'&&overlay){e.preventDefault();close();}};
 doc.addEventListener('keydown',onDocumentKey);
 const show=(tile,{x,y,touch=false}={})=>{
  cancelHold();close({focus:false});
  const app=resolveApp?.(tile.dataset.appContext);
  if(!app)return;
  const actions=appContextActions(app);
  restoreFocus=tile;
  overlay=doc.createElement('div');overlay.className='tavi-app-context-overlay';
  const menu=doc.createElement('div');menu.className='tavi-app-context-menu';menu.setAttribute('role','menu');
  menu.setAttribute('aria-label',`${app.label} options`);
  menu.setAttribute('tabindex','-1');
  const heading=doc.createElement('div');heading.className='tavi-app-context-heading';heading.textContent=app.label;
  menu.append(heading);
  for(const {action,label} of actions){
   const button=doc.createElement('button');button.type='button';button.setAttribute('role','menuitem');
   button.className=action==='remove'?'tavi-app-context-remove':'';button.textContent=label;
   button.addEventListener('click',()=>{
    // Never trust a cached tile flag when permissions or installation have changed.
    const current=resolveApp?.(tile.dataset.appContext);
    if(!current||!appContextActions(current).some(a=>a.action===action))return close();
    close({focus:false});
    if(action==='open')onOpen?.(current);
    if(action==='favorite')onFavorite?.(current);
    if(action==='remove')onRemove?.(current);
    if(action==='restore')onRestore?.(current);
   });
   menu.append(button);
  }
  overlay.append(menu);
  overlay.addEventListener('pointerdown',e=>{if(e.target===overlay)close();});
  menu.addEventListener('keydown',e=>{
   if(!['ArrowDown','ArrowUp','Home','End'].includes(e.key))return;
   e.preventDefault();const buttons=[...menu.querySelectorAll('button')];
   const index=buttons.indexOf(doc.activeElement),n=buttons.length;
   if(!n)return;
   const next=e.key==='Home'?0:e.key==='End'?n-1:(index+(e.key==='ArrowDown'?1:-1)+n)%n;
   buttons[next].focus();
  });
  doc.body.append(overlay);
  // CSS makes coarse-pointer menus bottom sheets; mouse menus float at the pointer.
  const w=view.innerWidth||360,h=view.innerHeight||640;
  const bounds=tile.getBoundingClientRect?.()||{left:0,bottom:0};
  menu.style.setProperty('--context-left',`${Math.max(8,Math.min(x??bounds.left,w-246))}px`);
  menu.style.setProperty('--context-top',`${Math.max(8,Math.min(y??bounds.bottom,h-(actions.length*49+65)))}px`);
  if(touch)overlay.classList.add('is-touch');
  menu.querySelector('button')?.focus();
 };
 const cleanups=[];
 for(const tile of tiles){
  const bind=(type,fn,options)=>{tile.addEventListener(type,fn,options);cleanups.push(()=>tile.removeEventListener(type,fn,options));};
  bind('contextmenu',e=>{e.preventDefault();const touch=e.pointerType==='touch'||(suppressTile===tile&&Date.now()<suppressUntil);if(touch&&overlay)return;show(tile,{x:e.clientX,y:e.clientY,touch});});
  bind('keydown',e=>{if(e.key!=='ContextMenu'&&!(e.shiftKey&&e.key==='F10'))return;e.preventDefault();show(tile);});
  bind('pointerdown',e=>{
   if(e.pointerType!=='touch'&&e.pointerType!=='pen')return;
   if(e.isPrimary===false)return;
   cancelHold();pressedTile=tile;pressStart={x:e.clientX,y:e.clientY};
   holdTimer=view.setTimeout(()=>{
    holdTimer=null;
    if(pressedTile!==tile)return;
    suppressTile=tile;suppressUntil=Date.now()+1100;
    show(tile,{x:e.clientX,y:e.clientY,touch:true});
   },holdMs);
  },{passive:true});
  bind('pointermove',e=>{if(pressedTile!==tile||!pressStart)return;
   if(Math.hypot(e.clientX-pressStart.x,e.clientY-pressStart.y)>MOVE_CANCEL_PX)cancelHold();
  },{passive:true});
  for(const type of ['pointerup','pointercancel','pointerleave'])bind(type,cancelHold);
  // Capture synthetic click generated after a successful touch long press.
  bind('click',e=>{if(suppressTile===tile&&Date.now()<suppressUntil){
   e.preventDefault();e.stopImmediatePropagation();suppressTile=null;suppressUntil=0;
  }},true);
 }
 const dispose=()=>{cancelHold();close({focus:false});doc.removeEventListener('keydown',onDocumentKey);cleanups.forEach(fn=>fn());};
 dispose.dismiss=()=>{if(!overlay)return false;close();return true;};
 return dispose;
}
