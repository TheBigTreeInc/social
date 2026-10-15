/** In-app/native OS notifications; not a background push service. */
import { isTauri } from '@tauri-apps/api/core';
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';

export async function grantNotifications() {
  if (isTauri()) return (await isPermissionGranted()) || (await requestPermission()) === 'granted';
  if (!('Notification' in globalThis)) return false;
  return (await Notification.requestPermission()) === 'granted';
}

export async function notifyTurn(title, body) {
  try {
    if (isTauri()) {
      if (!(await isPermissionGranted())) return false;
      await sendNotification({title, body});
      return true;
    }
    if ('Notification' in globalThis && Notification.permission === 'granted') {
      new Notification(title, {body, tag: `turn-${title}-${body}`}); return true;
    }
  } catch { /* Optional desktop notification failure must not break API sync. */ }
  return false;
}
