/** Mirrors `HealthStatus` in src-tauri/src/commands/health.rs. */
export interface HealthStatus {
  status: "ok";
  appVersion: string;
  os: string;
  arch: string;
  timestampMs: number;
}
