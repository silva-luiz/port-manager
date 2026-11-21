use std::os::windows::io::AsRawHandle;

use windows_sys::Win32::Foundation::{ERROR_ACCESS_DENIED, WAIT_OBJECT_0};
use windows_sys::Win32::System::Threading::{
    IsProcessCritical, PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_SYNCHRONIZE, PROCESS_TERMINATE,
    TerminateProcess, WaitForSingleObject,
};

use crate::error::{AppError, ProtectionReason};
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
    )
    .map_err(|e| match e {
        AppError::PermissionDenied { pid, .. } => permission_denied(pid, name),
        other => other,
    })?;
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
            permission_denied(pid, name)
        } else {
            AppError::internal(format!("could not end {name} (PID {pid}): {err}"))
        });
    }

    // SAFETY: valid handle opened with PROCESS_SYNCHRONIZE.
    Ok(unsafe { WaitForSingleObject(handle, EXIT_WAIT_MS) } == WAIT_OBJECT_0)
}

fn protected(name: &str) -> AppError {
    AppError::ProtectedProcess {
        name: name.to_owned(),
        reason: ProtectionReason::CriticalSystemProcess,
    }
}

fn permission_denied(pid: u32, name: &str) -> AppError {
    AppError::PermissionDenied {
        pid,
        name: Some(name.to_owned()),
    }
}
