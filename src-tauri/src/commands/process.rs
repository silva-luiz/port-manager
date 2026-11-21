use super::run_blocking;
use crate::error::AppError;
use crate::process::{self, ProcessDetails};
use crate::termination::{self, TerminationOutcome};

#[tauri::command]
pub async fn process_details(pid: u32) -> Result<ProcessDetails, AppError> {
    run_blocking(move || process::details(pid)).await
}

/// Ends a process the user explicitly confirmed in the UI. `expected_name` is
/// the name shown in the confirmation dialog and is re-checked against the PID.
#[tauri::command]
pub async fn terminate_process(
    pid: u32,
    expected_name: String,
) -> Result<TerminationOutcome, AppError> {
    run_blocking(move || termination::terminate(pid, &expected_name)).await
}
