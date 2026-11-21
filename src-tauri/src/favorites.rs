//! Favorite ports, persisted in SQLite.

use rusqlite::params;
use serde::Serialize;

use crate::clock;
use crate::error::AppError;
use crate::storage::Database;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Favorite {
    pub port: u16,
    /// Milliseconds since the Unix epoch (SQLite stores integers as i64).
    pub created_at_ms: i64,
}

pub fn list(db: &Database) -> Result<Vec<Favorite>, AppError> {
    db.with(|conn| {
        let mut stmt = conn.prepare("SELECT port, created_at_ms FROM favorites ORDER BY port")?;
        stmt.query_map([], |row| {
            Ok(Favorite {
                port: row.get(0)?,
                created_at_ms: row.get(1)?,
            })
        })?
        .collect()
    })
}

/// Adds `port`; adding an existing favorite is a no-op. Returns the updated list.
pub fn add(db: &Database, port: u16) -> Result<Vec<Favorite>, AppError> {
    validate_port(port)?;
    let now = clock::now_ms()?;
    db.with(|conn| {
        conn.execute(
            "INSERT OR IGNORE INTO favorites (port, created_at_ms) VALUES (?1, ?2)",
            params![port, now as i64],
        )
    })?;
    list(db)
}

/// Removes `port`; removing a non-favorite is a no-op. Returns the updated list.
pub fn remove(db: &Database, port: u16) -> Result<Vec<Favorite>, AppError> {
    validate_port(port)?;
    db.with(|conn| conn.execute("DELETE FROM favorites WHERE port = ?1", params![port]))?;
    list(db)
}

/// Port 0 means "any port" to the OS and can't be a meaningful favorite.
fn validate_port(port: u16) -> Result<(), AppError> {
    if port == 0 {
        return Err(AppError::InvalidInput(
            "Port must be between 1 and 65535.".into(),
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ports(favorites: &[Favorite]) -> Vec<u16> {
        favorites.iter().map(|f| f.port).collect()
    }

    #[test]
    fn add_list_and_remove() {
        let db = Database::open_in_memory().unwrap();
        assert!(list(&db).unwrap().is_empty());

        add(&db, 3000).unwrap();
        let after = add(&db, 1313).unwrap();
        assert_eq!(ports(&after), [1313, 3000], "sorted by port");

        assert_eq!(ports(&remove(&db, 3000).unwrap()), [1313]);
    }

    #[test]
    fn duplicates_and_missing_ports_are_no_ops() {
        let db = Database::open_in_memory().unwrap();
        let first = add(&db, 8080).unwrap();
        let again = add(&db, 8080).unwrap();
        assert_eq!(first, again, "re-adding keeps the original timestamp");
        assert_eq!(ports(&remove(&db, 9999).unwrap()), [8080]);
    }

    #[test]
    fn port_zero_is_rejected() {
        let db = Database::open_in_memory().unwrap();
        assert!(matches!(add(&db, 0), Err(AppError::InvalidInput(_))));
        assert!(matches!(remove(&db, 0), Err(AppError::InvalidInput(_))));
        assert!(list(&db).unwrap().is_empty());
    }
}
