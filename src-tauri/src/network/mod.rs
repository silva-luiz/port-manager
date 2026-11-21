//! TCP connection discovery. Reading the OS connection table is platform
//! specific and lives in per-OS submodules; the types here are shared.

#[cfg(windows)]
mod windows;

use serde::Serialize;
use std::net::SocketAddr;

use crate::error::AppError;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Protocol {
    Tcp,
    Tcp6,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum TcpState {
    Closed,
    Listen,
    SynSent,
    SynReceived,
    Established,
    FinWait1,
    FinWait2,
    CloseWait,
    Closing,
    LastAck,
    TimeWait,
    DeleteTcb,
    Unknown,
}

impl TcpState {
    /// A socket in TIME_WAIT or CLOSED is a leftover of a finished
    /// connection; it does not mean anything is using the port.
    pub fn is_live(self) -> bool {
        !matches!(self, TcpState::TimeWait | TcpState::Closed)
    }
}

/// One row of the OS TCP table, before any process information is attached.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TcpConnection {
    pub protocol: Protocol,
    pub local: SocketAddr,
    /// `None` for listening sockets and rows without a meaningful peer.
    pub remote: Option<SocketAddr>,
    pub state: TcpState,
    /// `None` when the OS does not attribute the socket to a process (PID 0).
    pub pid: Option<u32>,
}

/// Lists every IPv4 and IPv6 TCP socket known to the operating system.
pub fn tcp_connections() -> Result<Vec<TcpConnection>, AppError> {
    #[cfg(windows)]
    {
        windows::tcp_connections()
    }
    #[cfg(not(windows))]
    {
        Err(AppError::Unsupported {
            detail: "port discovery is only implemented for Windows".into(),
        })
    }
}

/// Treats an all-zero peer (`0.0.0.0:0` / `[::]:0`) as "no remote address".
fn meaningful_remote(state: TcpState, remote: SocketAddr) -> Option<SocketAddr> {
    if state == TcpState::Listen || (remote.ip().is_unspecified() && remote.port() == 0) {
        None
    } else {
        Some(remote)
    }
}

/// PID 0 is the idle pseudo-process; Windows reports it for sockets that no
/// longer belong to any process (e.g. TIME_WAIT).
fn owning_pid(raw: u32) -> Option<u32> {
    (raw != 0).then_some(raw)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unspecified_remote_is_dropped() {
        let zero: SocketAddr = "0.0.0.0:0".parse().unwrap();
        assert_eq!(meaningful_remote(TcpState::Established, zero), None);
        let zero6: SocketAddr = "[::]:0".parse().unwrap();
        assert_eq!(meaningful_remote(TcpState::TimeWait, zero6), None);
    }

    #[test]
    fn listening_sockets_have_no_remote() {
        let peer: SocketAddr = "10.0.0.1:443".parse().unwrap();
        assert_eq!(meaningful_remote(TcpState::Listen, peer), None);
        assert_eq!(meaningful_remote(TcpState::Established, peer), Some(peer));
    }

    #[test]
    fn finished_connections_are_not_live() {
        assert!(TcpState::Listen.is_live());
        assert!(TcpState::Established.is_live());
        assert!(TcpState::CloseWait.is_live());
        assert!(!TcpState::TimeWait.is_live());
        assert!(!TcpState::Closed.is_live());
    }

    #[test]
    fn pid_zero_means_no_process() {
        assert_eq!(owning_pid(0), None);
        assert_eq!(owning_pid(4), Some(4));
    }
}
