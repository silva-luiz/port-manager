//! Linux socket reader: `/proc/net/{tcp,tcp6,udp,udp6}` for sockets and
//! `/proc/<pid>/fd` links (`socket:[inode]`) to find their owners. Without
//! root, only the user's own processes' fds are readable; other sockets are
//! reported without an owner rather than guessed.

use std::collections::HashMap;
use std::fs;
use std::io::ErrorKind;

use super::procfs::{parse_net_table, socket_inode};
use super::{NetSocket, Protocol};
use crate::error::AppError;

const TABLES: [(&str, Protocol); 4] = [
    ("/proc/net/tcp", Protocol::Tcp),
    ("/proc/net/tcp6", Protocol::Tcp6),
    ("/proc/net/udp", Protocol::Udp),
    ("/proc/net/udp6", Protocol::Udp6),
];

pub fn sockets() -> Result<Vec<NetSocket>, AppError> {
    let owners = socket_owners();
    let mut sockets = Vec::new();
    for (path, protocol) in TABLES {
        let content = match fs::read_to_string(path) {
            Ok(content) => content,
            // IPv6 may be disabled, in which case its tables don't exist.
            Err(e) if e.kind() == ErrorKind::NotFound => continue,
            Err(e) => {
                return Err(AppError::Network {
                    detail: format!("could not read {path}: {e}"),
                });
            }
        };
        sockets.extend(
            parse_net_table(&content, protocol)
                .into_iter()
                .map(|row| NetSocket {
                    protocol,
                    local: row.local,
                    remote: row.remote,
                    state: row.state,
                    pid: owners.get(&row.inode).copied().filter(|_| row.inode != 0),
                }),
        );
    }
    Ok(sockets)
}

/// Socket inode -> PID, from every readable `/proc/<pid>/fd` directory.
fn socket_owners() -> HashMap<u64, u32> {
    let mut owners = HashMap::new();
    let Ok(procs) = fs::read_dir("/proc") else {
        return owners;
    };
    for proc_dir in procs.flatten() {
        let Some(pid) = proc_dir
            .file_name()
            .to_str()
            .and_then(|n| n.parse::<u32>().ok())
        else {
            continue;
        };
        // Permission denied for other users' processes: skip, don't fail.
        let Ok(fds) = fs::read_dir(proc_dir.path().join("fd")) else {
            continue;
        };
        for fd in fds.flatten() {
            if let Some(inode) = fs::read_link(fd.path())
                .ok()
                .and_then(|target| target.to_str().and_then(socket_inode))
            {
                owners.insert(inode, pid);
            }
        }
    }
    owners
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::network::SocketState;

    #[test]
    fn finds_own_tcp_listener_and_udp_socket() {
        let tcp = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let udp = std::net::UdpSocket::bind("127.0.0.1:0").unwrap();
        let (tcp_port, udp_port) = (
            tcp.local_addr().unwrap().port(),
            udp.local_addr().unwrap().port(),
        );
        let me = Some(std::process::id());

        let all = sockets().unwrap();
        assert!(all.iter().any(|s| s.protocol == Protocol::Tcp
            && s.state == SocketState::Listen
            && s.local.port() == tcp_port
            && s.pid == me));
        assert!(all.iter().any(|s| s.protocol == Protocol::Udp
            && s.state == SocketState::Bound
            && s.local.port() == udp_port
            && s.pid == me));
    }
}
