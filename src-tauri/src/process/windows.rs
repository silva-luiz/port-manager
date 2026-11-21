//! Windows process inspection.
//!
//! Names and parent PIDs come from a ToolHelp snapshot, which works for
//! protected/system processes without elevated privileges. Paths, command
//! lines and creation times require opening the process, which Windows may
//! refuse for system or other users' processes.

use std::collections::HashMap;
use std::mem::size_of;
use std::os::windows::io::{AsRawHandle, FromRawHandle, OwnedHandle};
use std::ptr;

use windows_sys::Wdk::System::Threading::{
    NtQueryInformationProcess, ProcessCommandLineInformation,
};
use windows_sys::Win32::Foundation::{
    ERROR_ACCESS_DENIED, ERROR_INSUFFICIENT_BUFFER, ERROR_INVALID_PARAMETER, FILETIME,
    INVALID_HANDLE_VALUE, UNICODE_STRING,
};
use windows_sys::Win32::System::Diagnostics::ToolHelp::{
    CreateToolhelp32Snapshot, PROCESSENTRY32W, Process32FirstW, Process32NextW, TH32CS_SNAPPROCESS,
};
use windows_sys::Win32::System::Threading::{
    GetProcessTimes, OpenProcess, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION,
    QueryFullProcessImageNameW,
};

use super::{ProcessEntry, not_found};
use crate::error::AppError;

/// Upper bound for extended-length Windows paths, in UTF-16 units.
const MAX_PATH_UNITS: usize = 32_768;
/// Windows command lines are limited to 32,767 UTF-16 units; allow headroom.
const MAX_COMMAND_LINE_BYTES: u32 = 64 * 1024 + 64;

pub fn process_table() -> Result<HashMap<u32, ProcessEntry>, AppError> {
    // SAFETY: plain FFI call; the result is checked below.
    let raw = unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) };
    if raw == INVALID_HANDLE_VALUE {
        return Err(AppError::internal(format!(
            "could not list running processes: {}",
            std::io::Error::last_os_error()
        )));
    }
    // SAFETY: `raw` is a valid handle we own; OwnedHandle closes it on drop.
    let snapshot = unsafe { OwnedHandle::from_raw_handle(raw) };

    let mut table = HashMap::new();
    let mut entry = PROCESSENTRY32W {
        dwSize: size_of::<PROCESSENTRY32W>() as u32,
        ..Default::default()
    };

    // SAFETY: `entry.dwSize` is set as the API requires; the handle is valid.
    let mut ok = unsafe { Process32FirstW(snapshot.as_raw_handle(), &mut entry) } != 0;
    while ok {
        table.insert(
            entry.th32ProcessID,
            ProcessEntry {
                name: exe_name(&entry.szExeFile),
                parent_pid: (entry.th32ParentProcessID != 0).then_some(entry.th32ParentProcessID),
            },
        );
        // SAFETY: same as above.
        ok = unsafe { Process32NextW(snapshot.as_raw_handle(), &mut entry) } != 0;
    }

    Ok(table)
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
        return Err(AppError::internal(format!(
            "could not read the executable path: {err}"
        )));
    }
}

