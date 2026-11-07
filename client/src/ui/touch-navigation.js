/** Mobile-first navigation: native overflow/scroll-snap with bounded elastic edge feedback. */
export const elasticDistance=(delta,limit=36)=>Math.sign(delta)*Math.min(limit,limit*Math.abs(delta)/(Math.abs(delta)+65));
export const atScrollEdge=({scrollTop,scrollHeight,clientHeight},direction)=>direction>0 ? scrollTop<=1 : scrollTop+clientHeight>=scrollHeight-1;
export function wireElasticScroll(element,{reducedMotion=false}={}){
 if(!element||reducedMotion)return ()=>{};
 let start=null,axis=null;
 const reset=()=>{start=null;axis=null;element.style.transition='transform 220ms cubic-bezier(.2, .9, .25, 1.15)';element.style.transform='translate3d(0,0,0)';};
 const down=e=>{if(e.touches.length!==1||e.target.closest?.('input,textarea,select,button,iframe,[contenteditable]'))return;start={x:e.touches[0].clientX,y:e.touches[0].clientY};axis=null;element.style.transition='none';};
 const move=e=>{if(!start||e.touches.length!==1)return;const dx=e.touches[0].clientX-start.x,dy=e.touches[0].clientY-start.y;
  if(!axis&&Math.max(Math.abs(dx),Math.abs(dy))>8)axis=Math.abs(dy)>Math.abs(dx)?'y':'x';
  if(axis!=='y'||Math.abs(dy)<9||!atScrollEdge(element,dy))return;
  element.style.transform=`translate3d(0,${elasticDistance(dy)}px,0)`;
 };
 element.addEventListener('touchstart',down,{passive:true});element.addEventListener('touchmove',move,{passive:true});element.addEventListener('touchend',reset,{passive:true});element.addEventListener('touchcancel',reset,{passive:true});
 return ()=>{element.removeEventListener('touchstart',down);element.removeEventListener('touchmove',move);element.removeEventListener('touchend',reset);element.removeEventListener('touchcancel',reset);element.style.transform='';element.style.transition='';};
}
export function wireAppPages(root,{initialIndex=0,onChange=()=>{}}={}){
 const pages=root?.querySelector('.tavi-app-pages');if(!pages)return;
 const controls=[...root.querySelectorAll('[data-app-page]')];
 if(!controls.length)return;
 const bounded=index=>Math.max(0,Math.min(controls.length-1,index));
 // Keep Favorites compact even when All has several more rows. The horizontal
 // carousel still includes both panels; only its vertical footprint changes.
 const sections=pages.querySelectorAll?.('.tavi-app-page')||[];
 const fitHeight=index=>{
  const height=sections[bounded(index)]?.scrollHeight;
  if(pages.style&&Number.isFinite(height)&&height>0)pages.style.height=`${Math.ceil(height)}px`;
 };
 const activate=index=>{
  const selected=bounded(index);
  controls.forEach((el,i)=>{el.setAttribute('aria-selected',i===selected?'true':'false');el.tabIndex=i===selected?0:-1;});
  fitHeight(selected);
  onChange(selected);
 };
 const scrollTo=index=>{
  const selected=bounded(index);
  pages.scrollTo({left:selected*pages.clientWidth,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  activate(selected);
 };
 controls.forEach((el,i)=>{
  el.addEventListener('click',()=>scrollTo(i));
  el.addEventListener('keydown',event=>{
   if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
   event.preventDefault();
   const selected=event.key==='Home'?0:event.key==='End'?controls.length-1:bounded(i+(event.key==='ArrowRight'?1:-1));
   scrollTo(selected);controls[selected].focus();
  });
 });
 pages.scrollLeft=bounded(initialIndex)*pages.clientWidth;
 activate(bounded(initialIndex));
 pages.addEventListener('scroll',()=>{
  const index=bounded(Math.round(pages.scrollLeft/Math.max(1,pages.clientWidth)));
  activate(index);
 },{passive:true});
}
