//! Background check of favorite ports, so changes are noticed even while the
//! window is minimized (when the frontend's own refresh is paused).
//!
//! Runs only while `favorite_alerts` is enabled. Each tick reads the TCP table
//! (no process names) and compares favorite ports with the previous tick; a
//! process name is looked up only for ports that changed. The first tick after
//! enabling just records a baseline, so turning alerts on never fires for the
//! current state. The frontend turns events into translated notifications.

use serde::Serialize;
use std::collections::HashMap;
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

use crate::favorites;
use crate::network::{self, NetSocket, SocketState};
use crate::process;
use crate::settings;
use crate::storage::Database;

pub const EVENT: &str = "favorite-port-changed";
const INTERVAL: Duration = Duration::from_secs(3);

/// Whether a port is in use and, if so, which process holds it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct Usage {
    in_use: bool,
    pid: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FavoritePortChange {
    pub port: u16,
    pub in_use: bool,
    pub pid: Option<u32>,
    pub process_name: Option<String>,
}

pub fn spawn(app: AppHandle) -> std::io::Result<()> {
    thread::Builder::new()
        .name("favorite-port-watcher".into())
        .spawn(move || {
            let mut baseline: Option<HashMap<u16, Usage>> = None;
            loop {
                thread::sleep(INTERVAL);
                baseline = tick(&app, baseline);
            }
        })
        .map(drop)
}

/// One check. Returns the state to compare against next time (`None` resets
/// the baseline, e.g. while alerts are off). Errors skip the tick quietly:
/// a missed check is retried in a few seconds and must never crash the app.
fn tick(app: &AppHandle, baseline: Option<HashMap<u16, Usage>>) -> Option<HashMap<u16, Usage>> {
    let db = app.state::<Database>();
    let enabled = settings::get(&db).is_ok_and(|s| s.favorite_alerts);
    if !enabled {
        return None;
    }
    let ports: Vec<u16> = favorites::list(&db).ok()?.iter().map(|f| f.port).collect();
    if ports.is_empty() {
        return None;
    }
    let connections = match network::sockets() {
        Ok(connections) => connections,
        Err(e) => {
            log::warn!("favorite port check skipped: {e}");
            return baseline;
        }
    };

    let current = usage_by_port(&connections, &ports);
    if let Some(previous) = &baseline {
        let changed = changes(previous, &current);
        if !changed.is_empty() {
            let names = process::process_names().unwrap_or_default();
            for (port, usage) in changed {
                let event = FavoritePortChange {
                    port,
                    in_use: usage.in_use,
                    pid: usage.pid,
                    process_name: usage.pid.and_then(|pid| names.get(&pid).cloned()),
                };
                log::info!(
                    "favorite port {port} is now {}",
                    if usage.in_use { "in use" } else { "free" }
                );
                if let Err(e) = app.emit(EVENT, event) {
                    log::warn!("could not deliver favorite port event: {e}");
                }
            }
        }
    }
    Some(current)
}

/// Usage of each watched port. A port is in use if any of its sockets is
/// live; the owner shown is the listening process when there is one.
fn usage_by_port(connections: &[NetSocket], ports: &[u16]) -> HashMap<u16, Usage> {
    ports
        .iter()
        .map(|&port| {
            let live: Vec<&NetSocket> = connections
                .iter()
                .filter(|c| c.local.port() == port && c.state.is_live())
                .collect();
            let owner = live
                .iter()
                .find(|c| c.state == SocketState::Listen)
                .or(live.first())
                .and_then(|c| c.pid);
            (
                port,
                Usage {
                    in_use: !live.is_empty(),
                    pid: owner,
                },
            )
        })
        .collect()
}

/// Ports whose in-use status flipped. Ports missing from either side (just
/// added to or removed from favorites) are not reported.
fn changes(previous: &HashMap<u16, Usage>, current: &HashMap<u16, Usage>) -> Vec<(u16, Usage)> {
    let mut changed: Vec<(u16, Usage)> = current
        .iter()
        .filter(|(port, now)| {
            previous
                .get(port)
                .is_some_and(|before| before.in_use != now.in_use)
        })
        .map(|(&port, &now)| (port, now))
        .collect();
    changed.sort_unstable_by_key(|(port, _)| *port);
    changed
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::network::Protocol;

    fn conn(local: &str, state: SocketState, pid: Option<u32>) -> NetSocket {
        NetSocket {
            protocol: Protocol::Tcp,
            local: local.parse().unwrap(),
            remote: None,
            state,
            pid,
        }
    }

    const FREE: Usage = Usage {
        in_use: false,
        pid: None,
    };

    #[test]
    fn usage_prefers_the_listening_owner_and_ignores_leftovers() {
        let connections = [
            conn("127.0.0.1:3000", SocketState::Established, Some(7)),
            conn("0.0.0.0:3000", SocketState::Listen, Some(42)),
            conn("127.0.0.1:8080", SocketState::TimeWait, None),
        ];
        let usage = usage_by_port(&connections, &[3000, 8080, 9999]);
        assert_eq!(
            usage[&3000],
            Usage {
                in_use: true,
                pid: Some(42)
            }
        );
        assert_eq!(usage[&8080], FREE, "TIME_WAIT alone is not in use");
        assert_eq!(usage[&9999], FREE);
    }

    #[test]
    fn reports_only_flips_of_ports_present_in_both_snapshots() {
        let busy = Usage {
            in_use: true,
            pid: Some(1),
        };
        let previous = HashMap::from([(3000, FREE), (5000, busy), (6000, busy)]);
        let current = HashMap::from([
            (3000, busy), // became busy
            (5000, FREE), // became free
            (
                6000,
                Usage {
                    in_use: true,
                    pid: Some(2),
                },
            ), // still busy, different owner: not a flip
            (7000, busy), // newly watched: baseline only
        ]);
        assert_eq!(changes(&previous, &current), [(3000, busy), (5000, FREE)]);
    }

    #[test]
    fn change_event_serializes_for_the_frontend() {
        let json = serde_json::to_value(FavoritePortChange {
            port: 3000,
            in_use: true,
            pid: Some(42),
            process_name: Some("node.exe".into()),
        })
        .unwrap();
        assert_eq!(
            json,
            serde_json::json!({ "port": 3000, "inUse": true, "pid": 42, "processName": "node.exe" })
        );
    }
}
