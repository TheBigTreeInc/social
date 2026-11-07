//! Native device-session vault. The Social token never enters browser localStorage
//! on Windows. Windows DPAPI encrypts it for the current OS account, then the
//! ciphertext is stored under Tavi's local application-data directory.
use tauri::{AppHandle, WebviewWindow, Manager};

fn main_window_only(window: &WebviewWindow) -> Result<(), String> {
    if window.label() == "main" { Ok(()) }
    else { Err("Session vault is available only to the main Tavi window".into()) }
}

#[cfg(target_os = "windows")]
mod session_vault {
    use std::{ffi::c_void, fs, io::Write, os::windows::ffi::OsStrExt, path::{Path, PathBuf}};
    use tauri::{AppHandle, Manager};

    const MAX_RECORD: usize = 8192;
    const MAX_CIPHERTEXT: u64 = 65536;
    const CRYPTPROTECT_UI_FORBIDDEN: u32 = 0x1;
    const MOVEFILE_REPLACE_EXISTING: u32 = 0x1;
    const MOVEFILE_WRITE_THROUGH: u32 = 0x8;

    #[repr(C)]
    struct DataBlob { len: u32, bytes: *mut u8 }
    #[link(name = "Crypt32")]
    unsafe extern "system" {
        fn CryptProtectData(input: *const DataBlob, description: *const u16, entropy: *const DataBlob,
            reserved: *mut c_void, prompt: *mut c_void, flags: u32, output: *mut DataBlob) -> i32;
        fn CryptUnprotectData(input: *const DataBlob, description: *mut *mut u16, entropy: *const DataBlob,
            reserved: *mut c_void, prompt: *mut c_void, flags: u32, output: *mut DataBlob) -> i32;
    }
    #[link(name = "Kernel32")]
    unsafe extern "system" {
        fn LocalFree(memory: *mut c_void) -> *mut c_void;
        fn MoveFileExW(existing: *const u16, replacement: *const u16, flags: u32) -> i32;
    }
    fn err() -> String { "Windows could not access the protected Tavi device session".into() }
    fn path(app: &AppHandle) -> Result<PathBuf, String> {
        app.path().app_local_data_dir().map(|p| p.join("remembered-session.v1.dpapi"))
            .map_err(|_| "Cannot locate the Tavi application-data directory".into())
    }
    fn protect(data: &[u8], decrypt: bool) -> Result<Vec<u8>, String> {
        if data.is_empty() || data.len() > MAX_CIPHERTEXT as usize { return Err("Invalid session vault data size".into()); }
        let input = DataBlob { len: data.len() as u32, bytes: data.as_ptr() as *mut u8 };
        let entropy_bytes = b"Tavi social device session v1";
        let entropy = DataBlob { len: entropy_bytes.len() as u32, bytes: entropy_bytes.as_ptr() as *mut u8 };
        let mut output = DataBlob { len: 0, bytes: std::ptr::null_mut() };
        // SAFETY: DPAPI consumes input buffers during the call and allocates the
        // output with LocalAlloc; we copy it and free it using LocalFree.
        let ok = unsafe {
            if decrypt { CryptUnprotectData(&input, std::ptr::null_mut(), &entropy,
                std::ptr::null_mut(), std::ptr::null_mut(), CRYPTPROTECT_UI_FORBIDDEN, &mut output) }
            else { CryptProtectData(&input, std::ptr::null(), &entropy,
                std::ptr::null_mut(), std::ptr::null_mut(), CRYPTPROTECT_UI_FORBIDDEN, &mut output) }
        };
        if ok == 0 { return Err(err()); }
        let result = if output.bytes.is_null() || output.len == 0 || output.len > MAX_CIPHERTEXT as u32 { Err(err()) }
            else { Ok(unsafe { std::slice::from_raw_parts(output.bytes, output.len as usize).to_vec() }) };
        unsafe { LocalFree(output.bytes.cast()); }
        result
    }
    fn wide(path: &Path) -> Vec<u16> { path.as_os_str().encode_wide().chain(std::iter::once(0)).collect() }
    pub fn load(app: &AppHandle) -> Result<Option<String>, String> {
        let file = path(app)?;
        let metadata = match fs::metadata(&file) {
            Ok(meta) => meta,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
            Err(_) => return Err("Cannot read the Tavi device session".into()),
        };
        if metadata.len() == 0 || metadata.len() > MAX_CIPHERTEXT { return Err("Invalid saved session file".into()); }
        let encrypted = fs::read(file).map_err(|_| "Cannot read the Tavi device session".to_string())?;
        let decrypted = protect(&encrypted, true)?;
        if decrypted.len() > MAX_RECORD { return Err("Invalid saved session record".into()); }
        String::from_utf8(decrypted).map(Some).map_err(|_| "Invalid saved session record".into())
    }
    pub fn save(app: &AppHandle, record: &str) -> Result<(), String> {
        if record.is_empty() || record.len() > MAX_RECORD { return Err("Invalid session record size".into()); }
        let file = path(app)?;
        let directory = file.parent().ok_or("Invalid Tavi application-data directory")?;
        fs::create_dir_all(directory).map_err(|_| "Cannot create Tavi application-data directory")?;
        let encrypted = protect(record.as_bytes(), false)?;
        let temp = file.with_extension("dpapi.new");
        let result = (|| -> Result<(), String> {
            let mut handle = fs::File::create(&temp).map_err(|_| "Cannot create protected session file")?;
            handle.write_all(&encrypted).map_err(|_| "Cannot write protected session file")?;
            handle.sync_all().map_err(|_| "Cannot flush protected session file")?;
            drop(handle);
            let old = wide(&temp);
            let new = wide(&file);
            if unsafe { MoveFileExW(old.as_ptr(), new.as_ptr(), MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH) } == 0 {
                return Err("Cannot activate protected session file".into());
            }
            Ok(())
        })();
        if result.is_err() { let _ = fs::remove_file(&temp); }
        result
    }
    pub fn clear(app: &AppHandle) -> Result<(), String> {
        match fs::remove_file(path(app)?) {
            Ok(()) => Ok(()),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(_) => Err("Cannot remove the saved Tavi session".into()),
        }
    }
}

