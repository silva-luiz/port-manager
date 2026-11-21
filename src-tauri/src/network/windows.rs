//! Windows TCP table reader built on `GetExtendedTcpTable` (IP Helper API).
//! This is the same data source `netstat -ano` uses; no shell is involved.

use std::mem::{offset_of, size_of, size_of_val};
use std::net::{Ipv4Addr, Ipv6Addr, SocketAddr, SocketAddrV4, SocketAddrV6};
use std::ptr;

use windows_sys::Win32::Foundation::{ERROR_INSUFFICIENT_BUFFER, NO_ERROR};
use windows_sys::Win32::NetworkManagement::IpHelper::{
    GetExtendedTcpTable, MIB_TCP6ROW_OWNER_PID, MIB_TCP6TABLE_OWNER_PID, MIB_TCPROW_OWNER_PID,
    MIB_TCPTABLE_OWNER_PID, TCP_TABLE_OWNER_PID_ALL,
};
use windows_sys::Win32::Networking::WinSock::{AF_INET, AF_INET6};

use super::{Protocol, TcpConnection, TcpState, meaningful_remote, owning_pid};
use crate::error::AppError;

/// The table can grow between the size query and the read; retry a few times.
const MAX_ATTEMPTS: usize = 5;

pub fn tcp_connections() -> Result<Vec<TcpConnection>, AppError> {
    let mut connections = Vec::new();

    let v4 = read_table(AF_INET)?;
    let v4_rows: &[MIB_TCPROW_OWNER_PID] =
        table_rows(&v4, offset_of!(MIB_TCPTABLE_OWNER_PID, table));
    connections.extend(v4_rows.iter().map(from_v4_row));

    let v6 = read_table(AF_INET6)?;
    let v6_rows: &[MIB_TCP6ROW_OWNER_PID] =
        table_rows(&v6, offset_of!(MIB_TCP6TABLE_OWNER_PID, table));
    connections.extend(v6_rows.iter().map(from_v6_row));

    Ok(connections)
}

/// Fetches the raw table for one address family. The buffer is `u64`-backed
/// so the row structs (4-byte aligned) can be read in place.
fn read_table(family: u16) -> Result<Vec<u64>, AppError> {
    let mut buf: Vec<u64> = Vec::new();
    let mut size: u32 = 0;

    for _ in 0..MAX_ATTEMPTS {
        let ptr = if buf.is_empty() {
            ptr::null_mut()
        } else {
            buf.as_mut_ptr().cast()
        };
        // SAFETY: `ptr` is either null with `size == 0` (size query) or points
        // to a writable buffer of at least `size` bytes.
        let rc = unsafe {
            GetExtendedTcpTable(
                ptr,
                &mut size,
                0,
                u32::from(family),
                TCP_TABLE_OWNER_PID_ALL,
                0,
            )
        };
        match rc {
            NO_ERROR => return Ok(buf),
            ERROR_INSUFFICIENT_BUFFER => {
                // Leave headroom so a few new sockets don't force another retry.
                let bytes = size as usize + size as usize / 4;
                buf = vec![0u64; bytes.div_ceil(size_of::<u64>())];
                size = size_of_val(buf.as_slice()) as u32;
            }
            code => {
                return Err(AppError::Network(format!(
                    "GetExtendedTcpTable failed with Windows error {code}"
                )));
            }
        }
    }

    Err(AppError::Network(
        "the TCP table kept changing size while it was being read; try again".into(),
    ))
}

/// Views the rows of a `MIB_TCP*TABLE_OWNER_PID` buffer. The entry count is
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

fn from_v4_row(row: &MIB_TCPROW_OWNER_PID) -> TcpConnection {
    let state = state_from_mib(row.dwState);
    let local = SocketAddr::V4(SocketAddrV4::new(
        Ipv4Addr::from(row.dwLocalAddr.to_ne_bytes()),
        port_from_dword(row.dwLocalPort),
    ));
    let remote = SocketAddr::V4(SocketAddrV4::new(
        Ipv4Addr::from(row.dwRemoteAddr.to_ne_bytes()),
        port_from_dword(row.dwRemotePort),
    ));
    TcpConnection {
        protocol: Protocol::Tcp,
        local,
        remote: meaningful_remote(state, remote),
        state,
        pid: owning_pid(row.dwOwningPid),
    }
}

fn from_v6_row(row: &MIB_TCP6ROW_OWNER_PID) -> TcpConnection {
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
    TcpConnection {
        protocol: Protocol::Tcp6,
        local,
        remote: meaningful_remote(state, remote),
        state,
        pid: owning_pid(row.dwOwningPid),
    }
}

/// Port fields hold the port in network byte order in their first two bytes.
fn port_from_dword(raw: u32) -> u16 {
    let [hi, lo, _, _] = raw.to_ne_bytes();
    u16::from_be_bytes([hi, lo])
}

/// Maps `MIB_TCP_STATE` values (1..=12).
fn state_from_mib(raw: u32) -> TcpState {
    match raw {
        1 => TcpState::Closed,
        2 => TcpState::Listen,
        3 => TcpState::SynSent,
        4 => TcpState::SynReceived,
        5 => TcpState::Established,
        6 => TcpState::FinWait1,
        7 => TcpState::FinWait2,
        8 => TcpState::CloseWait,
        9 => TcpState::Closing,
        10 => TcpState::LastAck,
        11 => TcpState::TimeWait,
        12 => TcpState::DeleteTcb,
        _ => TcpState::Unknown,
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
        assert_eq!(state_from_mib(2), TcpState::Listen);
        assert_eq!(state_from_mib(0), TcpState::Unknown);
        assert_eq!(state_from_mib(99), TcpState::Unknown);
    }

    #[test]
    fn short_buffer_yields_no_rows() {
        let rows: &[MIB_TCPROW_OWNER_PID] = table_rows(&[], 4);
        assert!(rows.is_empty());
    }

    #[test]
    fn finds_a_listener_owned_by_this_process() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();

        let found = tcp_connections().unwrap().into_iter().any(|c| {
            c.state == TcpState::Listen
                && c.local.port() == port
                && c.pid == Some(std::process::id())
                && c.remote.is_none()
        });
        assert!(found, "listener on port {port} not reported");
    }
}
