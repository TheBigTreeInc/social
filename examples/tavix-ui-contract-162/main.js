// Sample source for a TaviX bundler. Copy SDK modules into the signed .tavix build.
import {createTaviXSDK} from '@tavi/tavix-sdk';
import {applyTaviUI} from '@tavi/tavix-sdk/ui';
import '@tavi/tavix-sdk/ui.css';
const sdk=createTaviXSDK();
const root=document.querySelector('#studio');
const detail=document.querySelector('#host-details');
try {
 const host=await sdk.info();
 const workspace=await sdk.workspace.info();
 if(host.features.includes('tavix.ui/v1')){
  applyTaviUI(root,await sdk.uiContext());
  sdk.on('ui.contextChanged',context=>applyTaviUI(root,context));
 }
 detail.textContent=`Presentation: ${workspace.presentation?.current||workspace.mode}. Host navigation remains in Tavi.`;
}catch(_error){detail.textContent='Host capability discovery is unavailable in this preview.';}
for(const tab of document.querySelectorAll('[role="tab"]'))tab.addEventListener('click',()=>{
 for(const other of document.querySelectorAll('[role="tab"]'))other.setAttribute('aria-selected',String(other===tab));
});
document.querySelector('#exit').addEventListener('click',()=>void sdk.navigation.close().catch(()=>{}));
