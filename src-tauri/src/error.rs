use serde::Serialize;

/// Why a process is refused for termination.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ProtectionReason {
    CriticalSystemProcess,
    PortManagerItself,
}

/// Errors returned by Tauri commands.
///
/// Serialized as `{ "kind": "...", ...fields }`. Errors carry data, not
/// sentences: the frontend turns them into text in the user's language.
/// `detail` fields hold raw technical context (OS or SQLite error text) that
/// is shown verbatim.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum AppError {
    Internal {
        detail: String,
    },
    /// Reading the operating system's connection tables failed.
    Network {
        detail: String,
    },
    /// The operation is not implemented for the current operating system.
    #[cfg_attr(any(windows, target_os = "linux"), allow(dead_code))]
    Unsupported {
        detail: String,
    },
    /// Reading or writing the local database failed.
    Storage {
        detail: String,
    },
    /// PID 0 (or another value that can't identify a process).
    InvalidPid {
        pid: u32,
    },
    InvalidPort {
        port: u16,
    },
    /// A settings value outside the allowed set.
    InvalidSetting {
        key: String,
        value: String,
    },
    InvalidProcessName,
    /// The PID now belongs to a different program than the one confirmed.
    ProcessNameMismatch {
        pid: u32,
        expected: String,
        actual: String,
    },
    /// The process does not exist (it may have exited since the last refresh).
    ProcessNotFound {
        pid: u32,
    },
    /// The OS refused access, typically because elevation would be required.
    PermissionDenied {
        pid: u32,
        name: Option<String>,
    },
    /// The process is deliberately off-limits.
    ProtectedProcess {
        name: String,
        reason: ProtectionReason,
    },
}

impl AppError {
    pub fn internal(detail: impl Into<String>) -> Self {
        Self::Internal {
            detail: detail.into(),
        }
    }

    pub fn storage(detail: impl Into<String>) -> Self {
        Self::Storage {
            detail: detail.into(),
        }
    }
}

/// English text for logs and tests; the UI builds its own localized text.
impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Internal { detail } => write!(f, "internal error: {detail}"),
            Self::Network { detail } => write!(f, "network inspection error: {detail}"),
            Self::Unsupported { detail } => write!(f, "unsupported: {detail}"),
            Self::Storage { detail } => write!(f, "database error: {detail}"),
            Self::InvalidPid { pid } => write!(f, "invalid PID {pid}"),
            Self::InvalidPort { port } => write!(f, "invalid port {port}"),
            Self::InvalidSetting { key, value } => write!(f, "invalid value {value} for {key}"),
            Self::InvalidProcessName => write!(f, "invalid process name"),
            Self::ProcessNameMismatch {
                pid,
                expected,
                actual,
            } => write!(f, "PID {pid} is now {actual}, not {expected}"),
            Self::ProcessNotFound { pid } => write!(f, "no process with PID {pid}"),
            Self::PermissionDenied { pid, .. } => write!(f, "access denied to PID {pid}"),
            Self::ProtectedProcess { name, reason } => {
                write!(f, "{name} is protected ({reason:?})")
            }
        }
    }
}

impl std::error::Error for AppError {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_kind_with_camel_case_fields() {
        let json = serde_json::to_value(AppError::ProcessNameMismatch {
            pid: 42,
            expected: "node.exe".into(),
            actual: "hugo.exe".into(),
        })
        .unwrap();
        assert_eq!(
            json,
            serde_json::json!({
                "kind": "processNameMismatch",
                "pid": 42,
                "expected": "node.exe",
                "actual": "hugo.exe"
            })
        );

        let json = serde_json::to_value(AppError::ProtectedProcess {
            name: "csrss.exe".into(),
            reason: ProtectionReason::CriticalSystemProcess,
        })
        .unwrap();
        assert_eq!(json["reason"], "criticalSystemProcess");
        assert_eq!(
            serde_json::to_value(AppError::InvalidProcessName).unwrap(),
            serde_json::json!({ "kind": "invalidProcessName" })
        );
    }
}
