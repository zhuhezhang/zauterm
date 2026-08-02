//! 终端编码：Unicode <-> 字节，二进制线用于前端

use encoding_rs::{Encoding, UTF_8, GBK, GB18030, BIG5, SHIFT_JIS, EUC_JP, EUC_KR, WINDOWS_1252, KOI8_R};

/// 规范化编码
/// # 参数
/// - name: 编码名称
/// # 返回
/// 一个包含 &'static Encoding 的编码
pub fn normalize_encoding(name: Option<&str>) -> &'static Encoding {
    let n = name.unwrap_or("utf-8").trim().to_ascii_lowercase().replace('_', "-");
    match n.as_str() {
        "utf-8" | "utf8" => UTF_8,
        "gbk" | "cp936" => GBK,
        "gb18030" => GB18030,
        "big5" | "big-5" | "cp950" => BIG5,
        "shift_jis" | "shift-jis" | "sjis" | "cp932" => SHIFT_JIS,
        "euc-jp" | "eucjp" => EUC_JP,
        "euc-kr" | "euckr" | "cp949" => EUC_KR,
        "windows-1252" | "cp1252" => WINDOWS_1252,
        "iso-8859-1" | "latin1" | "latin-1" => WINDOWS_1252,
        "koi8-r" => KOI8_R,
        _ => UTF_8,
    }
}

/// Unicode 字符串 -> 终端字节使用会话编码
/// # 参数
/// - s: 字符串
/// - encoding: 编码
/// # 返回
/// 一个包含 Vec<u8> 的终端字节
pub fn encode_unicode_to_terminal_bytes(s: &str, encoding: Option<&str>) -> Vec<u8> {
    let enc = normalize_encoding(encoding);
    if enc == UTF_8 {
        return s.as_bytes().to_vec();
    }
    let (cow, _, _) = enc.encode(s);
    cow.into_owned()
}

/// 字节 -> 二进制线字符串 (Latin-1 / 一个字节一个字符，匹配 Node Buffer.toString('binary'))
/// # 参数
/// - data: 数据
/// # 返回
/// 一个包含 String 的二进制线字符串
pub fn buffer_to_binary_wire(data: &[u8]) -> String {
    data.iter().map(|&b| char::from(b)).collect()
}

/// 编码输出终端数据
/// # 参数
/// - data: 数据
/// - encoding: 编码
/// # 返回
/// 一个包含 Vec<u8> 的输出终端数据
pub fn encode_outgoing_terminal_data(data: &str, encoding: Option<&str>) -> Vec<u8> {
    encode_unicode_to_terminal_bytes(data, encoding)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 二进制线字节往返测试
    #[test]
    fn binary_wire_roundtrip_bytes() {
        let bytes = vec![0u8, 65, 255, 10];
        let wire = buffer_to_binary_wire(&bytes);
        assert_eq!(wire.chars().count(), 4);
        let back: Vec<u8> = wire.chars().map(|c| c as u8).collect();
        assert_eq!(back, bytes);
    }
}
