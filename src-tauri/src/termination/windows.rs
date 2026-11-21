use std::os::windows::io::AsRawHandle;

use windows_sys::Win32::Foundation::{ERROR_ACCESS_DENIED, WAIT_OBJECT_0};
use windows_sys::Win32::System::Threading::{
    IsProcessCritical, PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_SYNCHRONIZE, PROCESS_TERMINATE,
    TerminateProcess, WaitForSingleObject,
};

use crate::error::AppError;
use crate::process::windows::open_process;

/// Core Windows processes that must never be ended from this app, even when
/// it happens to run elevated. Ending any of these crashes or destabilizes
/// the session. Compared case-insensitively against the executable name.
const PROTECTED_NAMES: &[&str] = &[
    "System",
    "Secure System",
    "Registry",
    "Memory Compression",
    "smss.exe",
    "csrss.exe",
    "wininit.exe",
    "winlogon.exe",
    "services.exe",
    "lsass.exe",
    "lsaiso.exe",
];

const EXIT_WAIT_MS: u32 = 3_000;

/// Returns whether the process had exited by the end of a short wait.
pub fn terminate(pid: u32, name: &str) -> Result<bool, AppError> {
    if PROTECTED_NAMES.iter().any(|p| name.eq_ignore_ascii_case(p)) {
        return Err(protected(name));
    }

    let process = open_process(
        pid,
        PROCESS_TERMINATE | PROCESS_QUERY_LIMITED_INFORMATION | PROCESS_SYNCHRONIZE,
    )?;
    let handle = process.as_raw_handle();

    let mut critical = 0;
    // SAFETY: valid handle opened with query rights; `critical` is a valid out pointer.
    if unsafe { IsProcessCritical(handle, &mut critical) } != 0 && critical != 0 {
        return Err(protected(name));
    }

    // SAFETY: valid handle opened with PROCESS_TERMINATE.
    if unsafe { TerminateProcess(handle, 1) } == 0 {
        let err = std::io::Error::last_os_error();
        return Err(if err.raw_os_error() == Some(ERROR_ACCESS_DENIED as i32) {
            AppError::PermissionDenied(format!(
                "Windows didn't allow ending {name} (PID {pid}). It may be protected or \
                 running as another user, and Port Manager runs without administrator rights."
            ))
        } else {
            AppError::Internal(format!("Could not end {name} (PID {pid}): {err}"))
        });
    }

    // SAFETY: valid handle opened with PROCESS_SYNCHRONIZE.
    Ok(unsafe { WaitForSingleObject(handle, EXIT_WAIT_MS) } == WAIT_OBJECT_0)
}

fn protected(name: &str) -> AppError {
    AppError::ProtectedProcess(format!(
        "{name} is a critical Windows process. Ending it would crash or destabilize the system, \
         so Port Manager won't do it."
    ))
}
