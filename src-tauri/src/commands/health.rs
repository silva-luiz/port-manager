use serde::Serialize;

use crate::clock;
use crate::error::AppError;

/// Snapshot returned to the frontend to confirm the backend is reachable.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthStatus {
    pub status: &'static str,
    pub app_version: &'static str,
    pub os: &'static str,
    pub arch: &'static str,
    /// Milliseconds since the Unix epoch, as observed by the backend.
    pub timestamp_ms: u64,
}

#[tauri::command]
pub fn health_check() -> Result<HealthStatus, AppError> {
    Ok(HealthStatus {
        status: "ok",
        app_version: env!("CARGO_PKG_VERSION"),
        os: std::env::consts::OS,
        arch: std::env::consts::ARCH,
        timestamp_ms: clock::now_ms()?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn health_check_reports_ok() {
        let health = health_check().expect("health check should succeed");
        assert_eq!(health.status, "ok");
        assert_eq!(health.app_version, env!("CARGO_PKG_VERSION"));
        assert!(!health.os.is_empty());
        assert!(health.timestamp_ms > 0);
    }

    #[test]
    fn health_status_serializes_as_camel_case() {
        let json = serde_json::to_value(health_check().unwrap()).unwrap();
        assert!(json.get("appVersion").is_some());
        assert!(json.get("timestampMs").is_some());
    }
}
