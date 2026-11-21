use serde::Serialize;

/// Errors returned by Tauri commands. Serialized as `{ kind, message }` so the
/// frontend can branch on `kind` without parsing message strings. Messages are
/// written to be shown to the user as-is.
#[derive(Debug, Serialize)]
#[serde(tag = "kind", content = "message", rename_all = "camelCase")]
pub enum AppError {
    Internal(String),
    /// Reading the operating system's connection tables failed.
    Network(String),
    /// The operation is not implemented for the current operating system.
    #[cfg_attr(windows, allow(dead_code))]
    Unsupported(String),
    /// A value received from the frontend failed validation.
    InvalidInput(String),
    /// The process does not exist (it may have exited since the last refresh).
    ProcessNotFound(String),
    /// The OS refused access, typically because elevation would be required.
    PermissionDenied(String),
    /// The process is deliberately off-limits (system-critical or this app).
    ProtectedProcess(String),
    /// Reading or writing the local database failed.
    Storage(String),
}

impl AppError {
    pub fn message(&self) -> &str {
        match self {
            AppError::Internal(m)
            | AppError::Network(m)
            | AppError::Unsupported(m)
            | AppError::InvalidInput(m)
            | AppError::ProcessNotFound(m)
            | AppError::PermissionDenied(m)
            | AppError::ProtectedProcess(m)
            | AppError::Storage(m) => m,
        }
    }
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.message())
    }
}

impl std::error::Error for AppError {}
