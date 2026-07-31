//! IPC response shape matching src/lib/ipc/contract.ts
use serde_json::{Map, Value};

pub fn ipc_ok(content: Value) -> Value {
    serde_json::json!({
        "success": true,
        "content": if content.is_null() { Value::Object(Map::new()) } else { content }
    })
}

pub fn ipc_ok_empty() -> Value {
    ipc_ok(Value::Object(Map::new()))
}

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

pub fn ipc_fail_known(code: &str) -> Value {
    ipc_fail(code, true, None)
}

pub fn ipc_fail_known_params(code: &str, params: Value) -> Value {
    ipc_fail(code, true, Some(params))
}

pub fn ipc_fail_msg(msg: impl AsRef<str>) -> Value {
    ipc_fail(msg.as_ref(), false, None)
}