#[tauri::command]
fn tavi_session_load(window: WebviewWindow, app: AppHandle) -> Result<Option<String>, String> {
    main_window_only(&window)?;
    #[cfg(target_os = "windows")]
    { session_vault::load(&app) }
    #[cfg(not(target_os = "windows"))]
    { let _ = app; Err("OS-protected device session is not yet available on this platform".into()) }
}

#[tauri::command]
fn tavi_session_save(window: WebviewWindow, app: AppHandle, record: String) -> Result<(), String> {
    main_window_only(&window)?;
    #[cfg(target_os = "windows")]
    { session_vault::save(&app, &record) }
    #[cfg(not(target_os = "windows"))]
    { let _ = (app, record); Err("OS-protected device session is not yet available on this platform".into()) }
}

#[tauri::command]
fn tavi_session_clear(window: WebviewWindow, app: AppHandle) -> Result<(), String> {
    main_window_only(&window)?;
    #[cfg(target_os = "windows")]
    { session_vault::clear(&app) }
    #[cfg(not(target_os = "windows"))]
    { let _ = app; Err("OS-protected device session is not yet available on this platform".into()) }
}


// Only the authenticated main WebView may initiate an Android package update.
// The native Android plugin validates the GitHub Release URL again, independently
// of any client-side JavaScript input, before starting DownloadManager.
#[tauri::command]
fn tavi_android_install_update(window: WebviewWindow, app: AppHandle, url: String) -> Result<serde_json::Value, String> {
    main_window_only(&window)?;
    #[cfg(target_os = "android")]
    {
        let plugin = app.state::<AndroidUpdater>();
        plugin.0.run_mobile_plugin::<serde_json::Value>("installRelease", serde_json::json!({"url": url}))
            .map_err(|e| format!("Android installer unavailable: {e}"))
    }
    #[cfg(not(target_os = "android"))]
    { let _ = (app, url); Err("Only Android supports this installer".into()) }
}


