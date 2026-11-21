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
use std::collections::{HashMap, HashSet, VecDeque};

use crate::error::AppError;

/// One row of the OS process table.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProcessEntry {
    pub name: String,
    /// PID recorded as the creator. Windows keeps it after the parent exits,
    /// so it may now belong to an unrelated process; see `descendants`.
    pub parent_pid: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessRef {
    pub pid: u32,
    pub name: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessDetails {
    pub pid: u32,
    pub name: String,
    pub executable_path: Option<String>,
    /// Why `executable_path` is missing (usually `permissionDenied`).
    pub path_error: Option<AppError>,
    /// Full command line, when Windows allows reading it.
    pub command_line: Option<String>,
    /// The process that started this one, if it is still running.
    pub parent: Option<ProcessRef>,
    /// Processes started by this one, directly or indirectly, parents first.
    pub descendants: Vec<ProcessRef>,
}

/// One consistent snapshot of every running process.
pub fn process_table() -> Result<HashMap<u32, ProcessEntry>, AppError> {
    imp::process_table()
}

/// Maps every running PID to its executable name (e.g. `hugo.exe`).
pub fn process_names() -> Result<HashMap<u32, String>, AppError> {
    Ok(process_table()?
        .into_iter()
        .map(|(pid, entry)| (pid, entry.name))
        .collect())
}

pub fn command_line(pid: u32) -> Result<String, AppError> {
    imp::command_line(pid)
}

/// Creation time in an OS-defined monotonic unit, or `None` if unreadable.
pub fn creation_time(pid: u32) -> Option<u64> {
    imp::creation_time(pid)
}

pub fn details(pid: u32) -> Result<ProcessDetails, AppError> {
    validate_pid(pid)?;
    let table = process_table()?;
    let entry = table.get(&pid).ok_or_else(|| not_found(pid))?;

    let (executable_path, path_error) = match imp::executable_path(pid) {
        Ok(path) => (Some(path), None),
        Err(e @ AppError::ProcessNotFound { .. }) => return Err(e),
        Err(e) => (None, Some(e)),
    };

    let to_ref = |pid: u32| {
        table.get(&pid).map(|e| ProcessRef {
            pid,
            name: e.name.clone(),
        })
    };

    Ok(ProcessDetails {
        pid,
        name: entry.name.clone(),
        executable_path,
        path_error,
        command_line: imp::command_line(pid).ok(),
        parent: entry
            .parent_pid
            .filter(|&parent| started_before(parent, pid, creation_time))
            .and_then(to_ref),
        descendants: descendants(pid, &table, creation_time)
            .into_iter()
            .filter_map(to_ref)
            .collect(),
    })
}

/// Processes started by `root`, directly or indirectly, in breadth-first
/// order (parents before their children).
///
/// A recorded parent PID only counts if that process was created before the
/// child; otherwise the PID was reused after the real parent exited and the
/// "child" is unrelated. Processes whose creation time can't be read are
/// left out, so nothing is ever included on a guess.
pub fn descendants(
    root: u32,
    table: &HashMap<u32, ProcessEntry>,
    created: impl Fn(u32) -> Option<u64>,
) -> Vec<u32> {
    let mut children: HashMap<u32, Vec<u32>> = HashMap::new();
    for (&pid, entry) in table {
        if let Some(parent) = entry.parent_pid.filter(|&p| p != pid) {
            children.entry(parent).or_default().push(pid);
        }
    }
    for list in children.values_mut() {
        list.sort_unstable();
    }

    let mut order = Vec::new();
    let mut visited = HashSet::from([root]);
    let mut queue = VecDeque::from([root]);
    while let Some(parent) = queue.pop_front() {
        let Some(parent_created) = created(parent) else {
            continue;
        };
        for &child in children.get(&parent).into_iter().flatten() {
            if visited.contains(&child) {
                continue;
            }
            if created(child).is_some_and(|c| c >= parent_created) {
                visited.insert(child);
                order.push(child);
                queue.push_back(child);
            }
        }
    }
    order
}

fn started_before(parent: u32, child: u32, created: impl Fn(u32) -> Option<u64>) -> bool {
    matches!((created(parent), created(child)), (Some(p), Some(c)) if p <= c)
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

    fn table(rows: &[(u32, Option<u32>)]) -> HashMap<u32, ProcessEntry> {
        rows.iter()
            .map(|&(pid, parent_pid)| {
                (
                    pid,
                    ProcessEntry {
                        name: format!("p{pid}.exe"),
                        parent_pid,
                    },
                )
            })
            .collect()
    }

    /// Creation time = position in this list (earlier = older).
    fn created_in_order(order: &'static [u32]) -> impl Fn(u32) -> Option<u64> {
        move |pid| order.iter().position(|&p| p == pid).map(|i| i as u64)
    }

    #[test]
    fn descendants_are_breadth_first_parents_before_children() {
        // 1 -> 2 -> 4, 1 -> 3
        let t = table(&[(1, None), (2, Some(1)), (3, Some(1)), (4, Some(2))]);
        let d = descendants(1, &t, created_in_order(&[1, 2, 3, 4]));
        assert_eq!(d, [2, 3, 4]);
    }

    #[test]
    fn reused_parent_pid_is_not_a_parent() {
        // 5 claims parent 1, but 5 was created before 1: PID 1 was reused.
        let t = table(&[(1, None), (2, Some(1)), (5, Some(1))]);
        let d = descendants(1, &t, created_in_order(&[5, 1, 2]));
        assert_eq!(d, [2]);
    }

    #[test]
    fn unreadable_creation_time_excludes_the_process() {
        let t = table(&[(1, None), (2, Some(1)), (3, Some(1))]);
        let d = descendants(1, &t, created_in_order(&[1, 2]));
        assert_eq!(d, [2], "3 has no creation time and must be skipped");
        assert!(descendants(9, &t, created_in_order(&[1])).is_empty());
    }

    #[test]
    fn cycles_and_self_parents_terminate() {
        let t = table(&[(1, Some(2)), (2, Some(1)), (3, Some(3))]);
        let d = descendants(1, &t, |_| Some(0));
        assert_eq!(d, [2]);
    }

    #[test]
    fn parent_must_be_older_than_child() {
        let created = created_in_order(&[1, 2]);
        assert!(started_before(1, 2, &created));
        assert!(!started_before(2, 1, &created));
        assert!(!started_before(1, 99, &created));
    }

    #[test]
    fn pid_zero_is_rejected() {
        assert!(matches!(details(0), Err(AppError::InvalidPid { pid: 0 })));
    }

    #[cfg(windows)]
    #[test]
    fn details_of_own_process_include_path_command_line_and_parent() {
        let d = details(std::process::id()).unwrap();
        let expected = std::env::current_exe().unwrap();
        assert_eq!(d.executable_path.as_deref(), expected.to_str());
        assert!(d.path_error.is_none());
        let cmd = d.command_line.expect("own command line is readable");
        assert!(cmd.to_lowercase().contains("port_manager_lib"), "{cmd}");
        assert!(d.parent.is_some(), "the test runner started this process");
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
