//! Windows socket table reader built on `GetExtendedTcpTable` and
//! `GetExtendedUdpTable` (IP Helper API), the same data source `netstat -ano`
//! uses; no shell is involved.

use std::ffi::c_void;
use std::mem::{offset_of, size_of, size_of_val};
use std::net::{Ipv4Addr, Ipv6Addr, SocketAddr, SocketAddrV4, SocketAddrV6};
use std::ptr;

use windows_sys::Win32::Foundation::{ERROR_INSUFFICIENT_BUFFER, NO_ERROR};
use windows_sys::Win32::NetworkManagement::IpHelper::{
    GetExtendedTcpTable, GetExtendedUdpTable, MIB_TCP6ROW_OWNER_PID, MIB_TCP6TABLE_OWNER_PID,
    MIB_TCPROW_OWNER_PID, MIB_TCPTABLE_OWNER_PID, MIB_UDP6ROW_OWNER_PID, MIB_UDP6TABLE_OWNER_PID,
    MIB_UDPROW_OWNER_PID, MIB_UDPTABLE_OWNER_PID, TCP_TABLE_OWNER_PID_ALL, UDP_TABLE_OWNER_PID,
};
use windows_sys::Win32::Networking::WinSock::{AF_INET, AF_INET6};

use super::{NetSocket, Protocol, SocketState, meaningful_remote, owning_pid};
use crate::error::AppError;

/// The table can grow between the size query and the read; retry a few times.
const MAX_ATTEMPTS: usize = 5;

pub fn sockets() -> Result<Vec<NetSocket>, AppError> {
    let mut sockets = Vec::new();

    let tcp4 = read_table("GetExtendedTcpTable", tcp_query(AF_INET))?;
    let rows: &[MIB_TCPROW_OWNER_PID] =
        table_rows(&tcp4, offset_of!(MIB_TCPTABLE_OWNER_PID, table));
    sockets.extend(rows.iter().map(from_v4_row));

    let tcp6 = read_table("GetExtendedTcpTable", tcp_query(AF_INET6))?;
    let rows: &[MIB_TCP6ROW_OWNER_PID] =
        table_rows(&tcp6, offset_of!(MIB_TCP6TABLE_OWNER_PID, table));
    sockets.extend(rows.iter().map(from_v6_row));

    let udp4 = read_table("GetExtendedUdpTable", udp_query(AF_INET))?;
    let rows: &[MIB_UDPROW_OWNER_PID] =
        table_rows(&udp4, offset_of!(MIB_UDPTABLE_OWNER_PID, table));
    sockets.extend(rows.iter().map(from_udp_v4_row));

    let udp6 = read_table("GetExtendedUdpTable", udp_query(AF_INET6))?;
    let rows: &[MIB_UDP6ROW_OWNER_PID] =
        table_rows(&udp6, offset_of!(MIB_UDP6TABLE_OWNER_PID, table));
    sockets.extend(rows.iter().map(from_udp_v6_row));

    Ok(sockets)
}

/// A table query: fills `buffer` (or reports the needed `size`) and returns a Win32 error code.
type Query = Box<dyn Fn(*mut c_void, &mut u32) -> u32>;

fn tcp_query(family: u16) -> Query {
    Box::new(move |buffer, size| {
        // SAFETY: `read_table` passes either null with size 0 or a writable
        // buffer of at least `size` bytes.
        unsafe {
            GetExtendedTcpTable(
                buffer,
                size,
                0,
                u32::from(family),
                TCP_TABLE_OWNER_PID_ALL,
                0,
            )
        }
    })
}

fn udp_query(family: u16) -> Query {
    Box::new(move |buffer, size| {
        // SAFETY: as in `tcp_query`.
        unsafe { GetExtendedUdpTable(buffer, size, 0, u32::from(family), UDP_TABLE_OWNER_PID, 0) }
    })
}

/// Fetches a raw table, growing the buffer until it fits. The buffer is
/// `u64`-backed so the row structs (4-byte aligned) can be read in place.
fn read_table(api: &str, query: Query) -> Result<Vec<u64>, AppError> {
    let mut buf: Vec<u64> = Vec::new();
    let mut size: u32 = 0;

    for _ in 0..MAX_ATTEMPTS {
        let ptr = if buf.is_empty() {
            ptr::null_mut()
        } else {
            buf.as_mut_ptr().cast()
        };
        // `ptr` is either null with `size == 0` (size query) or points to a
        // writable buffer of at least `size` bytes.
        let rc = query(ptr, &mut size);
        match rc {
            NO_ERROR => return Ok(buf),
            ERROR_INSUFFICIENT_BUFFER => {
                // Leave headroom so a few new sockets don't force another retry.
                let bytes = size as usize + size as usize / 4;
                buf = vec![0u64; bytes.div_ceil(size_of::<u64>())];
                size = size_of_val(buf.as_slice()) as u32;
            }
            code => {
                return Err(AppError::Network {
                    detail: format!("{api} failed with Windows error {code}"),
                });
            }
        }
    }

    Err(AppError::Network {
        detail: format!("the table from {api} kept changing size while it was being read"),
    })
}

