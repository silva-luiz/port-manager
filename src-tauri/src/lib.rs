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

use tauri::{AppHandle, Manager};
use tauri_plugin_log::{RotationStrategy, Target, TargetKind};
use tauri_plugin_window_state::StateFlags;

const DATABASE_FILE: &str = "port-manager.db";
const MAIN_WINDOW: &str = "main";
/// Per log file; the 3 most recent files are kept.
const MAX_LOG_BYTES: u128 = 1024 * 1024;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Must be registered first. A second launch only brings the running
        // window forward, so there is one favorite watcher and one window state.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_main_window(app);
        }))
        // Remembers size, position and maximized state across launches. The
        // plugin skips the saved position if that monitor is no longer present.
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(StateFlags::SIZE | StateFlags::POSITION | StateFlags::MAXIMIZED)
                .build(),
        )
        .plugin(tauri_plugin_notification::init())
        .plugin(logger())
        .setup(|app| {
            log::info!("Port Manager {} starting", env!("CARGO_PKG_VERSION"));
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

/// Restores, shows and focuses the main window (it may be minimized or hidden).
pub(crate) fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// Rotating log file in the app's log folder (%LOCALAPPDATA%\<identifier>\logs),
/// plus the terminal in debug builds.
fn logger() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    let mut builder = tauri_plugin_log::Builder::new()
        .clear_targets()
        .target(Target::new(TargetKind::LogDir { file_name: None }))
        .level(log::LevelFilter::Info)
        .max_file_size(MAX_LOG_BYTES)
        .rotation_strategy(RotationStrategy::KeepSome(3));
    if cfg!(debug_assertions) {
        builder = builder.target(Target::new(TargetKind::Stdout));
    }
    builder.build()
}
