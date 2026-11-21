import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { AppError, AppErrorKind } from "../types/error";
import type { Favorite, FavoritePortChange } from "../types/favorites";
import type { HealthStatus } from "../types/health";
import type { PortSnapshot } from "../types/ports";
import type { ProcessDetails, TerminationOutcome } from "../types/process";
import type { Locale, Settings } from "../types/settings";

/**
 * The only place the frontend talks to Rust. Each wrapper maps one Tauri
 * command to a typed function so components never call `invoke` directly.
 */
export const api = {
  healthCheck: () => invoke<HealthStatus>("health_check"),
  listPorts: () => invoke<PortSnapshot>("list_ports"),
  processDetails: (pid: number) => invoke<ProcessDetails>("process_details", { pid }),
  /** Only call after the user confirmed in the UI; the backend re-validates the name. */
  terminateProcess: (pid: number, expectedName: string, includeChildren: boolean) =>
    invoke<TerminationOutcome>("terminate_process", { pid, expectedName, includeChildren }),
  listFavorites: () => invoke<Favorite[]>("list_favorites"),
  addFavorite: (port: number) => invoke<Favorite[]>("add_favorite", { port }),
  removeFavorite: (port: number) => invoke<Favorite[]>("remove_favorite", { port }),
  getSettings: () => invoke<Settings>("get_settings"),
  setLanguage: (language: Locale) => invoke<Settings>("set_language", { language }),
  setAutoRefresh: (seconds: number) => invoke<Settings>("set_auto_refresh", { seconds }),
  setFavoriteAlerts: (enabled: boolean) => invoke<Settings>("set_favorite_alerts", { enabled }),
  /** Emitted by the backend watcher (src-tauri/src/watcher.rs) while alerts are on. */
  onFavoritePortChange: (handler: (change: FavoritePortChange) => void): Promise<UnlistenFn> =>
    listen<FavoritePortChange>("favorite-port-changed", (event) => handler(event.payload)),
};

const KNOWN_KINDS = new Set<AppErrorKind>([
  "internal",
  "network",
  "unsupported",
  "storage",
  "invalidPid",
  "invalidPort",
  "invalidSetting",
  "invalidProcessName",
  "processNameMismatch",
  "processNotFound",
  "permissionDenied",
  "protectedProcess",
]);

/**
 * Normalizes anything thrown by `invoke` into an `AppError`. Tauri itself can
 * reject with plain strings (e.g. argument deserialization failures); those
 * become `internal` errors carrying the original text.
 */
export function toAppError(error: unknown): AppError {
  if (
    typeof error === "object" &&
    error !== null &&
    "kind" in error &&
    KNOWN_KINDS.has((error as { kind: AppErrorKind }).kind)
  ) {
    return error as AppError;
  }
  if (error instanceof Error) return { kind: "internal", detail: error.message };
  return { kind: "internal", detail: typeof error === "string" ? error : "unknown error" };
}
