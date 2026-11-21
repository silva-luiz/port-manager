//! Application settings, stored as key/value rows in SQLite and exposed as a
//! typed struct. Unknown or missing values fall back to defaults.

use rusqlite::{OptionalExtension, params};
use serde::{Deserialize, Serialize};

use crate::error::AppError;
use crate::storage::Database;

const LANGUAGE_KEY: &str = "language";

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
}

pub fn get(db: &Database) -> Result<Settings, AppError> {
    let stored: Option<String> = db.with(|conn| {
        conn.query_row(
            "SELECT value FROM settings WHERE key = ?1",
            params![LANGUAGE_KEY],
            |row| row.get(0),
        )
        .optional()
    })?;

    Ok(Settings {
        language: stored
            .as_deref()
            .and_then(Language::from_code)
            .unwrap_or_default(),
    })
}

pub fn set_language(db: &Database, language: Language) -> Result<Settings, AppError> {
    db.with(|conn| {
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)
             ON CONFLICT (key) DO UPDATE SET value = excluded.value",
            params![LANGUAGE_KEY, language.code()],
        )
    })?;
    get(db)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_to_english_and_persists_changes() {
        let db = Database::open_in_memory().unwrap();
        assert_eq!(get(&db).unwrap().language, Language::En);

        assert_eq!(
            set_language(&db, Language::PtBr).unwrap().language,
            Language::PtBr
        );
        assert_eq!(get(&db).unwrap().language, Language::PtBr);

        set_language(&db, Language::En).unwrap();
        assert_eq!(get(&db).unwrap().language, Language::En);
    }

    #[test]
    fn unknown_stored_value_falls_back_to_default() {
        let db = Database::open_in_memory().unwrap();
        db.with(|c| c.execute("INSERT INTO settings VALUES ('language', 'xx')", []))
            .unwrap();
        assert_eq!(get(&db).unwrap().language, Language::En);
    }

    #[test]
    fn language_uses_bcp47_tags_on_the_wire() {
        assert_eq!(
            serde_json::to_value(Language::PtBr).unwrap(),
            serde_json::json!("pt-BR")
        );
        let parsed: Language = serde_json::from_str("\"en\"").unwrap();
        assert_eq!(parsed, Language::En);
        assert!(serde_json::from_str::<Language>("\"fr\"").is_err());
    }
}
