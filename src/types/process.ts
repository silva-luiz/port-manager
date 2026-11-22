import type { AppError } from "./error";

/** Mirrors `ProcessDetails` in src-tauri/src/process/mod.rs. */
export interface ProcessDetails {
  pid: number;
  name: string;
  executablePath: string | null;
  /** Why `executablePath` is missing (usually `permissionDenied`). */
  pathError: AppError | null;
  commandLine: string | null;
  /** The process that started this one, if still running. */
  parent: ProcessRef | null;
  /** Main process of the application when this is one of its helpers; null if this is the main one. */
  mainProcess: ProcessRef | null;
  /** Processes started by this one, directly or indirectly, parents first. */
  descendants: ProcessRef[];
}

/** Mirrors `ProcessRef` in src-tauri/src/process/mod.rs. */
export interface ProcessRef {
  pid: number;
  name: string;
}

/** Mirrors `ChildOutcome` in src-tauri/src/termination/mod.rs. */
export interface ChildOutcome {
  pid: number;
  name: string;
  /** null when the child was ended. */
  error: AppError | null;
}

/** Mirrors `TerminationOutcome` in src-tauri/src/termination/mod.rs. */
export interface TerminationOutcome {
  pid: number;
  name: string;
  exited: boolean;
  children: ChildOutcome[];
}
