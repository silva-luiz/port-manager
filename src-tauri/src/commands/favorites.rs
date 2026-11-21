use tauri::State;

use crate::error::AppError;
use crate::favorites::{self, Favorite};
use crate::storage::Database;

#[tauri::command]
pub async fn list_favorites(db: State<'_, Database>) -> Result<Vec<Favorite>, AppError> {
    favorites::list(&db)
}

#[tauri::command]
pub async fn add_favorite(db: State<'_, Database>, port: u16) -> Result<Vec<Favorite>, AppError> {
    favorites::add(&db, port)
}

#[tauri::command]
pub async fn remove_favorite(
    db: State<'_, Database>,
    port: u16,
) -> Result<Vec<Favorite>, AppError> {
    favorites::remove(&db, port)
}
