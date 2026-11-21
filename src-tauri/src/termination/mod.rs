//! Process termination. Only ever invoked by an explicit, confirmed user
//! action from the UI; every request is re-validated here.

#[cfg(windows)]
mod windows;

use serde::Serialize;

use crate::error::AppError;
use crate::process;

/// Longest name accepted from the frontend (Windows MAX_PATH).
const MAX_NAME_LEN: usize = 260;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminationOutcome {
    pub pid: u32,
    pub name: String,
    /// False if the process was told to stop but had not exited after a short wait.
    pub exited: bool,
}

/// Ends `pid`, but only if it is still the process the user confirmed
/// (`expected_name`). This guards against the PID having been reused by a
/// different program between the refresh and the click.
pub fn terminate(pid: u32, expected_name: &str) -> Result<TerminationOutcome, AppError> {
    process::validate_pid(pid)?;
    if pid == std::process::id() {
        return Err(AppError::ProtectedProcess(
            "Port Manager can't end its own process.".into(),
        ));
    }

    let expected = expected_name.trim();
    if expected.is_empty() || expected.len() > MAX_NAME_LEN {
        return Err(AppError::InvalidInput("Invalid process name.".into()));
    }

    let current = process::process_name(pid)?;
    if !current.eq_ignore_ascii_case(expected) {
        return Err(AppError::InvalidInput(format!(
            "PID {pid} now belongs to {current}, not {expected}. Refresh the list and try again."
        )));
    }

    terminate_platform(pid, &current).map(|exited| TerminationOutcome {
        pid,
        name: current,
        exited,
    })
}

#[cfg(windows)]
fn terminate_platform(pid: u32, name: &str) -> Result<bool, AppError> {
    windows::terminate(pid, name)
}

#[cfg(not(windows))]
fn terminate_platform(_pid: u32, _name: &str) -> Result<bool, AppError> {
    Err(AppError::Unsupported(
        "ending processes is only implemented for Windows".into(),
    ))
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;
    use std::process::{Child, Command, Stdio};

    /// A harmless child process that would otherwise run for ~30 seconds.
    fn spawn_sleeper() -> Child {
        Command::new("ping")
            .args(["-n", "30", "127.0.0.1"])
            .stdout(Stdio::null())
            .spawn()
            .expect("spawn ping")
    }

    #[test]
    fn ends_a_matching_process() {
        let mut child = spawn_sleeper();
        let outcome = terminate(child.id(), "PING.EXE").expect("terminate");
        assert!(outcome.exited);
        assert!(!child.wait().unwrap().success());
    }

    #[test]
    fn refuses_when_the_name_no_longer_matches() {
        let mut child = spawn_sleeper();
        let result = terminate(child.id(), "node.exe");
        assert!(matches!(result, Err(AppError::InvalidInput(_))));
        assert!(child.try_wait().unwrap().is_none(), "process must survive");
        child.kill().unwrap();
    }

    #[test]
    fn refuses_invalid_and_protected_targets() {
        assert!(matches!(terminate(0, "x"), Err(AppError::InvalidInput(_))));
        assert!(matches!(
            terminate(std::process::id(), "anything"),
            Err(AppError::ProtectedProcess(_))
        ));
        assert!(matches!(
            terminate(4, "System"),
            Err(AppError::ProtectedProcess(_))
        ));
        assert!(matches!(
            terminate(1234, "  "),
            Err(AppError::InvalidInput(_))
        ));
    }

    #[test]
    fn refuses_critical_system_processes() {
        let names = process::process_names().unwrap();
        let (&pid, name) = names
            .iter()
            .find(|(_, n)| n.eq_ignore_ascii_case("csrss.exe"))
            .expect("csrss.exe is always running");
        assert!(matches!(
            terminate(pid, name),
            Err(AppError::ProtectedProcess(_))
        ));
    }
}
