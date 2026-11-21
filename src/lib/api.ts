import { invoke } from "@tauri-apps/api/core";
import type { AppError } from "../types/error";
import type { Favorite } from "../types/favorites";
import type { HealthStatus } from "../types/health";
import type { PortSnapshot } from "../types/ports";
import type { ProcessDetails, TerminationOutcome } from "../types/process";

/**
 * The only place the frontend talks to Rust. Each wrapper maps one Tauri
 * command to a typed function so components never call `invoke` directly.
 */
export const api = {
  healthCheck: () => invoke<HealthStatus>("health_check"),
  listPorts: () => invoke<PortSnapshot>("list_ports"),
  processDetails: (pid: number) => invoke<ProcessDetails>("process_details", { pid }),
  /** Only call after the user confirmed in the UI; the backend re-validates the name. */
  terminateProcess: (pid: number, expectedName: string) =>
    invoke<TerminationOutcome>("terminate_process", { pid, expectedName }),
  listFavorites: () => invoke<Favorite[]>("list_favorites"),
  addFavorite: (port: number) => invoke<Favorite[]>("add_favorite", { port }),
  removeFavorite: (port: number) => invoke<Favorite[]>("remove_favorite", { port }),
};

function isAppError(value: unknown): value is AppError {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    "message" in value &&
    typeof (value as AppError).message === "string"
  );
}

/** Normalizes anything thrown by `invoke` into a readable message. */
export function errorMessage(error: unknown): string {
  if (isAppError(error)) return error.message;
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown error";
}
