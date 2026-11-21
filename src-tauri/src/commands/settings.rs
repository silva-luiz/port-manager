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
