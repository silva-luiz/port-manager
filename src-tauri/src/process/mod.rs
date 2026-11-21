//! Process inspection. Platform-specific lookups live in per-OS submodules
//! exposing the same functions; this module adds validation and composition.

#[cfg(windows)]
pub(crate) mod windows;
#[cfg(windows)]
use windows as imp;

#[cfg(not(windows))]
mod unsupported;
#[cfg(not(windows))]
use unsupported as imp;

use serde::Serialize;
use std::collections::HashMap;

use crate::error::AppError;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessDetails {
    pub pid: u32,
    pub name: String,
    pub executable_path: Option<String>,
    /// Why `executable_path` is missing (usually `permissionDenied`).
    pub path_error: Option<AppError>,
}

/// Maps every running PID to its executable name (e.g. `hugo.exe`).
/// A single snapshot is used so lookups are consistent within one scan.
pub fn process_names() -> Result<HashMap<u32, String>, AppError> {
    imp::process_names()
}

/// Name of one running process, or `ProcessNotFound`.
pub fn process_name(pid: u32) -> Result<String, AppError> {
    process_names()?.remove(&pid).ok_or_else(|| not_found(pid))
}

pub fn details(pid: u32) -> Result<ProcessDetails, AppError> {
    validate_pid(pid)?;
    let name = process_name(pid)?;

    let (executable_path, path_error) = match imp::executable_path(pid) {
        Ok(path) => (Some(path), None),
        Err(e @ AppError::ProcessNotFound { .. }) => return Err(e),
        Err(e) => (None, Some(e)),
    };

    Ok(ProcessDetails {
        pid,
        name,
        executable_path,
        path_error,
    })
}

/// PID 0 is the idle pseudo-process and never a valid target.
pub fn validate_pid(pid: u32) -> Result<(), AppError> {
    if pid == 0 {
        return Err(AppError::InvalidPid { pid });
    }
    Ok(())
}

pub(crate) fn not_found(pid: u32) -> AppError {
    AppError::ProcessNotFound { pid }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pid_zero_is_rejected() {
        assert!(matches!(details(0), Err(AppError::InvalidPid { pid: 0 })));
    }

    #[cfg(windows)]
    #[test]
    fn details_of_own_process_include_executable_path() {
        let d = details(std::process::id()).unwrap();
        let expected = std::env::current_exe().unwrap();
        assert_eq!(d.executable_path.as_deref(), expected.to_str());
        assert!(d.path_error.is_none());
    }

    #[cfg(windows)]
    #[test]
    fn unknown_pid_is_not_found() {
        // PIDs are multiples of 4 on Windows; this one is never allocated in practice.
        assert!(matches!(
            details(0xFFFF_FFF0),
            Err(AppError::ProcessNotFound { .. })
        ));
    }
}
