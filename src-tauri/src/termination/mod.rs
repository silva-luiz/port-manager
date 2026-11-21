//! Process termination. Only ever invoked by an explicit, confirmed user
//! action from the UI; every request is re-validated here.

#[cfg(windows)]
mod windows;

use serde::Serialize;

use crate::error::{AppError, ProtectionReason};
use crate::process;

/// Longest name accepted from the frontend (Windows MAX_PATH).
const MAX_NAME_LEN: usize = 260;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChildOutcome {
    pub pid: u32,
    pub name: String,
    /// `None` when the child was ended.
    pub error: Option<AppError>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminationOutcome {
    pub pid: u32,
    pub name: String,
    /// False if the process was told to stop but had not exited after a short wait.
    pub exited: bool,
    /// Results for child processes; empty unless they were requested.
    pub children: Vec<ChildOutcome>,
}

/// Ends `pid`, but only if it is still the process the user confirmed
/// (`expected_name`). This guards against the PID having been reused by a
/// different program between the refresh and the click.
///
/// With `include_children`, processes it started are ended too. The main
/// process is vetted first and ended before its children, so a supervisor
/// (file watcher, auto-reloader) can't respawn them. A child that can't be
/// ended is reported, not fatal.
pub fn terminate(
    pid: u32,
    expected_name: &str,
    include_children: bool,
) -> Result<TerminationOutcome, AppError> {
    process::validate_pid(pid)?;
    if pid == std::process::id() {
        return Err(self_protected());
    }

    let expected = expected_name.trim();
    if expected.is_empty() || expected.len() > MAX_NAME_LEN {
        return Err(AppError::InvalidProcessName);
    }

    let table = process::process_table()?;
    let current = table
        .get(&pid)
        .map(|e| e.name.clone())
        .ok_or_else(|| process::not_found(pid))?;
    if !current.eq_ignore_ascii_case(expected) {
        return Err(AppError::ProcessNameMismatch {
            pid,
            expected: expected.to_owned(),
            actual: current,
        });
    }

    // Decide the full set before anything is ended.
    let children: Vec<(u32, String)> = if include_children {
        platform::ensure_terminable(pid, &current)?;
        process::descendants(pid, &table, process::creation_time)
            .into_iter()
            .filter_map(|child| table.get(&child).map(|e| (child, e.name.clone())))
            .collect()
    } else {
        Vec::new()
    };

    let exited = platform::terminate(pid, &current)?;

    let children = children
        .into_iter()
        .map(|(child, name)| {
            let error = if child == std::process::id() {
                Some(self_protected())
            } else {
                platform::terminate(child, &name).err()
            };
            ChildOutcome {
                pid: child,
                name,
                error,
            }
        })
        .collect();

    Ok(TerminationOutcome {
        pid,
        name: current,
        exited,
        children,
    })
}

fn self_protected() -> AppError {
    AppError::ProtectedProcess {
        name: "Port Manager".into(),
        reason: ProtectionReason::PortManagerItself,
    }
}

#[cfg(windows)]
use windows as platform;

#[cfg(not(windows))]
mod platform {
    use crate::error::AppError;

    fn unsupported() -> AppError {
        AppError::Unsupported {
            detail: "ending processes is only implemented for Windows".into(),
        }
    }

    pub fn ensure_terminable(_pid: u32, _name: &str) -> Result<(), AppError> {
        Err(unsupported())
    }

    pub fn terminate(_pid: u32, _name: &str) -> Result<bool, AppError> {
        Err(unsupported())
    }
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;
    use std::process::{Child, Command, Stdio};
    use std::time::{Duration, Instant};

    /// A harmless child process that would otherwise run for ~30 seconds.
    fn spawn_sleeper() -> Child {
        Command::new("ping")
            .args(["-n", "30", "127.0.0.1"])
            .stdout(Stdio::null())
            .spawn()
            .expect("spawn ping")
    }

    /// `cmd.exe` running `ping`, so there is a real parent/child pair.
    #[allow(
        clippy::zombie_processes,
        reason = "the Child is returned and every caller waits on it"
    )]
    fn spawn_tree() -> (Child, u32) {
        let parent = Command::new("cmd")
            .args(["/c", "ping -n 30 127.0.0.1 >nul"])
            .spawn()
            .expect("spawn cmd");
        let deadline = Instant::now() + Duration::from_secs(5);
        loop {
            let table = process::process_table().unwrap();
            let child = table.iter().find(|(_, e)| {
                e.parent_pid == Some(parent.id()) && e.name.eq_ignore_ascii_case("PING.EXE")
            });
            if let Some((&pid, _)) = child {
                return (parent, pid);
            }
            if Instant::now() >= deadline {
                let mut parent = parent;
                let _ = parent.kill();
                let _ = parent.wait();
                panic!("ping child never appeared");
            }
            std::thread::sleep(Duration::from_millis(50));
        }
    }

    fn is_running(pid: u32) -> bool {
        process::process_table().unwrap().contains_key(&pid)
    }

    #[test]
    fn ends_a_matching_process() {
        let mut child = spawn_sleeper();
        let outcome = terminate(child.id(), "PING.EXE", false).expect("terminate");
        assert!(outcome.exited);
        assert!(outcome.children.is_empty());
        assert!(!child.wait().unwrap().success());
    }

    #[test]
    fn ends_the_whole_tree_when_asked() {
        let (mut parent, child) = spawn_tree();
        let outcome = terminate(parent.id(), "cmd.exe", true).expect("terminate tree");
        assert!(outcome.exited);
        assert_eq!(outcome.children.len(), 1);
        assert_eq!(outcome.children[0].pid, child);
        assert!(outcome.children[0].error.is_none());
        parent.wait().unwrap();
        assert!(!is_running(child), "child must be gone");
    }

    #[test]
    fn leaves_children_alone_by_default() {
        let (mut parent, child) = spawn_tree();
        terminate(parent.id(), "cmd.exe", false).expect("terminate parent");
        parent.wait().unwrap();
        assert!(is_running(child), "child must survive");
        terminate(child, "PING.EXE", false).expect("clean up child");
    }

    #[test]
    fn refuses_when_the_name_no_longer_matches() {
        let mut child = spawn_sleeper();
        let result = terminate(child.id(), "node.exe", true);
        assert!(matches!(result, Err(AppError::ProcessNameMismatch { .. })));
        assert!(child.try_wait().unwrap().is_none(), "process must survive");
        child.kill().unwrap();
    }

    #[test]
    fn refuses_invalid_and_protected_targets() {
        assert!(matches!(
            terminate(0, "x", false),
            Err(AppError::InvalidPid { pid: 0 })
        ));
        assert!(matches!(
            terminate(std::process::id(), "anything", false),
            Err(AppError::ProtectedProcess {
                reason: ProtectionReason::PortManagerItself,
                ..
            })
        ));
        assert!(matches!(
            terminate(4, "System", true),
            Err(AppError::ProtectedProcess {
                reason: ProtectionReason::CriticalSystemProcess,
                ..
            })
        ));
        assert!(matches!(
            terminate(1234, "  ", false),
            Err(AppError::InvalidProcessName)
        ));
    }

    #[test]
    fn refuses_critical_system_processes_with_or_without_children() {
        let names = process::process_names().unwrap();
        let (&pid, name) = names
            .iter()
            .find(|(_, n)| n.eq_ignore_ascii_case("csrss.exe"))
            .expect("csrss.exe is always running");
        for include_children in [false, true] {
            assert!(matches!(
                terminate(pid, name, include_children),
                Err(AppError::ProtectedProcess { .. })
            ));
        }
    }
}
