//! Terminal encoding: Unicode <-> bytes, binary-wire for frontend

use encoding_rs::{Encoding, UTF_8, GBK, GB18030, BIG5, SHIFT_JIS, EUC_JP, EUC_KR, WINDOWS_1252, KOI8_R};

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

/// Unicode string -> terminal bytes using session encoding
pub fn encode_unicode_to_terminal_bytes(s: &str, encoding: Option<&str>) -> Vec<u8> {
    let enc = normalize_encoding(encoding);
    if enc == UTF_8 {
        return s.as_bytes().to_vec();
    }
    let (cow, _, _) = enc.encode(s);
    cow.into_owned()
}

/// Bytes -> binary-wire string (Latin-1 / one byte per char), matching Node Buffer.toString('binary')
pub fn buffer_to_binary_wire(data: &[u8]) -> String {
    data.iter().map(|&b| char::from(b)).collect()
}

pub fn encode_outgoing_terminal_data(data: &str, encoding: Option<&str>) -> Vec<u8> {
    encode_unicode_to_terminal_bytes(data, encoding)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn binary_wire_roundtrip_bytes() {
        let bytes = vec![0u8, 65, 255, 10];
        let wire = buffer_to_binary_wire(&bytes);
        assert_eq!(wire.chars().count(), 4);
        let back: Vec<u8> = wire.chars().map(|c| c as u8).collect();
        assert_eq!(back, bytes);
    }
}
