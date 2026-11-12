/** Non-sensitive host UI discovery. Device labels do not grant native capabilities. */
export const UI_FEATURE = 'tavix.ui/v1';
export function uiContext({platform='web',width=355,height=630,theme='light',presentation='embedded',chatAlignment='left'}={}) {
 const w=Number.isFinite(width)&&width>0?Math.round(width):355;
 const h=Number.isFinite(height)&&height>0?Math.round(height):630;
 const device=platform==='windows'||platform==='macos'||platform==='linux'?'desktop':w>=600?'tablet':'phone';
 const orientation=w>h?'landscape':'portrait';
 return {schema:UI_FEATURE,theme:theme==='dark'?'dark':'light',device,orientation,
  presentation:presentation==='detached'?'native-window':'embedded',
  chat:{orientation:device==='phone'?'portrait':'adaptive',placement:device!=='tablet'||orientation==='portrait'?'center':chatAlignment==='center'?'center':'left'},
  games:{orientations:['portrait','landscape']},
  viewport:presentation==='detached'?null:{width:w,height:h},
  components:'tavix.ui-components/v1'};
}
export function workspaceContext({desktop=false,mode='embedded'}={}) {
 return {schema:'tavi.workspace/v1',mode, // compatible with the 0.3.161 host wire API
  supported:desktop?['embedded','detached']:['embedded'],
  presentation:{schema:'tavix.presentation-capabilities/v1',current:mode==='detached'?'native-window':'embedded',
   supported:desktop?['embedded','native-window']:['embedded']}};
}
