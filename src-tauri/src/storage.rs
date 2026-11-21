//! Local SQLite persistence. A single connection behind a mutex is enough:
//! the app is single-user and every query is tiny.

use rusqlite::Connection;
use std::path::Path;
use std::sync::Mutex;

use crate::error::AppError;

/// Schema migrations, applied in order. `PRAGMA user_version` records how many
/// have run. Append new entries; never edit or reorder existing ones.
const MIGRATIONS: &[&str] = &[
    "CREATE TABLE favorites (
        port          INTEGER PRIMARY KEY CHECK (port BETWEEN 1 AND 65535),
        created_at_ms INTEGER NOT NULL
    ) STRICT;",
    "CREATE TABLE settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
    ) STRICT;",
];

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub fn open(path: &Path) -> Result<Self, AppError> {
        let conn = Connection::open(path)
            .map_err(|e| AppError::storage(format!("could not open {}: {e}", path.display())))?;
        Self::init(conn)
    }

    #[cfg(test)]
    pub fn open_in_memory() -> Result<Self, AppError> {
        Self::init(Connection::open_in_memory().map_err(storage_error)?)
    }

    fn init(mut conn: Connection) -> Result<Self, AppError> {
        migrate(&mut conn).map_err(storage_error)?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    /// Runs `f` with exclusive access to the connection.
    pub fn with<T>(
        &self,
        f: impl FnOnce(&Connection) -> rusqlite::Result<T>,
    ) -> Result<T, AppError> {
        let conn = self.conn.lock().map_err(|_| {
            AppError::storage("the database lock was poisoned by an earlier failure")
        })?;
        f(&conn).map_err(|e| {
            log::error!("database error: {e}");
            storage_error(e)
        })
    }
}

fn migrate(conn: &mut Connection) -> rusqlite::Result<()> {
    let applied: i64 = conn.pragma_query_value(None, "user_version", |row| row.get(0))?;
    for (index, sql) in MIGRATIONS.iter().enumerate().skip(applied.max(0) as usize) {
        let tx = conn.transaction()?;
        tx.execute_batch(sql)?;
        tx.pragma_update(None, "user_version", index as i64 + 1)?;
        tx.commit()?;
    }
    Ok(())
}

fn storage_error(e: rusqlite::Error) -> AppError {
    AppError::storage(e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migrations_are_applied_once_and_survive_reopening() {
        let dir = std::env::temp_dir().join(format!("port-manager-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("migrate.db");
        let _ = std::fs::remove_file(&path);

        let version = |db: &Database| {
            db.with(|c| c.pragma_query_value(None, "user_version", |r| r.get::<_, i64>(0)))
                .unwrap()
        };

        let db = Database::open(&path).unwrap();
        assert_eq!(version(&db), MIGRATIONS.len() as i64);
        db.with(|c| c.execute("INSERT INTO favorites VALUES (1313, 0)", []))
            .unwrap();
        drop(db);

        let reopened = Database::open(&path).unwrap();
        assert_eq!(version(&reopened), MIGRATIONS.len() as i64);
        let count: i64 = reopened
            .with(|c| c.query_row("SELECT COUNT(*) FROM favorites", [], |r| r.get(0)))
            .unwrap();
        assert_eq!(count, 1, "data must persist across reopen");

        drop(reopened);
        let _ = std::fs::remove_dir_all(&dir);
    }
}
