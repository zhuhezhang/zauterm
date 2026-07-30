//! Serial port enumeration helpers

use serde::Serialize;
use serialport::SerialPortType;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SerialPortInfo {
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub manufacturer: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub serial_number: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pnp_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub location_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vendor_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub product_id: Option<String>,
}

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

pub fn parse_parity(s: &str) -> serialport::Parity {
    match s.to_ascii_lowercase().as_str() {
        "even" => serialport::Parity::Even,
        "odd" => serialport::Parity::Odd,
        _ => serialport::Parity::None,
    }
}

pub fn parse_data_bits(n: u8) -> serialport::DataBits {
    match n {
        5 => serialport::DataBits::Five,
        6 => serialport::DataBits::Six,
        7 => serialport::DataBits::Seven,
        _ => serialport::DataBits::Eight,
    }
}

pub fn parse_stop_bits(n: u8) -> serialport::StopBits {
    match n {
        2 => serialport::StopBits::Two,
        _ => serialport::StopBits::One,
    }
}
