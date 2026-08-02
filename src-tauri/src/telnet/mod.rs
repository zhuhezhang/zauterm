//! Telnet 解析器

const TELNET_IAC: u8 = 255;
const TELNET_DO: u8 = 253;
const TELNET_DONT: u8 = 254;
const TELNET_WILL: u8 = 251;
const TELNET_WONT: u8 = 252;
const TELNET_SB: u8 = 250;
const TELNET_SE: u8 = 240;
const TELNET_MAX_PENDING: usize = 65536;

/// Telnet 解析器
pub struct TelnetStripper {
    /// 待处理的缓冲区
    pending: Vec<u8>,
}

impl Default for TelnetStripper {
    fn default() -> Self {
        Self {
            pending: Vec::new(),
        }
    }
}

impl TelnetStripper {
    /// 解析 Telnet 数据
    /// # 参数
    /// - chunk: 数据块
    /// # 返回
    /// 解析后的数据
    pub fn strip(&mut self, chunk: &[u8]) -> Vec<u8> {
        if !self.pending.is_empty() && self.pending.len() + chunk.len() > TELNET_MAX_PENDING {  // 如果待处理的缓冲区不为空且长度大于最大等待长度，则清空
            self.pending.clear();
        }
        let mut buf = std::mem::take(&mut self.pending);  // 获取待处理的缓冲区
        buf.extend_from_slice(chunk);

        let mut output = Vec::new();  // 输出数据
        let mut i = 0usize;
        let len = buf.len();

        while i < len {
            if buf[i] != TELNET_IAC {
                output.push(buf[i]);
                i += 1;
                continue;
            }
            if i + 1 >= len {
                break;  // 如果数据块长度小于2，则跳出循环
            }
            let cmd = buf[i + 1];
            if cmd == TELNET_IAC {
                output.push(TELNET_IAC);  // 添加 IAC 字节
                i += 2;
                continue;
            }
            if cmd == TELNET_DO || cmd == TELNET_DONT || cmd == TELNET_WILL || cmd == TELNET_WONT {
                if i + 2 >= len {
                    break;  // 如果数据块长度小于3，则跳出循环
                }
                i += 3;
                continue;
            }
            if cmd == TELNET_SB {
                if i + 3 > len {
                    break;  // 如果数据块长度小于4，则跳出循环
                }
                let mut j = i + 3;
                let mut closed = false;  // 是否关闭
                while j < len {
                    if buf[j] == TELNET_IAC {
                        if j + 1 >= len {
                            break;  // 如果数据块长度小于5，则跳出循环
                        }
                        if buf[j + 1] == TELNET_SE {
                            j += 2;
                            closed = true;  // 设置为关闭
                            break;
                        }
                        if buf[j + 1] == TELNET_IAC {
                            j += 2;
                            continue;
                        }
                        j += 2;
                        continue;
                    }
                    j += 1;
                }
                if !closed {
                    break;  // 如果未关闭，则跳出循环
                }
                i = j;
                continue;
            }
            i += 2;
        }

        if i < len {
            self.pending = buf[i..].to_vec();  // 将剩余数据添加到待处理的缓冲区
        } else {
            self.pending.clear();  // 清空待处理的缓冲区
        }
        output
    }

    /// 清空待处理的缓冲区
    pub fn clear(&mut self) {
        self.pending.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 测试解析 Telnet WILL 数据
    #[test]
    fn strips_will_and_keeps_data() {
        let mut s = TelnetStripper::default();  // 创建 Telnet 解析器
        let mut chunk = vec![b'h', b'i'];
        chunk.extend_from_slice(&[TELNET_IAC, TELNET_WILL, 1]);  // 添加 IAC 字节
        chunk.extend_from_slice(b"yo");  // 添加数据
        let out = s.strip(&chunk);  // 解析数据
        assert_eq!(out, b"hiyo");
    }

    /// 测试解析 Telnet IAC 数据
    #[test]
    fn escaped_iac() {
        let mut s = TelnetStripper::default();  // 创建 Telnet 解析器
        let out = s.strip(&[TELNET_IAC, TELNET_IAC, b'x']);  // 解析数据
        assert_eq!(out, &[255, b'x']);  // 确保解析后的数据为 [255, b'x']
    }
}