#[tauri::command]
fn tavi_android_test_update(window: WebviewWindow, app: AppHandle, url: String) -> Result<serde_json::Value, String> {
    main_window_only(&window)?;
    #[cfg(target_os = "android")]
    { app.state::<AndroidUpdater>().0.run_mobile_plugin::<serde_json::Value>("testRelease", serde_json::json!({"url": url}))
        .map_err(|_| "Android updater self-test unavailable".to_string()) }
    #[cfg(not(target_os = "android"))]
    { let _ = (app, url); Err("Only Android supports the updater self-test".into()) }
}

#[tauri::command]
fn tavi_android_update_status(window: WebviewWindow, app: AppHandle) -> Result<serde_json::Value, String> {
    main_window_only(&window)?;
    #[cfg(target_os = "android")]
    { app.state::<AndroidUpdater>().0.run_mobile_plugin::<serde_json::Value>("updateStatus", serde_json::json!({}))
        .map_err(|_| "Android updater status unavailable".to_string()) }
    #[cfg(not(target_os = "android"))]
    { let _ = app; Err("Only Android supports updater status".into()) }
}

#[cfg(target_os = "android")]
struct AndroidUpdater(tauri::plugin::PluginHandle<tauri::Wry>);

fn android_updater_plugin() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    tauri::plugin::Builder::<tauri::Wry>::new("tavi-android-updater")
        .setup(|app, api| {
            #[cfg(target_os = "android")]
            {
                let handle = api.register_android_plugin("inc.thebigtree.looprdsocial", "TaviUpdaterPlugin")?;
                app.manage(AndroidUpdater(handle));
            }
            #[cfg(not(target_os = "android"))]
            { let _ = (app, api); }
            Ok(())
        })
        .build()
}


// Native Windows TaviX file picker. WebView2 may decline HTML file inputs without
// reporting an error; use the OS common-file dialog instead. The selected path
// never crosses the JS boundary. Only the authenticated main window can call it.
#[cfg(target_os = "windows")]
mod native_tavix_picker {
    use std::{ffi::{c_void, OsString}, fs::File, io::Read,
        mem, os::windows::ffi::OsStringExt, path::PathBuf};
    use base64::{engine::general_purpose::STANDARD, Engine as _};

    const MAX_PACKAGE_BYTES: u64 = 12_000_000;
    const OFN_EXPLORER: u32 = 0x0008_0000;
    const OFN_FILEMUSTEXIST: u32 = 0x0000_1000;
    const OFN_PATHMUSTEXIST: u32 = 0x0000_0800;
    const OFN_HIDEREADONLY: u32 = 0x0000_0004;
    const OFN_NOCHANGEDIR: u32 = 0x0000_0008;

    // ABI layout matches the Win32 OPENFILENAMEW structure (commdlg.h).
    #[repr(C)]
    struct OpenFilenameW {
        l_struct_size: u32,
        hwnd_owner: *mut c_void,
        h_instance: *mut c_void,
        lpstr_filter: *const u16,
        lpstr_custom_filter: *mut u16,
        n_max_cust_filter: u32,
        n_filter_index: u32,
        lpstr_file: *mut u16,
        n_max_file: u32,
        lpstr_file_title: *mut u16,
        n_max_file_title: u32,
        lpstr_initial_dir: *const u16,
        lpstr_title: *const u16,
        flags: u32,
        n_file_offset: u16,
        n_file_extension: u16,
        lpstr_def_ext: *const u16,
        l_cust_data: isize,
        lpfn_hook: *const c_void,
        lp_template_name: *const u16,
        pv_reserved: *mut c_void,
        dw_reserved: u32,
        flags_ex: u32,
    }
    #[link(name = "Comdlg32")]
    unsafe extern "system" {
        fn GetOpenFileNameW(ofn: *mut OpenFilenameW) -> i32;
        fn CommDlgExtendedError() -> u32;
    }
    #[link(name = "User32")]
    unsafe extern "system" { fn GetForegroundWindow() -> *mut c_void; }

