/**
 * Tavi owns its screens; WebView history does not represent the current panel.
 * This pure policy is shared by the Android OS Back gesture, an accessible
 * in-app Back button and the desktop Escape shortcut. Back never logs out,
 * exits the application, navigates a sandboxed extension or loses a draft.
 */
export function decideHostBack({connected=false,step='server',panel='home',mobileRoster=true,
  extensionReturnsHome=false,installApproval=false,lifeLaunch=false,diagnostics=false,
  interactionDetail=false}={}) {
 if(diagnostics)return 'close-diagnostics';
 if(installApproval)return 'cancel-install';
 if(lifeLaunch)return 'cancel-life-launch';
 if(!connected)return step==='account'?'server-step':'root';
 if(panel==='inbox'&&interactionDetail)return 'close-interaction';
 if(panel==='messenger')return mobileRoster?'home':'contacts';
 if(panel==='extension')return extensionReturnsHome?'home':'app-store';
 if(panel==='home')return 'root';
 return 'home';
}

/** Do not turn the first Back press while composing into screen navigation. */
export function shouldDismissKeyboard({isEditable=false,viewportHeight=0,layoutHeight=0}={}){
 return isEditable&&layoutHeight>0&&viewportHeight>0&&layoutHeight-viewportHeight>120;
}
