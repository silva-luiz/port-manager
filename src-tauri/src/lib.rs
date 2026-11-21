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
mod watcher;

use tauri::Manager;
use tauri_plugin_window_state::StateFlags;

const DATABASE_FILE: &str = "port-manager.db";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Remembers size, position and maximized state across launches. The
        // plugin skips the saved position if that monitor is no longer present.
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(StateFlags::SIZE | StateFlags::POSITION | StateFlags::MAXIMIZED)
                .build(),
        )
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            app.manage(storage::Database::open(&dir.join(DATABASE_FILE))?);
            watcher::spawn(app.handle().clone())?;
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
            commands::settings::set_auto_refresh,
            commands::settings::set_favorite_alerts,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