    pub fn pick() -> Result<serde_json::Value, String> {
        let filter: Vec<u16> = "TaviX packages (*.tavix)\0*.tavix\0All files (*.*)\0*.*\0\0"
            .encode_utf16().collect();
        let title: Vec<u16> = "Install local TaviX package\0".encode_utf16().collect();
        let mut filename: Vec<u16> = vec![0; 32_768];
        // SAFETY: All pointers refer to live local storage throughout the
        // blocking Win32 call; all other OPENFILENAMEW fields are initialized.
        let mut dialog: OpenFilenameW = unsafe { mem::zeroed() };
        dialog.l_struct_size = mem::size_of::<OpenFilenameW>() as u32;
        dialog.hwnd_owner = unsafe { GetForegroundWindow() };
        dialog.lpstr_filter = filter.as_ptr();
        dialog.n_filter_index = 1;
        dialog.lpstr_file = filename.as_mut_ptr();
        dialog.n_max_file = filename.len() as u32;
        dialog.lpstr_title = title.as_ptr();
        dialog.flags = OFN_EXPLORER | OFN_FILEMUSTEXIST | OFN_PATHMUSTEXIST
            | OFN_HIDEREADONLY | OFN_NOCHANGEDIR;
        let selected = unsafe { GetOpenFileNameW(&mut dialog) };
        if selected == 0 {
            let code = unsafe { CommDlgExtendedError() };
            if code == 0 { return Ok(serde_json::json!({"status": "cancelled"})); }
            return Err(format!("Windows file dialog failed (code {code})"));
        }
        let length = filename.iter().position(|&c| c == 0)
            .ok_or_else(|| "Selected path is too long".to_string())?;
        let path = PathBuf::from(OsString::from_wide(&filename[..length]));
        let name = path.file_name().and_then(|name| name.to_str())
            .ok_or_else(|| "Selected package name is invalid".to_string())?;
        if !name.to_ascii_lowercase().ends_with(".tavix") {
            return Err("Please select a .tavix package".to_string());
        }
        let file = File::open(&path).map_err(|_| "Cannot open selected package".to_string())?;
        let metadata = file.metadata().map_err(|_| "Cannot inspect selected package".to_string())?;
        if !metadata.is_file() || metadata.len() == 0 || metadata.len() > MAX_PACKAGE_BYTES {
            return Err("Selected package must be under 12 MB".to_string());
        }
        let mut bytes = Vec::with_capacity(metadata.len() as usize);
        file.take(MAX_PACKAGE_BYTES + 1).read_to_end(&mut bytes)
            .map_err(|_| "Cannot read selected package".to_string())?;
        if bytes.is_empty() || bytes.len() as u64 > MAX_PACKAGE_BYTES {
            return Err("Selected package must be under 12 MB".to_string());
        }
        // A package's filename is displayed to the user but the absolute path
        // is never returned. The JS validator still checks manifest and lockfile.
        Ok(serde_json::json!({"status":"selected","name":name,"base64":STANDARD.encode(&bytes)}))
    }
}

#[tauri::command]
async fn tavi_native_pick_tavix(window: WebviewWindow) -> Result<serde_json::Value, String> {
    main_window_only(&window)?;
    #[cfg(target_os = "windows")]
    {
        tauri::async_runtime::spawn_blocking(native_tavix_picker::pick)
            .await.map_err(|_| "Windows file dialog stopped unexpectedly".to_string())?
    }
    #[cfg(not(target_os = "windows"))]
    { Err("Native TaviX selection is available on Windows only".into()) }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![tavi_session_load, tavi_session_save, tavi_session_clear, tavi_native_pick_tavix, tavi_android_install_update, tavi_android_test_update, tavi_android_update_status])
        .plugin(android_updater_plugin())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("failed to launch LoopRD Social Client");
}
