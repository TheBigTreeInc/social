/** Foreground desktop/Android/Web notifications. No background push guarantee. */
import { isTauri } from '@tauri-apps/api/core';
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';

export async function notificationPermissionStatus() {
  try {
    if (isTauri()) return (await isPermissionGranted()) ? 'granted' : 'prompt';
    if (!('Notification' in globalThis)) return 'unavailable';
    return Notification.permission; // granted / denied / default
  } catch { return 'unavailable'; }
}

export async function grantNotifications() {
  if (isTauri()) return (await isPermissionGranted()) || (await requestPermission()) === 'granted';
  if (!('Notification' in globalThis)) return false;
  return (await Notification.requestPermission()) === 'granted';
}

async function showNotification(title,body,tag){
  try {
    if (isTauri()) {
      if (!(await isPermissionGranted())) return false;
      await sendNotification({title,body});
      return true;
    }
    if ('Notification' in globalThis && Notification.permission === 'granted') {
      const notice=new Notification(title,{body,tag});
      notice.onclick=()=>{globalThis.focus?.();notice.close();};
      return true;
    }
  } catch { /* Notification delivery is optional and never blocks sync. */ }
  return false;
}
export const notifyTurn=(title,body)=>showNotification(title,body,`turn-${title}-${body}`);
export const sendTestNotification=()=>showNotification('Tavi · Test notification','Your device can display Tavi alerts while the app is running.','tavi-test');
export function notifyChat(name,text,{preview=false}={}){
 const safeName=String(name||'Friend').slice(0,64);
 const body=preview?String(text||'New message').slice(0,100):'New private message';
 return showNotification(`${safeName} · Tavi`,body,`tavi-message-${safeName}`);
}
export const notifyFriendRequest=name=>showNotification('Tavi · Friend request',`${String(name||'Someone').slice(0,64)} wants to add you.`,`tavi-request-${name}`);
