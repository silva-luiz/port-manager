//! Combines connection discovery and process names into the snapshot shown
//! by the UI, and computes the dashboard summary in one place.

use serde::Serialize;
use std::collections::{HashMap, HashSet};

use crate::clock;
use crate::error::AppError;
use crate::network::{self, Protocol, TcpConnection, TcpState};
use crate::process;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PortEntry {
    pub protocol: Protocol,
    pub local_address: String,
    pub local_port: u16,
    pub remote_address: Option<String>,
    pub remote_port: Option<u16>,
    pub state: TcpState,
    /// Whether the socket still counts as in use (see `TcpState::is_live`).
    /// The UI relies on this instead of re-implementing the rule.
    pub live: bool,
    pub pid: Option<u32>,
    /// `None` when there is no owning process or it exited before lookup.
    pub process_name: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PortSummary {
    /// Distinct local ports with a live socket (excludes TIME_WAIT/CLOSED).
    pub active_ports: usize,
    /// Distinct PIDs owning at least one socket.
    pub unique_processes: usize,
    /// Distinct local ports in LISTEN state (IPv4 and IPv6 counted once).
    pub listening_ports: usize,
    pub established_connections: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PortSnapshot {
    pub entries: Vec<PortEntry>,
    pub summary: PortSummary,
    pub scanned_at_ms: u64,
    /// Set when connections were read but process names could not be.
    pub process_lookup_error: Option<AppError>,
}

pub fn snapshot() -> Result<PortSnapshot, AppError> {
    let connections = network::tcp_connections()?;

    // Missing names are not fatal: the ports are still worth showing.
    let (names, process_lookup_error) = match process::process_names() {
        Ok(names) => (names, None),
        Err(e) => (HashMap::new(), Some(e)),
    };

    let entries = build_entries(connections, &names);
    Ok(PortSnapshot {
        summary: summarize(&entries),
        entries,
        scanned_at_ms: clock::now_ms()?,
        process_lookup_error,
    })
}

fn build_entries(connections: Vec<TcpConnection>, names: &HashMap<u32, String>) -> Vec<PortEntry> {
    connections
        .into_iter()
        .map(|c| PortEntry {
            protocol: c.protocol,
            local_address: c.local.ip().to_string(),
            local_port: c.local.port(),
            remote_address: c.remote.map(|r| r.ip().to_string()),
            remote_port: c.remote.map(|r| r.port()),
            state: c.state,
            live: c.state.is_live(),
            process_name: c.pid.and_then(|pid| names.get(&pid).cloned()),
            pid: c.pid,
        })
        .collect()
}

fn summarize(entries: &[PortEntry]) -> PortSummary {
    PortSummary {
        active_ports: entries
            .iter()
            .filter(|e| e.live)
            .map(|e| e.local_port)
            .collect::<HashSet<_>>()
            .len(),
        unique_processes: entries
            .iter()
            .filter_map(|e| e.pid)
            .collect::<HashSet<_>>()
            .len(),
        listening_ports: entries
            .iter()
            .filter(|e| e.state == TcpState::Listen)
            .map(|e| e.local_port)
            .collect::<HashSet<_>>()
            .len(),
        established_connections: entries
            .iter()
            .filter(|e| e.state == TcpState::Established)
            .count(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn conn(protocol: Protocol, local: &str, state: TcpState, pid: Option<u32>) -> TcpConnection {
        TcpConnection {
            protocol,
            local: local.parse().unwrap(),
            remote: None,
            state,
            pid,
        }
    }

    #[test]
    fn attaches_process_names_and_tolerates_missing_ones() {
        let names = HashMap::from([(100, "hugo.exe".to_string())]);
        let entries = build_entries(
            vec![
                conn(Protocol::Tcp, "127.0.0.1:1313", TcpState::Listen, Some(100)),
                conn(Protocol::Tcp, "127.0.0.1:5000", TcpState::Listen, Some(200)),
                conn(Protocol::Tcp, "127.0.0.1:6000", TcpState::TimeWait, None),
            ],
            &names,
        );
        assert_eq!(entries[0].process_name.as_deref(), Some("hugo.exe"));
        assert_eq!(entries[1].process_name, None, "PID exited before lookup");
        assert_eq!(entries[2].pid, None);
        assert_eq!(entries[2].process_name, None);
    }

    #[test]
    fn summary_counts_distinct_ports_and_processes() {
        let entries = build_entries(
            vec![
                // Same port on IPv4 and IPv6 counts as one listening port.
                conn(Protocol::Tcp, "0.0.0.0:80", TcpState::Listen, Some(1)),
                conn(Protocol::Tcp6, "[::]:80", TcpState::Listen, Some(1)),
                conn(
                    Protocol::Tcp,
                    "127.0.0.1:5000",
                    TcpState::Established,
                    Some(2),
                ),
                conn(
                    Protocol::Tcp,
                    "127.0.0.1:5001",
                    TcpState::Established,
                    Some(2),
                ),
                conn(Protocol::Tcp, "127.0.0.1:6000", TcpState::TimeWait, None),
            ],
            &HashMap::new(),
        );
        assert_eq!(
            summarize(&entries),
            PortSummary {
                active_ports: 3,
                unique_processes: 2,
                listening_ports: 1,
                established_connections: 2,
            }
        );
    }

    #[test]
    fn entry_serializes_with_camel_case_fields() {
        let entries = build_entries(
            vec![conn(
                Protocol::Tcp6,
                "[::1]:8080",
                TcpState::Listen,
                Some(7),
            )],
            &HashMap::new(),
        );
        let json = serde_json::to_value(&entries[0]).unwrap();
        assert_eq!(json["localPort"], 8080);
        assert_eq!(json["localAddress"], "::1");
        assert_eq!(json["protocol"], "tcp6");
        assert_eq!(json["state"], "listen");
        assert_eq!(json["live"], true);
        assert!(json["processName"].is_null());
    }
}
