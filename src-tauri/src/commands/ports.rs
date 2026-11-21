use crate::error::AppError;
use crate::ports::{self, PortSnapshot};

/// Scans the OS TCP tables. Runs on a blocking thread so the UI stays responsive.
#[tauri::command]
pub async fn list_ports() -> Result<PortSnapshot, AppError> {
    tauri::async_runtime::spawn_blocking(ports::snapshot)
        .await
        .map_err(|e| AppError::internal(format!("port scan task failed: {e}")))?
}
