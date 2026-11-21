//! Windows process inspection.
//!
//! Names come from a ToolHelp snapshot, which works for protected/system
//! processes without elevated privileges. Executable paths require opening
//! the process, which Windows may refuse for system or other users' processes.

use std::collections::HashMap;
use std::mem::size_of;
use std::os::windows::io::{AsRawHandle, FromRawHandle, OwnedHandle};

use windows_sys::Win32::Foundation::{
    ERROR_ACCESS_DENIED, ERROR_INSUFFICIENT_BUFFER, ERROR_INVALID_PARAMETER, INVALID_HANDLE_VALUE,
};
use windows_sys::Win32::System::Diagnostics::ToolHelp::{
    CreateToolhelp32Snapshot, PROCESSENTRY32W, Process32FirstW, Process32NextW, TH32CS_SNAPPROCESS,
};
use windows_sys::Win32::System::Threading::{
    OpenProcess, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION, QueryFullProcessImageNameW,
};

use super::not_found;
use crate::error::AppError;

/// Upper bound for extended-length Windows paths, in UTF-16 units.
const MAX_PATH_UNITS: usize = 32_768;

pub fn process_names() -> Result<HashMap<u32, String>, AppError> {
    // SAFETY: plain FFI call; the result is checked below.
    let raw = unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) };
    if raw == INVALID_HANDLE_VALUE {
        return Err(AppError::Internal(format!(
            "Could not list running processes: {}",
            std::io::Error::last_os_error()
        )));
    }
    // SAFETY: `raw` is a valid handle we own; OwnedHandle closes it on drop.
    let snapshot = unsafe { OwnedHandle::from_raw_handle(raw) };

    let mut names = HashMap::new();
    let mut entry = PROCESSENTRY32W {
        dwSize: size_of::<PROCESSENTRY32W>() as u32,
        ..Default::default()
    };

    // SAFETY: `entry.dwSize` is set as the API requires; the handle is valid.
    let mut ok = unsafe { Process32FirstW(snapshot.as_raw_handle(), &mut entry) } != 0;
    while ok {
        names.insert(entry.th32ProcessID, exe_name(&entry.szExeFile));
        // SAFETY: same as above.
        ok = unsafe { Process32NextW(snapshot.as_raw_handle(), &mut entry) } != 0;
    }

    Ok(names)
}

pub fn executable_path(pid: u32) -> Result<String, AppError> {
    let process = open_process(pid, PROCESS_QUERY_LIMITED_INFORMATION)?;
    let mut buf = vec![0u16; 1024];

    loop {
        let mut len = buf.len() as u32;
        // SAFETY: `buf` has `len` writable UTF-16 units; the handle is valid.
        let ok = unsafe {
            QueryFullProcessImageNameW(
                process.as_raw_handle(),
                PROCESS_NAME_WIN32,
                buf.as_mut_ptr(),
                &mut len,
            )
        } != 0;
        if ok {
            return Ok(String::from_utf16_lossy(&buf[..len as usize]));
        }

        let err = std::io::Error::last_os_error();
        if err.raw_os_error() == Some(ERROR_INSUFFICIENT_BUFFER as i32)
            && buf.len() < MAX_PATH_UNITS
        {
            buf.resize(buf.len() * 4, 0);
            continue;
        }
        return Err(AppError::Internal(format!(
            "Windows could not report the executable path: {err}"
        )));
    }
}

/// Opens a process handle, translating the common failures into user-facing errors.
pub(crate) fn open_process(pid: u32, access: u32) -> Result<OwnedHandle, AppError> {
    // SAFETY: plain FFI call; a null result is handled below.
    let raw = unsafe { OpenProcess(access, 0, pid) };
    if raw.is_null() {
        let err = std::io::Error::last_os_error();
        return Err(match err.raw_os_error().map(|c| c as u32) {
            Some(ERROR_INVALID_PARAMETER) => not_found(pid),
            Some(ERROR_ACCESS_DENIED) => AppError::PermissionDenied(format!(
                "Windows denied access to PID {pid}. It probably belongs to the system or \
                 another user, and Port Manager runs without administrator rights."
            )),
            _ => AppError::Internal(format!("Could not open PID {pid}: {err}")),
        });
    }
    // SAFETY: `raw` is a valid process handle we own.
    Ok(unsafe { OwnedHandle::from_raw_handle(raw) })
}

fn exe_name(raw: &[u16]) -> String {
    let len = raw.iter().position(|&c| c == 0).unwrap_or(raw.len());
    String::from_utf16_lossy(&raw[..len])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn includes_the_current_process() {
        let names = process_names().unwrap();
        let own = names.get(&std::process::id()).expect("own PID missing");
        assert!(own.to_lowercase().ends_with(".exe"));
    }

    #[test]
    fn exe_name_stops_at_nul() {
        let mut raw = [0u16; 8];
        for (slot, c) in raw.iter_mut().zip("hugo.exe".encode_utf16()) {
            *slot = c;
        }
        assert_eq!(exe_name(&raw), "hugo.exe");
        assert_eq!(exe_name(&[0; 4]), "");
    }
}
