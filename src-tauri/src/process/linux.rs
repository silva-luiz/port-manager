//! Linux process inspection via `/proc`. Names prefer the executable's file
//! name (`/proc/<pid>/exe`), falling back to `comm` (truncated to 15
//! characters) when the link isn't readable, e.g. for other users' processes.

use std::collections::HashMap;
use std::fs;
use std::io::{self, ErrorKind};
use std::path::{Path, PathBuf};

use super::procfs::{cmdline_to_string, parse_stat};
use super::{ProcessEntry, not_found};
use crate::error::AppError;

pub fn process_table() -> Result<HashMap<u32, ProcessEntry>, AppError> {
    let procs = fs::read_dir("/proc")
        .map_err(|e| AppError::internal(format!("could not list /proc: {e}")))?;
    let mut table = HashMap::new();
    for entry in procs.flatten() {
        let Some(pid) = entry
            .file_name()
            .to_str()
            .and_then(|n| n.parse::<u32>().ok())
        else {
            continue;
        };
        // The process may exit while we read it; skip it in that case.
        let Some(stat) = fs::read_to_string(proc_path(pid, "stat"))
            .ok()
            .and_then(|s| parse_stat(&s))
        else {
            continue;
        };
        let Some(name) = display_name(pid) else {
            continue;
        };
        table.insert(
            pid,
            ProcessEntry {
                name,
                parent_pid: (stat.ppid != 0).then_some(stat.ppid),
            },
        );
    }
    Ok(table)
}

pub fn executable_path(pid: u32) -> Result<String, AppError> {
    let target = fs::read_link(proc_path(pid, "exe")).map_err(|e| io_error(pid, e))?;
    Ok(strip_deleted(&target.to_string_lossy()).to_owned())
}

pub fn command_line(pid: u32) -> Result<String, AppError> {
    fs::read(proc_path(pid, "cmdline"))
        .map(|raw| cmdline_to_string(&raw))
        .map_err(|e| io_error(pid, e))
}

pub fn creation_time(pid: u32) -> Option<u64> {
    fs::read_to_string(proc_path(pid, "stat"))
        .ok()
        .and_then(|s| parse_stat(&s))
        .map(|stat| stat.start_time)
}

fn display_name(pid: u32) -> Option<String> {
    let from_exe = fs::read_link(proc_path(pid, "exe"))
        .ok()
        .and_then(|target| {
            Path::new(strip_deleted(&target.to_string_lossy()))
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
        });
    from_exe.or_else(|| {
        fs::read_to_string(proc_path(pid, "comm"))
            .ok()
            .map(|comm| comm.trim_end().to_owned())
            .filter(|comm| !comm.is_empty())
    })
}

/// The kernel appends " (deleted)" when the executable was replaced on disk.
fn strip_deleted(path: &str) -> &str {
    path.strip_suffix(" (deleted)").unwrap_or(path)
}

fn proc_path(pid: u32, file: &str) -> PathBuf {
    Path::new("/proc").join(pid.to_string()).join(file)
}

fn io_error(pid: u32, e: io::Error) -> AppError {
    match e.kind() {
        _ if !proc_path(pid, "").exists() => not_found(pid),
        ErrorKind::PermissionDenied => AppError::PermissionDenied { pid, name: None },
        _ => AppError::internal(format!("could not read /proc/{pid}: {e}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn includes_the_current_process_and_its_parent() {
        let table = process_table().unwrap();
        let own = table.get(&std::process::id()).expect("own PID missing");
        assert!(own.name.starts_with("port_manager_lib"), "{}", own.name);
        assert!(own.parent_pid.is_some());
    }

    #[test]
    fn missing_process_is_not_found() {
        assert!(matches!(
            executable_path(u32::MAX - 1),
            Err(AppError::ProcessNotFound { .. })
        ));
    }

    #[test]
    fn strips_deleted_marker() {
        assert_eq!(strip_deleted("/usr/bin/node (deleted)"), "/usr/bin/node");
        assert_eq!(strip_deleted("/usr/bin/node"), "/usr/bin/node");
    }
}