/// Reads another process's command line via `ProcessCommandLineInformation`
/// (Windows 8.1+). Needs only limited query rights, so it works for the
/// user's own processes without elevation.
pub fn command_line(pid: u32) -> Result<String, AppError> {
    let process = open_process(pid, PROCESS_QUERY_LIMITED_INFORMATION)?;
    let handle = process.as_raw_handle();

    // First call reports the required size.
    let mut needed: u32 = 0;
    // SAFETY: a null buffer with length 0 is the documented way to query the size.
    unsafe {
        NtQueryInformationProcess(
            handle,
            ProcessCommandLineInformation,
            ptr::null_mut(),
            0,
            &mut needed,
        )
    };
    if needed == 0 || needed > MAX_COMMAND_LINE_BYTES {
        return Err(AppError::internal(format!(
            "unexpected command line size {needed} for PID {pid}"
        )));
    }

    // u64-backed so the UNICODE_STRING header at the start is aligned.
    let mut buf = vec![0u64; (needed as usize).div_ceil(size_of::<u64>())];
    let capacity = (buf.len() * size_of::<u64>()) as u32;
    // SAFETY: `buf` is writable for `capacity` bytes; the handle is valid.
    let status = unsafe {
        NtQueryInformationProcess(
            handle,
            ProcessCommandLineInformation,
            buf.as_mut_ptr().cast(),
            capacity,
            &mut needed,
        )
    };
    if status < 0 {
        return Err(AppError::internal(format!(
            "could not read the command line of PID {pid} (NTSTATUS {status:#010x})"
        )));
    }

    // SAFETY: on success the buffer starts with a UNICODE_STRING.
    let header = unsafe { &*buf.as_ptr().cast::<UNICODE_STRING>() };
    let units = usize::from(header.Length) / 2;
    if header.Buffer.is_null() || units == 0 {
        return Ok(String::new());
    }

    // The string data lives inside `buf`; refuse anything pointing elsewhere.
    let base = buf.as_ptr() as usize;
    let start = header.Buffer as usize;
    let end = start + usize::from(header.Length);
    if start < base || end > base + capacity as usize {
        return Err(AppError::internal(
            "command line data was outside the returned buffer",
        ));
    }
    // SAFETY: bounds checked above; u16 data written by the OS.
    let text = unsafe { std::slice::from_raw_parts(header.Buffer, units) };
    Ok(String::from_utf16_lossy(text))
}

/// Process creation time as a FILETIME tick count, or `None` if unreadable.
pub fn creation_time(pid: u32) -> Option<u64> {
    let process = open_process(pid, PROCESS_QUERY_LIMITED_INFORMATION).ok()?;
    let zero = || FILETIME {
        dwLowDateTime: 0,
        dwHighDateTime: 0,
    };
    let (mut created, mut exited, mut kernel, mut user) = (zero(), zero(), zero(), zero());
    // SAFETY: all out pointers are valid; the handle has query rights.
    let ok = unsafe {
        GetProcessTimes(
            process.as_raw_handle(),
            &mut created,
            &mut exited,
            &mut kernel,
            &mut user,
        )
    } != 0;
    ok.then(|| (u64::from(created.dwHighDateTime) << 32) | u64::from(created.dwLowDateTime))
}

/// Opens a process handle, translating the common failures into user-facing errors.
pub(crate) fn open_process(pid: u32, access: u32) -> Result<OwnedHandle, AppError> {
    // SAFETY: plain FFI call; a null result is handled below.
    let raw = unsafe { OpenProcess(access, 0, pid) };
    if raw.is_null() {
        let err = std::io::Error::last_os_error();
        return Err(match err.raw_os_error().map(|c| c as u32) {
            Some(ERROR_INVALID_PARAMETER) => not_found(pid),
            Some(ERROR_ACCESS_DENIED) => AppError::PermissionDenied { pid, name: None },
            _ => AppError::internal(format!("could not open PID {pid}: {err}")),
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
    fn includes_the_current_process_and_its_parent() {
        let table = process_table().unwrap();
        let own = table.get(&std::process::id()).expect("own PID missing");
        assert!(own.name.to_lowercase().ends_with(".exe"));
        assert!(own.parent_pid.is_some());
    }

    #[test]
    fn reads_a_child_command_line_and_creation_order() {
        let mut child = std::process::Command::new("ping")
            .args(["-n", "30", "127.0.0.1"])
            .stdout(std::process::Stdio::null())
            .spawn()
            .unwrap();

        let cmd = command_line(child.id()).unwrap();
        assert!(cmd.contains("-n 30 127.0.0.1"), "{cmd}");

        let parent = creation_time(std::process::id()).unwrap();
        let spawned = creation_time(child.id()).unwrap();
        assert!(spawned >= parent);

        child.kill().unwrap();
        child.wait().unwrap();
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
