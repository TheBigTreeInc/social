'use strict';
(async function () {
  const $=id=>document.getElementById(id);
  const status=value=>{$('status').textContent=value;};
  if (!globalThis.Portraits || !globalThis.PortraitWizard || !globalThis.ModularPortraits) {
    throw Error('Generator sources have not been synchronized; run npm run portrait:sync.');
  }
  const canonical = 'https://raw.githubusercontent.com/TheBigTreeInc/assets/main/portraits/index.json';
  status('Fetching latest official registry and selected artwork…');
  const system = await Portraits.System.load(canonical, {preload:'selected'});
  $('library').textContent=system.registry.index.schema+' · live main registry';
  let value=system.defaultAppearance();
  let sequence=0;
  async function render(input){
    const current=++sequence;value=input;
    try{
      status('Loading selected artwork…'); await system.preload(input);
      if(current!==sequence)return;
      system.render(input,{canvas:$('portrait'),size:320});
      $('code').value=Portraits.encode(system.registry,input);
      status('Ready · official artwork verified');
    }catch(e){status(e.message);}
  }
  const wizard=PortraitWizard.mount($('controls'),system,value,{onChange:v=>{void render(v);}});
  await render(value);
  $('random').disabled=false; $('use').disabled=false;$('export').disabled=false;
  $('random').onclick=()=>wizard.setAppearance(system.randomAppearance());
  $('use').onclick=()=>{const code=$('code').value;if(!/^[1-9][0-9]*$/.test(code))return;parent.postMessage({type:'looprd.portrait.selected/v1',code},location.origin);status('Portrait sent to Social client.');};
  $('export').onclick=async()=>{try{await navigator.clipboard.writeText($('code').value);status('Portrait code copied.');}catch{status('Copy unavailable. Select the text below.');}};
})().catch(e=>document.getElementById('status').textContent=e.message);
