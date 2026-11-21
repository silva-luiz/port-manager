//! Application settings, stored as key/value rows in SQLite and exposed as a
//! typed struct. Unknown or missing values fall back to defaults.

use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::error::AppError;
use crate::storage::Database;

const LANGUAGE_KEY: &str = "language";
const AUTO_REFRESH_KEY: &str = "auto_refresh_seconds";
const FAVORITE_ALERTS_KEY: &str = "favorite_alerts";
const CLOSE_TO_TRAY_KEY: &str = "close_to_tray";

/// Allowed automatic refresh intervals in seconds; 0 means off (the default).
pub const AUTO_REFRESH_OPTIONS: &[u32] = &[0, 2, 5, 10, 30];

/// UI language. Serialized as a BCP 47 tag, matching the frontend locales.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
pub enum Language {
    #[default]
    #[serde(rename = "en")]
    En,
    #[serde(rename = "pt-BR")]
    PtBr,
}

impl Language {
    fn code(self) -> &'static str {
        match self {
            Language::En => "en",
            Language::PtBr => "pt-BR",
        }
    }

    fn from_code(code: &str) -> Option<Self> {
        match code {
            "en" => Some(Language::En),
            "pt-BR" => Some(Language::PtBr),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub language: Language,
    pub auto_refresh_seconds: u32,
    /// The values `auto_refresh_seconds` may take, so the UI doesn't hard-code them.
    pub auto_refresh_options: &'static [u32],
    /// Notify when a favorite port becomes busy or free. Off by default.
    pub favorite_alerts: bool,
    /// Closing the window hides it to the notification area. Off by default.
    pub close_to_tray: bool,
}

pub fn get(db: &Database) -> Result<Settings, AppError> {
    let stored: HashMap<String, String> = db.with(|conn| {
        let mut stmt = conn.prepare("SELECT key, value FROM settings")?;
        stmt.query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?
            .collect()
    })?;

    Ok(Settings {
        language: stored
            .get(LANGUAGE_KEY)
            .and_then(|v| Language::from_code(v))
            .unwrap_or_default(),
        auto_refresh_seconds: stored
            .get(AUTO_REFRESH_KEY)
            .and_then(|v| v.parse().ok())
            .filter(|s| AUTO_REFRESH_OPTIONS.contains(s))
            .unwrap_or(0),
        auto_refresh_options: AUTO_REFRESH_OPTIONS,
        favorite_alerts: stored.get(FAVORITE_ALERTS_KEY).is_some_and(|v| v == "true"),
        close_to_tray: stored.get(CLOSE_TO_TRAY_KEY).is_some_and(|v| v == "true"),
    })
}

pub fn set_language(db: &Database, language: Language) -> Result<Settings, AppError> {
    put(db, LANGUAGE_KEY, language.code())?;
    get(db)
}

pub fn set_auto_refresh(db: &Database, seconds: u32) -> Result<Settings, AppError> {
    if !AUTO_REFRESH_OPTIONS.contains(&seconds) {
        return Err(AppError::InvalidSetting {
            key: AUTO_REFRESH_KEY.into(),
            value: seconds.to_string(),
        });
    }
    put(db, AUTO_REFRESH_KEY, &seconds.to_string())?;
    get(db)
}

pub fn set_favorite_alerts(db: &Database, enabled: bool) -> Result<Settings, AppError> {
    put(db, FAVORITE_ALERTS_KEY, bool_value(enabled))?;
    get(db)
}

pub fn set_close_to_tray(db: &Database, enabled: bool) -> Result<Settings, AppError> {
    put(db, CLOSE_TO_TRAY_KEY, bool_value(enabled))?;
    get(db)
}

fn bool_value(enabled: bool) -> &'static str {
    if enabled { "true" } else { "false" }
}

fn put(db: &Database, key: &str, value: &str) -> Result<(), AppError> {
    db.with(|conn| {
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)
             ON CONFLICT (key) DO UPDATE SET value = excluded.value",
            params![key, value],
        )
    })
    .map(drop)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_to_english_and_no_auto_refresh() {
        let db = Database::open_in_memory().unwrap();
        let s = get(&db).unwrap();
        assert_eq!(s.language, Language::En);
        assert_eq!(s.auto_refresh_seconds, 0);
        assert_eq!(s.auto_refresh_options, AUTO_REFRESH_OPTIONS);
        assert!(!s.favorite_alerts);
        assert!(!s.close_to_tray);
    }

    #[test]
    fn persists_favorite_alerts() {
        let db = Database::open_in_memory().unwrap();
        assert!(set_favorite_alerts(&db, true).unwrap().favorite_alerts);
        assert!(get(&db).unwrap().favorite_alerts);
        assert!(!set_favorite_alerts(&db, false).unwrap().favorite_alerts);
    }

    #[test]
    fn persists_close_to_tray_independently() {
        let db = Database::open_in_memory().unwrap();
        let s = set_close_to_tray(&db, true).unwrap();
        assert!(s.close_to_tray);
        assert!(!s.favorite_alerts);
        assert!(get(&db).unwrap().close_to_tray);
    }

    #[test]
    fn persists_language_changes() {
        let db = Database::open_in_memory().unwrap();
        assert_eq!(
            set_language(&db, Language::PtBr).unwrap().language,
            Language::PtBr
        );
        assert_eq!(get(&db).unwrap().language, Language::PtBr);
        set_language(&db, Language::En).unwrap();
        assert_eq!(get(&db).unwrap().language, Language::En);
    }

    #[test]
    fn persists_allowed_auto_refresh_and_rejects_others() {
        let db = Database::open_in_memory().unwrap();
        assert_eq!(set_auto_refresh(&db, 5).unwrap().auto_refresh_seconds, 5);
        assert!(matches!(
            set_auto_refresh(&db, 7),
            Err(AppError::InvalidSetting { .. })
        ));
        assert_eq!(get(&db).unwrap().auto_refresh_seconds, 5, "unchanged");
        // Settings are independent of each other.
        set_language(&db, Language::PtBr).unwrap();
        assert_eq!(get(&db).unwrap().auto_refresh_seconds, 5);
    }

    #[test]
    fn unknown_stored_values_fall_back_to_defaults() {
        let db = Database::open_in_memory().unwrap();
        db.with(|c| {
            c.execute_batch(
                "INSERT INTO settings VALUES ('language', 'xx');
                 INSERT INTO settings VALUES ('auto_refresh_seconds', '7');",
            )
        })
        .unwrap();
        let s = get(&db).unwrap();
        assert_eq!(s.language, Language::En);
        assert_eq!(s.auto_refresh_seconds, 0);
    }

    #[test]
    fn serializes_for_the_frontend() {
        let db = Database::open_in_memory().unwrap();
        let json = serde_json::to_value(set_auto_refresh(&db, 10).unwrap()).unwrap();
        assert_eq!(
            json,
            serde_json::json!({
                "language": "en",
                "autoRefreshSeconds": 10,
                "autoRefreshOptions": [0, 2, 5, 10, 30],
                "favoriteAlerts": false,
                "closeToTray": false
            })
        );
        let parsed: Language = serde_json::from_str("\"pt-BR\"").unwrap();
        assert_eq!(parsed, Language::PtBr);
        assert!(serde_json::from_str::<Language>("\"fr\"").is_err());
    }
}
