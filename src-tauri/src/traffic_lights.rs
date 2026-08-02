//! 在自定义的 40px 标题栏中垂直居中 macOS 红绿灯

/// 在 macOS 上调整红绿灯位置，使其垂直居中于自定义的 40px 标题栏
/// 
/// tauri.conf.json 用了 titleBarStyle: Overlay + 自定义前端标题栏。
/// 系统红绿灯还是原生控件，默认位置往往和 40px 自定义栏对不齐，所以要用 AppKit（通过 objc2）直接改它们的 frame
#[cfg(target_os = "macos")]
pub fn center_traffic_lights(window: &tauri::WebviewWindow) {
    use objc2_app_kit::{NSWindow, NSWindowButton};
    use objc2_foundation::NSPoint;

    const TITLEBAR_HEIGHT: f64 = 40.0;  // 必须匹配 `src/styles/titlebar.css` 中的 `.titlebar { height: 40px }`
    const TRAFFIC_LIGHT_X: f64 = 16.0;

    let Ok(ns_ptr) = window.ns_window() else {
        return;  // 获取不到窗口则跳过
    };
    if ns_ptr.is_null() {
        return;  // 窗口指针为空则跳过
    }

    unsafe {  // "感觉不如叫 suppress_check(忽略检查) 简单明了，声明这里禁用了检查，安不安全你自己看着办"
        let ns_window = &*(ns_ptr as *const NSWindow);

        // 分别找到三个按钮和他们的容器
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

        let Some(btn_group) = close.superview() else {  // 按钮容器
            return;
        };
        let Some(title_bar) = btn_group.superview() else {  // 标题栏容器
            return;
        };

        // AppKit 坐标：原点在左下，y 向上。在 40px 高的标题栏里，按钮高度为 button_h，上下留白各一半 → (40 - h) / 2。.max(0.0) 防止算出负数
        let close_frame = close.frame();
        let button_h = close_frame.size.height;
        let button_y = ((TITLEBAR_HEIGHT - button_h) / 2.0).max(0.0);

        // 窗口总高减去 40，得到标题栏底部的 y，让原生 title bar 区域和自定义 40px 栏对齐
        let win_frame = ns_window.frame();
        let mut bar_frame = title_bar.frame();
        bar_frame.size.height = TITLEBAR_HEIGHT;
        bar_frame.origin.y = win_frame.size.height - TITLEBAR_HEIGHT;
        title_bar.setFrame(bar_frame);

        let mini_frame = miniaturize.frame();
        let space = mini_frame.origin.x - close_frame.origin.x;  // space：系统默认「关」和「黄」之间的间距，用来保持原生观感

        let buttons = [close, miniaturize, zoom];
        for (i, btn) in buttons.iter().enumerate() {  // 遍历三个按钮，设置它们的位置
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
