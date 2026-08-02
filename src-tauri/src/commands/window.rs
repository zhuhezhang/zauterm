//! 窗口命令

use crate::ipc::{ipc_fail_msg, ipc_ok};
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager, WebviewWindow};

/// 最小化窗口
/// # 参数
/// - window: 窗口
/// # 返回
/// 一个包含 Result 的最小化窗口
#[tauri::command]
pub fn window_minimize(window: WebviewWindow) {
    let _ = window.minimize();
}

/// 最大化窗口
/// # 参数
/// - window: 窗口
/// # 返回
/// 一个包含 Result 的最大化窗口
#[tauri::command]
pub fn window_maximize(window: WebviewWindow) {
    if window.is_maximized().unwrap_or(false) {
        let _ = window.unmaximize();
    } else {
        let _ = window.maximize();
    }
}

/// 关闭窗口
/// # 参数
/// - window: 窗口
/// # 返回
/// 一个包含 Result 的关闭窗口
#[tauri::command]
pub fn window_close(window: WebviewWindow) {
    let _ = window.close();
}

/// 设置背景颜色
/// # 参数
/// - window: 窗口
/// - hex: 十六进制颜色
/// # 返回
/// 一个包含 Result 的设置背景颜色
#[tauri::command]
pub fn window_set_background_color(window: WebviewWindow, hex: String) {
    // Tauri 2: best-effort via CSS / ignored if unsupported
    let _ = (window, hex);
}

/// 是否最大化
/// # 参数
/// - window: 窗口
/// # 返回
/// 一个包含 Result 的是否最大化
#[tauri::command]
pub fn window_is_maximized(window: WebviewWindow) -> Value {
    match window.is_maximized() {
        Ok(maximized) => ipc_ok(json!({ "maximized": maximized })),
        Err(e) => ipc_fail_msg(e.to_string()),
    }
}

/// 缩放滚轮步长
/// # 参数
/// - window: 窗口
/// - delta_y: 滚轮步长
/// # 返回
/// 一个包含 Result 的缩放滚轮步长
#[tauri::command]
pub fn window_zoom_wheel_step(_window: WebviewWindow, _delta_y: f64) {
    // macOS Cmd+wheel zoom: frontend scales via CSS; native zoom optional
}

/// 附加最大化事件
/// # 参数
/// - app: 应用
/// # 返回
/// 一个包含 Result 的附加最大化事件
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
