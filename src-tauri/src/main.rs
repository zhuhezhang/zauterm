//! Zauterm 主程序入口

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
// 与 lib.rs 相同：抑制 bin 链接阶段的 OpenSSL LNK4099 / linker_messages 警告
#![cfg_attr(windows, allow(linker_messages))]
/*
 * 条件编译属性
 * #![...] 作用于整个 crate，不加 ! 则只作用于 main 函数，也就是后面紧跟的函数、结构体、模块等
 * cfg_attr(条件, 属性) 条件成立时才加上后面的属性
 * not(debug_assertions) 非 debug 构建（即 release）
 * windows_subsystem = "windows" 告诉链接器：这是 GUI 程序，不要弹黑色控制台窗口
 *
 * Crate 是编译单元，可以理解为一个代码包。每个 Crate 都是一个独立的项目，它可以是一个二进制可执行文件，也可以是一个库。
 * Rust 编译器会将每个 Crate 编译成独立的文件，二进制 Crate 通常是独立的应用程序，而库 Crate 则用于被其他 Crate 引用。
 * Crate分为二进制 Crate和库 Crate：
 * - 二进制 Crate：一个带有 main 函数的 Crate，可以编译成可执行文件。默认情况下，一个 Rust 项目中的 src/main.rs 文件即为一个二进制 Crate。
 * - 库 Crate：没有 main 函数，而是提供功能模块供其他 Crate 使用。默认情况下，src/lib.rs 是一个库 Crate。
 */

fn main() {
    zauterm_lib::run();  // zauterm_lib在Cargo.toml中定义，run在lib.rs中定义
}
