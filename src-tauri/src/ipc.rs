//! IPC 响应形状匹配 src/lib/ipc/contract.ts
use serde_json::{Map, Value};

/// 创建一个成功的 IPC 响应
/// # 参数
/// - content 响应内容
/// # 返回
/// 一个包含 "success": true 和 "content" 字段的 JSON 对象
pub fn ipc_ok(content: Value) -> Value {
    serde_json::json!({
        "success": true,
        "content": if content.is_null() { Value::Object(Map::new()) } else { content }
    })
}

/// 创建一个空的 IPC 响应
/// # 返回
/// 一个包含 "success": true 和 "content": {} 的 JSON 对象
pub fn ipc_ok_empty() -> Value {
    ipc_ok(Value::Object(Map::new()))
}

/// 创建一个失败的 IPC 响应
/// # 参数
/// - error 错误信息
/// - error_known 是否已知错误
/// - params 错误参数
/// # 返回
/// 一个包含 "success": false 和 "error": error 和 "errorParams": params 的 JSON 对象
pub fn ipc_fail(error: &str, error_known: bool, params: Option<Value>) -> Value {
    let mut content = Map::new();
    content.insert("error".into(), Value::String(error.to_string()));
    if error_known {
        if let Some(p) = params {
            content.insert("errorParams".into(), p);
        }
    }
    serde_json::json!({
        "success": false,
        "errorKnown": error_known,
        "content": content
    })
}

/// 创建一个已知错误的 IPC 响应
/// # 参数
/// - code 错误代码
/// # 返回
/// 一个包含 "success": false 和 "errorKnown": true 和 "content": {} 的 JSON 对象
pub fn ipc_fail_known(code: &str) -> Value {
    ipc_fail(code, true, None)
}

/// 创建一个已知错误的 IPC 响应，并包含错误参数
/// # 参数
/// - code 错误代码
/// - params 错误参数
/// # 返回
/// 一个包含 "success": false 和 "errorKnown": true 和 "content": params 的 JSON 对象
pub fn ipc_fail_known_params(code: &str, params: Value) -> Value {
    ipc_fail(code, true, Some(params))
}

/// 创建一个未知的错误信息 IPC 响应
/// # 参数
/// - msg 错误信息
/// # 返回
/// 一个包含 "success": false 和 "errorKnown": false 和 "content": {} 的 JSON 对象
pub fn ipc_fail_msg(msg: impl AsRef<str>) -> Value {
    ipc_fail(msg.as_ref(), false, None)
}
