// Read actual painted layout; the browser fixture uses an Android-like safe
// area without touching the user's real OS, account, or Tavi runtime state.
export function snapshotSafeLayout(doc) {
 const d=doc||document;
 const rect=selector=>{
  const node=d.querySelector(selector);
  if(!node)return null;
  const r=node.getBoundingClientRect();
  return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height};
 };
 const root=d.documentElement;
 const css=root.ownerDocument.defaultView.getComputedStyle(d.querySelector('#app'));
 return {
  viewport:{height:root.ownerDocument.defaultView.innerHeight,width:root.ownerDocument.defaultView.innerWidth},
  insets:{top:parseFloat(css.paddingTop)||0,bottom:parseFloat(css.paddingBottom)||0},
  home:rect('.tavi-home'),roster:rect('.tavi-classic-home>.tavi-home-roster'),
  dock:rect('.tavi-unified-home .tavi-mobile-tabs'),menu:rect('.tavi-unified-home .tavi-mobile-tabs [data-action="main-menu"]'),
  homeHeader:rect('.tavi-unified-home .tavi-ui-header'),
  toolbar:rect('.tavi-focus-toolbar'),back:rect('.tavi-shell-bar__back'),
  chatCompose:rect('.tavi-chat-compose'),
 };
}
