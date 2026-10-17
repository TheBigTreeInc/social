//! Native device-session vault. The Social token never enters browser localStorage
//! on Windows. Windows DPAPI encrypts it for the current OS account, then the
//! ciphertext is stored under Tavi's local application-data directory.
use tauri::{AppHandle, WebviewWindow};

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![tavi_session_load, tavi_session_save, tavi_session_clear])
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("failed to launch LoopRD Social Client");
}
