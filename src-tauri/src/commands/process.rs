use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;

use super::run_blocking;
use crate::error::AppError;
use crate::process::{self, ProcessDetails};
use crate::termination::{self, TerminationOutcome};

/// Opens Explorer with the process's executable selected. Takes a PID, not a
/// path, so the frontend can only reveal executables of running processes.
#[tauri::command]
pub async fn reveal_executable(app: AppHandle, pid: u32) -> Result<(), AppError> {
    let path = run_blocking(move || process::executable_path(pid)).await?;
    app.opener()
        .reveal_item_in_dir(&path)
        .map_err(|e| AppError::internal(format!("could not open the folder of {path}: {e}")))
}

#[tauri::command]
pub async fn process_details(pid: u32) -> Result<ProcessDetails, AppError> {
    run_blocking(move || process::details(pid)).await
}

/// Ends a process the user explicitly confirmed in the UI. `expected_name` is
/// the name shown in the confirmation dialog and is re-checked against the PID.
/// `include_children` reflects the dialog's checkbox.
#[tauri::command]
pub async fn terminate_process(
    pid: u32,
    expected_name: String,
    include_children: bool,
) -> Result<TerminationOutcome, AppError> {
    run_blocking(move || termination::terminate(pid, &expected_name, include_children)).await
}
