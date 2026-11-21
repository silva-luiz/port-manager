mod clock;
mod commands;
mod error;
mod favorites;
mod network;
mod ports;
mod process;
mod settings;
mod storage;
mod termination;

use tauri::Manager;

const DATABASE_FILE: &str = "port-manager.db";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            app.manage(storage::Database::open(&dir.join(DATABASE_FILE))?);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::health::health_check,
            commands::ports::list_ports,
            commands::process::process_details,
            commands::process::terminate_process,
            commands::favorites::list_favorites,
            commands::favorites::add_favorite,
            commands::favorites::remove_favorite,
            commands::settings::get_settings,
            commands::settings::set_language,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
