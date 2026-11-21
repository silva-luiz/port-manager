import type { AppError } from "./error";

/** Mirrors `ProcessDetails` in src-tauri/src/process/mod.rs. */
export interface ProcessDetails {
  pid: number;
  name: string;
  executablePath: string | null;
  /** Why `executablePath` is missing (usually `permissionDenied`). */
  pathError: AppError | null;
}

/** Mirrors `TerminationOutcome` in src-tauri/src/termination/mod.rs. */
export interface TerminationOutcome {
  pid: number;
  name: string;
  exited: boolean;
}
