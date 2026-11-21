//! Placeholder for platforms without an implementation yet (e.g. Linux).

use std::collections::HashMap;

use crate::error::AppError;

fn unsupported() -> AppError {
    AppError::Unsupported("process inspection is only implemented for Windows".into())
}

pub fn process_names() -> Result<HashMap<u32, String>, AppError> {
    Err(unsupported())
}

pub fn executable_path(_pid: u32) -> Result<String, AppError> {
    Err(unsupported())
}
