use std::time::{SystemTime, UNIX_EPOCH};

use crate::error::AppError;

/// Current wall-clock time in milliseconds since the Unix epoch.
pub fn now_ms() -> Result<u64, AppError> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .map_err(|e| AppError::internal(format!("system clock is before Unix epoch: {e}")))
}
