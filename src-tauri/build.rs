/// Every command registered in `generate_handler!` (src/lib.rs). Declaring them
/// here makes each one require an explicit `allow-<command>` permission in
/// capabilities/default.json, so a command that isn't granted is denied.
const COMMANDS: &[&str] = &[
    "health_check",
    "list_ports",
    "process_details",
    "terminate_process",
    "reveal_executable",
    "list_favorites",
    "add_favorite",
    "remove_favorite",
    "get_settings",
    "set_language",
    "set_auto_refresh",
    "set_favorite_alerts",
    "set_close_to_tray",
];

fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new()
            .app_manifest(tauri_build::AppManifest::new().commands(COMMANDS)),
    )
    .expect("failed to run tauri-build");
}