/// Views the rows of a `MIB_*TABLE_OWNER_PID` buffer. The entry count is
/// clamped to the buffer length so a malformed header can't cause an overread.
fn table_rows<Row>(buf: &[u64], rows_offset: usize) -> &[Row] {
    let bytes = size_of_val(buf);
    if bytes < rows_offset {
        return &[];
    }
    let base = buf.as_ptr().cast::<u8>();
    // SAFETY: the buffer holds at least 4 bytes (the u32 header) and is 8-byte aligned.
    let declared = unsafe { base.cast::<u32>().read() } as usize;
    let count = declared.min((bytes - rows_offset) / size_of::<Row>());
    // SAFETY: `count` rows fit inside the buffer; rows are plain-old-data
    // structs of integers/bytes, so any bit pattern is valid.
    unsafe { std::slice::from_raw_parts(base.add(rows_offset).cast::<Row>(), count) }
}

fn from_v4_row(row: &MIB_TCPROW_OWNER_PID) -> NetSocket {
    let state = state_from_mib(row.dwState);
    let local = SocketAddr::V4(SocketAddrV4::new(
        Ipv4Addr::from(row.dwLocalAddr.to_ne_bytes()),
        port_from_dword(row.dwLocalPort),
    ));
    let remote = SocketAddr::V4(SocketAddrV4::new(
        Ipv4Addr::from(row.dwRemoteAddr.to_ne_bytes()),
        port_from_dword(row.dwRemotePort),
    ));
    NetSocket {
        protocol: Protocol::Tcp,
        local,
        remote: meaningful_remote(state, remote),
        state,
        pid: owning_pid(row.dwOwningPid),
    }
}

fn from_v6_row(row: &MIB_TCP6ROW_OWNER_PID) -> NetSocket {
    let state = state_from_mib(row.dwState);
    let local = SocketAddr::V6(SocketAddrV6::new(
        Ipv6Addr::from(row.ucLocalAddr),
        port_from_dword(row.dwLocalPort),
        0,
        row.dwLocalScopeId,
    ));
    let remote = SocketAddr::V6(SocketAddrV6::new(
        Ipv6Addr::from(row.ucRemoteAddr),
        port_from_dword(row.dwRemotePort),
        0,
        row.dwRemoteScopeId,
    ));
    NetSocket {
        protocol: Protocol::Tcp6,
        local,
        remote: meaningful_remote(state, remote),
        state,
        pid: owning_pid(row.dwOwningPid),
    }
}

fn from_udp_v4_row(row: &MIB_UDPROW_OWNER_PID) -> NetSocket {
    NetSocket {
        protocol: Protocol::Udp,
        local: SocketAddr::V4(SocketAddrV4::new(
            Ipv4Addr::from(row.dwLocalAddr.to_ne_bytes()),
            port_from_dword(row.dwLocalPort),
        )),
        remote: None,
        state: SocketState::Bound,
        pid: owning_pid(row.dwOwningPid),
    }
}

fn from_udp_v6_row(row: &MIB_UDP6ROW_OWNER_PID) -> NetSocket {
    NetSocket {
        protocol: Protocol::Udp6,
        local: SocketAddr::V6(SocketAddrV6::new(
            Ipv6Addr::from(row.ucLocalAddr),
            port_from_dword(row.dwLocalPort),
            0,
            row.dwLocalScopeId,
        )),
        remote: None,
        state: SocketState::Bound,
        pid: owning_pid(row.dwOwningPid),
    }
}

/// Port fields hold the port in network byte order in their first two bytes.
fn port_from_dword(raw: u32) -> u16 {
    let [hi, lo, _, _] = raw.to_ne_bytes();
    u16::from_be_bytes([hi, lo])
}

/// Maps `MIB_TCP_STATE` values (1..=12).
fn state_from_mib(raw: u32) -> SocketState {
    match raw {
        1 => SocketState::Closed,
        2 => SocketState::Listen,
        3 => SocketState::SynSent,
        4 => SocketState::SynReceived,
        5 => SocketState::Established,
        6 => SocketState::FinWait1,
        7 => SocketState::FinWait2,
        8 => SocketState::CloseWait,
        9 => SocketState::Closing,
        10 => SocketState::LastAck,
        11 => SocketState::TimeWait,
        12 => SocketState::DeleteTcb,
        _ => SocketState::Unknown,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::TcpListener;

    #[test]
    fn port_is_decoded_from_network_byte_order() {
        // Port 1313 = 0x0521, stored as bytes [0x05, 0x21, 0, 0].
        let raw = u32::from_ne_bytes([0x05, 0x21, 0, 0]);
        assert_eq!(port_from_dword(raw), 1313);
    }

    #[test]
    fn unknown_state_values_do_not_panic() {
        assert_eq!(state_from_mib(2), SocketState::Listen);
        assert_eq!(state_from_mib(0), SocketState::Unknown);
        assert_eq!(state_from_mib(99), SocketState::Unknown);
    }

    #[test]
    fn short_buffer_yields_no_rows() {
        let rows: &[MIB_TCPROW_OWNER_PID] = table_rows(&[], 4);
        assert!(rows.is_empty());
    }

    #[test]
    fn finds_a_bound_udp_socket_owned_by_this_process() {
        let socket = std::net::UdpSocket::bind("127.0.0.1:0").unwrap();
        let port = socket.local_addr().unwrap().port();

        let found = sockets().unwrap().into_iter().any(|s| {
            s.protocol == Protocol::Udp
                && s.state == SocketState::Bound
                && s.local.port() == port
                && s.pid == Some(std::process::id())
        });
        assert!(found, "UDP socket on port {port} not reported");
    }

    #[test]
    fn finds_a_listener_owned_by_this_process() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();

        let found = sockets().unwrap().into_iter().any(|c| {
            c.state == SocketState::Listen
                && c.local.port() == port
                && c.pid == Some(std::process::id())
                && c.remote.is_none()
        });
        assert!(found, "listener on port {port} not reported");
    }
}
