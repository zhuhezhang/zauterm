use crate::ipc::{ipc_fail_msg, ipc_ok};
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager, WebviewWindow};

#[tauri::command]
pub fn window_minimize(window: WebviewWindow) {
    let _ = window.minimize();
}

#[tauri::command]
pub fn window_maximize(window: WebviewWindow) {
    if window.is_maximized().unwrap_or(false) {
        let _ = window.unmaximize();
    } else {
        let _ = window.maximize();
    }
}

#[tauri::command]
pub fn window_close(window: WebviewWindow) {
    let _ = window.close();
}

#[tauri::command]
pub fn window_set_background_color(window: WebviewWindow, hex: String) {
    // Tauri 2: best-effort via CSS / ignored if unsupported
    let _ = (window, hex);
}

#[tauri::command]
pub fn window_is_maximized(window: WebviewWindow) -> Value {
    match window.is_maximized() {
        Ok(maximized) => ipc_ok(json!({ "maximized": maximized })),
        Err(e) => ipc_fail_msg(e.to_string()),
    }
}

#[tauri::command]
pub fn window_zoom_wheel_step(_window: WebviewWindow, _delta_y: f64) {
    // macOS Cmd+wheel zoom: frontend scales via CSS; native zoom optional
}

pub fn attach_maximize_events(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let app_c = app.clone();
        let _ = win.on_window_event(move |event| {
            if let tauri::WindowEvent::Resized(_) = event {
                if let Some(w) = app_c.get_webview_window("main") {
                    let maximized = w.is_maximized().unwrap_or(false);
                    let _ = app_c.emit("window:maximized", maximized);
                }
            }
        });
    }
    let _ = app; // state unused
}
