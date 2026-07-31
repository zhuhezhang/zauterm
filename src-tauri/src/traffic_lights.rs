//! Vertically center macOS traffic lights within the custom 40px titlebar.

#[cfg(target_os = "macos")]
pub fn center_traffic_lights(window: &tauri::WebviewWindow) {
    use objc2_app_kit::{NSWindow, NSWindowButton};
    use objc2_foundation::NSPoint;

    /// Must match `.titlebar { height: 40px }` in `src/styles/titlebar.css`.
    const TITLEBAR_HEIGHT: f64 = 40.0;
    const TRAFFIC_LIGHT_X: f64 = 16.0;

    let Ok(ns_ptr) = window.ns_window() else {
        return;
    };
    if ns_ptr.is_null() {
        return;
    }

    unsafe {
        let ns_window = &*(ns_ptr as *const NSWindow);

        let Some(close) = ns_window.standardWindowButton(NSWindowButton::CloseButton) else {
            return;
        };
        let Some(miniaturize) = ns_window.standardWindowButton(NSWindowButton::MiniaturizeButton)
        else {
            return;
        };
        let Some(zoom) = ns_window.standardWindowButton(NSWindowButton::ZoomButton) else {
            return;
        };

        let Some(btn_group) = close.superview() else {
            return;
        };
        let Some(title_bar) = btn_group.superview() else {
            return;
        };

        let close_frame = close.frame();
        let button_h = close_frame.size.height;
        // AppKit y grows upward; origin is bottom-left of the title-bar container.
        let button_y = ((TITLEBAR_HEIGHT - button_h) / 2.0).max(0.0);

        let win_frame = ns_window.frame();
        let mut bar_frame = title_bar.frame();
        bar_frame.size.height = TITLEBAR_HEIGHT;
        bar_frame.origin.y = win_frame.size.height - TITLEBAR_HEIGHT;
        title_bar.setFrame(bar_frame);

        let mini_frame = miniaturize.frame();
        let space = mini_frame.origin.x - close_frame.origin.x;

        let buttons = [close, miniaturize, zoom];
        for (i, btn) in buttons.iter().enumerate() {
            let origin = NSPoint {
                x: TRAFFIC_LIGHT_X + (i as f64) * space,
                y: button_y,
            };
            btn.setFrameOrigin(origin);
        }
    }
}

#[cfg(not(target_os = "macos"))]
pub fn center_traffic_lights(_window: &tauri::WebviewWindow) {}
