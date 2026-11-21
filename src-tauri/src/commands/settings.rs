use tauri::State;

use crate::error::AppError;
use crate::settings::{self, Language, Settings};
use crate::storage::Database;

#[tauri::command]
pub async fn get_settings(db: State<'_, Database>) -> Result<Settings, AppError> {
    settings::get(&db)
}

/// `language` is deserialized into the `Language` enum, so anything other
/// than a supported tag is rejected before reaching this function.
#[tauri::command]
pub async fn set_language(
    db: State<'_, Database>,
    language: Language,
) -> Result<Settings, AppError> {
    settings::set_language(&db, language)
}

/// `seconds` must be one of `Settings::auto_refresh_options`; 0 turns it off.
#[tauri::command]
pub async fn set_auto_refresh(db: State<'_, Database>, seconds: u32) -> Result<Settings, AppError> {
    settings::set_auto_refresh(&db, seconds)
}

#[tauri::command]
pub async fn set_favorite_alerts(
    db: State<'_, Database>,
    enabled: bool,
) -> Result<Settings, AppError> {
    settings::set_favorite_alerts(&db, enabled)
}
