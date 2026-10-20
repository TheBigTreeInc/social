// One menu opens at a time across classic Tavi navigation.
// DOM event ownership stays with each freshly rendered menu, preventing leaked
// global listeners when Tavi rerenders its workspace.
export function wireExclusiveMenus(menuNodes) {
 const menus=Array.from(menuNodes??[]);
 for (const menu of menus) {
  menu.addEventListener('toggle',()=>{
   if (!menu.open) return;
   for (const other of menus) if (other!==menu) other.open=false;
  });
  menu.addEventListener('keydown',event=>{
   if (event.key!=='Escape'||!menu.open) return;
   menu.open=false;
   menu.querySelector('summary')?.focus();
   event.stopPropagation();
  });
 }
}
