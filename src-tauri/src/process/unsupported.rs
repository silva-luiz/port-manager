//! Placeholder for platforms without an implementation yet (e.g. Linux).

use std::collections::HashMap;

use super::ProcessEntry;
use crate::error::AppError;

fn unsupported() -> AppError {
    AppError::Unsupported {
        detail: "process inspection is only implemented for Windows".into(),
    }
}

pub fn process_table() -> Result<HashMap<u32, ProcessEntry>, AppError> {
    Err(unsupported())
}

pub fn executable_path(_pid: u32) -> Result<String, AppError> {
    Err(unsupported())
}

pub fn command_line(_pid: u32) -> Result<String, AppError> {
    Err(unsupported())
}

pub fn creation_time(_pid: u32) -> Option<u64> {
    None
}
