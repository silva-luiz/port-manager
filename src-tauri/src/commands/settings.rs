use tauri::{AppHandle, State};

use crate::error::AppError;
use crate::settings::{self, Language, Settings};
use crate::storage::Database;
use crate::tray;

#[tauri::command]
pub async fn get_settings(db: State<'_, Database>) -> Result<Settings, AppError> {
    settings::get(&db)
}

/// `language` is deserialized into the `Language` enum, so anything other
/// than a supported tag is rejected before reaching this function.
#[tauri::command]
pub async fn set_language(
    app: AppHandle,
    db: State<'_, Database>,
    language: Language,
) -> Result<Settings, AppError> {
    let saved = settings::set_language(&db, language)?;
    sync_tray(&app, &saved);
    Ok(saved)
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

#[tauri::command]
pub async fn set_close_to_tray(
    app: AppHandle,
    db: State<'_, Database>,
    enabled: bool,
) -> Result<Settings, AppError> {
    let saved = settings::set_close_to_tray(&db, enabled)?;
    sync_tray(&app, &saved);
    Ok(saved)
}

/// The setting is saved either way; a tray failure only affects the icon.
fn sync_tray(app: &AppHandle, settings: &Settings) {
    if let Err(e) = tray::sync(app, settings) {
        log::warn!("could not update the tray icon: {e}");
    }
}
