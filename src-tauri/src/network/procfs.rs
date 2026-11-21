//! Parser for Linux `/proc/net/{tcp,tcp6,udp,udp6}`. Pure text processing, so
//! it is compiled and tested on every platform; only `linux.rs` reads files.

use std::net::{Ipv4Addr, Ipv6Addr, SocketAddr, SocketAddrV4, SocketAddrV6};

use super::{Protocol, SocketState, meaningful_remote};

/// One parsed row: a socket plus the inode used to find its owning process.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProcNetEntry {
    pub local: SocketAddr,
    pub remote: Option<SocketAddr>,
    pub state: SocketState,
    /// 0 when the kernel reports no inode (e.g. TIME_WAIT).
    pub inode: u64,
}

/// Parses a whole table. Malformed lines are skipped rather than failing the scan.
pub fn parse_net_table(content: &str, protocol: Protocol) -> Vec<ProcNetEntry> {
    content
        .lines()
        .skip(1) // header
        .filter_map(|line| parse_line(line, protocol))
        .collect()
}

fn parse_line(line: &str, protocol: Protocol) -> Option<ProcNetEntry> {
    // sl local_address rem_address st tx:rx tr:when retrnsmt uid timeout inode ...
    let fields: Vec<&str> = line.split_whitespace().collect();
    let local = parse_address(fields.get(1)?)?;
    let remote = parse_address(fields.get(2)?)?;
    let state = match protocol {
        Protocol::Tcp | Protocol::Tcp6 => tcp_state(u8::from_str_radix(fields.get(3)?, 16).ok()?),
        Protocol::Udp | Protocol::Udp6 => SocketState::Bound,
    };
    let inode = fields.get(9)?.parse().ok()?;
    Some(ProcNetEntry {
        local,
        remote: match protocol {
            Protocol::Udp | Protocol::Udp6 => None,
            _ => meaningful_remote(state, remote),
        },
        state,
        inode,
    })
}

/// `ADDR:PORT` in hex. The kernel prints each 32-bit address word in host
/// byte order and the port as a plain number.
fn parse_address(field: &str) -> Option<SocketAddr> {
    let (addr, port) = field.split_once(':')?;
    let port = u16::from_str_radix(port, 16).ok()?;
    match addr.len() {
        8 => {
            let word = u32::from_str_radix(addr, 16).ok()?;
            Some(SocketAddr::V4(SocketAddrV4::new(
                Ipv4Addr::from(word.to_ne_bytes()),
                port,
            )))
        }
        32 => {
            let mut bytes = [0u8; 16];
            for (i, chunk) in bytes.chunks_mut(4).enumerate() {
                let word = u32::from_str_radix(addr.get(i * 8..i * 8 + 8)?, 16).ok()?;
                chunk.copy_from_slice(&word.to_ne_bytes());
            }
            Some(SocketAddr::V6(SocketAddrV6::new(
                Ipv6Addr::from(bytes),
                port,
                0,
                0,
            )))
        }
        _ => None,
    }
}

/// Linux `TCP_*` state numbers (include/net/tcp_states.h).
fn tcp_state(raw: u8) -> SocketState {
    match raw {
        0x01 => SocketState::Established,
        0x02 => SocketState::SynSent,
        0x03 => SocketState::SynReceived,
        0x04 => SocketState::FinWait1,
        0x05 => SocketState::FinWait2,
        0x06 => SocketState::TimeWait,
        0x07 => SocketState::Closed,
        0x08 => SocketState::CloseWait,
        0x09 => SocketState::LastAck,
        0x0A => SocketState::Listen,
        0x0B => SocketState::Closing,
        _ => SocketState::Unknown,
    }
}

/// Inode from an fd symlink target such as `socket:[12345]`.
pub fn socket_inode(link: &str) -> Option<u64> {
    link.strip_prefix("socket:[")?
        .strip_suffix(']')?
        .parse()
        .ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    // Little-endian hosts (x86-64, aarch64) print 127.0.0.1 as 0100007F.
    const TCP: &str = "  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode
   0: 0100007F:0BB8 00000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 41234 1 0000000000000000 100 0 0 10 0
   1: 0100007F:0BB8 0100007F:D431 01 00000000:00000000 00:00000000 00000000  1000        0 41300 1 0000000000000000 20 4 30 10 -1
   2: 0100007F:1F90 0100007F:D432 06 00000000:00000000 03:00000F8B 00000000     0        0 0 3 0000000000000000
   garbage line
";

    #[cfg(target_endian = "little")]
    #[test]
    fn parses_ipv4_tcp_rows() {
        let rows = parse_net_table(TCP, Protocol::Tcp);
        assert_eq!(rows.len(), 3, "malformed line is skipped");

        assert_eq!(rows[0].local, "127.0.0.1:3000".parse().unwrap());
        assert_eq!(rows[0].state, SocketState::Listen);
        assert_eq!(rows[0].remote, None);
        assert_eq!(rows[0].inode, 41234);

        assert_eq!(rows[1].state, SocketState::Established);
        assert_eq!(rows[1].remote, Some("127.0.0.1:54321".parse().unwrap()));

        assert_eq!(rows[2].state, SocketState::TimeWait);
        assert_eq!(rows[2].inode, 0);
    }

    #[cfg(target_endian = "little")]
    #[test]
    fn parses_ipv6_and_udp_rows() {
        let tcp6 = "header
   0: 00000000000000000000000001000000:1F90 00000000000000000000000000000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 5555 1";
        let rows = parse_net_table(tcp6, Protocol::Tcp6);
        assert_eq!(rows[0].local, "[::1]:8080".parse().unwrap());
        assert_eq!(rows[0].state, SocketState::Listen);

        let udp = "header
   7: 00000000:14E9 00000000:0000 07 00000000:00000000 00:00000000 00000000   101        0 777 2";
        let rows = parse_net_table(udp, Protocol::Udp);
        assert_eq!(rows[0].local, "0.0.0.0:5353".parse().unwrap());
        assert_eq!(rows[0].state, SocketState::Bound);
        assert_eq!(rows[0].remote, None);
    }

    #[test]
    fn unknown_states_and_bad_addresses_are_handled() {
        assert_eq!(tcp_state(0x0C), SocketState::Unknown);
        assert_eq!(parse_address("XYZ:0050"), None);
        assert_eq!(parse_address("0100007F"), None);
    }

    #[test]
    fn reads_socket_inodes_from_fd_links() {
        assert_eq!(socket_inode("socket:[41234]"), Some(41234));
        assert_eq!(socket_inode("pipe:[41234]"), None);
        assert_eq!(socket_inode("/dev/null"), None);
    }
}
