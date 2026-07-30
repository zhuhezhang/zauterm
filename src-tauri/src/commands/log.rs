use crate::path_policy::{collect_resolved_roots, safe_file_stem, validate_log_directory};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[tauri::command]
pub fn log_write(app: AppHandle, log_dir: String, session_id: String, data: String) {
    write_log(&app, &log_dir, &session_id, &data, false);
}

#[tauri::command]
pub fn log_append(app: AppHandle, log_dir: String, session_id: String, data: String) {
    write_log(&app, &log_dir, &session_id, &data, true);
}

fn write_log(app: &AppHandle, log_dir: &str, session_id: &str, data: &str, append: bool) {
    let Ok(app_data) = app.path().app_data_dir() else {
        return;
    };
    let roots = collect_resolved_roots(&app_data);
    if validate_log_directory(log_dir, &roots).is_err() {
        return;
    }
    let name = safe_file_stem(session_id);
    let path = PathBuf::from(log_dir).join(format!("{name}.log"));
    let _ = fs::create_dir_all(log_dir);
    if append {
        use std::io::Write;
        if let Ok(mut f) = fs::OpenOptions::new().create(true).append(true).open(&path) {
            let _ = f.write_all(data.as_bytes());
        }
    } else {
        let _ = fs::write(&path, data);
    }
}
