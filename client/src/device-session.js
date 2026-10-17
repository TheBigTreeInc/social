/** Remembered device sessions, with a Windows OS-protected storage backend.
 * Native main-window commands are deliberately unavailable to chat/game windows.
 * Browser and Android retain their existing origin-scoped storage until a native
 * Android Keystore adapter is implemented; never silently downgrade on Windows.
 */
import {loadRememberedSession,saveRememberedSession,clearRememberedSession,isPersistentSession,
        parseRememberedRecord,createRememberedRecord} from './session-store.js';

export function createDeviceSessionStore({windows=false,invoke,local,session}) {
  if (windows && typeof invoke !== 'function') throw Error('Windows secure session storage requires the Tauri bridge');
  const legacyPersistent = () => isPersistentSession(local);
  return {
    async load() {
      if (!windows) return {record:loadRememberedSession(local,session),remembered:legacyPersistent()};
      const payload=await invoke('tavi_session_load');
      if (payload !== null && payload !== undefined) {
        const record=parseRememberedRecord(payload);
        if (!record) { await invoke('tavi_session_clear'); return {record:null,remembered:false}; }
        // Never retain a second, script-readable token copy on Windows.
        clearRememberedSession(local,session);
        return {record,remembered:true};
      }
      // One-time migration of v0.3.14–0.3.23 localStorage credentials.
      if (legacyPersistent()) {
        const record=loadRememberedSession(local,{getItem:()=>null,removeItem:()=>{}});
        await invoke('tavi_session_save',{record:JSON.stringify(record)});
        clearRememberedSession(local,session);
        return {record,remembered:true};
      }
      return {record:loadRememberedSession(local,session),remembered:false};
    },
    async save({origin,token,profileId,remember}) {
      if (!windows) { saveRememberedSession({origin,token,profileId,remember},local,session); return !!remember; }
      if (remember) {
        const record=createRememberedRecord({origin,token,profileId});
        await invoke('tavi_session_save',{record:JSON.stringify(record)});
        clearRememberedSession(local,session);
      } else {
        // The account stays signed in during this process, but the next launch
        // will not restore it. Clear the durable credential first.
        await invoke('tavi_session_clear');
        saveRememberedSession({origin,token,profileId,remember:false},local,session);
      }
      return !!remember;
    },
    async clear() {
      // Always try vault removal; failure is reported to the caller, not hidden.
      if (windows) await invoke('tavi_session_clear');
      clearRememberedSession(local,session);
    }
  };
}
