//! 串口枚举助手

use serde::Serialize;
use serialport::SerialPortType;

/// 串口信息
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SerialPortInfo {
    /// 路径
    pub path: String,
    /// 制造商
    #[serde(skip_serializing_if = "Option::is_none")]
    pub manufacturer: Option<String>,
    /// 序列号
    #[serde(skip_serializing_if = "Option::is_none")]
    pub serial_number: Option<String>,
    /// PnP ID
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pnp_id: Option<String>,
    /// 位置 ID
    #[serde(skip_serializing_if = "Option::is_none")]
    pub location_id: Option<String>,
    /// 供应商 ID
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vendor_id: Option<String>,
    /// 产品 ID
    #[serde(skip_serializing_if = "Option::is_none")]
    pub product_id: Option<String>,
}

/// 列出串口
/// # 返回
/// 一个包含 Vec<SerialPortInfo> 的错误结果，如果成功则返回 Ok(Vec<SerialPortInfo>)，否则返回 Err(String)
pub fn list_ports() -> Result<Vec<SerialPortInfo>, String> {
    let ports = serialport::available_ports().map_err(|e| e.to_string())?;
    Ok(ports
        .into_iter()
        .map(|p| {
            let mut info = SerialPortInfo {
                path: p.port_name,
                manufacturer: None,
                serial_number: None,
                pnp_id: None,
                location_id: None,
                vendor_id: None,
                product_id: None,
            };
            if let SerialPortType::UsbPort(usb) = p.port_type {
                info.manufacturer = usb.manufacturer;
                info.serial_number = usb.serial_number;
                info.vendor_id = Some(format!("{:04x}", usb.vid));
                info.product_id = Some(format!("{:04x}", usb.pid));
            }
            info
        })
        .collect())
}

/// 解析奇偶校验
/// # 参数
/// - s: 奇偶校验字符串
/// # 返回
/// 一个包含 serialport::Parity 的奇偶校验
pub fn parse_parity(s: &str) -> serialport::Parity {
    match s.to_ascii_lowercase().as_str() {
        "even" => serialport::Parity::Even,
        "odd" => serialport::Parity::Odd,
        _ => serialport::Parity::None,
    }
}

/// 解析数据位
/// # 参数
/// - n: 数据位
/// # 返回
/// 一个包含 serialport::DataBits 的数据位
pub fn parse_data_bits(n: u8) -> serialport::DataBits {
    match n {
        5 => serialport::DataBits::Five,
        6 => serialport::DataBits::Six,
        7 => serialport::DataBits::Seven,
        _ => serialport::DataBits::Eight,
    }
}

/// 解析停止位
/// # 参数
/// - n: 停止位
/// # 返回
/// 一个包含 serialport::StopBits 的停止位
pub fn parse_stop_bits(n: u8) -> serialport::StopBits {
    match n {
        2 => serialport::StopBits::Two,
        _ => serialport::StopBits::One,
    }
}
