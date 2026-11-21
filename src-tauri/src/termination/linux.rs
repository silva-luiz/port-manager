//! Linux termination with `kill(2)`. Hard kill (SIGKILL) to match Windows'
//! TerminateProcess and the confirmation dialog's "stops immediately".

use std::fs;
use std::thread;
use std::time::{Duration, Instant};

use crate::error::{AppError, ProtectionReason};
use crate::process::procfs::parse_stat;

/// PID 1 (init/systemd) and 2 (kthreadd, parent of all kernel threads).
const PROTECTED_PIDS: [u32; 2] = [1, 2];
const KTHREADD: u32 = 2;
const EXIT_WAIT: Duration = Duration::from_secs(3);
const POLL: Duration = Duration::from_millis(50);

/// Fails if `pid` is protected or can't be signalled with the current rights.
pub fn ensure_terminable(pid: u32, name: &str) -> Result<(), AppError> {
    let pid_t = to_pid_t(pid)?;
    let parent = fs::read_to_string(format!("/proc/{pid}/stat"))
        .ok()
        .and_then(|s| parse_stat(&s))
        .map(|stat| stat.ppid);
    if PROTECTED_PIDS.contains(&pid) || parent == Some(KTHREADD) {
        return Err(AppError::ProtectedProcess {
            name: name.to_owned(),
            reason: ProtectionReason::CriticalSystemProcess,
        });
    }
    // Signal 0 checks existence and permission without affecting the process.
    signal(pid_t, 0, pid, name)
}

/// Returns whether the process had exited by the end of a short wait.
pub fn terminate(pid: u32, name: &str) -> Result<bool, AppError> {
    ensure_terminable(pid, name)?;
    signal(to_pid_t(pid)?, libc::SIGKILL, pid, name)?;

    let deadline = Instant::now() + EXIT_WAIT;
    while Instant::now() < deadline {
        if has_exited(pid) {
            return Ok(true);
        }
        thread::sleep(POLL);
    }
    Ok(has_exited(pid))
}

/// `kill` treats 0 and negative PIDs as process groups (-1 = everything the
/// user may signal), so only strictly positive values that fit are allowed.
fn to_pid_t(pid: u32) -> Result<libc::pid_t, AppError> {
    libc::pid_t::try_from(pid)
        .ok()
        .filter(|&p| p > 0)
        .ok_or(AppError::InvalidPid { pid })
}

fn signal(pid_t: libc::pid_t, sig: libc::c_int, pid: u32, name: &str) -> Result<(), AppError> {
    // SAFETY: `pid_t` is strictly positive, so this targets one process.
    if unsafe { libc::kill(pid_t, sig) } == 0 {
        return Ok(());
    }
    let err = std::io::Error::last_os_error();
    Err(match err.raw_os_error() {
        Some(libc::EPERM) => AppError::PermissionDenied {
            pid,
            name: Some(name.to_owned()),
        },
        Some(libc::ESRCH) => AppError::ProcessNotFound { pid },
        _ => AppError::internal(format!("could not signal {name} (PID {pid}): {err}")),
    })
}

/// Gone, or a zombie waiting for its parent to collect its exit status.
fn has_exited(pid: u32) -> bool {
    match fs::read_to_string(format!("/proc/{pid}/stat")) {
        Err(_) => true,
        Ok(stat) => parse_stat(&stat).is_none_or(|s| s.state == 'Z'),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_pids_that_kill_would_treat_as_groups() {
        assert!(matches!(to_pid_t(0), Err(AppError::InvalidPid { .. })));
        assert!(matches!(
            to_pid_t(u32::MAX),
            Err(AppError::InvalidPid { .. })
        ));
        assert!(matches!(
            to_pid_t(i32::MAX as u32 + 1),
            Err(AppError::InvalidPid { .. })
        ));
        assert_eq!(to_pid_t(1234).unwrap(), 1234);
    }

    #[test]
    fn protects_init_and_kernel_threads() {
        assert!(matches!(
            ensure_terminable(1, "systemd"),
            Err(AppError::ProtectedProcess { .. })
        ));
        assert!(matches!(
            ensure_terminable(2, "kthreadd"),
            Err(AppError::ProtectedProcess { .. })
        ));
    }
}
