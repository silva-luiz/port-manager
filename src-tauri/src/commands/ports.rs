use super::run_blocking;
use crate::error::AppError;
use crate::ports::{self, PortSnapshot};

/// Scans the OS TCP tables.
#[tauri::command]
pub async fn list_ports() -> Result<PortSnapshot, AppError> {
    run_blocking(ports::snapshot).await
}
