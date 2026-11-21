//! Tauri command handlers. Each submodule exposes a narrowly scoped set of
//! commands; OS-specific logic lives in dedicated modules, never here.

pub mod favorites;
pub mod health;
pub mod ports;
pub mod process;
pub mod settings;

use crate::error::AppError;

/// Runs OS work on Tauri's blocking thread pool so the UI never waits on it.
pub(crate) async fn run_blocking<T: Send + 'static>(
    f: impl FnOnce() -> Result<T, AppError> + Send + 'static,
) -> Result<T, AppError> {
    tauri::async_runtime::spawn_blocking(f)
        .await
        .map_err(|e| AppError::internal(format!("background task failed: {e}")))?
}
