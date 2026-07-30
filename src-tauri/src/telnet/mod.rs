//! Telnet IAC stripper + session helpers

const TELNET_IAC: u8 = 255;
const TELNET_DO: u8 = 253;
const TELNET_DONT: u8 = 254;
const TELNET_WILL: u8 = 251;
const TELNET_WONT: u8 = 252;
const TELNET_SB: u8 = 250;
const TELNET_SE: u8 = 240;
const TELNET_MAX_PENDING: usize = 65536;

pub struct TelnetStripper {
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
    pub fn strip(&mut self, chunk: &[u8]) -> Vec<u8> {
        if !self.pending.is_empty() && self.pending.len() + chunk.len() > TELNET_MAX_PENDING {
            self.pending.clear();
        }
        let mut buf = std::mem::take(&mut self.pending);
        buf.extend_from_slice(chunk);

        let mut output = Vec::new();
        let mut i = 0usize;
        let len = buf.len();

        while i < len {
            if buf[i] != TELNET_IAC {
                output.push(buf[i]);
                i += 1;
                continue;
            }
            if i + 1 >= len {
                break;
            }
            let cmd = buf[i + 1];
            if cmd == TELNET_IAC {
                output.push(TELNET_IAC);
                i += 2;
                continue;
            }
            if cmd == TELNET_DO || cmd == TELNET_DONT || cmd == TELNET_WILL || cmd == TELNET_WONT {
                if i + 2 >= len {
                    break;
                }
                i += 3;
                continue;
            }
            if cmd == TELNET_SB {
                if i + 3 > len {
                    break;
                }
                let mut j = i + 3;
                let mut closed = false;
                while j < len {
                    if buf[j] == TELNET_IAC {
                        if j + 1 >= len {
                            break;
                        }
                        if buf[j + 1] == TELNET_SE {
                            j += 2;
                            closed = true;
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
                    break;
                }
                i = j;
                continue;
            }
            i += 2;
        }

        if i < len {
            self.pending = buf[i..].to_vec();
        } else {
            self.pending.clear();
        }
        output
    }

    pub fn clear(&mut self) {
        self.pending.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn strips_will_and_keeps_data() {
        let mut s = TelnetStripper::default();
        let mut chunk = vec![b'h', b'i'];
        chunk.extend_from_slice(&[TELNET_IAC, TELNET_WILL, 1]);
        chunk.extend_from_slice(b"yo");
        let out = s.strip(&chunk);
        assert_eq!(out, b"hiyo");
    }

    #[test]
    fn escaped_iac() {
        let mut s = TelnetStripper::default();
        let out = s.strip(&[TELNET_IAC, TELNET_IAC, b'x']);
        assert_eq!(out, &[255, b'x']);
    }
}
