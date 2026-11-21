//! Notification-area (tray) icon, present only while "keep running when the
//! window is closed" is on. Left click reopens the window; the menu offers
//! Show and Quit.

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager};

use crate::settings::{Language, Settings};
use crate::storage::Database;

const TRAY_ID: &str = "main";
const SHOW_ID: &str = "show";
const QUIT_ID: &str = "quit";

/// The tray menu is native (built here, not in the webview), so its two labels
/// are the only UI text translated on the Rust side.
fn labels(language: Language) -> (&'static str, &'static str) {
    match language {
        Language::En => ("Show Port Manager", "Quit"),
        Language::PtBr => ("Mostrar Port Manager", "Sair"),
    }
}

/// Creates, updates or removes the tray icon to match `settings`.
pub fn sync(app: &AppHandle, settings: &Settings) -> tauri::Result<()> {
    if !settings.close_to_tray {
        app.remove_tray_by_id(TRAY_ID);
        return Ok(());
    }

    let (show, quit) = labels(settings.language);
    let menu = Menu::with_items(
        app,
        &[
            &MenuItem::with_id(app, SHOW_ID, show, true, None::<&str>)?,
            &MenuItem::with_id(app, QUIT_ID, quit, true, None::<&str>)?,
        ],
    )?;

    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        return tray.set_menu(Some(menu));
    }

    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip("Port Manager")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            SHOW_ID => crate::show_main_window(app),
            QUIT_ID => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                crate::show_main_window(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app).map(drop)
}

/// Whether closing the main window should hide it instead of quitting.
pub fn should_hide_on_close(app: &AppHandle) -> bool {
    crate::settings::get(&app.state::<Database>()).is_ok_and(|s| s.close_to_tray)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn menu_labels_exist_for_every_language() {
        for language in [Language::En, Language::PtBr] {
            let (show, quit) = labels(language);
            assert!(!show.is_empty() && !quit.is_empty());
        }
        assert_ne!(labels(Language::En), labels(Language::PtBr));
    }
}
